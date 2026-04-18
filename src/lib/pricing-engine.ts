// =============================================================================
// MOTEUR DE TARIFICATION TECHNIQUE — DiagRisk Pro Multi Pro
// =============================================================================
// Version  : 2.0.0
// Date     : 2026-04-18
// Auteur   : Actuariat Senior — DiagRisk Pro
// Contexte : Luxembourg, produit multirisque professionnelle (Dommages + RC Pro)
//
// Ce module implémente la transformation :
//   score catégoriel (0-100) -> coefficient technique -> prime ajustée
//
// v2.0 : Intégration des pools de risque NACE dans la chaîne de scoring.
//   Le facteur de risque intrinsèque du pool s'applique aux SCORES (pas aux
//   coefficients) avant conversion. Les poids finaux sont un blend
//   segment/activité x pool (alpha = 0.60 par défaut).
//
// v2.1 : Corrections audit actuariel + PM :
//   - P1-02 : facteur intrinsèque NACE = transformation AFFINE centrée sur s₀
//     (score_ajusté = s₀ + (score_brut - s₀) × factor) au lieu de multiplication
//     simple (score × factor). Élimine la saturation en queue droite.
//   - M1 : le coefficient pricing engine est AUTORITAIRE pour le calcul de prime.
//     Les premiumMultiplier de la matrice de souscription sont INDICATIFS uniquement.
//     computeUnderwritingDecision() reçoit les scores AJUSTÉS (avec facteur NACE).
//     Ajout d'un contrôle de cohérence coefficient vs fourchette matrice.
//
// Propriétés de la formule :
//   - Continue et monotone (pas de sauts)
//   - Asymétrique (majoration > rabais, principe de prudence actuarielle)
//   - Bornée : plancher 0.75 (-25%), plafond 1.80 (+80%)
//   - Point neutre : score = 52.5 -> coefficient = 1.00
//   - Raccord C1 au point neutre (continuité de la valeur et de la dérivée)
//
// Défendabilité CAA :
//   - Formule déterministe, transparente, explicable
//   - Pas de ML, pas de boîte noire
//   - Paramètres nommés et documentés
//   - Asymétrie justifiée par le principe de prudence
//   - Équilibre technique vérifié (barème légèrement excédentaire)
// =============================================================================

import type { RiskCategory } from '../types'
import type { CompanySegment, ActivityCategory, CategoryWeights } from './proportionality'
import {
  resolveSegment,
  resolveActivityCategory,
  resolveWeights,
  computeUnderwritingDecision,
} from './proportionality'
import type { CompanyData, UnderwritingResult } from './proportionality'
import { DEFAULT_WEIGHTS as DEFAULT_WEIGHTS_FALLBACK } from './scoring'
import { resolvePool, getPoolById, combineWeights, applyIntrinsicRiskFactor } from '../data/nace-risk-pools'

// ---------------------------------------------------------------------------
// 1. PARAMÈTRES DU BARÈME
// ---------------------------------------------------------------------------

/**
 * Paramètres de la courbe score -> coefficient.
 *
 * Ces paramètres sont les leviers de calibration du barème.
 * Ils peuvent être ajustés lors des revues actuarielles annuelles
 * sans modifier la structure de la formule.
 */
export interface PricingCurveParams {
  /** Score auquel le coefficient vaut exactement 1.00 (point neutre) */
  neutralScore: number
  /** Coefficient plancher (rabais maximum). Défaut : 0.75 (-25%) */
  coeffFloor: number
  /** Coefficient plafond (majoration maximum). Défaut : 1.80 (+80%) */
  coeffCeiling: number
  /**
   * Exposant de la branche gauche (rabais).
   * > 1 : convexe (rabais progressif, tangente horizontale au neutre)
   * = 1 : linéaire (sensibilité constante, pas de zone morte)
   * < 1 : concave (rabais rapide puis saturation)
   *
   * Valeur retenue : 1.00 (linéaire)
   * Justification (correction P1-01) : alpha=1.20 créait une zone morte
   * au voisinage du neutre (tangente horizontale), rendant la courbe
   * quasi-insensible sur ±5 points autour de s₀. Avec alpha=1.00,
   * la courbe est C0 (continue mais pas dérivable) au neutre,
   * ce qui est acceptable actuariellement et élimine la zone morte.
   */
  alphaLeft: number
  /**
   * Exposant de la branche droite (majoration).
   * Même logique que alphaLeft mais pour les majorations.
   *
   * Valeur retenue : 1.15
   * Justification : plus proche de 1 que alpha (la majoration monte
   * plus vite que le rabais ne descend = asymétrie actuarielle).
   * Le ratio asymétrie résultant est d'environ 3.7x à +/-20 points,
   * ce qui est conforme au principe de prudence.
   */
  betaRight: number
}

