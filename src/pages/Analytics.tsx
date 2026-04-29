import { AppLayout } from "@/components/AppLayout";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["hsl(188 78% 24%)", "hsl(32 95% 55%)", "hsl(152 60% 38%)", "hsl(38 92% 50%)"];

export default function Analytics() {
  const { questions, attempts, exams, topics } = useStore();

  const byTopic = topics.map((t) => ({
    name: t.title,
    value: questions.filter((q) => q.topicId === t.id).length,
  }));

  const byDifficulty = ["easy", "medium", "hard"].map((d) => ({
    name: d === "easy" ? "ง่าย" : d === "medium" ? "ปานกลาง" : "ยาก",
    value: questions.filter((q) => q.difficulty === d).length,
  }));

  const examScores = exams.map((e) => {
    const list = attempts.filter((a) => a.examId === e.id);
    const avg = list.length ? Math.round((list.reduce((s, a) => s + (a.score / a.maxScore) * 100, 0) / list.length)) : 0;
    return { name: e.title.slice(0, 20), avg };
  });

  return (
    <AppLayout title="สถิติและการวิเคราะห์">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">จำนวนข้อตามหัวข้อ</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byTopic}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey="value" fill="hsl(188 78% 24%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">สัดส่วนระดับความยาก</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byDifficulty} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {byDifficulty.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">คะแนนเฉลี่ยรายชุดข้อสอบ (%)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={examScores}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey="avg" fill="hsl(32 95% 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </AppLayout>
  );
}
