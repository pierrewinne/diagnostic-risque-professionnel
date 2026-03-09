import type { RiskCategory } from '../types'

export interface PreventionActionDef {
  category: RiskCategory
  actionLabel: string
  description: string
  scoreReduction: number  // points to reduce on factor score
  targetQuestionKey: string
  deadlineMonths: number  // 3, 6, or 12
  estimatedCostMin: number
  estimatedCostMax: number
}

// All available prevention actions mapped to question keys
// Only triggered when the factor score for that question >= 5
export const PREVENTION_CATALOG: PreventionActionDef[] = [
  // Fire
  {
    category: 'fire',
    actionLabel: 'Installer un système de détection incendie',
    description: 'Installation de détecteurs de fumée, sprinklers et alarme incendie automatique',
    scoreReduction: 3,
    targetQuestionKey: 'fire_detection',
    deadlineMonths: 6,
    estimatedCostMin: 2000,
    estimatedCostMax: 8000,
  },
  {
    category: 'fire',
    actionLabel: 'Sécuriser le stockage de matières dangereuses',
    description: 'Mise en conformité du stockage : armoires ignifugées, zones dédiées',
    scoreReduction: 3,
    targetQuestionKey: 'fire_hazmat',
    deadlineMonths: 6,
    estimatedCostMin: 1500,
    estimatedCostMax: 5000,
  },
  {
    category: 'fire',
    actionLabel: 'Améliorer la résistance au feu du bâtiment',
    description: 'Traitement ignifuge des structures, compartimentage',
    scoreReduction: 2,
    targetQuestionKey: 'fire_construction',
    deadlineMonths: 12,
    estimatedCostMin: 5000,
    estimatedCostMax: 20000,
  },

  // Liability
  {
    category: 'liability',
    actionLabel: 'Encadrer contractuellement la sous-traitance',
    description: 'Clauses de responsabilité, assurance obligatoire des sous-traitants',
    scoreReduction: 3,
    targetQuestionKey: 'rc_subcontracting',
    deadlineMonths: 3,
    estimatedCostMin: 1000,
    estimatedCostMax: 3000,
  },
  {
    category: 'liability',
    actionLabel: 'Mettre en place un processus qualité produit',
    description: 'Contrôle qualité renforcé, traçabilité, procédure de rappel',
    scoreReduction: 3,
    targetQuestionKey: 'rc_bodily',
    deadlineMonths: 6,
    estimatedCostMin: 3000,
    estimatedCostMax: 10000,
  },

  // Dependency
  {
    category: 'dependency',
    actionLabel: 'Rédiger un Plan de Continuité d\'Activité (PCA)',
    description: 'Document formalisant les procédures de reprise après sinistre majeur',
    scoreReduction: 4,
    targetQuestionKey: 'dep_pca',
    deadlineMonths: 6,
    estimatedCostMin: 3000,
    estimatedCostMax: 10000,
  },
  {
    category: 'dependency',
    actionLabel: 'Diversifier les fournisseurs critiques',
    description: 'Identifier et qualifier des fournisseurs alternatifs pour les approvisionnements clés',
    scoreReduction: 3,
    targetQuestionKey: 'dep_supplier',
    deadlineMonths: 12,
    estimatedCostMin: 0,
    estimatedCostMax: 5000,
  },
  {
    category: 'dependency',
    actionLabel: 'Créer un site de repli ou backup',
    description: 'Accord avec un site partenaire ou location d\'un espace de secours',
    scoreReduction: 3,
    targetQuestionKey: 'dep_single_site',
    deadlineMonths: 12,
    estimatedCostMin: 2000,
    estimatedCostMax: 15000,
  },

  // Equipment
  {
    category: 'equipment',
    actionLabel: 'Mettre en place une maintenance préventive',
    description: 'Contrat de maintenance régulière avec planning d\'interventions',
    scoreReduction: 3,
    targetQuestionKey: 'equip_maintenance',
    deadlineMonths: 3,
    estimatedCostMin: 2000,
    estimatedCostMax: 10000,
  },
  {
    category: 'equipment',
    actionLabel: 'Planifier le renouvellement des équipements critiques',
    description: 'Plan d\'investissement pour remplacer les machines obsolètes',
    scoreReduction: 3,
    targetQuestionKey: 'equip_age',
    deadlineMonths: 12,
    estimatedCostMin: 10000,
    estimatedCostMax: 50000,
  },

  // Cyber
  {
    category: 'cyber',
    actionLabel: 'Mettre en place des sauvegardes externalisées',
    description: 'Sauvegardes automatiques, chiffrées et testées (règle 3-2-1)',
    scoreReduction: 3,
    targetQuestionKey: 'cyber_backup',
    deadlineMonths: 3,
    estimatedCostMin: 500,
    estimatedCostMax: 3000,
  },
  {
    category: 'cyber',
    actionLabel: 'Former les employés à la cybersécurité',
    description: 'Programme de sensibilisation : phishing, mots de passe, bonnes pratiques',
    scoreReduction: 2,
    targetQuestionKey: 'cyber_training',
    deadlineMonths: 3,
    estimatedCostMin: 1500,
    estimatedCostMax: 5000,
  },
  {
    category: 'cyber',
    actionLabel: 'Déployer l\'authentification multi-facteurs (MFA)',
    description: 'MFA sur tous les accès critiques : email, VPN, applications métier',
    scoreReduction: 3,
    targetQuestionKey: 'cyber_mfa',
    deadlineMonths: 3,
    estimatedCostMin: 500,
    estimatedCostMax: 2000,
  },

  // Fleet
  {
    category: 'fleet',
    actionLabel: 'Instaurer une politique de conduite',
    description: 'Charte de conduite, formation éco-conduite, suivi télématique',
    scoreReduction: 3,
    targetQuestionKey: 'fleet_policy',
    deadlineMonths: 6,
    estimatedCostMin: 1000,
    estimatedCostMax: 5000,
  },
]

