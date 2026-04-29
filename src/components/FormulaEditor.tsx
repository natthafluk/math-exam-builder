import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MathRender } from "./MathRender";
import { Label } from "@/components/ui/label";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
}

const PALETTE: { label: string; insert: string; aria: string }[] = [
  { label: "a/b", insert: "\\frac{a}{b}", aria: "เศษส่วน" },
  { label: "x²", insert: "x^{2}", aria: "ยกกำลัง" },
  { label: "√", insert: "\\sqrt{x}", aria: "รากที่สอง" },
  { label: "ⁿ√", insert: "\\sqrt[n]{x}", aria: "รากที่ n" },
  { label: "≤", insert: "\\leq ", aria: "น้อยกว่าหรือเท่ากับ" },
  { label: "≥", insert: "\\geq ", aria: "มากกว่าหรือเท่ากับ" },
  { label: "≠", insert: "\\neq ", aria: "ไม่เท่ากับ" },
  { label: "∑", insert: "\\sum_{i=1}^{n} ", aria: "ผลรวม" },
  { label: "∫", insert: "\\int_{a}^{b} ", aria: "อินทิเกรต" },
  { label: "lim", insert: "\\lim_{x \\to 0} ", aria: "ลิมิต" },
  { label: "π", insert: "\\pi ", aria: "พาย" },
  { label: "θ", insert: "\\theta ", aria: "ทีตา" },
  { label: "∞", insert: "\\infty ", aria: "อนันต์" },
  { label: "matrix", insert: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", aria: "เมทริกซ์" },
  { label: "system", insert: "\\begin{cases} x + y = 1 \\\\ x - y = 3 \\end{cases}", aria: "ระบบสมการ" },
];

export function FormulaEditor({ value, onChange, label, placeholder, rows = 6 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (snippet: string) => {
    const el = ref.current;
    if (!el) {
      onChange((value ?? "") + ` $${snippet}$`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const wrapped = `$${snippet}$`;
    const next = value.slice(0, start) + wrapped + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + wrapped.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-1 p-2 bg-muted/50 border border-border rounded-md">
        {PALETTE.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={p.aria}
            title={p.aria}
            onClick={() => insert(p.insert)}
            className="h-7 px-2 font-mono text-xs"
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder ?? "พิมพ์โจทย์... ใช้ $...$ สำหรับสูตรแทรกในบรรทัด หรือ $$...$$ สำหรับสูตรกึ่งกลาง"}
          className="font-mono text-sm leading-relaxed"
        />
        <div className="border border-border rounded-md p-3 bg-card min-h-[8rem] text-[15px] leading-relaxed overflow-auto">
          {value ? (
            <MathRender text={value} block />
          ) : (
            <span className="text-muted-foreground text-sm">ตัวอย่างจะแสดงที่นี่</span>
          )}
        </div>
      </div>
    </div>
  );
}
