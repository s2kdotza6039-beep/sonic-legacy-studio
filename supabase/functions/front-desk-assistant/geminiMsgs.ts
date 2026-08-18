// Pure, dependency-free helpers for converting chat messages (with attachments)
// into the multimodal message shape the Gemini gateway expects.
// Kept separate from index.ts so it can be unit-tested without Deno/network.

export type AttachDetected =
  | "image"
  | "audio"
  | "pdf"
  | "xlsx"
  | "csv"
  | "doc"
  | "text"
  | "unknown";

export type AttachDebug = {
  name: string;
  mime: string;
  detected: AttachDetected;
  bytes?: number;
  text_chars?: number;
  /** Parse/extract time in ms (documents only). */
  parse_ms?: number;
  status: "ok" | "skipped" | "error";
  error?: string;
};

export type DocFile = { name: string; mime?: string; base64: string };

export const detectKind = (name: string, mime: string): AttachDetected => {
  const n = (name || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".csv") || m.includes("csv")) return "csv";
  if (m.includes("sheet") || m.includes("excel") || /\.(xlsx|xls)$/.test(n)) return "xlsx";
  if (m.includes("word") || /\.(docx|doc)$/.test(n)) return "doc";
  if (m.startsWith("text/") || /\.(txt|md|json|log|ya?ml|xml|tsx?|jsx?|html)$/.test(n)) return "text";
  return "unknown";
};

export const audioFormat = (mime: string) => {
  const m = (mime || "").toLowerCase();
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("flac")) return "flac";
  if (m.includes("aac")) return "aac";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("x-m4a")) return "m4a";
  return "mp3";
};

export const MAX_DOC_CHARS = 15000;
export const MAX_IMAGES = 4;
export const MAX_AUDIO = 1;
export const MAX_DOCS = 3;

export type BuildDeps = {
  /** Extract plain text from a document. May push into `errors` for failures. */
  extractDoc: (f: DocFile) => Promise<string>;
  errors: string[];
  debug: AttachDebug[];
  parts: { role: string; parts: string[] }[];
};

/**
 * Convert chat messages into gateway-ready messages.
 * Tool-protocol messages pass through untouched (flattening drops tool_calls
 * and the gateway rejects the request with a 400).
 */
export const buildGeminiMsgs = async (msgs: any[], deps: BuildDeps) => {
  const { extractDoc, errors, debug, parts: partsLog } = deps;
  const out: any[] = [];

  for (const m of msgs || []) {
    if (m?.role === "tool" || m?.tool_calls || m?.tool_call_id) {
      out.push(m);
      continue;
    }
    const hasMedia = m?.role === "user" && (m.images?.length || m.audio?.length || m.files?.length);
    if (!hasMedia) {
      out.push({
        role: m.role,
        content: Array.isArray(m.content)
          ? m.content
          : typeof m.content === "string"
            ? m.content
            : String(m.content ?? ""),
      });
      continue;
    }

    const parts: any[] = [];
    if (m.content) parts.push({ type: "text", text: m.content });

    for (const url of (m.images || []).slice(0, MAX_IMAGES)) {
      if (typeof url !== "string" || !/^(data:image\/|https?:\/\/)/.test(url)) {
        errors.push("image: unsupported source, skipped");
        debug.push({ name: "image", mime: "image/*", detected: "image", status: "skipped", error: "unsupported source" });
        continue;
      }
      const mime = /^data:([^;]+);/.exec(url)?.[1] || "image/*";
      debug.push({
        name: "image",
        mime,
        detected: "image",
        bytes: url.startsWith("data:") ? Math.round((url.length - url.indexOf(",") - 1) * 0.75) : undefined,
        status: "ok",
      });
      parts.push({ type: "image_url", image_url: { url } });
    }
    if ((m.images || []).length > MAX_IMAGES) errors.push(`only the first ${MAX_IMAGES} images per message were read`);

    for (const a of (m.audio || []).slice(0, MAX_AUDIO)) {
      const mimeMatch = typeof a === "string" ? /^data:([^;]+);base64,(.*)$/.exec(a) : null;
      if (!mimeMatch || !mimeMatch[2]) {
        errors.push("audio: could not read clip, skipped");
        debug.push({ name: "audio", mime: "audio/*", detected: "audio", status: "skipped", error: "could not read clip" });
        continue;
      }
      debug.push({
        name: "audio",
        mime: mimeMatch[1],
        detected: "audio",
        bytes: Math.round(mimeMatch[2].length * 0.75),
        status: "ok",
      });
      parts.push({ type: "input_audio", input_audio: { data: mimeMatch[2], format: audioFormat(mimeMatch[1]) } });
    }
    if ((m.audio || []).length > MAX_AUDIO) errors.push(`only the first ${MAX_AUDIO} audio clip per message was read`);

    for (const f of (m.files || []).slice(0, MAX_DOCS)) {
      const before = errors.length;
      const startedAt = Date.now();
      const text = (await extractDoc(f)).slice(0, MAX_DOC_CHARS);
      const parseMs = Date.now() - startedAt;
      const failed = errors.length > before;
      debug.push({
        name: f?.name || "attachment",
        mime: f?.mime || "application/octet-stream",
        detected: detectKind(f?.name || "", f?.mime || ""),
        bytes: f?.base64 ? Math.round(f.base64.length * 0.75) : 0,
        text_chars: text.length,
        parse_ms: parseMs,
        status: failed ? "error" : "ok",
        error: failed ? errors[errors.length - 1] : undefined,
      });
      parts.push({ type: "text", text: `\n--- DOCUMENT: ${f?.name || "attachment"} ---\n${text}\n--- END DOCUMENT ---` });
    }
    if ((m.files || []).length > MAX_DOCS) errors.push(`only the first ${MAX_DOCS} documents per message were read`);

    partsLog.push({ role: "user", parts: parts.map((p: any) => p.type) });
    out.push({ role: "user", content: parts });
  }

  return out;
};
