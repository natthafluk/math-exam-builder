import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireStudent } from "@/components/RequireStudent";
import { StudentSessionProvider } from "@/lib/studentSession";
import Auth from "./pages/Auth";
import StudentLogin from "./pages/StudentLogin";
import { StudentExams as StudentExamsNew, StudentTakeExam } from "./pages/StudentApp";
import Dashboard from "./pages/Dashboard";
import QuestionBank from "./pages/QuestionBank";
import QuestionEditor from "./pages/QuestionEditor";
import QuestionPreview from "./pages/QuestionPreview";
import ExamList from "./pages/ExamList";
import ExamBuilder from "./pages/ExamBuilder";
import ExamResults from "./pages/ExamResults";
import ExamPrint from "./pages/ExamPrint";
import TakeExam from "./pages/TakeExam";

import UsersPage from "./pages/UsersPage";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import ClassesPage from "./pages/ClassesPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import ResultsPage from "./pages/ResultsPage";
import AdminPage from "./pages/AdminPage";
import ImportQuestions from "./pages/ImportQuestions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: React.ReactNode }) => (
  <RequireAuth><StoreProvider>{children}</StoreProvider></RequireAuth>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <StudentSessionProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />

            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/questions" element={<Protected><QuestionBank /></Protected>} />
            <Route path="/questions/new" element={<Protected><QuestionEditor /></Protected>} />
            <Route path="/questions/import" element={<Protected><ImportQuestions /></Protected>} />
            <Route path="/questions/:id" element={<Protected><QuestionEditor /></Protected>} />
            <Route path="/questions/:id/preview" element={<Protected><QuestionPreview /></Protected>} />
            <Route path="/exams" element={<Protected><ExamList /></Protected>} />
            <Route path="/exams/new" element={<Protected><ExamBuilder /></Protected>} />
            <Route path="/exams/:id" element={<Protected><ExamBuilder /></Protected>} />
            <Route path="/exams/:id/results" element={<Protected><ExamResults /></Protected>} />
            <Route path="/exams/:id/print" element={<Protected><ExamPrint /></Protected>} />
            <Route path="/exams/:id/take" element={<Protected><TakeExam /></Protected>} />

            <Route path="/student-login" element={<StudentLogin />} />
            <Route path="/student" element={<Navigate to="/student/exams" replace />} />
            <Route path="/student/exams" element={<RequireStudent><StudentExamsNew /></RequireStudent>} />
            <Route path="/student/take/:id" element={<RequireStudent><StudentTakeExam /></RequireStudent>} />
            <Route path="/student/exams/:id" element={<RequireStudent><StudentTakeExam /></RequireStudent>} />
            <Route path="/student/results" element={<RequireStudent><StudentExamsNew /></RequireStudent>} />

            <Route path="/classes" element={<Protected><ClassesPage /></Protected>} />
            <Route path="/students" element={<Protected><UsersPage /></Protected>} />
            <Route path="/assignments" element={<Protected><AssignmentsPage /></Protected>} />
            <Route path="/results" element={<Protected><ResultsPage /></Protected>} />
            <Route path="/admin" element={<Protected><AdminPage /></Protected>} />

            <Route path="/users" element={<Protected><UsersPage /></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </StudentSessionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