/**
 * Paramètres par défaut — calibration initiale (lancement produit).
 *
 * À recalibrer après 12-18 mois d'historique sinistre.
 */
export const DEFAULT_PRICING_CURVE: PricingCurveParams = {
  neutralScore: 52.5,
  coeffFloor: 0.75,
  coeffCeiling: 1.80,
  alphaLeft: 1.00,  // P1-01 fix: linéaire pour éliminer la zone morte au neutre
  betaRight: 1.15,
}

// ---------------------------------------------------------------------------
// 2. POIDS DOMMAGES / RC PAR CATÉGORIE
// ---------------------------------------------------------------------------

/**
 * Ventilation de l'impact de chaque catégorie sur les deux composantes
 * du contrat Multi Pro.
 *
 * Chaque catégorie affecte principalement une composante :
 * - fire, equipment, dependency -> Dommages aux biens / Perte d'exploitation
 * - liability, cyber           -> RC Professionnelle
 * - fleet                      -> résiduel (souvent tarifé séparément)
 *
 * Les poids somment à 1.00 par composante.
 */
export interface ComponentWeights {
  damages: Record<RiskCategory, number>
  liability: Record<RiskCategory, number>
  /** Part de la composante Dommages dans la prime Multi Pro */
  damagesShare: number
}

export const DEFAULT_COMPONENT_WEIGHTS: ComponentWeights = {
  damages: {
    fire: 0.40,
    liability: 0.05,
    dependency: 0.20,
    equipment: 0.30,  // +0.05 ex-fleet → equipment (M2 : fleet désactivé)
    cyber: 0.05,
    fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },
  liability: {
    fire: 0.05,
    liability: 0.45,
    dependency: 0.10,
    equipment: 0.05,
    cyber: 0.35,      // +0.05 ex-fleet → cyber (M2 : fleet désactivé)
    fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },
  damagesShare: 0.55,
}

// ---------------------------------------------------------------------------
// 3. FACTEUR DE TAILLE
// ---------------------------------------------------------------------------

/**
 * Paramètres du facteur de taille.
 *
 * Le facteur de taille module l'AMPLITUDE du coefficient technique,
 * pas le coefficient lui-même. Un grand employeur voit ses majorations
 * amplifiées et ses rabais légèrement réduits (moindre crédibilité
 * du scoring sur petites structures / plus grande exposition sur grandes).
 *
 * Formule : tau(n) = 1 + gamma * ln(n / n_ref)
 *
 * Effet :
 *   n=2   : tau = 0.936  (amplitude réduite de 6.4%)
 *   n=10  : tau = 1.000  (neutre)
 *   n=30  : tau = 1.044  (amplitude augmentée de 4.4%)
 *   n=200 : tau = 1.120  (amplitude augmentée de 12.0%)
 */
export interface SizeFactorParams {
  /** Effectif de référence (neutre). Défaut : 10 */
  referenceEmployees: number
  /** Élasticité logarithmique. Défaut : 0.04 */
  gamma: number
  /** Plancher du facteur de taille (évite des effets trop forts sur micro) */
  tauFloor: number
  /** Plafond du facteur de taille */
  tauCeiling: number
}

export const DEFAULT_SIZE_FACTOR: SizeFactorParams = {
  referenceEmployees: 10,
  gamma: 0.04,
  tauFloor: 0.90,
  tauCeiling: 1.15,
}

// ---------------------------------------------------------------------------
// 4. FORMULES DE CALCUL
// ---------------------------------------------------------------------------

/**
 * Transforme un score catégoriel (0-100) en coefficient technique.
 *
 * Formule par morceaux avec raccord C1 au point neutre :
 *
 *   Si s <= s0 :  f(s) = 1 - (1 - C_floor) * ((s0 - s) / s0)^alpha
 *   Si s >  s0 :  f(s) = 1 + (C_ceil - 1) * ((s - s0) / (100 - s0))^beta
 *
 * Propriétés :
 *   f(0)   = C_floor = 0.75
 *   f(s0)  = 1.00
 *   f(100) = C_ceil  = 1.80
 *   f est continue, monotone croissante, C1 en s0 (car alpha > 1 et beta > 1)
 *
 * L'asymétrie est intrinsèque : la plage de majoration (0.80) est 3.2x
 * la plage de rabais (0.25), et beta < alpha amplifie encore l'effet.
 */
