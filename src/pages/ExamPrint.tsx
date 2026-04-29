import { useParams, Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { MathRender } from "@/components/MathRender";
import { Printer, ArrowLeft } from "lucide-react";

export default function ExamPrint() {
  const { id } = useParams();
  const { exams, questions } = useStore();
  const exam = exams.find((e) => e.id === id);
  if (!exam) return <div className="p-8">ไม่พบ</div>;

  const items = [...exam.questions].sort((a, b) => a.order - b.order)
    .map((eq) => ({ ref: eq, q: questions.find((q) => q.id === eq.questionId)! }));

  return (
    <div className="min-h-screen bg-muted/30 py-6">
      <div className="no-print max-w-4xl mx-auto px-6 mb-4 flex items-center justify-between">
        <Button asChild variant="outline" className="gap-1.5">
          <Link to="/exams"><ArrowLeft className="w-4 h-4" /> กลับ</Link>
        </Button>
        <Button onClick={() => window.print()} className="gap-1.5">
          <Printer className="w-4 h-4" /> พิมพ์ / บันทึก PDF
        </Button>
      </div>

      <div className="print-page max-w-4xl mx-auto bg-white shadow-sm border border-border p-10 md:p-14 text-black" style={{ minHeight: "29.7cm" }}>
        <header className="border-b-2 border-black pb-4 mb-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider">โรงเรียนตัวอย่างวิทยา</div>
            <h1 className="text-2xl font-bold mt-1">{exam.title}</h1>
            <p className="text-sm text-gray-700 mt-1">{exam.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-5 text-sm">
            <div>ชื่อ-สกุล: ____________________</div>
            <div>ชั้น: __________ เลขที่: ______</div>
            <div className="text-right">เวลา: {exam.timeLimitMinutes} นาที</div>
          </div>
        </header>

        <div className="text-sm bg-gray-50 border border-gray-200 rounded p-3 mb-6">
          <strong>คำชี้แจง:</strong> ข้อสอบมีทั้งหมด {items.length} ข้อ คะแนนเต็ม {items.reduce((s, x) => s + x.ref.points, 0)} คะแนน — ให้นักเรียนทำลงในกระดาษคำตอบ
        </div>

        <ol className="space-y-6">
          {items.map(({ ref, q }, i) => (
            <li key={q.id} className="break-inside-avoid">
              <div className="flex justify-between gap-4 mb-2">
                <div className="font-semibold">ข้อที่ {i + 1}. {q.title}</div>
                <span className="text-sm text-gray-600 shrink-0">({ref.points} คะแนน)</span>
              </div>
              <div className="text-[15px] leading-relaxed pl-5">
                <MathRender text={q.body} block />
              </div>
              {q.type === "mcq" && q.choices && (
                <ol className="mt-2 pl-10 space-y-1.5 list-[lower-alpha]">
                  {q.choices.map((c) => (
                    <li key={c.id} className="text-[15px]"><MathRender text={c.text} /></li>
                  ))}
                </ol>
              )}
              {q.type === "written" && (
                <div className="mt-2 pl-5 space-y-3">
                  {[...Array(4)].map((_, k) => <div key={k} className="border-b border-dotted border-gray-400 h-6" />)}
                </div>
              )}
              {q.type === "short" && (
                <div className="mt-2 pl-5 text-sm">คำตอบ: <span className="inline-block border-b border-gray-400 min-w-[200px]">&nbsp;</span></div>
              )}
            </li>
          ))}
        </ol>

        <footer className="mt-10 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
          ขอให้นักเรียนทำข้อสอบด้วยความตั้งใจ • MathBank Studio
        </footer>
      </div>
    </div>
  );
}
