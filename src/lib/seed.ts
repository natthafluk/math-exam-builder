import type { User, Topic, ClassRoom, Question, Exam, Attempt } from "./types";

export const seedUsers: User[] = [
  { id: "u-admin", name: "ดร.สมชาย ผู้ดูแล", email: "admin@mathbank.th", role: "admin", department: "ฝ่ายวิชาการ", avatarColor: "bg-primary" },
  { id: "u-t1", name: "อ.มาลี ใจดี", email: "malee@mathbank.th", role: "teacher", department: "กลุ่มสาระคณิตศาสตร์", avatarColor: "bg-accent" },
  { id: "u-t2", name: "อ.ประสิทธิ์ คำนวณ", email: "prasit@mathbank.th", role: "teacher", department: "กลุ่มสาระคณิตศาสตร์", avatarColor: "bg-success" },
  { id: "u-s1", name: "ด.ช.ภูมิ ตั้งใจเรียน", email: "phum@student.th", role: "student", classId: "c-m4-1", avatarColor: "bg-primary" },
  { id: "u-s2", name: "ด.ญ.ใบเตย ขยันทำ", email: "baitoey@student.th", role: "student", classId: "c-m4-1", avatarColor: "bg-accent" },
  { id: "u-s3", name: "ด.ช.กิตติ พากเพียร", email: "kitti@student.th", role: "student", classId: "c-m4-1", avatarColor: "bg-success" },
  { id: "u-s4", name: "ด.ญ.พิมพ์ใจ ฉลาดคิด", email: "pim@student.th", role: "student", classId: "c-m5-2", avatarColor: "bg-warning" },
  { id: "u-s5", name: "ด.ช.ธนากร เก่งเลข", email: "thanakorn@student.th", role: "student", classId: "c-m5-2", avatarColor: "bg-primary" },
];

export const seedClasses: ClassRoom[] = [
  { id: "c-m4-1", name: "ม.4/1", gradeLevel: "ม.4", teacherId: "u-t1", studentIds: ["u-s1", "u-s2", "u-s3"] },
  { id: "c-m5-2", name: "ม.5/2", gradeLevel: "ม.5", teacherId: "u-t1", studentIds: ["u-s4", "u-s5"] },
  { id: "c-m6-1", name: "ม.6/1", gradeLevel: "ม.6", teacherId: "u-t2", studentIds: [] },
];

export const seedTopics: Topic[] = [
  { id: "t-alg", title: "พีชคณิต", gradeLevel: "ม.4" },
  { id: "t-geo", title: "เรขาคณิต", gradeLevel: "ม.4" },
  { id: "t-trig", title: "ตรีโกณมิติ", gradeLevel: "ม.5" },
  { id: "t-calc", title: "แคลคูลัส", gradeLevel: "ม.6" },
  { id: "t-stat", title: "สถิติและความน่าจะเป็น", gradeLevel: "ม.5" },
  { id: "t-num", title: "ทฤษฎีจำนวน", gradeLevel: "ม.4" },
  { id: "t-matrix", title: "เมทริกซ์", gradeLevel: "ม.6" },
];

const now = new Date().toISOString();

