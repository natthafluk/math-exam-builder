import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store";
import Dashboard from "./pages/Dashboard";
import QuestionBank from "./pages/QuestionBank";
import QuestionEditor from "./pages/QuestionEditor";
import QuestionPreview from "./pages/QuestionPreview";
import ExamList from "./pages/ExamList";
import ExamBuilder from "./pages/ExamBuilder";
import ExamResults from "./pages/ExamResults";
import ExamPrint from "./pages/ExamPrint";
import TakeExam from "./pages/TakeExam";
import { StudentExams, StudentResults } from "./pages/StudentPages";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <StoreProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/questions" element={<QuestionBank />} />
            <Route path="/questions/new" element={<QuestionEditor />} />
            <Route path="/questions/import" element={<ImportQuestions />} />
            <Route path="/questions/:id" element={<QuestionEditor />} />
            <Route path="/questions/:id/preview" element={<QuestionPreview />} />
            <Route path="/exams" element={<ExamList />} />
            <Route path="/exams/new" element={<ExamBuilder />} />
            <Route path="/exams/:id" element={<ExamBuilder />} />
            <Route path="/exams/:id/results" element={<ExamResults />} />
            <Route path="/exams/:id/print" element={<ExamPrint />} />
            <Route path="/exams/:id/take" element={<TakeExam />} />

            <Route path="/student" element={<Navigate to="/student/exams" replace />} />
            <Route path="/student/exams" element={<StudentExams />} />
            <Route path="/student/exams/:id" element={<TakeExam />} />
            <Route path="/student/results" element={<StudentResults />} />
            <Route path="/student/take/:id" element={<TakeExam />} />

            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/students" element={<UsersPage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/admin" element={<AdminPage />} />

            <Route path="/users" element={<UsersPage />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
