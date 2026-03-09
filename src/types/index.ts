import type { Database } from './database'

// Row types (read from database)
export type Profile = Database['public']['Tables']['profiles']['Row']
export type SectorProfile = Database['public']['Tables']['sector_profiles']['Row']
export type Company = Database['public']['Tables']['companies']['Row']
export type Diagnostic = Database['public']['Tables']['diagnostics']['Row']
export type CategoryScore = Database['public']['Tables']['category_scores']['Row']
export type RiskAnswer = Database['public']['Tables']['risk_answers']['Row']
export type PreventionPlan = Database['public']['Tables']['prevention_plans']['Row']
export type PreventionAction = Database['public']['Tables']['prevention_actions']['Row']
export type Offer = Database['public']['Tables']['offers']['Row']
export type Report = Database['public']['Tables']['reports']['Row']

// Insert types (create new rows)
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type SectorProfileInsert = Database['public']['Tables']['sector_profiles']['Insert']
export type CompanyInsert = Database['public']['Tables']['companies']['Insert']
export type DiagnosticInsert = Database['public']['Tables']['diagnostics']['Insert']
export type CategoryScoreInsert = Database['public']['Tables']['category_scores']['Insert']
export type RiskAnswerInsert = Database['public']['Tables']['risk_answers']['Insert']
export type PreventionPlanInsert = Database['public']['Tables']['prevention_plans']['Insert']
export type PreventionActionInsert = Database['public']['Tables']['prevention_actions']['Insert']
export type OfferInsert = Database['public']['Tables']['offers']['Insert']
export type ReportInsert = Database['public']['Tables']['reports']['Insert']

// Update types (partial updates)
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type SectorProfileUpdate = Database['public']['Tables']['sector_profiles']['Update']
export type CompanyUpdate = Database['public']['Tables']['companies']['Update']
export type DiagnosticUpdate = Database['public']['Tables']['diagnostics']['Update']
export type CategoryScoreUpdate = Database['public']['Tables']['category_scores']['Update']
export type RiskAnswerUpdate = Database['public']['Tables']['risk_answers']['Update']
export type PreventionPlanUpdate = Database['public']['Tables']['prevention_plans']['Update']
export type PreventionActionUpdate = Database['public']['Tables']['prevention_actions']['Update']
export type OfferUpdate = Database['public']['Tables']['offers']['Update']
export type ReportUpdate = Database['public']['Tables']['reports']['Update']

// Enum-like union types
export type RiskCategory = 'fire' | 'liability' | 'dependency' | 'equipment' | 'cyber' | 'fleet'
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'
export type DiagnosticStatus = 'draft' | 'completed' | 'archived'
export type UserRole = 'broker' | 'underwriter' | 'admin'
export type PreventionPlanStatus = 'draft' | 'validated' | 'active' | 'completed'
export type PreventionActionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type OfferType = 'A' | 'B'

// Re-export the Database type
export type { Database } from './database'