export function scoreToCoefficient(
  score: number,
  params: PricingCurveParams = DEFAULT_PRICING_CURVE,
): number {
  // Clamp score to [0, 100]
  const s = Math.max(0, Math.min(100, score))
  const { neutralScore: s0, coeffFloor, coeffCeiling, alphaLeft, betaRight } = params

  if (s <= s0) {
    // Branche rabais
    const t = (s0 - s) / s0
    return 1 - (1 - coeffFloor) * Math.pow(t, alphaLeft)
  } else {
    // Branche majoration
    const t = (s - s0) / (100 - s0)
    return 1 + (coeffCeiling - 1) * Math.pow(t, betaRight)
  }
}

/**
 * Calcule le facteur de taille tau(n).
 *
 * tau(n) = clamp(1 + gamma * ln(n / n_ref), tauFloor, tauCeiling)
 *
 * Ce facteur module l'amplitude de l'écart au neutre, pas le coefficient
 * lui-même. L'application est : C_final = 1 + (C_raw - 1) * tau(n)
 */
export function computeSizeFactor(
  employees: number,
  params: SizeFactorParams = DEFAULT_SIZE_FACTOR,
): number {
  const n = Math.max(1, employees)
  const raw = 1 + params.gamma * Math.log(n / params.referenceEmployees)
  return Math.max(params.tauFloor, Math.min(params.tauCeiling, raw))
}

// ---------------------------------------------------------------------------
// 5. RÉSULTAT DU CALCUL DE TARIFICATION
// ---------------------------------------------------------------------------

/**
 * Résultat détaillé du calcul de coefficient technique.
 *
 * Chaque étape est tracée pour permettre :
 * - L'explication au courtier/client
 * - L'audit par le régulateur (CAA)
 * - Le backtesting actuariel
 */
export interface PricingResult {
  /** Scores catégoriels en entrée */
  categoryScores: Record<RiskCategory, number>

  /** Coefficients catégoriels (un par catégorie) */
  categoryCoefficients: Record<RiskCategory, number>

  /** Coefficient global (moyenne pondérée avec poids scoring standard) */
  globalCoefficient: number

  /** Coefficient composante Dommages */
  damagesCoefficient: number

  /** Coefficient composante RC */
  liabilityCoefficient: number

  /** Coefficient Multi Pro (combinaison Dommages + RC) */
  multiProCoefficient: number

  /** Facteur de taille appliqué */
  sizeFactor: number

  /** Coefficient final après application du facteur de taille */
  finalCoefficient: number

  /** Modificateur de prime en % (positif = majoration, négatif = rabais) */
  premiumModifierPct: number

  // --- Champs NACE (optionnels pour rétrocompatibilité avec computePricingCoefficient) ---

  /** Identifiant du pool NACE résolu (ex: POOL_FOOD, POOL_OFFICE) */
  poolId?: string

  /** Label du pool en français */
  poolLabel?: string

  /** Facteur de risque intrinsèque appliqué (ex: 0.85 pour bureau, 1.30 pour industrie lourde) */
  intrinsicRiskFactor?: number

  /**
   * Score global brut AVANT application du facteur de risque intrinsèque.
   * C'est la moyenne pondérée des scores catégoriels avec les poids blendés.
   */
  rawGlobalScore?: number

  /**
   * Score global APRES application du facteur de risque intrinsèque.
   * adjustedGlobalScore = clamp(s₀ + (rawGlobalScore - s₀) × factor, 0, 100)
   *
   * Transformation affine centrée sur le point neutre s₀ pour éviter
   * la saturation en queue droite (correction P1-02).
   *
   * Ce score est celui qui entre dans la conversion score -> coefficient.
   * Le souscripteur voit les deux (raw et adjusted) pour distinguer
   * l'effet de la gestion vs l'effet de l'activité.
   */
  adjustedGlobalScore?: number

  /**
   * Poids finaux après blending segment x pool (alpha = 0.60 par défaut).
   * Présent uniquement quand le pool NACE est résolu.
   */
  blendedWeights?: CategoryWeights

