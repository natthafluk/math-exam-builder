export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          class_id: string
          created_at: string
          due_date: string | null
          exam_id: string
          id: string
          settings: Json
          status: Database["public"]["Enums"]["assignment_status"]
        }
        Insert: {
          class_id: string
          created_at?: string
          due_date?: string | null
          exam_id: string
          id?: string
          settings?: Json
          status?: Database["public"]["Enums"]["assignment_status"]
        }
        Update: {
          class_id?: string
          created_at?: string
          due_date?: string | null
          exam_id?: string
          id?: string
          settings?: Json
          status?: Database["public"]["Enums"]["assignment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          answer: Json
          attempt_id: string
          id: string
          is_correct: boolean | null
          points_awarded: number
          question_id: string
        }
        Insert: {
          answer?: Json
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          points_awarded?: number
          question_id: string
        }
        Update: {
          answer?: Json
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          points_awarded?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          assignment_id: string
          created_at: string
          enrollment_id: string | null
          id: string
          max_score: number
          score: number
          status: Database["public"]["Enums"]["attempt_status"]
          student_id: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          max_score?: number
          score?: number
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          max_score?: number
          score?: number
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "class_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_students: {
        Row: {
          class_id: string
          created_at: string
          full_name: string
          id: string
          student_code: string
        }
        Insert: {
          class_id: string
          created_at?: string
          full_name: string
          id?: string
          student_code: string
        }
        Update: {
          class_id?: string
          created_at?: string
          full_name?: string
          id?: string
          student_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          grade_level: string
          id: string
          name: string
          subject_code: string
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          grade_level: string
          id?: string
          name: string
          subject_code?: string
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          grade_level?: string
          id?: string
          name?: string
          subject_code?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          exam_id: string
          id: string
          points: number
          question_id: string
          sort_order: number
        }
        Insert: {
          exam_id: string
          id?: string
          points?: number
          question_id: string
          sort_order?: number
        }
        Update: {
          exam_id?: string
          id?: string
          points?: number
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          id: string
          reveal_mode: string
          revealed_at: string | null
          settings: Json
          show_explanations: boolean
          status: Database["public"]["Enums"]["exam_status"]
          teacher_id: string | null
          time_limit_minutes: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          reveal_mode?: string
          revealed_at?: string | null
          settings?: Json
          show_explanations?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          teacher_id?: string | null
          time_limit_minutes?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          reveal_mode?: string
          revealed_at?: string | null
          settings?: Json
          show_explanations?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          teacher_id?: string | null
          time_limit_minutes?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_color: string | null
          avatar_initials: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_super_admin: boolean
          requested_role: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          avatar_color?: string | null
          avatar_initials?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_super_admin?: boolean
          requested_role?: Database["public"]["Enums"]["app_role"] | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          avatar_color?: string | null
          avatar_initials?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_super_admin?: boolean
          requested_role?: Database["public"]["Enums"]["app_role"] | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      question_choices: {
        Row: {
          body_latex: string
          id: string
          is_correct: boolean
          label: string
          question_id: string
          sort_order: number
        }
        Insert: {
          body_latex?: string
          id?: string
          is_correct?: boolean
          label: string
          question_id: string
          sort_order?: number
        }
        Update: {
          body_latex?: string
          id?: string
          is_correct?: boolean
          label?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_choices_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          author_id: string | null
          body_latex: string
          correct_answer: string
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          explanation_latex: string
          grade_level: string
          id: string
          reviewer_id: string | null
          status: Database["public"]["Enums"]["question_status"]
          tags: string[]
          title: string
          topic_id: string | null
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_latex?: string
          correct_answer?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation_latex?: string
          grade_level?: string
          id?: string
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          tags?: string[]
          title: string
          topic_id?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_latex?: string
          correct_answer?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          explanation_latex?: string
          grade_level?: string
          id?: string
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          tags?: string[]
          title?: string
          topic_id?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          grade_level: string
          id: string
          parent_topic_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          grade_level: string
          id?: string
          parent_topic_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          grade_level?: string
          id?: string
          parent_topic_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_topic_id_fkey"
            columns: ["parent_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_user: {
        Args: {
          _role?: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_color: string | null
          avatar_initials: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_super_admin: boolean
          requested_role: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      admin_list_users: {
        Args: { _status?: string }
        Returns: {
          approval_status: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_super_admin: boolean
          requested_role: Database["public"]["Enums"]["app_role"]
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      admin_reject_user: {
        Args: { _user_id: string }
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_color: string | null
          avatar_initials: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_super_admin: boolean
          requested_role: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_color: string | null
          avatar_initials: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_super_admin: boolean
          requested_role: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      exam_is_revealed: {
        Args: { _assignment_id: string; _exam_id: string }
        Returns: boolean
      }
      get_my_profile: {
        Args: never
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_color: string | null
          avatar_initials: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_super_admin: boolean
          requested_role: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_class_student: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      my_approval_status: { Args: never; Returns: string }
      repair_my_profile: {
        Args: never
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_color: string | null
          avatar_initials: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_super_admin: boolean
          requested_role: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      student_find_enrollments: {
        Args: { _code: string }
        Returns: {
          class_id: string
          class_name: string
          enrollment_id: string
          full_name: string
          grade_level: string
          subject_code: string
          teacher_name: string
        }[]
      }
      student_get_exam: {
        Args: { _assignment_id: string; _code: string; _enrollment_id: string }
        Returns: Json
      }
      student_list_assignments: {
        Args: { _code: string; _enrollment_id: string }
        Returns: {
          assignment_id: string
          due_date: string
          exam_description: string
          exam_id: string
          exam_title: string
          reveal_mode: string
          revealed: boolean
          show_explanations: boolean
          status: string
          time_limit_minutes: number
        }[]
      }
      student_list_results: {
        Args: { _code: string; _enrollment_id: string }
        Returns: {
          assignment_id: string
          attempt_id: string
          exam_title: string
          max_score: number
          revealed: boolean
          score: number
          submitted_at: string
        }[]
      }
      student_submit_attempt: {
        Args: {
          _answers: Json
          _assignment_id: string
          _code: string
          _enrollment_id: string
        }
        Returns: Json
      }
      student_verify: {
        Args: { _code: string; _enrollment_id: string }
        Returns: {
          class_id: string
          class_name: string
          enrollment_id: string
          full_name: string
          grade_level: string
          subject_code: string
          teacher_name: string
        }[]
      }
      teacher_import_roster: {
        Args: { _class_id: string; _rows: Json }
        Returns: number
      }
      teacher_list_exams_reveal: {
        Args: never
        Returns: {
          attempts_count: number
          due_date: string
          exam_id: string
          reveal_mode: string
          revealed_at: string
          status: string
          title: string
        }[]
      }
      teacher_set_exam_reveal: {
        Args: { _exam_id: string; _mode: string; _revealed: boolean }
        Returns: {
          created_at: string
          description: string
          due_date: string | null
          id: string
          reveal_mode: string
          revealed_at: string | null
          settings: Json
          show_explanations: boolean
          status: Database["public"]["Enums"]["exam_status"]
          teacher_id: string | null
          time_limit_minutes: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "exams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
      assignment_status: "scheduled" | "open" | "closed"
      attempt_status: "in_progress" | "submitted" | "graded"
      difficulty_level: "easy" | "medium" | "hard"
      exam_status: "draft" | "assigned" | "closed"
      question_status: "draft" | "review" | "published" | "archived"
      question_type: "mcq" | "short" | "tf" | "written"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "teacher", "student"],
      assignment_status: ["scheduled", "open", "closed"],
      attempt_status: ["in_progress", "submitted", "graded"],
      difficulty_level: ["easy", "medium", "hard"],
      exam_status: ["draft", "assigned", "closed"],
      question_status: ["draft", "review", "published", "archived"],
      question_type: ["mcq", "short", "tf", "written"],
    },
  },
} as const
