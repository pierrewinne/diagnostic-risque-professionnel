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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      category_scores: {
        Row: {
          category: string
          diagnostic_id: string
          id: string
          risk_level: string | null
          score: number
          weight: number
        }
        Insert: {
          category: string
          diagnostic_id: string
          id?: string
          risk_level?: string | null
          score?: number
          weight?: number
        }
        Update: {
          category?: string
          diagnostic_id?: string
          id?: string
          risk_level?: string | null
          score?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_scores_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          created_by: string
          employees: number | null
          id: string
          nace_code: string | null
          name: string
          revenue: number | null
          sector: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          employees?: number | null
          id?: string
          nace_code?: string | null
          name: string
          revenue?: number | null
          sector?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          employees?: number | null
          id?: string
          nace_code?: string | null
          name?: string
          revenue?: number | null
          sector?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_sector_fkey"
            columns: ["sector"]
            isOneToOne: false
            referencedRelation: "sector_profiles"
            referencedColumns: ["sector"]
          },
        ]
      }
      diagnostics: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          global_score: number | null
          id: string
          risk_level: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          global_score?: number | null
          id?: string
          risk_level?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          global_score?: number | null
          id?: string
          risk_level?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          conditions: string | null
          created_at: string
          diagnostic_id: string
          discount_pct: number | null
          id: string
          premium: number
          score_used: number
          type: string
        }
        Insert: {
          conditions?: string | null
          created_at?: string
          diagnostic_id: string
          discount_pct?: number | null
          id?: string
          premium: number
          score_used: number
          type: string
        }
        Update: {
          conditions?: string | null
          created_at?: string
          diagnostic_id?: string
          discount_pct?: number | null
          id?: string
          premium?: number
          score_used?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      prevention_actions: {
        Row: {
          action_label: string
          category: string
          deadline_months: number
          description: string | null
          estimated_cost_max: number | null
          estimated_cost_min: number | null
          id: string
          plan_id: string
          score_reduction: number
          status: string
          target_question_key: string | null
        }
        Insert: {
          action_label: string
          category: string
          deadline_months?: number
          description?: string | null
          estimated_cost_max?: number | null
          estimated_cost_min?: number | null
          id?: string
          plan_id: string
          score_reduction?: number
          status?: string
          target_question_key?: string | null
        }
        Update: {
          action_label?: string
          category?: string
          deadline_months?: number
          description?: string | null
          estimated_cost_max?: number | null
          estimated_cost_min?: number | null
          id?: string
          plan_id?: string
          score_reduction?: number
          status?: string
          target_question_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prevention_actions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "prevention_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      prevention_plans: {
        Row: {
          created_at: string
          diagnostic_id: string
          id: string
          improved_global_score: number | null
          status: string
          total_discount_pct: number | null
        }
        Insert: {
          created_at?: string
          diagnostic_id: string
          id?: string
          improved_global_score?: number | null
          status?: string
          total_discount_pct?: number | null
        }
        Update: {
          created_at?: string
          diagnostic_id?: string
          id?: string
          improved_global_score?: number | null
          status?: string
          total_discount_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prevention_plans_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: true
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          diagnostic_id: string
          file_name: string | null
          generated_at: string
          id: string
          storage_path: string
        }
        Insert: {
          diagnostic_id: string
          file_name?: string | null
          generated_at?: string
          id?: string
          storage_path: string
        }
        Update: {
          diagnostic_id?: string
          file_name?: string | null
          generated_at?: string
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_answers: {
        Row: {
          answer_value: string
          category: string
          diagnostic_id: string
          factor_score: number | null
          id: string
          question_key: string
        }
        Insert: {
          answer_value: string
          category: string
          diagnostic_id: string
          factor_score?: number | null
          id?: string
          question_key: string
        }
        Update: {
          answer_value?: string
          category?: string
          diagnostic_id?: string
          factor_score?: number | null
          id?: string
          question_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_answers_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_profiles: {
        Row: {
          category_weights: Json
          created_at: string
          id: string
          label: string
          sector: string
        }
        Insert: {
          category_weights?: Json
          created_at?: string
          id?: string
          label: string
          sector: string
        }
        Update: {
          category_weights?: Json
          created_at?: string
          id?: string
          label?: string
          sector?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