  /** Paramètres utilisés (traçabilité) */
  params: {
    curve: PricingCurveParams
    components: ComponentWeights
    sizeFactor: SizeFactorParams
    scoringWeights: CategoryWeights
  }
}

/**
 * Calcul complet du coefficient technique Multi Pro.
 *
 * Chaîne de calcul :
 * 1. Score catégoriel (0-100) -> coefficient catégoriel via scoreToCoefficient()
 * 2. Coefficients catégoriels -> coefficient Dommages (moyenne pondérée)
 * 3. Coefficients catégoriels -> coefficient RC (moyenne pondérée)
 * 4. C_dommages + C_rc -> C_multipro (combinaison linéaire)
 * 5. C_multipro * facteur de taille -> C_final
 * 6. C_final -> modificateur de prime en %
 */
export function computePricingCoefficient(
  categoryScores: Record<RiskCategory, number>,
  employees: number,
  curveParams: PricingCurveParams = DEFAULT_PRICING_CURVE,
  componentWeights: ComponentWeights = DEFAULT_COMPONENT_WEIGHTS,
  sizeFactorParams: SizeFactorParams = DEFAULT_SIZE_FACTOR,
  scoringWeights?: CategoryWeights,
): PricingResult {
  // Poids scoring pour le calcul du coefficient global simple
  const weights: CategoryWeights = scoringWeights ?? DEFAULT_WEIGHTS_FALLBACK

  // --- Étape 1 : coefficients catégoriels ---
  const categories: RiskCategory[] = ['fire', 'liability', 'dependency', 'equipment', 'cyber', 'fleet']
  const categoryCoefficients = {} as Record<RiskCategory, number>
  for (const cat of categories) {
    categoryCoefficients[cat] = scoreToCoefficient(categoryScores[cat] ?? 52.5, curveParams)
  }

  // --- Étape 2 : coefficient global simple (pondération scoring) ---
  let globalCoefficient = 0
  for (const cat of categories) {
    globalCoefficient += weights[cat] * categoryCoefficients[cat]
  }

  // --- Étape 3 : coefficient Dommages ---
  let damagesCoefficient = 0
  for (const cat of categories) {
    damagesCoefficient += componentWeights.damages[cat] * categoryCoefficients[cat]
  }

  // --- Étape 4 : coefficient RC ---
  let liabilityCoefficient = 0
  for (const cat of categories) {
    liabilityCoefficient += componentWeights.liability[cat] * categoryCoefficients[cat]
  }

  // --- Étape 5 : coefficient Multi Pro ---
  const phi = componentWeights.damagesShare
  const multiProCoefficient = phi * damagesCoefficient + (1 - phi) * liabilityCoefficient

  // --- Étape 6 : facteur de taille ---
  const sizeFactor = computeSizeFactor(employees, sizeFactorParams)

  // --- Étape 7 : coefficient final ---
  let finalCoefficient = 1 + (multiProCoefficient - 1) * sizeFactor
  // Clamp au plancher/plafond absolu
  finalCoefficient = Math.max(curveParams.coeffFloor, Math.min(curveParams.coeffCeiling, finalCoefficient))

  // --- Étape 8 : modificateur en % ---
  const premiumModifierPct = Math.round((finalCoefficient - 1) * 10000) / 100

  return {
    categoryScores,
    categoryCoefficients,
    globalCoefficient: Math.round(globalCoefficient * 10000) / 10000,
    damagesCoefficient: Math.round(damagesCoefficient * 10000) / 10000,
    liabilityCoefficient: Math.round(liabilityCoefficient * 10000) / 10000,
    multiProCoefficient: Math.round(multiProCoefficient * 10000) / 10000,
    sizeFactor: Math.round(sizeFactor * 10000) / 10000,
    finalCoefficient: Math.round(finalCoefficient * 10000) / 10000,
    premiumModifierPct,
    params: {
      curve: curveParams,
      components: componentWeights,
      sizeFactor: sizeFactorParams,
      scoringWeights: weights,
    },
  }
}

// ---------------------------------------------------------------------------
// 6. INTÉGRATION AVEC LE SYSTÈME DE PROPORTIONNALITÉ + POOLS NACE
// ---------------------------------------------------------------------------

