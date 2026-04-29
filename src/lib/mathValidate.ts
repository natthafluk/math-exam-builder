import katex from "katex";

export interface MathIssue {
  index: number;
  snippet: string;
  message: string;
  display: boolean;
}

const MATH_RE = /(\$\$[^$]+\$\$|\$[^$\n]+\$)/g;

/**
 * Validates a mixed Thai/LaTeX string by attempting to render each $...$ /
 * $$...$$ region with KaTeX in throw mode. Returns Thai-language errors.
 */
export function validateMath(text: string): MathIssue[] {
  const issues: MathIssue[] = [];
  let m: RegExpExecArray | null;
  let counter = 0;
  const re = new RegExp(MATH_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const display = raw.startsWith("$$");
    const inner = display ? raw.slice(2, -2) : raw.slice(1, -1);
    try {
      katex.renderToString(inner, { displayMode: display, throwOnError: true, strict: "ignore" });
    } catch (e: any) {
      issues.push({
        index: counter,
        snippet: inner.length > 40 ? inner.slice(0, 40) + "…" : inner,
        message: translateKatexError(String(e?.message ?? e)),
        display,
      });
    }
    counter++;
  }
  // Detect unmatched $ — odd count of single $ outside $$ pairs
  const stripped = text.replace(/\$\$[^$]+\$\$/g, "");
  const dollars = (stripped.match(/\$/g) ?? []).length;
  if (dollars % 2 !== 0) {
    issues.push({
      index: -1,
      snippet: "$",
      message: "พบเครื่องหมาย $ ไม่ครบคู่ — ตรวจสอบการเปิด/ปิดสูตร",
      display: false,
    });
  }
  return issues;
}

function translateKatexError(msg: string): string {
  if (/Undefined control sequence/i.test(msg)) return "ใช้คำสั่ง LaTeX ที่ไม่รู้จัก — ตรวจการสะกด เช่น \\frac, \\sqrt";
  if (/Expected '}'/i.test(msg) || /Expected '\\}'/i.test(msg)) return "ลืมปิดวงเล็บปีกกา } ในสูตร";
  if (/Expected 'EOF'/i.test(msg)) return "โครงสร้างสูตรไม่สมบูรณ์ ตรวจวงเล็บและคำสั่ง";
  if (/Can't use function/i.test(msg)) return "ใช้คำสั่งผิดบริบท เช่นใช้ \\\\ นอก matrix";
  if (/got '\$'/i.test(msg)) return "พบ $ ซ้อนภายในสูตร";
  return "สูตรไม่ถูกต้อง: " + msg.replace(/^KaTeX parse error:\s*/, "");
}
