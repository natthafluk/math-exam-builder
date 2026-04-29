export type Role = "admin" | "teacher" | "student";

export type QuestionType = "mcq" | "short" | "tf" | "written";
export type Difficulty = "easy" | "medium" | "hard";
export type QuestionStatus = "draft" | "review" | "published" | "archived";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  classId?: string;
  department?: string;
  avatarColor?: string;
}

export interface Topic {
  id: string;
  title: string;
  gradeLevel: string;
  parentId?: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  gradeLevel: string;
  teacherId: string;
  studentIds: string[];
}

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  title: string;
  body: string;
  type: QuestionType;
  choices?: Choice[];
  correctAnswer: string;
  explanation: string;
  gradeLevel: string;
  topicId: string;
  difficulty: Difficulty;
  tags: string[];
  status: QuestionStatus;
  authorId: string;
  lastEditedBy?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamQuestionRef {
  questionId: string;
  order: number;
  points: number;
}

export interface ExamSettings {
  randomizeQuestionOrder: boolean;
  randomizeChoices: boolean;
  allowLateSubmission: boolean;
  showScoreImmediately: boolean;
  showExplanationsAfterClose: boolean;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  classIds: string[];
  questions: ExamQuestionRef[];
  timeLimitMinutes: number;
  dueDate: string;
  showExplanations: boolean;
  status: "draft" | "assigned" | "closed";
  settings?: ExamSettings;
  createdAt: string;
}

export interface Attempt {
  id: string;
  examId: string;
  studentId: string;
  answers: Record<string, string>;
  score: number;
  maxScore: number;
  submittedAt?: string;
  status: "in_progress" | "submitted" | "graded";
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  target?: string;
  tone?: "default" | "success" | "warning" | "destructive";
}

export interface SchoolSettings {
  schoolName: string;
  department: string;
  academicYear: string;
  semester: string;
}