/**
 * Calcul intégré : combine le moteur de tarification avec le système
 * de proportionnalité (segment, poids ajustés, matrice de souscription)
 * ET les pools de risque NACE.
 *
 * Chaîne de calcul enrichie :
 * 1. Résoudre segment, activité, pool NACE
 * 2. Blender les poids segment x pool (alpha = 0.60)
 * 3. Calculer le score global brut avec les poids blendés
 * 4. Appliquer le facteur de risque intrinsèque aux scores catégoriels
 * 5. Convertir les scores ajustés en coefficients
 * 6. Calculer le coefficient Multi Pro (Dommages + RC)
 * 7. Appliquer le facteur de taille
 *
 * Le facteur intrinsèque s'applique au SCORE via transformation AFFINE
 * centrée sur le point neutre : score_ajusté = s₀ + (score - s₀) × factor.
 * Cela garantit que l'asymétrie de la courbe scoreToCoefficient()
 * amplifie correctement les risques, SANS saturation en queue droite.
 *
 * Rétrocompatibilité : la signature est inchangée. Les nouveaux champs
 * du PricingResult sont optionnels — les consommateurs existants ne
 * sont pas impactés.
 */
export function computeIntegratedPricing(
  company: CompanyData,
  categoryScores: Record<RiskCategory, number>,
  curveParams: PricingCurveParams = DEFAULT_PRICING_CURVE,
  componentWeights: ComponentWeights = DEFAULT_COMPONENT_WEIGHTS,
  sizeFactorParams: SizeFactorParams = DEFAULT_SIZE_FACTOR,
): PricingResult {
  const categories: RiskCategory[] = ['fire', 'liability', 'dependency', 'equipment', 'cyber', 'fleet']

  // --- Étape 1 : résolution segment, activité, pool ---
  const segment = resolveSegment(company)
  const activity = resolveActivityCategory(company.naceCode)
  const pool = resolvePool(company.naceCode)

  // --- Étape 2 : blending des poids (segment x pool, alpha = 0.60) ---
  const blendedWeights = combineWeights(segment, activity, pool)

  // --- Étape 3 : score global brut (moyenne pondérée avec poids blendés) ---
  let rawGlobalScore = 0
  for (const cat of categories) {
    rawGlobalScore += blendedWeights[cat] * (categoryScores[cat] ?? 0)
  }
  rawGlobalScore = Math.round(rawGlobalScore * 100) / 100

  // --- Étape 4 : application du facteur de risque intrinsèque aux scores ---
  // Transformation AFFINE CENTRÉE sur le point neutre (s₀) :
  //   score_ajusté = s₀ + (score_brut - s₀) × factor
  //
  // Cette transformation dilate l'écart au neutre sans saturer les queues
  // (contrairement à la multiplication simple qui clampait à 100 dès
  // score_brut > 100/factor, détruisant la discrimination en queue droite).
  const adjustedScores = {} as Record<RiskCategory, number>
  for (const cat of categories) {
    adjustedScores[cat] = applyIntrinsicRiskFactor(
      categoryScores[cat] ?? 0, pool, curveParams.neutralScore
    )
  }

  // Score global ajusté (pour traçabilité)
  const adjustedGlobalScore = applyIntrinsicRiskFactor(
    rawGlobalScore, pool, curveParams.neutralScore
  )

  // --- Étape 5 : coefficients catégoriels à partir des scores AJUSTÉS ---
  const categoryCoefficients = {} as Record<RiskCategory, number>
  for (const cat of categories) {
    categoryCoefficients[cat] = scoreToCoefficient(adjustedScores[cat], curveParams)
  }

  // --- Étape 6 : coefficient global (pondération blendée) ---
  let globalCoefficient = 0
  for (const cat of categories) {
    globalCoefficient += blendedWeights[cat] * categoryCoefficients[cat]
  }

  // --- Étape 7 : coefficient Dommages ---
  let damagesCoefficient = 0
  for (const cat of categories) {
    damagesCoefficient += componentWeights.damages[cat] * categoryCoefficients[cat]
  }

  // --- Étape 8 : coefficient RC ---
  let liabilityCoefficient = 0
  for (const cat of categories) {
    liabilityCoefficient += componentWeights.liability[cat] * categoryCoefficients[cat]
  }

  // --- Étape 9 : coefficient Multi Pro ---
  const phi = componentWeights.damagesShare
  const multiProCoefficient = phi * damagesCoefficient + (1 - phi) * liabilityCoefficient

  // --- Étape 10 : facteur de taille ---
  const sizeFactor = computeSizeFactor(company.employees ?? 1, sizeFactorParams)

  // --- Étape 11 : coefficient final ---
  let finalCoefficient = 1 + (multiProCoefficient - 1) * sizeFactor
  finalCoefficient = Math.max(curveParams.coeffFloor, Math.min(curveParams.coeffCeiling, finalCoefficient))

  // --- Étape 12 : modificateur en % ---
  const premiumModifierPct = Math.round((finalCoefficient - 1) * 10000) / 100

  return {
    categoryScores,
    categoryCoefficients,
    globalCoefficient: Math.round(globalCoefficient * 10000) / 10000,
    damagesCoefficient: Math.round(damagesCoefficient * 10000) / 10000,
    liabilityCoefficient: Math.round(liabilityCoefficient * 10000) / 10000,
    multiProCoefficient: Math.round(multiProCoefficient * 10000) / 10000,
    sizeFactor: Math.round(sizeFactor * 10000) / 10000,
    finalCoefficient: Math.round(finalCoefficient * 10000) / 10000,
    premiumModifierPct,

    // --- Traçabilité NACE ---
    poolId: pool.id,
    poolLabel: pool.label,
    intrinsicRiskFactor: pool.intrinsicRiskFactor,
    rawGlobalScore,
    adjustedGlobalScore,
    blendedWeights,

    params: {
      curve: curveParams,
      components: componentWeights,
      sizeFactor: sizeFactorParams,
      scoringWeights: blendedWeights,
    },
  }
}

