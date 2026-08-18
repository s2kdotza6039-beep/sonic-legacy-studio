import { describe, it, expect } from "vitest";
import {
  buildGeminiMsgs,
  detectKind,
  audioFormat,
  MAX_DOC_CHARS,
  type AttachDebug,
} from "../../supabase/functions/front-desk-assistant/geminiMsgs";

const makeDeps = (extract?: (f: any) => Promise<string>) => {
  const errors: string[] = [];
  const debug: AttachDebug[] = [];
  const parts: { role: string; parts: string[] }[] = [];
  const extractDoc =
    extract ??
    (async (f: any) => `TEXT OF ${f.name}`);
  return { deps: { extractDoc, errors, debug, parts }, errors, debug, parts };
};

describe("detectKind", () => {
  it("detects by mime and extension", () => {
    expect(detectKind("a.png", "image/png")).toBe("image");
    expect(detectKind("a.mp3", "audio/mpeg")).toBe("audio");
    expect(detectKind("deck.pdf", "")).toBe("pdf");
    expect(detectKind("x", "application/pdf")).toBe("pdf");
    expect(detectKind("rows.csv", "")).toBe("csv");
    expect(detectKind("book.xlsx", "")).toBe("xlsx");
    expect(detectKind("x", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("xlsx");
    expect(detectKind("contract.docx", "")).toBe("doc");
    expect(detectKind("x", "application/msword")).toBe("doc");
    expect(detectKind("notes.md", "")).toBe("text");
    expect(detectKind("blob.bin", "application/octet-stream")).toBe("unknown");
  });
});

describe("audioFormat", () => {
  it("maps mime types to gateway formats", () => {
    expect(audioFormat("audio/wav")).toBe("wav");
    expect(audioFormat("audio/webm")).toBe("webm");
    expect(audioFormat("audio/ogg")).toBe("ogg");
    expect(audioFormat("audio/flac")).toBe("flac");
    expect(audioFormat("audio/aac")).toBe("aac");
    expect(audioFormat("audio/x-m4a")).toBe("m4a");
    expect(audioFormat("audio/mp4")).toBe("m4a");
    expect(audioFormat("audio/mpeg")).toBe("mp3");
    expect(audioFormat("")).toBe("mp3");
  });
});

describe("buildGeminiMsgs", () => {
  it("passes plain text messages through", async () => {
    const { deps } = makeDeps();
    const out = await buildGeminiMsgs([{ role: "user", content: "hello" }], deps);
    expect(out).toEqual([{ role: "user", content: "hello" }]);
  });

  it("passes tool-protocol messages through untouched", async () => {
    const { deps } = makeDeps();
    const toolMsg = { role: "tool", tool_call_id: "abc", content: "{}" };
    const callMsg = { role: "assistant", content: null, tool_calls: [{ id: "abc" }] };
    const out = await buildGeminiMsgs([callMsg, toolMsg], deps);
    expect(out[0]).toBe(callMsg);
    expect(out[1]).toBe(toolMsg);
  });

  it("converts PDF, DOCX and XLSX/CSV documents into text parts", async () => {
    const { deps, debug } = makeDeps();
    const files = [
      { name: "deck.pdf", mime: "application/pdf", base64: "AAAA" },
      { name: "contract.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", base64: "AAAA" },
      { name: "rows.csv", mime: "text/csv", base64: "AAAA" },
    ];
    const out = await buildGeminiMsgs([{ role: "user", content: "read these", files }], deps);
    const parts = out[0].content;
    expect(parts[0]).toEqual({ type: "text", text: "read these" });
    expect(parts).toHaveLength(4);
    expect(parts[1].text).toContain("--- DOCUMENT: deck.pdf ---");
    expect(parts[1].text).toContain("TEXT OF deck.pdf");
    expect(debug.map((d) => d.detected)).toEqual(["pdf", "doc", "csv"]);
    expect(debug.every((d) => d.status === "ok")).toBe(true);
  });

  it("truncates long document text to the char cap", async () => {
    const { deps, debug } = makeDeps(async () => "x".repeat(MAX_DOC_CHARS + 5000));
    await buildGeminiMsgs(
      [{ role: "user", content: "", files: [{ name: "big.xlsx", mime: "", base64: "AAAA" }] }],
      deps,
    );
    expect(debug[0].text_chars).toBe(MAX_DOC_CHARS);
    expect(debug[0].detected).toBe("xlsx");
  });

  it("records an error when document extraction fails", async () => {
    const { deps, errors, debug } = makeDeps(async (f) => {
      deps.errors.push(`${f.name}: parse failed (boom)`);
      return `[Could not parse ${f.name}]`;
    });
    await buildGeminiMsgs(
      [{ role: "user", content: "", files: [{ name: "bad.pdf", mime: "application/pdf", base64: "AAAA" }] }],
      deps,
    );
    expect(debug[0].status).toBe("error");
    expect(debug[0].error).toContain("parse failed");
    expect(errors).toHaveLength(1);
  });

  it("caps documents at 3 per message", async () => {
    const { deps, errors, debug } = makeDeps();
    const files = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}.pdf`, mime: "application/pdf", base64: "AA" }));
    await buildGeminiMsgs([{ role: "user", content: "", files }], deps);
    expect(debug).toHaveLength(3);
    expect(errors.join(" ")).toContain("only the first 3 documents");
  });

  it("accepts data-url and https images and skips invalid sources", async () => {
    const { deps, errors, debug } = makeDeps();
    const out = await buildGeminiMsgs(
      [{
        role: "user",
        content: "look",
        images: ["data:image/png;base64,AAAA", "https://example.com/a.jpg", "javascript:alert(1)"],
      }],
      deps,
    );
    const parts = out[0].content;
    expect(parts.filter((p: any) => p.type === "image_url")).toHaveLength(2);
    expect(debug[0].mime).toBe("image/png");
    expect(debug[2].status).toBe("skipped");
    expect(errors.join(" ")).toContain("unsupported source");
  });

  it("caps images at 4 per message", async () => {
    const { deps, errors } = makeDeps();
    const images = Array.from({ length: 6 }, () => "data:image/jpeg;base64,AAAA");
    const out = await buildGeminiMsgs([{ role: "user", content: "", images }], deps);
    expect(out[0].content.filter((p: any) => p.type === "image_url")).toHaveLength(4);
    expect(errors.join(" ")).toContain("only the first 4 images");
  });

  it("converts audio into input_audio with the right format", async () => {
    const { deps, debug } = makeDeps();
    const out = await buildGeminiMsgs(
      [{ role: "user", content: "listen", audio: ["data:audio/wav;base64,QUJD"] }],
      deps,
    );
    const audioPart = out[0].content.find((p: any) => p.type === "input_audio");
    expect(audioPart.input_audio).toEqual({ data: "QUJD", format: "wav" });
    expect(debug[0].detected).toBe("audio");
  });

  it("skips malformed audio payloads", async () => {
    const { deps, errors, debug } = makeDeps();
    const out = await buildGeminiMsgs(
      [{ role: "user", content: "listen", audio: ["not-a-data-url"] }],
      deps,
    );
    expect(out[0].content.some((p: any) => p.type === "input_audio")).toBe(false);
    expect(debug[0].status).toBe("skipped");
    expect(errors.join(" ")).toContain("could not read clip");
  });

  it("caps audio at 1 clip per message", async () => {
    const { deps, errors } = makeDeps();
    const audio = ["data:audio/mpeg;base64,QUJD", "data:audio/mpeg;base64,QUJD"];
    const out = await buildGeminiMsgs([{ role: "user", content: "", audio }], deps);
    expect(out[0].content.filter((p: any) => p.type === "input_audio")).toHaveLength(1);
    expect(errors.join(" ")).toContain("only the first 1 audio clip");
  });

  it("logs the part types sent to Gemini", async () => {
    const { deps, parts } = makeDeps();
    await buildGeminiMsgs(
      [{
        role: "user",
        content: "all",
        images: ["data:image/png;base64,AAAA"],
        audio: ["data:audio/mpeg;base64,QUJD"],
        files: [{ name: "a.pdf", mime: "application/pdf", base64: "AA" }],
      }],
      deps,
    );
    expect(parts[0].parts).toEqual(["text", "image_url", "input_audio", "text"]);
  });
});