export const seedQuestions: Question[] = [
  {
    id: "q-1",
    title: "สมการกำลังสอง",
    body: "จงหาค่า $x$ ที่สอดคล้องกับสมการ $$x^2 - 5x + 6 = 0$$",
    type: "mcq",
    choices: [
      { id: "a", text: "$x = 1, 6$" },
      { id: "b", text: "$x = 2, 3$" },
      { id: "c", text: "$x = -2, -3$" },
      { id: "d", text: "$x = 0, 5$" },
    ],
    correctAnswer: "b",
    explanation: "แยกตัวประกอบ $(x-2)(x-3) = 0$ ได้ $x = 2$ หรือ $x = 3$",
    gradeLevel: "ม.4", topicId: "t-alg", difficulty: "easy", tags: ["สมการ", "แยกตัวประกอบ"],
    status: "published", authorId: "u-t1", createdAt: now, updatedAt: now,
  },
  {
    id: "q-2",
    title: "พื้นที่วงกลม",
    body: "วงกลมรัศมี $r = 7$ เซนติเมตร มีพื้นที่เท่าใด (ใช้ $\\pi \\approx \\frac{22}{7}$)",
    type: "mcq",
    choices: [
      { id: "a", text: "$44 \\text{ ตร.ซม.}$" },
      { id: "b", text: "$154 \\text{ ตร.ซม.}$" },
      { id: "c", text: "$49\\pi \\text{ ตร.ซม.}$" },
      { id: "d", text: "ทั้ง ข และ ค ถูก" },
    ],
    correctAnswer: "d",
    explanation: "$A = \\pi r^2 = \\frac{22}{7} \\times 49 = 154$ ตร.ซม. และเขียนในรูป $49\\pi$ ก็ถูกเช่นกัน",
    gradeLevel: "ม.4", topicId: "t-geo", difficulty: "easy", tags: ["วงกลม", "พื้นที่"],
    status: "published", authorId: "u-t1", createdAt: now, updatedAt: now,
  },
  {
    id: "q-3",
    title: "เอกลักษณ์ตรีโกณมิติ",
    body: "พิสูจน์ว่า $$\\frac{\\sin^2\\theta}{1 - \\cos\\theta} = 1 + \\cos\\theta$$",
    type: "written",
    correctAnswer: "ใช้เอกลักษณ์ $\\sin^2\\theta = 1 - \\cos^2\\theta = (1-\\cos\\theta)(1+\\cos\\theta)$",
    explanation: "$\\frac{(1-\\cos\\theta)(1+\\cos\\theta)}{1-\\cos\\theta} = 1 + \\cos\\theta$",
    gradeLevel: "ม.5", topicId: "t-trig", difficulty: "medium", tags: ["พิสูจน์", "เอกลักษณ์"],
    status: "published", authorId: "u-t1", createdAt: now, updatedAt: now,
  },
  {
    id: "q-4",
    title: "อนุพันธ์ของฟังก์ชัน",
    body: "จงหา $\\frac{dy}{dx}$ เมื่อ $y = 3x^4 - 2x^2 + 5x - 7$",
    type: "short",
    correctAnswer: "12x^3 - 4x + 5",
    explanation: "ใช้กฎกำลัง: $\\frac{dy}{dx} = 12x^3 - 4x + 5$",
    gradeLevel: "ม.6", topicId: "t-calc", difficulty: "easy", tags: ["อนุพันธ์", "พหุนาม"],
    status: "published", authorId: "u-t2", createdAt: now, updatedAt: now,
  },
  {
    id: "q-5",
    title: "อินทิเกรตจำกัดเขต",
    body: "$$\\int_{0}^{2} (3x^2 + 2x)\\, dx = ?$$",
    type: "mcq",
    choices: [
      { id: "a", text: "$10$" },
      { id: "b", text: "$12$" },
      { id: "c", text: "$14$" },
      { id: "d", text: "$16$" },
    ],
    correctAnswer: "b",
    explanation: "$\\int (3x^2+2x)dx = x^3 + x^2$ เมื่อแทน $0$ ถึง $2$ จะได้ $8+4 = 12$",
    gradeLevel: "ม.6", topicId: "t-calc", difficulty: "medium", tags: ["อินทิเกรต"],
    status: "published", authorId: "u-t2", createdAt: now, updatedAt: now,
  },
  {
    id: "q-6",
    title: "ความน่าจะเป็น",
    body: "โยนลูกเต๋า 2 ลูก ความน่าจะเป็นที่ผลรวมเท่ากับ 7 มีค่าเท่าใด?",
    type: "mcq",
    choices: [
      { id: "a", text: "$\\frac{1}{6}$" },
      { id: "b", text: "$\\frac{1}{12}$" },
      { id: "c", text: "$\\frac{5}{36}$" },
      { id: "d", text: "$\\frac{7}{36}$" },
    ],
    correctAnswer: "a",
    explanation: "มี 6 คู่ที่ผลรวม = 7 จากทั้งหมด 36 คู่ ดังนั้น $\\frac{6}{36} = \\frac{1}{6}$",
    gradeLevel: "ม.5", topicId: "t-stat", difficulty: "medium", tags: ["ความน่าจะเป็น"],
    status: "published", authorId: "u-t1", createdAt: now, updatedAt: now,
  },
  {
    id: "q-7",
    title: "ตัวประกอบเฉพาะ",
    body: "$60$ มีตัวประกอบเฉพาะคือ $2, 3$ และ $5$ ใช่หรือไม่?",
    type: "tf",
    correctAnswer: "true",
    explanation: "$60 = 2^2 \\times 3 \\times 5$ ดังนั้นตัวประกอบเฉพาะคือ $2, 3, 5$",
    gradeLevel: "ม.4", topicId: "t-num", difficulty: "easy", tags: ["จำนวนเฉพาะ"],
    status: "published", authorId: "u-t2", createdAt: now, updatedAt: now,
  },
  {
    id: "q-8",
    title: "ดีเทอร์มิแนนต์ของเมทริกซ์",
    body: "จงหาค่าดีเทอร์มิแนนต์ของเมทริกซ์ $$A = \\begin{pmatrix} 2 & 3 \\\\ 1 & 4 \\end{pmatrix}$$",
    type: "short",
    correctAnswer: "5",
    explanation: "$\\det(A) = (2)(4) - (3)(1) = 8 - 3 = 5$",
    gradeLevel: "ม.6", topicId: "t-matrix", difficulty: "easy", tags: ["เมทริกซ์", "ดีเทอร์มิแนนต์"],
    status: "published", authorId: "u-t2", createdAt: now, updatedAt: now,
  },
  {
    id: "q-9",
    title: "อสมการ",
    body: "จงแก้อสมการ $\\frac{2x - 1}{3} \\geq \\frac{x + 2}{4}$",
    type: "written",
    correctAnswer: "x \\geq 2",
    explanation: "คูณไขว้: $4(2x-1) \\geq 3(x+2) \\Rightarrow 8x - 4 \\geq 3x + 6 \\Rightarrow 5x \\geq 10 \\Rightarrow x \\geq 2$",
    gradeLevel: "ม.4", topicId: "t-alg", difficulty: "medium", tags: ["อสมการ"],
    status: "review", authorId: "u-t1", createdAt: now, updatedAt: now,
  },
  {
    id: "q-10",
    title: "ลิมิตของฟังก์ชัน",
    body: "จงหา $$\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$$",
    type: "mcq",
    choices: [
      { id: "a", text: "$0$" },
      { id: "b", text: "$2$" },
      { id: "c", text: "$4$" },
      { id: "d", text: "หาค่าไม่ได้" },
    ],
    correctAnswer: "c",
    explanation: "$\\frac{(x-2)(x+2)}{x-2} = x + 2$ เมื่อ $x \\to 2$ ได้ $4$",
    gradeLevel: "ม.6", topicId: "t-calc", difficulty: "medium", tags: ["ลิมิต"],
    status: "published", authorId: "u-t2", createdAt: now, updatedAt: now,
  },
];