// ---------------------------------------------------------------------------
// 6bis. POINT D'ENTRÉE TOUT-EN-UN : DIAGNOSTIC + PRICING
// ---------------------------------------------------------------------------

/**
 * Résultat complet d'un diagnostic de tarification.
 *
 * Combine en un seul objet :
 * - La décision de souscription (segment, qualification, matrice)
 * - Le pricing technique (coefficient, facteur de taille, composantes)
 * - Les informations NACE (pool, facteur intrinsèque, poids blendés)
 *
 * C'est le type de retour de computeFullDiagnosticPricing(), conçu pour
 * être consommé directement par l'UI sans appels multiples.
 */
export interface FullDiagnosticPricingResult {
  /** Résultat de la décision de souscription (segment, matrice, qualification) */
  underwriting: UnderwritingResult

  /**
   * Résultat du pricing technique (coefficients, facteur de taille, etc.)
   *
   * ⚠️ pricing.finalCoefficient est le coefficient AUTORITAIRE pour le calcul
   * de prime. Les champs premiumMultiplierMin/Max de la matrice de souscription
   * sont INDICATIFS uniquement (contrôle de cohérence souscripteur).
   *
   * Formule de prime : Prime = Prime_base × pricing.finalCoefficient
   */
  pricing: PricingResult

  /** Segment résolu (raccourci) */
  segment: CompanySegment

  /** Catégorie d'activité résolue (raccourci) */
  activity: ActivityCategory

  /** Identifiant du pool NACE résolu */
  poolId: string

  /** Label du pool en français */
  poolLabel: string

  /** Facteur de risque intrinsèque du pool */
  intrinsicRiskFactor: number

  /** Poids blendés finaux (segment x pool) */
  blendedWeights: CategoryWeights

  /** Score global brut (avant facteur intrinsèque) */
  rawGlobalScore: number

  /** Score global ajusté (après facteur intrinsèque) */
  adjustedGlobalScore: number

  /**
   * true si le coefficient technique (pricing.finalCoefficient) sort de la
   * fourchette indicative de la matrice de souscription pour cette cellule.
   * Signal d'alerte pour le souscripteur : vérifier manuellement.
   */
  coefficientOutOfRange: boolean
}

/**
 * Point d'entrée tout-en-un pour le diagnostic complet d'une entreprise.
 *
 * Cette fonction fait TOUT en un seul appel :
 * 1. Résout segment, activité, pool NACE
 * 2. Calcule les poids blendés (segment x pool)
 * 3. Applique le facteur de risque intrinsèque aux scores
 * 4. Calcule le coefficient technique Multi Pro
 * 5. Produit la décision de souscription (matrice segment x qualification)
 * 6. Retourne l'ensemble dans un objet unique exploitable par l'UI
 *
 * C'est le successeur de computeIntegratedPricing() pour les consommateurs
 * qui ont besoin à la fois du pricing ET de la décision de souscription.
 *
 * @param company Données de l'entreprise (effectif, CA, NACE, hazmat, commodo)
 * @param categoryScores Scores bruts des 6 catégories de risque (0-100)
 * @param curveParams Paramètres de la courbe score -> coefficient
 * @param componentWeights Poids Dommages / RC par catégorie
 * @param sizeFactorParams Paramètres du facteur de taille
 */
