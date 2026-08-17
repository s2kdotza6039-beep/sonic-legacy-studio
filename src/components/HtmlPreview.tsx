import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const PREVIEW_RE = /<!--HTML-PREVIEW-->([\s\S]*?)<!--\/HTML-PREVIEW-->/;

const HtmlPreview = ({ content }: { content: string }) => {
  const [open, setOpen] = useState(false);
  const match = content.match(PREVIEW_RE);
  if (!match) return null;
  const html = match[1].trim();
  const srcDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Sydney layout preview</title>
<style>
  body { font-family: Montserrat, 'Open Sans', -apple-system, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #2C2C2C; padding: 20px; margin: 0; }
</style>
</head>
<body>
${html}
</body>
</html>`;
  return (
    <div className="w-full mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary/15 text-primary border border-primary/40 hover:bg-primary/25 transition-colors"
        aria-label={open ? "Hide live preview" : "View live preview"}
      >
        {open ? <EyeOff size={13} /> : <Eye size={13} />}
        {open ? "Hide live preview" : "View live preview"}
      </button>
      {open && (
        <iframe
          title="Sydney layout preview"
          sandbox="allow-scripts"
          className="w-full h-[420px] bg-white rounded-md border border-border mt-2"
          srcDoc={srcDoc}
        />
      )}
    </div>
  );
};

export default HtmlPreview;