export const seedExams: Exam[] = [
  {
    id: "e-1",
    title: "ทดสอบกลางภาค คณิตศาสตร์ ม.4",
    description: "ครอบคลุมพีชคณิต เรขาคณิต และทฤษฎีจำนวน",
    teacherId: "u-t1",
    classIds: ["c-m4-1"],
    questions: [
      { questionId: "q-1", order: 1, points: 5 },
      { questionId: "q-2", order: 2, points: 5 },
      { questionId: "q-7", order: 3, points: 3 },
      { questionId: "q-9", order: 4, points: 7 },
    ],
    timeLimitMinutes: 60,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    showExplanations: true,
    status: "assigned",
    createdAt: now,
  },
  {
    id: "e-2",
    title: "แบบฝึกหัด แคลคูลัส ม.6",
    description: "อนุพันธ์ อินทิเกรต และลิมิต",
    teacherId: "u-t2",
    classIds: ["c-m6-1"],
    questions: [
      { questionId: "q-4", order: 1, points: 5 },
      { questionId: "q-5", order: 2, points: 5 },
      { questionId: "q-10", order: 3, points: 5 },
    ],
    timeLimitMinutes: 45,
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    showExplanations: true,
    status: "assigned",
    createdAt: now,
  },
];

export const seedAttempts: Attempt[] = [
  {
    id: "at-1", examId: "e-1", studentId: "u-s1",
    answers: { "q-1": "b", "q-2": "d", "q-7": "true", "q-9": "x \\geq 2" },
    score: 20, maxScore: 20, submittedAt: now, status: "graded",
  },
  {
    id: "at-2", examId: "e-1", studentId: "u-s2",
    answers: { "q-1": "b", "q-2": "b", "q-7": "true", "q-9": "x > 2" },
    score: 13, maxScore: 20, submittedAt: now, status: "graded",
  },
  {
    id: "at-3", examId: "e-1", studentId: "u-s3",
    answers: { "q-1": "a", "q-2": "d", "q-7": "false", "q-9": "" },
    score: 5, maxScore: 20, submittedAt: now, status: "graded",
  },
];
