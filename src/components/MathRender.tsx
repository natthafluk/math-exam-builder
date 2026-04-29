import katex from "katex";
import { useMemo } from "react";

interface Props {
  text: string;
  className?: string;
  block?: boolean;
}

/**
 * Renders text containing inline ($...$) and display ($$...$$) LaTeX, plus plain Thai text.
 * Uses HTML-only output to avoid duplicate MathML reading in screen readers / DOM.
 */
export function MathRender({ text, className = "", block = false }: Props) {
  const html = useMemo(() => renderMixed(text ?? ""), [text]);
  const Tag = block ? "div" : "span";
  return (
    <Tag
      className={`math-display ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMixed(input: string): string {
  const parts: { type: "text" | "math"; value: string; display: boolean }[] = [];
  const re = /(\$\$[^$]+\$\$|\$[^$\n]+\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: input.slice(last, m.index), display: false });
    const raw = m[0];
    if (raw.startsWith("$$")) {
      parts.push({ type: "math", value: raw.slice(2, -2), display: true });
    } else {
      parts.push({ type: "math", value: raw.slice(1, -1), display: false });
    }
    last = m.index + raw.length;
  }
  if (last < input.length) parts.push({ type: "text", value: input.slice(last), display: false });

  return parts
    .map((p) => {
      if (p.type === "text") return escapeHtml(p.value).replace(/\n/g, "<br/>");
      try {
        return katex.renderToString(p.value, {
          displayMode: p.display,
          throwOnError: false,
          strict: "ignore",
          output: "html",
        });
      } catch {
        return `<code>${escapeHtml(p.value)}</code>`;
      }
    })
    .join("");
}