export function computeFullDiagnosticPricing(
  company: CompanyData,
  categoryScores: Record<RiskCategory, number>,
  curveParams: PricingCurveParams = DEFAULT_PRICING_CURVE,
  componentWeights: ComponentWeights = DEFAULT_COMPONENT_WEIGHTS,
  sizeFactorParams: SizeFactorParams = DEFAULT_SIZE_FACTOR,
): FullDiagnosticPricingResult {
  // --- Pricing intégré (inclut résolution pool + blending + facteur intrinsèque) ---
  const pricing = computeIntegratedPricing(
    company,
    categoryScores,
    curveParams,
    componentWeights,
    sizeFactorParams,
  )

  // --- Scores ajustés (avec facteur intrinsèque) pour la décision de souscription ---
  // CORRECTIF M1 : la décision de souscription doit utiliser les scores AJUSTÉS
  // (incluant le facteur intrinsèque NACE), pas les scores bruts.
  // CORRECTIF C2 : réutilise le pool déjà résolu via pricing.poolId au lieu
  // d'appeler resolvePool() une seconde fois (évite divergence future).
  const categories: RiskCategory[] = ['fire', 'liability', 'dependency', 'equipment', 'cyber', 'fleet']
  const pool = getPoolById(pricing.poolId!) ?? resolvePool(company.naceCode)
  const adjustedScoresForUW = {} as Record<RiskCategory, number>
  for (const cat of categories) {
    adjustedScoresForUW[cat] = applyIntrinsicRiskFactor(
      categoryScores[cat] ?? 0, pool, curveParams.neutralScore
    )
  }

  const underwriting = computeUnderwritingDecision(company, adjustedScoresForUW)

  // --- Contrôle de cohérence : coefficient technique vs fourchette matrice ---
  // La matrice donne une fourchette INDICATIVE. Si le coefficient technique
  // sort de cette fourchette, c'est un signal d'alerte pour le souscripteur.
  const cell = underwriting.underwritingCell
  const coeff = pricing.finalCoefficient
  const coefficientOutOfRange =
    cell.premiumMultiplierMin > 0 && cell.premiumMultiplierMax > 0 &&
    (coeff < cell.premiumMultiplierMin * 0.90 || coeff > cell.premiumMultiplierMax * 1.10)

  return {
    underwriting,
    pricing,
    segment: underwriting.segment,
    activity: underwriting.activity,
    poolId: pool.id,
    poolLabel: pool.label,
    intrinsicRiskFactor: pool.intrinsicRiskFactor,
    blendedWeights: pricing.blendedWeights!,
    rawGlobalScore: pricing.rawGlobalScore!,
    adjustedGlobalScore: pricing.adjustedGlobalScore!,
    coefficientOutOfRange,
  }
}

// ---------------------------------------------------------------------------
// 7. CALCUL DE PRIME AJUSTÉE (REMPLACEMENT DE computePremium)
// ---------------------------------------------------------------------------

/**
 * Calcule la prime technique ajustée par le coefficient de diagnostic.
 *
 * Cette fonction remplace la version simplifiée de prevention.ts.
 * La prime de base reste inchangée ; seul le multiplicateur est
 * désormais calculé par le moteur de tarification paramétrique.
 *
 * Prime_technique = Prime_base * C_final
 *
 * où :
 *   Prime_base = taux_CA * CA + coût_par_salarié * nb_salariés
 *   C_final = coefficient issu de computePricingCoefficient()
 */
export function computeAdjustedPremium(
  basePremium: number,
  pricingResult: PricingResult,
): number {
  return Math.round(basePremium * pricingResult.finalCoefficient)
}

// ---------------------------------------------------------------------------
// 8. TABLE DE RÉFÉRENCE RAPIDE
// ---------------------------------------------------------------------------

/**
 * Génère la table de correspondance score -> coefficient pour une
 * calibration donnée. Utile pour l'affichage dans le rapport PDF
 * et la documentation du barème.
 */
export interface ReferenceTableRow {
  score: number
  coefficient: number
  premiumModifierPct: number
  qualificationLevel: string
}