// Generate applicable prevention actions based on risk answers
// Only include actions where the target factor score >= 5
export function generatePreventionPlan(
  answers: { questionKey: string; factorScore: number }[]
): PreventionActionDef[] {
  const answerMap = new Map(answers.map(a => [a.questionKey, a.factorScore]))
  return PREVENTION_CATALOG.filter(action => {
    const score = answerMap.get(action.targetQuestionKey)
    return score !== undefined && score >= 5
  })
}

// Compute improved score for a category after applying prevention actions
// Takes original factors and applicable reductions
export function computeImprovedCategoryScore(
  factors: { questionKey: string; factorScore: number; weight: number }[],
  actions: PreventionActionDef[]
): number {
  const reductionMap = new Map(actions.map(a => [a.targetQuestionKey, a.scoreReduction]))
  const improvedFactors = factors.map(f => ({
    ...f,
    factorScore: Math.max(0, f.factorScore - (reductionMap.get(f.questionKey) || 0)),
  }))
  return improvedFactors.reduce((sum, f) => sum + f.factorScore * f.weight, 0) * 10
}

// Calculate discount percentage
// Décote (%) = min(Plafond, (Score_actuel - Score_amélioré) / Score_actuel x Facteur_décote)
export interface DiscountParams {
  discountFactor: number  // default 0.5
  floorPct: number        // default 5 (%)
  ceilingPct: number      // default 25 (%)
}

export const DEFAULT_DISCOUNT_PARAMS: DiscountParams = {
  discountFactor: 0.5,
  floorPct: 5,
  ceilingPct: 25,
}

export function computeDiscount(
  currentScore: number,
  improvedScore: number,
  params: DiscountParams = DEFAULT_DISCOUNT_PARAMS
): number {
  if (currentScore <= 0) return 0
  const raw = ((currentScore - improvedScore) / currentScore) * params.discountFactor * 100
  if (raw < params.floorPct) return params.floorPct
  return Math.min(params.ceilingPct, Math.round(raw * 10) / 10)
}

// Calculate premium from score (simplified model)
// Base premium calculation: basePremium * multiplier
export function computePremium(
  score: number,
  revenue: number,
  employees: number
): number {
  // Base premium: 0.5% of revenue + 100EUR per employee
  const basePremium = (revenue * 0.005) + (employees * 100)
  // Score multiplier: 0.7 for score=0, 1.5 for score=100
  const multiplier = 0.7 + (score / 100) * 0.8
  return Math.round(basePremium * multiplier)
}
