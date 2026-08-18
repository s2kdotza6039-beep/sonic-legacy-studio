/** Client-side thumbnail generation so the Fan Zone feed loads light images, not full media. */

const THUMB_MAX = 480;
const THUMB_QUALITY = 0.72;

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode thumbnail"))),
      "image/jpeg",
      THUMB_QUALITY,
    ),
  );

const drawScaled = (source: CanvasImageSource, w: number, h: number) => {
  const scale = Math.min(1, THUMB_MAX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/** Downscaled JPEG preview of an uploaded image. */
export const imageThumbnail = async (file: File): Promise<Blob> => {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read the image"));
      el.src = url;
    });
    return await canvasToBlob(drawScaled(img, img.naturalWidth, img.naturalHeight));
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** First readable frame of an uploaded video, used as the feed poster. */
export const videoThumbnail = async (file: File): Promise<Blob> => {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error("Could not read the video"));
      video.onloadeddata = () => resolve();
      video.onerror = fail;
      setTimeout(fail, 15000);
    });
    // Nudge past frame 0 — many encodes start on a black frame.
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      setTimeout(resolve, 4000);
    });
    return await canvasToBlob(drawScaled(video, video.videoWidth, video.videoHeight));
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
  }
};

export const makeThumbnail = (file: File): Promise<Blob> =>
  file.type.startsWith("video/") ? videoThumbnail(file) : imageThumbnail(file);
