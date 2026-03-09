import type { RiskCategory, RiskLevel } from '../types'

// Risk categories
type CategoryWeights = Record<RiskCategory, number>

// Compute score for a single category (0-100)
// Takes array of { questionKey, factorScore (0-10), weight (0-1) }
export function computeCategoryScore(factors: { factorScore: number; weight: number }[]): number {
  // Weighted average of factor scores, multiplied by 10 to get 0-100 scale
  const score = factors.reduce((sum, f) => sum + f.factorScore * f.weight, 0) * 10
  return Math.round(score * 100) / 100
}

// Compute global score from category scores and weights
export function computeGlobalScore(
  categoryScores: Record<RiskCategory, number>,
  weights: CategoryWeights
): number {
  // Sum of (category_score * weight)
  return Object.entries(categoryScores).reduce((sum, [cat, score]) => {
    return sum + score * (weights[cat as RiskCategory] || 0)
  }, 0)
}

// Get risk level from score
export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'low'
  if (score <= 50) return 'moderate'
  if (score <= 75) return 'high'
  return 'critical'
}

// Get risk level label in French
export function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'Faible'
    case 'moderate': return 'Modéré'
    case 'high': return 'Élevé'
    case 'critical': return 'Critique'
  }
}

// Get risk level color (tailwind class compatible)
export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'low': return '#22c55e'
    case 'moderate': return '#f59e0b'
    case 'high': return '#f97316'
    case 'critical': return '#ef4444'
  }
}

// Default weights
export const DEFAULT_WEIGHTS: CategoryWeights = {
  fire: 0.25,
  liability: 0.20,
  dependency: 0.20,
  equipment: 0.15,
  cyber: 0.15,
  fleet: 0.05,
}
