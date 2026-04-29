import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MathRender } from "./MathRender";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { validateMath } from "@/lib/mathValidate";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
}

interface Item { label: string; insert: string; aria: string; wrap?: boolean }

const QUICK: Item[] = [
  { label: "a/b", insert: "\\frac{a}{b}", aria: "เศษส่วน" },
  { label: "x²", insert: "x^{2}", aria: "ยกกำลัง" },
  { label: "√", insert: "\\sqrt{x}", aria: "รากที่สอง" },
  { label: "≤", insert: "\\leq ", aria: "น้อยกว่าหรือเท่ากับ" },
  { label: "≥", insert: "\\geq ", aria: "มากกว่าหรือเท่ากับ" },
  { label: "≠", insert: "\\neq ", aria: "ไม่เท่ากับ" },
  { label: "π", insert: "\\pi ", aria: "พาย" },
  { label: "θ", insert: "\\theta ", aria: "ทีตา" },
];

const GROUPS: { name: string; items: Item[] }[] = [
  {
    name: "เลขคณิต",
    items: [
      { label: "เศษส่วน a/b", insert: "\\frac{a}{b}", aria: "เศษส่วน" },
      { label: "ราก √x", insert: "\\sqrt{x}", aria: "รากที่สอง" },
      { label: "รากที่ n", insert: "\\sqrt[n]{x}", aria: "รากที่ n" },
      { label: "ยกกำลัง xⁿ", insert: "x^{n}", aria: "ยกกำลัง" },
      { label: "ตัวห้อย xₙ", insert: "x_{n}", aria: "ตัวห้อย" },
      { label: "พาย π", insert: "\\pi ", aria: "พาย" },
      { label: "อนันต์ ∞", insert: "\\infty ", aria: "อนันต์" },
      { label: "± plus/minus", insert: "\\pm ", aria: "บวกลบ" },
    ],
  },
  {
    name: "พีชคณิต",
    items: [
      { label: "สมการกำลังสอง", insert: "ax^2 + bx + c = 0" },
      { label: "สูตรกำลังสอง", insert: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", aria: "สูตรหาราก" },
      { label: "ระบบสมการ", insert: "\\begin{cases} x + y = 1 \\\\ x - y = 3 \\end{cases}", aria: "ระบบสมการ" },
      { label: "Piecewise", insert: "f(x) = \\begin{cases} x^2, & x \\geq 0 \\\\ -x, & x < 0 \\end{cases}", aria: "ฟังก์ชันแยกช่วง" },
      { label: "อสมการ", insert: "x \\leq 5", aria: "อสมการ" },
    ],
  },
  {
    name: "เรขาคณิต/ตรีโกณ",
    items: [
      { label: "sin θ", insert: "\\sin\\theta ", aria: "ไซน์" },
      { label: "cos θ", insert: "\\cos\\theta ", aria: "โคไซน์" },
      { label: "tan θ", insert: "\\tan\\theta ", aria: "แทน" },
      { label: "พื้นที่วงกลม", insert: "A = \\pi r^2", aria: "พื้นที่วงกลม" },
      { label: "พีทาโกรัส", insert: "a^2 + b^2 = c^2", aria: "ทฤษฎีพีทาโกรัส" },
      { label: "องศา °", insert: "^{\\circ}", aria: "องศา" },
    ],
  },
  {
    name: "แคลคูลัส",
    items: [
      { label: "ลิมิต", insert: "\\lim_{x \\to a} f(x)", aria: "ลิมิต" },
      { label: "อนุพันธ์", insert: "\\frac{dy}{dx}", aria: "อนุพันธ์" },
      { label: "อนุพันธ์อันดับสอง", insert: "\\frac{d^2 y}{dx^2}", aria: "อนุพันธ์อันดับสอง" },
      { label: "อินทิเกรต", insert: "\\int f(x)\\, dx", aria: "อินทิเกรต" },
      { label: "อินทิเกรตจำกัดเขต", insert: "\\int_{a}^{b} f(x)\\, dx", aria: "อินทิเกรตจำกัดเขต" },
      { label: "ผลรวม Σ", insert: "\\sum_{i=1}^{n} a_i", aria: "ผลรวม" },
      { label: "ผลคูณ Π", insert: "\\prod_{i=1}^{n} a_i", aria: "ผลคูณ" },
    ],
  },
  {
    name: "สถิติ",
    items: [
      { label: "ค่าเฉลี่ย x̄", insert: "\\bar{x}", aria: "ค่าเฉลี่ย" },
      { label: "ค่าเบี่ยงเบน σ", insert: "\\sigma", aria: "ซิกมา" },
      { label: "ความน่าจะเป็น P(A)", insert: "P(A) = \\frac{n(A)}{n(S)}", aria: "ความน่าจะเป็น" },
      { label: "C(n,r)", insert: "\\binom{n}{r}", aria: "การจัดหมู่" },
    ],
  },
  {
    name: "เมทริกซ์",
    items: [
      { label: "เมทริกซ์ 2x2", insert: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}", aria: "เมทริกซ์" },
      { label: "เมทริกซ์ 3x3", insert: "\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}", aria: "เมทริกซ์ 3x3" },
      { label: "ดีเทอร์มิแนนต์", insert: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}", aria: "ดีเทอร์มิแนนต์" },
      { label: "Identity I", insert: "I = \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}", aria: "เมทริกซ์เอกลักษณ์" },
    ],
  },
];

export function FormulaEditor({ value, onChange, label, placeholder, rows = 6 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);

  const insert = (snippet: string) => {
    const el = ref.current;
    const wrapped = `$${snippet}$`;
    if (!el) {
      onChange((value ?? "") + " " + wrapped);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + wrapped + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + wrapped.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const issues = validateMath(value || "");

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/50 border border-border rounded-md">
        {QUICK.map((p) => (
          <Button
            key={p.label} type="button" variant="ghost" size="sm"
            aria-label={p.aria} title={p.aria}
            onClick={() => insert(p.insert)}
            className="h-7 px-2 font-mono text-xs"
          >{p.label}</Button>
        ))}
        <div className="flex-1" />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Sparkles className="w-3.5 h-3.5" /> สูตรเพิ่มเติม
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>คลังสูตรคณิตศาสตร์</SheetTitle>
            </SheetHeader>
            <div className="mt-5 space-y-5">
              {GROUPS.map((g) => (
                <section key={g.name}>
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">{g.name}</h4>
                  <div className="grid gap-2">
                    {g.items.map((it) => (
                      <button
                        key={it.label} type="button"
                        onClick={() => { insert(it.insert); setOpen(false); }}
                        className="text-left p-2.5 rounded-md border border-border hover:border-primary hover:bg-muted/40 transition-colors"
                      >
                        <div className="text-xs text-muted-foreground mb-1">{it.label}</div>
                        <div className="text-sm"><MathRender text={`$${it.insert}$`} /></div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Textarea
          ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
          placeholder={placeholder ?? "พิมพ์โจทย์... ใช้ $...$ สำหรับสูตรแทรกในบรรทัด หรือ $$...$$ สำหรับสูตรกึ่งกลาง"}
          className="font-mono text-sm leading-relaxed"
        />
        <div className="border border-border rounded-md p-3 bg-card min-h-[8rem] text-[15px] leading-relaxed overflow-auto">
          {value ? <MathRender text={value} block /> : <span className="text-muted-foreground text-sm">ตัวอย่างจะแสดงที่นี่</span>}
        </div>
      </div>

      {value && (
        issues.length === 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="w-3.5 h-3.5" /> สูตรทั้งหมดถูกต้อง
          </div>
        ) : (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-destructive font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> พบปัญหาในสูตร {issues.length} จุด
            </div>
            <ul className="space-y-0.5 text-foreground/80 ml-5 list-disc">
              {issues.slice(0, 4).map((it, i) => (
                <li key={i}><code className="text-[11px] bg-muted px-1 py-0.5 rounded">{it.snippet}</code> — {it.message}</li>
              ))}
              {issues.length > 4 && <li>…และอีก {issues.length - 4} จุด</li>}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
