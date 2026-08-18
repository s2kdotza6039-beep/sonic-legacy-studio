import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resumable (tus) upload to Cloud storage with automatic retries.
 * Large videos survive flaky connections and resume instead of restarting.
 */

const CHUNK_SIZE = 6 * 1024 * 1024; // Storage requires exactly 6MB chunks.

export type UploadOptions = {
  bucket: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  onProgress?: (percent: number) => void;
  onRetry?: (attempt: number, message: string) => void;
};

export const resumableUpload = async ({
  bucket,
  path,
  file,
  contentType,
  onProgress,
  onRetry,
}: UploadOptions): Promise<void> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Your session expired — sign in again to upload.");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
      // Same fingerprint for the same file+path so an interrupted upload resumes.
      storeFingerprintForResuming: true,
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 6000, 12000],
      headers: {
        authorization: `Bearer ${token}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      chunkSize: CHUNK_SIZE,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: contentType || (file as File).type || "application/octet-stream",
        cacheControl: "3600",
      },
      onShouldRetry: (err, attempt) => {
        const status = (err as tus.DetailedError)?.originalResponse?.getStatus?.() ?? 0;
        // Auth/permission/too-large errors will never succeed on retry.
        if ([400, 401, 403, 413, 415].includes(status)) return false;
        onRetry?.(attempt + 1, `Connection hiccup — retrying (attempt ${attempt + 2})`);
        return attempt < 4;
      },
      onProgress: (sent, total) => onProgress?.(total ? (sent / total) * 100 : 0),
      onError: (error) => {
        const status = (error as tus.DetailedError)?.originalResponse?.getStatus?.() ?? 0;
        if (status === 413) return reject(new Error("That file is too large for storage."));
        if (status === 415) return reject(new Error("That media type isn't supported."));
        if (status === 401 || status === 403)
          return reject(new Error("You don't have permission to upload this file."));
        reject(new Error(error.message || "Upload failed after several retries."));
      },
      onSuccess: () => resolve(),
    });

    // Resume a previous partial upload of the same file when one exists.
    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
};
