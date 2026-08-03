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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      attendance: {
        Row: {
          branch_id: string | null
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          project_id: string
          recorded_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["attendance_subject_type"]
        }
        Insert: {
          branch_id?: string | null
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          project_id: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["attendance_subject_type"]
        }
        Update: {
          branch_id?: string | null
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          project_id?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["attendance_subject_type"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "project_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          event: Database["public"]["Enums"]["automation_event"]
          id: string
          is_active: boolean
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          event: Database["public"]["Enums"]["automation_event"]
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          event?: Database["public"]["Enums"]["automation_event"]
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          context: Json
          created_at: string
          error: string | null
          event: Database["public"]["Enums"]["automation_event"]
          id: string
          result: Json | null
          rule_id: string | null
          status: string
        }
        Insert: {
          context?: Json
          created_at?: string
          error?: string | null
          event: Database["public"]["Enums"]["automation_event"]
          id?: string
          result?: Json | null
          rule_id?: string | null
          status?: string
        }
        Update: {
          context?: Json
          created_at?: string
          error?: string | null
          event?: Database["public"]["Enums"]["automation_event"]
          id?: string
          result?: Json | null
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          created_at: string
          criteria_type: string
          criteria_value: number | null
          description_ar: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          points_reward: number | null
        }
        Insert: {
          created_at?: string
          criteria_type?: string
          criteria_value?: number | null
          description_ar?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          points_reward?: number | null
        }
        Update: {
          created_at?: string
          criteria_type?: string
          criteria_value?: number | null
          description_ar?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
          points_reward?: number | null
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed_at: string | null
          created_at: string
          id: string
          participant_id: string
          progress: number | null
          status: string | null
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          participant_id: string
          progress?: number | null
          status?: string | null
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          progress?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          challenge_type: string | null
          created_at: string
          description_ar: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          points_reward: number
          project_id: string | null
          start_date: string | null
          target_value: number | null
        }
        Insert: {
          challenge_type?: string | null
          created_at?: string
          description_ar?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          points_reward?: number
          project_id?: string | null
          start_date?: string | null
          target_value?: number | null
        }
        Update: {
          challenge_type?: string | null
          created_at?: string
          description_ar?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
          points_reward?: number
          project_id?: string | null
          start_date?: string | null
          target_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      course_discussions: {
        Row: {
          content: string
          course_id: string
          created_at: string
          id: string
          lesson_id: string | null
          parent_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          parent_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_discussions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_discussions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_discussions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "course_discussions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          project_id: string
          target_group_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          project_id: string
          target_group_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          target_group_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_announcements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_announcements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_announcements_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_badges: {
        Row: {
          created_at: string
          description_ar: string | null
          icon: string | null
          id: string
          name_ar: string
          points_reward: number | null
          project_id: string | null
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          icon?: string | null
          id?: string
          name_ar: string
          points_reward?: number | null
          project_id?: string | null
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          icon?: string | null
          id?: string
          name_ar?: string
          points_reward?: number | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_badges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_badges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_budget: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          project_id: string
          title: string
          transaction_type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          title: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          title?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_budget_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_budget_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_groups: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          name_ar: string
          project_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          name_ar: string
          project_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          name_ar?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "project_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_initiative_grants: {
        Row: {
          awarded_by: string | null
          cancellation_reason: string | null
          created_at: string | null
          id: string
          initiative_id: string
          notes: string | null
          participant_id: string
          points_awarded: number
          processed_at: string | null
          processed_by: string | null
          status: string
        }
        Insert: {
          awarded_by?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          id?: string
          initiative_id: string
          notes?: string | null
          participant_id: string
          points_awarded: number
          processed_at?: string | null
          processed_by?: string | null
          status?: string
        }
        Update: {
          awarded_by?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          id?: string
          initiative_id?: string
          notes?: string | null
          participant_id?: string
          points_awarded?: number
          processed_at?: string | null
          processed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_initiative_grants_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "enjaz_initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_initiative_grants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_initiative_grants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_initiatives: {
        Row: {
          award_method: string
          created_at: string | null
          created_by: string | null
          daily_limit: number | null
          description: string | null
          encouragement_message: string | null
          end_date: string | null
          icon: string | null
          id: string
          initiative_type: string
          is_active: boolean | null
          max_per_participant: number | null
          max_per_teacher: number | null
          max_total_distribution: number | null
          name: string
          points: number
          project_id: string
          requires_approval: boolean | null
          requires_notes: boolean | null
          scope: string
          show_in_log: boolean | null
          start_date: string | null
        }
        Insert: {
          award_method?: string
          created_at?: string | null
          created_by?: string | null
          daily_limit?: number | null
          description?: string | null
          encouragement_message?: string | null
          end_date?: string | null
          icon?: string | null
          id?: string
          initiative_type?: string
          is_active?: boolean | null
          max_per_participant?: number | null
          max_per_teacher?: number | null
          max_total_distribution?: number | null
          name: string
          points?: number
          project_id: string
          requires_approval?: boolean | null
          requires_notes?: boolean | null
          scope?: string
          show_in_log?: boolean | null
          start_date?: string | null
        }
        Update: {
          award_method?: string
          created_at?: string | null
          created_by?: string | null
          daily_limit?: number | null
          description?: string | null
          encouragement_message?: string | null
          end_date?: string | null
          icon?: string | null
          id?: string
          initiative_type?: string
          is_active?: boolean | null
          max_per_participant?: number | null
          max_per_teacher?: number | null
          max_total_distribution?: number | null
          name?: string
          points?: number
          project_id?: string
          requires_approval?: boolean | null
          requires_notes?: boolean | null
          scope?: string
          show_in_log?: boolean | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_initiatives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_initiatives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          project_id: string
          recipient_id: string | null
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          project_id: string
          recipient_id?: string | null
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          recipient_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_participant_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          participant_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          participant_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_participant_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "enjaz_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_participant_badges_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_participant_badges_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_quiz_attempts: {
        Row: {
          completed_at: string
          id: string
          participant_id: string
          points_awarded: number
          quiz_id: string
          score: number
        }
        Insert: {
          completed_at?: string
          id?: string
          participant_id: string
          points_awarded?: number
          quiz_id: string
          score?: number
        }
        Update: {
          completed_at?: string
          id?: string
          participant_id?: string
          points_awarded?: number
          quiz_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_quiz_attempts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_quiz_attempts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "enjaz_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_quiz_questions: {
        Row: {
          correct_option_index: number
          id: string
          options: Json
          points_reward: number
          question_text: string
          quiz_id: string
        }
        Insert: {
          correct_option_index?: number
          id?: string
          options?: Json
          points_reward?: number
          question_text: string
          quiz_id: string
        }
        Update: {
          correct_option_index?: number
          id?: string
          options?: Json
          points_reward?: number
          question_text?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "enjaz_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_quizzes: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean | null
          project_id: string
          title: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          project_id: string
          title: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_quizzes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_quizzes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_reward_claims: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          processed_at: string | null
          processed_by: string | null
          reward_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          processed_at?: string | null
          processed_by?: string | null
          reward_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reward_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_reward_claims_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_reward_claims_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_reward_claims_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "enjaz_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_rewards: {
        Row: {
          created_at: string
          description_ar: string | null
          id: string
          is_active: boolean | null
          name_ar: string
          points_required: number
          project_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          id?: string
          is_active?: boolean | null
          name_ar: string
          points_required?: number
          project_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          id?: string
          is_active?: boolean | null
          name_ar?: string
          points_required?: number
          project_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_rewards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_rewards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_task_submissions: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          points_awarded: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submission_text: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          points_awarded?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_text?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          points_awarded?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_text?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_task_submissions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_task_submissions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_task_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "enjaz_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      enjaz_tasks: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          points_reward: number
          project_id: string
          start_date: string | null
          target_group_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          points_reward?: number
          project_id: string
          start_date?: string | null
          target_group_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          points_reward?: number
          project_id?: string
          start_date?: string | null
          target_group_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "enjaz_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enjaz_tasks_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          transaction_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          transaction_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          transaction_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          amount: number
          branch_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          direction: Database["public"]["Enums"]["finance_direction"]
          id: string
          notes: string | null
          party: string | null
          project_id: string | null
          transaction_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          direction: Database["public"]["Enums"]["finance_direction"]
          id?: string
          notes?: string | null
          party?: string | null
          project_id?: string | null
          transaction_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          direction?: Database["public"]["Enums"]["finance_direction"]
          id?: string
          notes?: string | null
          party?: string | null
          project_id?: string | null
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "project_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          national_id: string | null
          notes: string | null
          phone: string
          relation: Database["public"]["Enums"]["guardian_relation"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone: string
          relation?: Database["public"]["Enums"]["guardian_relation"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone?: string
          relation?: Database["public"]["Enums"]["guardian_relation"]
          updated_at?: string
        }
        Relationships: []
      }
      in_app_notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          priority: string | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          priority?: string | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          priority?: string | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      landing_page_settings: {
        Row: {
          about_us: Json | null
          business_platform_btn: Json | null
          header_links: Json | null
          id: string
          news_cards: Json | null
          partners_carousel: Json | null
          popup_alert: Json | null
          social_media_links: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          about_us?: Json | null
          business_platform_btn?: Json | null
          header_links?: Json | null
          id?: string
          news_cards?: Json | null
          partners_carousel?: Json | null
          popup_alert?: Json | null
          social_media_links?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          about_us?: Json | null
          business_platform_btn?: Json | null
          header_links?: Json | null
          id?: string
          news_cards?: Json | null
          partners_carousel?: Json | null
          popup_alert?: Json | null
          social_media_links?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      lms_activities: {
        Row: {
          academic_weight: number
          activity_type: string
          content: Json | null
          course_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_required: boolean
          lesson_id: string | null
          max_points: number | null
          module_id: string | null
          title_ar: string
          title_en: string | null
        }
        Insert: {
          academic_weight?: number
          activity_type?: string
          content?: Json | null
          course_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_required?: boolean
          lesson_id?: string | null
          max_points?: number | null
          module_id?: string | null
          title_ar: string
          title_en?: string | null
        }
        Update: {
          academic_weight?: number
          activity_type?: string
          content?: Json | null
          course_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_required?: boolean
          lesson_id?: string | null
          max_points?: number | null
          module_id?: string | null
          title_ar?: string
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_activities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_activities_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "lms_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_activity_submissions: {
        Row: {
          activity_id: string
          attachment_urls: Json | null
          feedback: string | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          status: string
          submission_content: Json | null
          submitted_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          attachment_urls?: Json | null
          feedback?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          status?: string
          submission_content?: Json | null
          submitted_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          attachment_urls?: Json | null
          feedback?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          status?: string
          submission_content?: Json | null
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_activity_submissions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "lms_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_certificates: {
        Row: {
          code: string
          course_id: string
          id: string
          issued_at: string
          participant_id: string | null
          qr_payload: string | null
          user_id: string
          verification_code: string | null
          verification_url: string | null
        }
        Insert: {
          code?: string
          course_id: string
          id?: string
          issued_at?: string
          participant_id?: string | null
          qr_payload?: string | null
          user_id: string
          verification_code?: string | null
          verification_url?: string | null
        }
        Update: {
          code?: string
          course_id?: string
          id?: string
          issued_at?: string
          participant_id?: string | null
          qr_payload?: string | null
          user_id?: string
          verification_code?: string | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_certificates_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_certificates_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_courses: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_public: boolean | null
          is_published: boolean
          max_attempts: number | null
          pass_score: number
          points_reward: number
          project_id: string | null
          thumbnail_url: string | null
          title_ar: string
          title_en: string | null
          updated_at: string
          video_url: string | null
          youtube_url: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_public?: boolean | null
          is_published?: boolean
          max_attempts?: number | null
          pass_score?: number
          points_reward?: number
          project_id?: string | null
          thumbnail_url?: string | null
          title_ar: string
          title_en?: string | null
          updated_at?: string
          video_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_public?: boolean | null
          is_published?: boolean
          max_attempts?: number | null
          pass_score?: number
          points_reward?: number
          project_id?: string | null
          thumbnail_url?: string | null
          title_ar?: string
          title_en?: string | null
          updated_at?: string
          video_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_courses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_courses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_enrollments: {
        Row: {
          completed_at: string | null
          completed_lessons: Json | null
          course_id: string
          enrolled_at: string
          id: string
          progress: number
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_lessons?: Json | null
          course_id: string
          enrolled_at?: string
          id?: string
          progress?: number
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_lessons?: Json | null
          course_id?: string
          enrolled_at?: string
          id?: string
          progress?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_instructor_notes: {
        Row: {
          author_id: string
          course_id: string
          created_at: string
          id: string
          is_private: boolean
          note: string
          student_id: string
        }
        Insert: {
          author_id: string
          course_id: string
          created_at?: string
          id?: string
          is_private?: boolean
          note: string
          student_id: string
        }
        Update: {
          author_id?: string
          course_id?: string
          created_at?: string
          id?: string
          is_private?: boolean
          note?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_instructor_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_learning_paths: {
        Row: {
          course_ids: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          name_ar: string
          name_en: string | null
          project_id: string | null
        }
        Insert: {
          course_ids?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          name_ar: string
          name_en?: string | null
          project_id?: string | null
        }
        Update: {
          course_ids?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          name_ar?: string
          name_en?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_learning_paths_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_learning_paths_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_lessons: {
        Row: {
          academic_weight: number
          content: string | null
          course_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          lesson_type: string
          module_id: string | null
          order_index: number
          pdf_url: string | null
          prerequisites: Json | null
          sort_order: number | null
          title: string
          title_ar: string | null
          title_en: string | null
          unlock_time_seconds: number | null
          updated_at: string
          validation_rules: Json | null
          video_url: string | null
          youtube_url: string | null
        }
        Insert: {
          academic_weight?: number
          content?: string | null
          course_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          lesson_type?: string
          module_id?: string | null
          order_index?: number
          pdf_url?: string | null
          prerequisites?: Json | null
          sort_order?: number | null
          title: string
          title_ar?: string | null
          title_en?: string | null
          unlock_time_seconds?: number | null
          updated_at?: string
          validation_rules?: Json | null
          video_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          academic_weight?: number
          content?: string | null
          course_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          lesson_type?: string
          module_id?: string | null
          order_index?: number
          pdf_url?: string | null
          prerequisites?: Json | null
          sort_order?: number | null
          title?: string
          title_ar?: string | null
          title_en?: string | null
          unlock_time_seconds?: number | null
          updated_at?: string
          validation_rules?: Json | null
          video_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "lms_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_live_sessions: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          id: string
          meeting_type: string | null
          meeting_url: string | null
          notes: string | null
          scheduled_at: string
          title_ar: string
          title_en: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_type?: string | null
          meeting_url?: string | null
          notes?: string | null
          scheduled_at: string
          title_ar: string
          title_en?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          meeting_type?: string | null
          meeting_url?: string | null
          notes?: string | null
          scheduled_at?: string
          title_ar?: string
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_live_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          order_index: number
          prerequisites: Json | null
          sort_order: number | null
          title_ar: string
          title_en: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          order_index?: number
          prerequisites?: Json | null
          sort_order?: number | null
          title_ar: string
          title_en?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          order_index?: number
          prerequisites?: Json | null
          sort_order?: number | null
          title_ar?: string
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_questions: {
        Row: {
          correct_index: number
          id: string
          options: Json
          order_index: number
          question: string
          quiz_id: string
        }
        Insert: {
          correct_index?: number
          id?: string
          options?: Json
          order_index?: number
          question: string
          quiz_id: string
        }
        Update: {
          correct_index?: number
          id?: string
          options?: Json
          order_index?: number
          question?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "lms_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_quiz_attempts: {
        Row: {
          answers: Json
          id: string
          passed: boolean
          quiz_id: string
          score: number
          submitted_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          id?: string
          passed?: boolean
          quiz_id: string
          score?: number
          submitted_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "lms_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_quizzes: {
        Row: {
          academic_weight: number
          course_id: string
          created_at: string
          id: string
          pass_score: number
          title: string
        }
        Insert: {
          academic_weight?: number
          course_id: string
          created_at?: string
          id?: string
          pass_score?: number
          title: string
        }
        Update: {
          academic_weight?: number
          course_id?: string
          created_at?: string
          id?: string
          pass_score?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      message_thread_members: {
        Row: {
          id: string
          joined_at: string
          last_read_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          project_id: string | null
          subject: string | null
          thread_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string | null
          subject?: string | null
          thread_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string | null
          subject?: string | null
          thread_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          body: string
          created_at: string
          id: string
          is_deleted: boolean
          sender_id: string
          thread_id: string
        }
        Insert: {
          attachments?: Json | null
          body: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          sender_id: string
          thread_id: string
        }
        Update: {
          attachments?: Json | null
          body?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_template: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          is_active: boolean
          key: string
          last_used_at: string | null
          manual_variables: Json
          meta_components: Json | null
          name: string
          subject_template: string | null
          updated_at: string
          usage_count: number
          variables: Json
          variables_config: Json | null
        }
        Insert: {
          body_template: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          last_used_at?: string | null
          manual_variables?: Json
          meta_components?: Json | null
          name: string
          subject_template?: string | null
          updated_at?: string
          usage_count?: number
          variables?: Json
          variables_config?: Json | null
        }
        Update: {
          body_template?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          last_used_at?: string | null
          manual_variables?: Json
          meta_components?: Json | null
          name?: string
          subject_template?: string | null
          updated_at?: string
          usage_count?: number
          variables?: Json
          variables_config?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          category: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          created_by: string | null
          delivered_at: string | null
          error: string | null
          id: string
          is_read: boolean
          provider_message_id: string | null
          read_at: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string | null
          target_user_id: string | null
          template: string
        }
        Insert: {
          action_url?: string | null
          body: string
          category?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          is_read?: boolean
          provider_message_id?: string | null
          read_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          target_user_id?: string | null
          template?: string
        }
        Update: {
          action_url?: string | null
          body?: string
          category?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          is_read?: boolean
          provider_message_id?: string | null
          read_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          target_user_id?: string | null
          template?: string
        }
        Relationships: []
      }
      participant_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          participant_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          participant_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_badges_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_badges_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_learning_activity: {
        Row: {
          activity_type: string
          course_id: string | null
          created_at: string
          duration_seconds: number
          id: string
          lesson_id: string | null
          metadata: Json
          participant_id: string
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          activity_type?: string
          course_id?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          lesson_id?: string | null
          metadata?: Json
          participant_id: string
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          course_id?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          lesson_id?: string | null
          metadata?: Json
          participant_id?: string
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_learning_activity_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_learning_activity_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_learning_activity_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_learning_activity_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_learning_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_learning_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_levels: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          max_points: number
          min_points: number
          name_ar: string
          name_en: string | null
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          max_points?: number
          min_points?: number
          name_ar: string
          name_en?: string | null
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          max_points?: number
          min_points?: number
          name_ar?: string
          name_en?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      participant_points_log: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          participant_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          participant_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          participant_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_points_log_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_points_log_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_project_memberships: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          branch_id: string | null
          enrolled_at: string
          enrollment_source: string | null
          id: string
          notes: string | null
          participant_id: string
          project_id: string
          restored_at: string | null
          status: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          branch_id?: string | null
          enrolled_at?: string
          enrollment_source?: string | null
          id?: string
          notes?: string | null
          participant_id: string
          project_id: string
          restored_at?: string | null
          status?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          branch_id?: string | null
          enrolled_at?: string
          enrollment_source?: string | null
          id?: string
          notes?: string | null
          participant_id?: string
          project_id?: string
          restored_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_project_memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "project_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_project_memberships_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_project_memberships_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_project_memberships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_project_memberships_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_projects: {
        Row: {
          id: string
          participant_id: string
          project_id: string
          role: string | null
          joined_at: string
          created_at: string
        }
        Insert: {
          id?: string
          participant_id: string
          project_id: string
          role?: string | null
          joined_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          participant_id?: string
          project_id?: string
          role?: string | null
          joined_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_projects_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          date_of_birth: string | null
          email: string | null
          group_id: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          guardian_email: string | null
          guardian_id: string | null
          guardian_name: string | null
          guardian_national_id: string | null
          guardian_notes: string | null
          guardian_phone: string | null
          guardian_relation:
            | Database["public"]["Enums"]["guardian_relation"]
            | null
          id: string
          is_staff: boolean
          last_learning_activity_at: string | null
          learning_minutes: number
          national_id: string | null
          notes: string | null
          phone: string | null
          points: number
          portfolio_files: Json
          project_id: string | null
          staff_user_id: string | null
          status: Database["public"]["Enums"]["participant_status"]
          updated_at: string
          username: string | null
          weekly_goal_minutes: number
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          email?: string | null
          group_id?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          guardian_email?: string | null
          guardian_id?: string | null
          guardian_name?: string | null
          guardian_national_id?: string | null
          guardian_notes?: string | null
          guardian_phone?: string | null
          guardian_relation?:
            | Database["public"]["Enums"]["guardian_relation"]
            | null
          id?: string
          is_staff?: boolean
          last_learning_activity_at?: string | null
          learning_minutes?: number
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          points?: number
          portfolio_files?: Json
          project_id?: string | null
          staff_user_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
          username?: string | null
          weekly_goal_minutes?: number
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          date_of_birth?: string | null
          email?: string | null
          group_id?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          guardian_email?: string | null
          guardian_id?: string | null
          guardian_name?: string | null
          guardian_national_id?: string | null
          guardian_notes?: string | null
          guardian_phone?: string | null
          guardian_relation?:
            | Database["public"]["Enums"]["guardian_relation"]
            | null
          id?: string
          is_staff?: boolean
          last_learning_activity_at?: string | null
          learning_minutes?: number
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          points?: number
          portfolio_files?: Json
          project_id?: string | null
          staff_user_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
          username?: string | null
          weekly_goal_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "participants_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "project_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          label_ar: string
          label_en: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          key: string
          label_ar: string
          label_en: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          label_ar?: string
          label_en?: string
        }
        Relationships: []
      }
      profile_edit_requests: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          rejection_reason: string | null
          requested_changes: Json
          requester_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          rejection_reason?: string | null
          requested_changes?: Json
          requester_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          rejection_reason?: string | null
          requested_changes?: Json
          requester_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_edit_requests_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_edit_requests_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name_ar: string | null
          display_name_en: string | null
          email: string | null
          full_name: string | null
          id: string
          is_password_setup_required: boolean | null
          national_id: string | null
          normalized_username: string | null
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name_ar?: string | null
          display_name_en?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_password_setup_required?: boolean | null
          national_id?: string | null
          normalized_username?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name_ar?: string | null
          display_name_en?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_password_setup_required?: boolean | null
          national_id?: string | null
          normalized_username?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      project_branches: {
        Row: {
          branch_manager_id: string | null
          created_at: string
          end_date: string | null
          id: string
          name_ar: string
          name_en: string | null
          project_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          branch_manager_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name_ar: string
          name_en?: string | null
          project_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          branch_manager_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name_ar?: string
          name_en?: string | null
          project_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_branches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_branches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          project_id: string
          uploaded_by: string | null
          youtube_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          project_id: string
          uploaded_by?: string | null
          youtube_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string
          uploaded_by?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_groups: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          name_ar: string
          name_en: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          name_ar: string
          name_en?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "project_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_learning_content: {
        Row: {
          audience_type: string
          body: string
          content_type: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          learning_path_id: string | null
          project_id: string | null
          scheduled_at: string | null
          settings: Json
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience_type?: string
          body: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          learning_path_id?: string | null
          project_id?: string | null
          scheduled_at?: string | null
          settings?: Json
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience_type?: string
          body?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          learning_path_id?: string | null
          project_id?: string | null
          scheduled_at?: string | null
          settings?: Json
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_learning_content_learning_path_id_fkey"
            columns: ["learning_path_id"]
            isOneToOne: false
            referencedRelation: "lms_learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_learning_content_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_learning_content_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_learning_content_audit: {
        Row: {
          action: string
          changed_by: string | null
          content_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_learning_content_audit_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "project_learning_content"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          branch_id: string | null
          created_at: string
          group_id: string | null
          id: string
          project_id: string
          project_role: string
          responsibilities: string[]
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          project_id: string
          project_role?: string
          responsibilities?: string[]
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          project_id?: string
          project_role?: string
          responsibilities?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "project_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_registrations: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          national_id: string | null
          notes: string | null
          phone: string | null
          project_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          project_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          project_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_registrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_registrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_surveys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          id: string
          is_published: boolean
          is_template: boolean
          project_id: string | null
          target_audience: string
          title_ar: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_published?: boolean
          is_template?: boolean
          project_id?: string | null
          target_audience?: string
          title_ar: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_published?: boolean
          is_template?: boolean
          project_id?: string | null
          target_audience?: string
          title_ar?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          default_tasks: Json
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          default_tasks?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          default_tasks?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_trainings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          library_id: string | null
          project_id: string
          structure_jsonb: Json
          target_groups: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          library_id?: string | null
          project_id: string
          structure_jsonb?: Json
          target_groups?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          library_id?: string | null
          project_id?: string
          structure_jsonb?: Json
          target_groups?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_trainings_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "training_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_trainings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_trainings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          capacity: number | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          enjaz_enabled: boolean | null
          enjaz_points_absent: number | null
          enjaz_points_excused: number | null
          enjaz_points_late: number | null
          enjaz_points_present: number | null
          excluded_dates: string[] | null
          excluded_weekdays: number[] | null
          has_branches: boolean
          id: string
          is_public: boolean
          manager_id: string | null
          name_ar: string
          name_en: string | null
          project_mode: Database["public"]["Enums"]["project_mode"]
          registration_deadline: string | null
          registration_open: boolean
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          waitlist_enabled: boolean
          whatsapp_automation_enabled: boolean
        }
        Insert: {
          budget?: number | null
          capacity?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          enjaz_enabled?: boolean | null
          enjaz_points_absent?: number | null
          enjaz_points_excused?: number | null
          enjaz_points_late?: number | null
          enjaz_points_present?: number | null
          excluded_dates?: string[] | null
          excluded_weekdays?: number[] | null
          has_branches?: boolean
          id?: string
          is_public?: boolean
          manager_id?: string | null
          name_ar: string
          name_en?: string | null
          project_mode?: Database["public"]["Enums"]["project_mode"]
          registration_deadline?: string | null
          registration_open?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          waitlist_enabled?: boolean
          whatsapp_automation_enabled?: boolean
        }
        Update: {
          budget?: number | null
          capacity?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          enjaz_enabled?: boolean | null
          enjaz_points_absent?: number | null
          enjaz_points_excused?: number | null
          enjaz_points_late?: number | null
          enjaz_points_present?: number | null
          excluded_dates?: string[] | null
          excluded_weekdays?: number[] | null
          has_branches?: boolean
          id?: string
          is_public?: boolean
          manager_id?: string | null
          name_ar?: string
          name_en?: string | null
          project_mode?: Database["public"]["Enums"]["project_mode"]
          registration_deadline?: string | null
          registration_open?: boolean
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          waitlist_enabled?: boolean
          whatsapp_automation_enabled?: boolean
        }
        Relationships: []
      }
      registration_form_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          max_length: number | null
          min_length: number | null
          name_ar: string
          options_array: Json | null
          order_index: number | null
          regex_pattern: string | null
          system_key: string | null
          tab_section: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_type: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_length?: number | null
          min_length?: number | null
          name_ar: string
          options_array?: Json | null
          order_index?: number | null
          regex_pattern?: string | null
          system_key?: string | null
          tab_section?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_length?: number | null
          min_length?: number | null
          name_ar?: string
          options_array?: Json | null
          order_index?: number | null
          regex_pattern?: string | null
          system_key?: string | null
          tab_section?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      site_content: {
        Row: {
          body_ar: string | null
          body_en: string | null
          created_at: string
          data: Json
          display_order: number
          id: string
          is_published: boolean
          section: string
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          body_ar?: string | null
          body_en?: string | null
          created_at?: string
          data?: Json
          display_order?: number
          id?: string
          is_published?: boolean
          section: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          body_ar?: string | null
          body_en?: string | null
          created_at?: string
          data?: Json
          display_order?: number
          id?: string
          is_published?: boolean
          section?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_partners: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          website_url?: string | null
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          content_ar: string | null
          content_en: string | null
          created_at: string
          display_order: number
          id: string
          is_published: boolean | null
          media_url: string | null
          section_type: string
          settings: Json | null
          subtitle_ar: string | null
          subtitle_en: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          content_ar?: string | null
          content_en?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean | null
          media_url?: string | null
          section_type?: string
          settings?: Json | null
          subtitle_ar?: string | null
          subtitle_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          content_ar?: string | null
          content_en?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean | null
          media_url?: string | null
          section_type?: string
          settings?: Json | null
          subtitle_ar?: string | null
          subtitle_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_testimonials: {
        Row: {
          avatar_url: string | null
          content_ar: string
          content_en: string | null
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          rating: number | null
          role_ar: string | null
          role_en: string | null
        }
        Insert: {
          avatar_url?: string | null
          content_ar: string
          content_en?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          rating?: number | null
          role_ar?: string | null
          role_en?: string | null
        }
        Update: {
          avatar_url?: string | null
          content_ar?: string
          content_en?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
          rating?: number | null
          role_ar?: string | null
          role_en?: string | null
        }
        Relationships: []
      }
      staff_registration_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          national_id: string | null
          notes: string | null
          phone: string
          rejection_reason: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["staff_request_status"]
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone: string
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["staff_request_status"]
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone?: string
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["staff_request_status"]
        }
        Relationships: []
      }
      support_ticket_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          priority: string
          requester_id: string
          status: string
          title: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          priority?: string
          requester_id: string
          status?: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          priority?: string
          requester_id?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          answers: Json
          id: string
          submitted_at: string
          survey_id: string
          user_id: string
        }
        Insert: {
          answers?: Json
          id?: string
          submitted_at?: string
          survey_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          id?: string
          submitted_at?: string
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "project_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      system_attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      system_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_errors: {
        Row: {
          created_at: string
          details: string | null
          error_type: string
          id: string
          message: string
          severity: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          error_type: string
          id?: string
          message: string
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          error_type?: string
          id?: string
          message?: string
          severity?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: []
      }
      task_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          task_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          file_name: string
          file_type: string
          file_url: string
          id: string
          task_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_type: string
          file_url: string
          id?: string
          task_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          task_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_automations: {
        Row: {
          actions: Json | null
          conditions: Json | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          project_id: string
          trigger_event: string
        }
        Insert: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          trigger_event: string
        }
        Update: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_automations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_automations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          assignee_id: string | null
          checklist_id: string
          created_at: string
          due_date: string | null
          id: string
          is_completed: boolean
          sort_order: number | null
          title: string
        }
        Insert: {
          assignee_id?: string | null
          checklist_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          sort_order?: number | null
          title: string
        }
        Update: {
          assignee_id?: string | null
          checklist_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "task_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklists: {
        Row: {
          created_at: string
          id: string
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_relationships: {
        Row: {
          created_at: string
          id: string
          relation_type: string
          source_task_id: string
          target_task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          relation_type: string
          source_task_id: string
          target_task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relation_type?: string
          source_task_id?: string
          target_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_relationships_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_relationships_target_task_id_fkey"
            columns: ["target_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_offset_days: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          priority: Database["public"]["Enums"]["task_priority"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_offset_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: Database["public"]["Enums"]["task_priority"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_offset_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assignee_id: string | null
          branch_id: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          is_archived: boolean | null
          is_private: boolean | null
          parent_id: string | null
          points: number | null
          position: number | null
          priority: Database["public"]["Enums"]["task_priority"]
          progress_percent: number | null
          project_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_color: string | null
          title: string
          updated_at: string
          workflow_stage_id: string | null
        }
        Insert: {
          actual_hours?: number | null
          assignee_id?: string | null
          branch_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_archived?: boolean | null
          is_private?: boolean | null
          parent_id?: string | null
          points?: number | null
          position?: number | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress_percent?: number | null
          project_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_color?: string | null
          title: string
          updated_at?: string
          workflow_stage_id?: string | null
        }
        Update: {
          actual_hours?: number | null
          assignee_id?: string | null
          branch_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_archived?: boolean | null
          is_private?: boolean | null
          parent_id?: string | null
          points?: number | null
          position?: number | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress_percent?: number | null
          project_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_color?: string | null
          title?: string
          updated_at?: string
          workflow_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "project_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workflow_stage_id_fkey"
            columns: ["workflow_stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      training_library: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          structure_jsonb: Json
          title_ar: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          structure_jsonb?: Json
          title_ar: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          structure_jsonb?: Json
          title_ar?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_training_progress: {
        Row: {
          created_at: string
          id: string
          item_progress_jsonb: Json
          project_training_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_progress_jsonb?: Json
          project_training_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_progress_jsonb?: Json
          project_training_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_training_progress_project_training_id_fkey"
            columns: ["project_training_id"]
            isOneToOne: false
            referencedRelation: "project_trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automation_settings: {
        Row: {
          conditions: Json
          created_at: string
          delay_minutes: number
          id: string
          is_active: boolean
          target_audience: string
          template_key: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          target_audience: string
          template_key: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          target_audience?: string
          template_key?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automation_settings_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      whatsapp_opt_outs: {
        Row: {
          created_at: string
          id: string
          phone_number: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          phone_number: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          phone_number?: string
          reason?: string | null
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          created_at: string
          last_message_at: string
          phone_number: string
        }
        Insert: {
          created_at?: string
          last_message_at?: string
          phone_number: string
        }
        Update: {
          created_at?: string
          last_message_at?: string
          phone_number?: string
        }
        Relationships: []
      }
      workflow_stages: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name_ar: string
          name_en: string | null
          project_id: string
          sort_order: number | null
          wip_limit: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name_ar: string
          name_en?: string | null
          project_id: string
          sort_order?: number | null
          wip_limit?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string | null
          project_id?: string
          sort_order?: number | null
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      lms_questions_public: {
        Row: {
          id: string | null
          options: Json | null
          order_index: number | null
          question: string | null
          quiz_id: string | null
        }
        Insert: {
          id?: string | null
          options?: Json | null
          order_index?: number | null
          question?: string | null
          quiz_id?: string | null
        }
        Update: {
          id?: string | null
          options?: Json | null
          order_index?: number | null
          question?: string | null
          quiz_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "lms_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_summary_view: {
        Row: {
          absent_count: number | null
          certificates_count: number | null
          courses_count: number | null
          full_name: string | null
          id: string | null
          last_attendance: string | null
          national_id: string | null
          phone: string | null
          points: number | null
          present_count: number | null
          project_id: string | null
          status: Database["public"]["Enums"]["participant_status"] | null
        }
        Insert: {
          absent_count?: never
          certificates_count?: never
          courses_count?: never
          full_name?: string | null
          id?: string | null
          last_attendance?: never
          national_id?: string | null
          phone?: string | null
          points?: number | null
          present_count?: never
          project_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"] | null
        }
        Update: {
          absent_count?: never
          certificates_count?: never
          courses_count?: never
          full_name?: string | null
          id?: string | null
          last_attendance?: never
          national_id?: string | null
          phone?: string | null
          points?: number | null
          present_count?: never
          project_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summary_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_summary_view: {
        Row: {
          attendance_present_30d: number | null
          attendance_total_30d: number | null
          end_date: string | null
          id: string | null
          manager_id: string | null
          name_ar: string | null
          name_en: string | null
          participants_count: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          tasks_done: number | null
          tasks_overdue: number | null
          tasks_total: number | null
          total_expense: number | null
          total_income: number | null
        }
        Insert: {
          attendance_present_30d?: never
          attendance_total_30d?: never
          end_date?: string | null
          id?: string | null
          manager_id?: string | null
          name_ar?: string | null
          name_en?: string | null
          participants_count?: never
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tasks_done?: never
          tasks_overdue?: never
          tasks_total?: never
          total_expense?: never
          total_income?: never
        }
        Update: {
          attendance_present_30d?: never
          attendance_total_30d?: never
          end_date?: string | null
          id?: string | null
          manager_id?: string | null
          name_ar?: string | null
          name_en?: string | null
          participants_count?: never
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          tasks_done?: never
          tasks_overdue?: never
          tasks_total?: never
          total_expense?: never
          total_income?: never
        }
        Relationships: []
      }
    }
    Functions: {
      add_participant_points: {
        Args: { _delta: number; _participant_id: string; _reason: string }
        Returns: number
      }
      admin_change_user_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: boolean
      }
      admin_get_questions: {
        Args: { _quiz_id: string }
        Returns: {
          correct_index: number
          id: string
          options: Json
          order_index: number
          question: string
          quiz_id: string
        }[]
      }
      can_access_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_guardian: {
        Args: { _guardian_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_roles: { Args: { _user_id: string }; Returns: boolean }
      compute_participant_status: {
        Args: { _participant_id: string }
        Returns: string
      }
      compute_project_health: { Args: { _project_id: string }; Returns: Json }
      current_user_is_admin_or_assistant: { Args: never; Returns: boolean }
      current_user_is_manager: { Args: never; Returns: boolean }
      current_user_is_staff: { Args: never; Returns: boolean }
      exec_sql: { Args: { sql_query: string }; Returns: undefined }
      get_table_columns: {
        Args: { t_name: string }
        Returns: {
          col_name: string
          d_type: string
        }[]
      }
      get_unread_message_count: { Args: { _user_id: string }; Returns: number }
      get_unread_notification_count: {
        Args: { _user_id: string }
        Returns: number
      }
      get_user_email_by_identifier: {
        Args: { _identifier: string }
        Returns: string
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      grade_quiz: {
        Args: { _answers: Json; _quiz_id: string }
        Returns: {
          passed: boolean
          score: number
        }[]
      }
      has_any_role:
        | {
            Args: {
              _roles: Database["public"]["Enums"]["app_role"][]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _roles: string[]; _user_id: string }; Returns: boolean }
      has_project_responsibility: {
        Args: { _project_id: string; _responsibility: string; _user_id: string }
        Returns: boolean
      }
      has_project_role: {
        Args: { _project_id: string; _role: string; _user_id: string }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_system_admin: { Args: { _user_id: string }; Returns: boolean }
      user_has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "board"
        | "executive"
        | "assistant"
        | "project_manager"
        | "branch_manager"
        | "employee"
        | "contractor"
        | "participant"
        | "guardian"
        | "system_admin"
      attendance_status: "present" | "absent" | "late" | "excused"
      attendance_subject_type: "employee" | "participant"
      automation_action_type:
        | "send_notification"
        | "add_points"
        | "deduct_points"
        | "change_status"
        | "create_task"
        | "webhook"
      automation_event:
        | "attendance_recorded"
        | "attendance_absent_streak"
        | "task_overdue"
        | "lms_course_completed"
        | "lms_quiz_passed"
        | "participant_inactive"
        | "project_status_changed"
        | "finance_threshold"
        | "manual"
      finance_direction: "income" | "expense"
      gender: "male" | "female"
      guardian_relation: "father" | "mother" | "guardian" | "other"
      notification_channel: "whatsapp" | "sms" | "email"
      notification_status:
        | "pending"
        | "sent"
        | "failed"
        | "delivered"
        | "read"
        | "undelivered"
      notification_template: "absence" | "late" | "reminder" | "task" | "manual"
      participant_status: "active" | "inactive" | "archived"
      project_mode: "external" | "internal" | "mixed"
      project_status: "planned" | "in_progress" | "completed" | "stalled"
      staff_request_status: "pending" | "approved" | "rejected"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "new" | "in_progress" | "completed" | "overdue"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "board",
        "executive",
        "assistant",
        "project_manager",
        "branch_manager",
        "employee",
        "contractor",
        "participant",
        "guardian",
        "system_admin",
      ],
      attendance_status: ["present", "absent", "late", "excused"],
      attendance_subject_type: ["employee", "participant"],
      automation_action_type: [
        "send_notification",
        "add_points",
        "deduct_points",
        "change_status",
        "create_task",
        "webhook",
      ],
      automation_event: [
        "attendance_recorded",
        "attendance_absent_streak",
        "task_overdue",
        "lms_course_completed",
        "lms_quiz_passed",
        "participant_inactive",
        "project_status_changed",
        "finance_threshold",
        "manual",
      ],
      finance_direction: ["income", "expense"],
      gender: ["male", "female"],
      guardian_relation: ["father", "mother", "guardian", "other"],
      notification_channel: ["whatsapp", "sms", "email"],
      notification_status: [
        "pending",
        "sent",
        "failed",
        "delivered",
        "read",
        "undelivered",
      ],
      notification_template: ["absence", "late", "reminder", "task", "manual"],
      participant_status: ["active", "inactive", "archived"],
      project_mode: ["external", "internal", "mixed"],
      project_status: ["planned", "in_progress", "completed", "stalled"],
      staff_request_status: ["pending", "approved", "rejected"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["new", "in_progress", "completed", "overdue"],
    },
  },
} as const