export function generateReferenceTable(
  step: number = 5,
  params: PricingCurveParams = DEFAULT_PRICING_CURVE,
): ReferenceTableRow[] {
  const rows: ReferenceTableRow[] = []
  for (let s = 0; s <= 100; s += step) {
    const coeff = scoreToCoefficient(s, params)
    const pct = Math.round((coeff - 1) * 10000) / 100

    let level: string
    if (s > 65) level = 'DEGRADE'
    else if (s >= 40) level = 'CONFORME'
    else if (s >= 20) level = 'AMELIORE'
    else level = 'EXCELLENCE'

    rows.push({
      score: s,
      coefficient: Math.round(coeff * 10000) / 10000,
      premiumModifierPct: pct,
      qualificationLevel: level,
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// 9. VALIDATION ET DIAGNOSTIC DU BARÈME
// ---------------------------------------------------------------------------

/**
 * Vérifie les propriétés mathématiques du barème pour une calibration donnée.
 * À exécuter lors de chaque changement de paramètres.
 *
 * Retourne un objet diagnostique avec :
 * - Monotonie : vérifiée par pas de 0.5 point
 * - Continuité au point neutre
 * - Bornes respectées
 * - Ratio d'asymétrie à +/-20 points du neutre
 * - Coefficient moyen sur une distribution uniforme (proxy équilibre)
 */
export interface BaremeValidation {
  isMonotone: boolean
  isContinuousAtNeutral: boolean
  boundsRespected: boolean
  asymmetryRatio: number
  meanCoefficientUniform: number
  warnings: string[]
}

export function validateBareme(
  params: PricingCurveParams = DEFAULT_PRICING_CURVE,
): BaremeValidation {
  const warnings: string[] = []

  // Monotonie
  let isMonotone = true
  let prev = scoreToCoefficient(0, params)
  for (let s = 0.5; s <= 100; s += 0.5) {
    const curr = scoreToCoefficient(s, params)
    if (curr < prev - 1e-10) {
      isMonotone = false
      warnings.push(`Monotonie violée entre s=${s - 0.5} et s=${s}`)
    }
    prev = curr
  }

  // Continuité au point neutre
  const epsilon = 0.001
  const fLeft = scoreToCoefficient(params.neutralScore - epsilon, params)
  const fRight = scoreToCoefficient(params.neutralScore + epsilon, params)
  const fCenter = scoreToCoefficient(params.neutralScore, params)
  const isContinuousAtNeutral =
    Math.abs(fLeft - fCenter) < 0.001 &&
    Math.abs(fRight - fCenter) < 0.001
  if (!isContinuousAtNeutral) {
    warnings.push(`Discontinuité au point neutre : f(${params.neutralScore})=${fCenter}, limites=${fLeft}/${fRight}`)
  }

  // Bornes
  const fMin = scoreToCoefficient(0, params)
  const fMax = scoreToCoefficient(100, params)
  const boundsRespected =
    Math.abs(fMin - params.coeffFloor) < 0.001 &&
    Math.abs(fMax - params.coeffCeiling) < 0.001
  if (!boundsRespected) {
    warnings.push(`Bornes non respectées : f(0)=${fMin} vs floor=${params.coeffFloor}, f(100)=${fMax} vs ceil=${params.coeffCeiling}`)
  }

  // Asymétrie à +/-20 points
  const delta = 20
  const rebate = 1 - scoreToCoefficient(params.neutralScore - delta, params)
  const surcharge = scoreToCoefficient(params.neutralScore + delta, params) - 1
  const asymmetryRatio = rebate > 0 ? surcharge / rebate : Infinity
  if (asymmetryRatio < 2) {
    warnings.push(`Ratio asymétrie faible (${asymmetryRatio.toFixed(1)}x) : le principe de prudence peut être insuffisant`)
  }

  // Coefficient moyen (proxy équilibre technique)
  let sum = 0
  const N = 1000
  for (let i = 0; i <= N; i++) {
    sum += scoreToCoefficient((i / N) * 100, params)
  }
  const meanCoefficientUniform = sum / (N + 1)
  if (meanCoefficientUniform < 1.0) {
    warnings.push(`Coefficient moyen < 1.00 (${meanCoefficientUniform.toFixed(4)}) : le barème est DÉFICITAIRE sur distribution uniforme`)
  }

  return {
    isMonotone,
    isContinuousAtNeutral,
    boundsRespected,
    asymmetryRatio: Math.round(asymmetryRatio * 100) / 100,
    meanCoefficientUniform: Math.round(meanCoefficientUniform * 10000) / 10000,
    warnings,
  }
}
