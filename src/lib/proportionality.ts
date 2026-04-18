// =============================================================================
// SYSTEME DE PROPORTIONNALITE — Multi Pro (Dommages + RC Professionnelle)
// =============================================================================
// Auteur : Expert Souscription Senior — DiagRisk Pro
// Contexte : Luxembourg, produit multirisque professionnelle classique
// Périmètre : Dommages aux biens + RC Professionnelle / Exploitation
// Les 6 catégories (fire, liability, dependency, equipment, cyber, fleet)
// alimentent le scoring dans le cadre Multi Pro, pas en standalone.
// =============================================================================

import type { RiskCategory } from '../types'

// ---------------------------------------------------------------------------
// 1. TYPES FONDAMENTAUX
// ---------------------------------------------------------------------------

/**
 * Profil d'entreprise — 4 segments basés sur des critères objectifs et vérifiables.
 *
 * La logique de segmentation repose sur le principe de proportionnalité :
 * on ne peut pas exiger d'un coiffeur solo le même niveau de conformité
 * qu'une menuiserie de 80 salariés avec stockage de matières inflammables.
 *
 * S1 — Micro-service : coiffeur, consultant solo, bureau comptable < 5 salariés
 * S2 — Petit professionnel : artisan, petit commerce, 5-14 salariés
 * S3 — PME structurée : entreprise avec process, 15-99 salariés
 * S4 — PME industrielle / à risque : industrie, Commodo, matières dangereuses
 */
export type CompanySegment = 'S1' | 'S2' | 'S3' | 'S4'

/**
 * Catégorie d'activité — distingue la nature de l'exposition dominante.
 * Un commerce n'a pas les mêmes risques qu'un artisan du bâtiment.
 */
export type ActivityCategory = 'services' | 'commerce' | 'artisanat' | 'industrie'

/**
 * Niveau de qualification du risque — 4 niveaux symétriques autour du Niveau 0.
 * Le Niveau 0 est le plancher réglementaire proportionné au profil.
 */
export type QualificationLevel = -1 | 0 | 1 | 2

/**
 * Décision de souscription — 4 positions possibles.
 */
export type UnderwritingDecision = 'accept' | 'accept_conditions' | 'defer' | 'decline'

// ---------------------------------------------------------------------------
// 2. CRITÈRES DE SEGMENTATION
// ---------------------------------------------------------------------------

/**
 * Critères d'entrée dans un segment — tous objectifs et vérifiables.
 *
 * La classification est hiérarchique : on teste d'abord S4 (le plus exigeant),
 * puis S3, puis S2, et S1 par défaut. Un seul critère S4 suffit à classer S4
 * (principe de prudence : le critère le plus contraignant l'emporte).
 */
export interface SegmentCriteria {
  segment: CompanySegment
  label: string
  description: string
  /** Effectif maximum (inclus). null = pas de plafond */
  employeesMax: number | null
  /** Effectif minimum (inclus). null = pas de plancher */
  employeesMin: number | null
  /** CA maximum en EUR (inclus). null = pas de plafond */
  revenueMax: number | null
  /** CA minimum en EUR (inclus). null = pas de plancher */
  revenueMin: number | null
  /** Catégories d'activité éligibles (vide = toutes) */
  activityCategories: ActivityCategory[]
  /** Établissement classé (Commodo) obligatoire pour ce segment ? */
  requiresCommodo: boolean | null
  /** Stockage matières dangereuses obligatoire pour ce segment ? */
  requiresHazmat: boolean | null
}

export const SEGMENT_CRITERIA: SegmentCriteria[] = [
  // S4 : PME industrielle / à risque — testé en premier (principe de prudence)
  {
    segment: 'S4',
    label: 'PME industrielle / à risque',
    description: 'Entreprise industrielle, établissement classé, ou stockage de matières dangereuses. Exigences maximales de prévention et protection.',
    employeesMax: null,
    employeesMin: null, // Pas de plancher : un garage de 3 pers. avec hazmat = S4
    revenueMax: null,
    revenueMin: null,
    activityCategories: [], // Toutes — c'est le critère hazmat/commodo qui prime
    requiresCommodo: true, // OU hazmat = true (logique OR, voir resolveSegment)
    requiresHazmat: true,
  },
  // S3 : PME structurée
  {
    segment: 'S3',
    label: 'PME structurée',
    description: 'Entreprise de 15 à 99 salariés ou CA > 2M EUR. Seuil aligné sur la délégation du personnel (Code du Travail LU).',
    employeesMax: 99,
    employeesMin: 15,
    revenueMax: null,
    revenueMin: 2_000_000,
    activityCategories: [],
    requiresCommodo: null,
    requiresHazmat: null,
  },
  // S2 : Petit professionnel
  {
    segment: 'S2',
    label: 'Petit professionnel',
    description: 'Artisan, petit commerce, petit prestataire de 5 à 14 salariés ou CA 500K-2M EUR.',
    employeesMax: 14,
    employeesMin: 5,
    revenueMax: 2_000_000,
    revenueMin: 500_000,
    activityCategories: [],
    requiresCommodo: null,
    requiresHazmat: null,
  },
  // S1 : Micro-service — segment par défaut
  {
    segment: 'S1',
    label: 'Micro-service',
    description: 'Professionnel solo ou très petite structure (< 5 salariés, CA < 500K EUR). Activité de services ou petit commerce. Exigences allégées.',
    employeesMax: 4,
    employeesMin: null,
    revenueMax: 500_000,
    revenueMin: null,
    activityCategories: ['services', 'commerce'],
    requiresCommodo: null,
    requiresHazmat: null,
  },
]

// ---------------------------------------------------------------------------
// 3. MAPPING NACE → CATÉGORIE D'ACTIVITÉ
// ---------------------------------------------------------------------------

/**
 * Mapping simplifié des sections NACE Rev.2 vers les catégories d'activité.
 * Le code NACE commence par une lettre (section) puis des chiffres.
 * Ce mapping utilise la section (premier caractère) pour la classification.
 *
 * Note : ce mapping est indicatif et peut être affiné par sous-section.
 * En cas de doute, l'activité déclarée prime sur le code NACE.
 */
export const NACE_TO_ACTIVITY: Record<string, ActivityCategory> = {
  // A - Agriculture — classé artisanat (travaux physiques, machines)
  A: 'artisanat',
  // B - Industries extractives
  B: 'industrie',
  // C - Industrie manufacturière
  C: 'industrie',
  // D - Production d'énergie
  D: 'industrie',
  // E - Eau, assainissement, déchets
  E: 'industrie',
  // F - Construction
  F: 'artisanat',
  // G - Commerce
  G: 'commerce',
  // H - Transport et entreposage
  H: 'artisanat',
  // I - Hébergement et restauration
  I: 'commerce',
  // J - Information et communication
  J: 'services',
  // K - Finance et assurance
  K: 'services',
  // L - Activités immobilières
  L: 'services',
  // M - Activités spécialisées, scientifiques
  M: 'services',
  // N - Activités de services administratifs
  N: 'services',
  // O - Administration publique
  O: 'services',
  // P - Enseignement
  P: 'services',
  // Q - Santé humaine et action sociale
  Q: 'services',
  // R - Arts, spectacles, activités récréatives
  R: 'services',
  // S - Autres activités de services
  S: 'services',
}

// ---------------------------------------------------------------------------
// 4. FONCTION DE RÉSOLUTION DU SEGMENT
// ---------------------------------------------------------------------------

export interface CompanyData {
  employees: number | null
  revenue: number | null
  naceCode: string | null
  sector: string | null
  /** Déclaré dans le questionnaire : fire_hazmat !== 'non' */
  hasHazmat: boolean
  /** Établissement classé au sens Commodo (Luxembourg) — déclaratif */
  isCommodo: boolean
}

/**
 * Résout le segment d'une entreprise à partir de ses données objectives.
 *
 * Algorithme :
 * 1. Si hazmat OU commodo → S4 (indépendamment de la taille)
 * 2. Si employees >= 15 OU revenue >= 2M → S3
 * 3. Si employees >= 5 OU revenue >= 500K → S2
 * 4. Sinon → S1
 *
 * Les seuils sont alignés sur les standards luxembourgeois (seuils PME UE)
 * et les pratiques de marché Multi Pro.
 *
 * Note importante : un artisan bois de 3 personnes avec stockage de vernis
 * inflammable sera classé S4, pas S1. C'est voulu : le risque intrinsèque
 * de l'activité prime sur la taille.
 */
export function resolveSegment(company: CompanyData): CompanySegment {
  // Critère S4 : matières dangereuses OU établissement classé
  if (company.hasHazmat || company.isCommodo) {
    return 'S4'
  }

  const emp = company.employees ?? 0
  const rev = company.revenue ?? 0

  // Critère S3 : PME structurée
  // Seuil à 15 salariés (S1 PM) aligné sur le seuil de la délégation
  // du personnel au Luxembourg (Code du Travail), marqueur de maturité
  // organisationnelle réelle.
  if (emp >= 15 || rev >= 2_000_000) {
    return 'S3'
  }

  // Critère S2 : Petit professionnel
  if (emp >= 5 || rev >= 500_000) {
    return 'S2'
  }

  // Défaut : Micro-service
  return 'S1'
}

/**
 * Résout la catégorie d'activité à partir du code NACE.
 * Si le code NACE est absent ou non reconnu, retourne 'services' par défaut.
 */
export function resolveActivityCategory(naceCode: string | null): ActivityCategory {
  if (!naceCode || naceCode.length === 0) return 'services'
  const section = naceCode.charAt(0).toUpperCase()
  return NACE_TO_ACTIVITY[section] ?? 'services'
}

// ---------------------------------------------------------------------------
// 5. QUESTIONS APPLICABLES PAR SEGMENT
// ---------------------------------------------------------------------------

/**
 * Certaines questions du questionnaire ne sont pas pertinentes pour tous
 * les segments. Par exemple, demander à un consultant solo s'il a un PCA
 * formalisé n'a pas de sens. Demander à un coiffeur l'âge de son parc
 * machines non plus.
 *
 * Les questions non applicables reçoivent un score neutre (0) et ne
 * contribuent pas au score de la catégorie.
 *
 * true = question posée et scorée
 * false = question masquée, score neutre automatique
 */
export type QuestionApplicability = Record<string, boolean>

export const QUESTION_APPLICABILITY: Record<CompanySegment, QuestionApplicability> = {
  S1: {
    // Fire — allégé : construction et détection suffisent
    fire_construction: true,
    fire_detection: true,
    fire_hazmat: false,     // S1 n'a pas de hazmat (sinon serait S4)
    fire_distance: true,
    fire_history: true,
    fire_assets: true,
    // Liability — toutes pertinentes
    rc_export: true,
    rc_subcontracting: true,
    rc_claims: true,
    rc_bodily: true,
    // Dependency — allégé
    dep_single_site: true,
    dep_supplier: false,     // Micro-service : pas de supply chain complexe
    dep_pca: false,          // Pas de PCA formalisé exigible
    dep_recovery: true,
    // Equipment — allégé
    equip_age: false,        // Pas de parc machines significatif
    equip_maintenance: false,
    equip_critical: false,
    equip_value: true,       // Valeur des biens reste pertinente
    // Cyber — allégé
    cyber_data: true,
    cyber_backup: true,
    cyber_training: false,   // Micro : pas de salariés à former
    cyber_mfa: true,
    cyber_incident: true,
    // Fleet — M2 : désactivé (RC Auto séparé au Luxembourg)
    fleet_count: false,
    fleet_type: false,
    fleet_claims: false,
    fleet_policy: false,
  },
  S2: {
    // Fire — complet sauf hazmat
    fire_construction: true,
    fire_detection: true,
    fire_hazmat: false,     // S2 n'a pas de hazmat (sinon serait S4)
    fire_distance: true,
    fire_history: true,
    fire_assets: true,
    // Liability — toutes
    rc_export: true,
    rc_subcontracting: true,
    rc_claims: true,
    rc_bodily: true,
    // Dependency — quasi complet
    dep_single_site: true,
    dep_supplier: true,
    dep_pca: false,          // PCA formalisé pas encore exigible à ce stade
    dep_recovery: true,
    // Equipment — toutes
    equip_age: true,
    equip_maintenance: true,
    equip_critical: true,
    equip_value: true,
    // Cyber — toutes
    cyber_data: true,
    cyber_backup: true,
    cyber_training: true,
    cyber_mfa: true,
    cyber_incident: true,
    // Fleet — M2 : désactivé (RC Auto séparé au Luxembourg)
    fleet_count: false,
    fleet_type: false,
    fleet_claims: false,
    fleet_policy: false,
  },
  S3: {
    // Toutes les questions sont pertinentes
    fire_construction: true,
    fire_detection: true,
    fire_hazmat: false,     // S3 sans hazmat (sinon serait S4)
    fire_distance: true,
    fire_history: true,
    fire_assets: true,
    rc_export: true,
    rc_subcontracting: true,
    rc_claims: true,
    rc_bodily: true,
    dep_single_site: true,
    dep_supplier: true,
    dep_pca: true,           // PCA exigible à partir de S3
    dep_recovery: true,
    equip_age: true,
    equip_maintenance: true,
    equip_critical: true,
    equip_value: true,
    cyber_data: true,
    cyber_backup: true,
    cyber_training: true,
    cyber_mfa: true,
    cyber_incident: true,
    // Fleet — M2 : désactivé (RC Auto séparé au Luxembourg)
    fleet_count: false,
    fleet_type: false,
    fleet_claims: false,
    fleet_policy: false,
  },
  S4: {
    // Toutes les questions sont pertinentes, y compris hazmat
    fire_construction: true,
    fire_detection: true,
    fire_hazmat: true,       // S4 = seul segment où hazmat est scoré
    fire_distance: true,
    fire_history: true,
    fire_assets: true,
    rc_export: true,
    rc_subcontracting: true,
    rc_claims: true,
    rc_bodily: true,
    dep_single_site: true,
    dep_supplier: true,
    dep_pca: true,
    dep_recovery: true,
    equip_age: true,
    equip_maintenance: true,
    equip_critical: true,
    equip_value: true,
    cyber_data: true,
    cyber_backup: true,
    cyber_training: true,
    cyber_mfa: true,
    cyber_incident: true,
    // Fleet — M2 : désactivé (RC Auto séparé au Luxembourg)
    fleet_count: false,
    fleet_type: false,
    fleet_claims: false,
    fleet_policy: false,
  },
}

// ---------------------------------------------------------------------------
// 6. PONDÉRATIONS DES CATÉGORIES PAR SEGMENT × ACTIVITÉ
// ---------------------------------------------------------------------------

/**
 * Les pondérations reflètent l'exposition DOMINANTE du profil.
 *
 * Logique de souscription :
 * - Un micro-service (coiffeur, consultant) : RC > Cyber > Fire > Dependency
 * - Un petit commerce : RC > Fire > Dependency > Equipment
 * - Un artisan : Fire > Equipment > RC > Dependency
 * - Une industrie S4 : Fire > Equipment > Dependency > RC
 *
 * Les poids sont définis par couple (segment, activité) pour refléter
 * fidèlement le profil de risque réel.
 *
 * Les 6 catégories somment toujours à 1.0 pour chaque profil.
 *
 * Clé du Record : "segment_activity" (ex: "S1_services")
 */
export type CategoryWeights = Record<RiskCategory, number>

export const SEGMENT_ACTIVITY_WEIGHTS: Record<string, CategoryWeights> = {
  // ── S1 — Micro-service ──────────────────────────────────────────────
  S1_services: {
    fire: 0.15,
    liability: 0.30,
    dependency: 0.10,
    equipment: 0.05,
    cyber: 0.40,      // +0.05 ex-fleet → cyber (exposition principale micro-service)
    fleet: 0.00,      // M2 : fleet désactivé (RC Auto séparé au Luxembourg)
  },
  S1_commerce: {
    fire: 0.25,
    liability: 0.35,  // +0.05 ex-fleet → liability (exposition dominante commerce)
    dependency: 0.10,
    equipment: 0.10,
    cyber: 0.20,
    fleet: 0.00,      // M2 : fleet désactivé (RC Auto séparé au Luxembourg)
  },
  // S1 artisanat et industrie : cas théoriques car S1 < 5 salariés
  // mais un artisan solo sans hazmat ni commodo reste S1
  S1_artisanat: {
    fire: 0.35,       // +0.05 ex-fleet → fire (exposition dominante artisanat)
    liability: 0.25,
    dependency: 0.10,
    equipment: 0.20,
    cyber: 0.10,
    fleet: 0.00,      // M2 : fleet désactivé (RC Auto séparé au Luxembourg)
  },
  S1_industrie: {
    fire: 0.35,       // +0.05 ex-fleet → fire
    liability: 0.20,
    dependency: 0.15,
    equipment: 0.20,
    cyber: 0.10,
    fleet: 0.00,      // M2 : fleet désactivé (RC Auto séparé au Luxembourg)
  },

  // ── S2 — Petit professionnel ────────────────────────────────────────
  S2_services: {
    fire: 0.15,
    liability: 0.25,
    dependency: 0.15,
    equipment: 0.10,
    cyber: 0.35,      // +0.05 ex-fleet → cyber
    fleet: 0.00,      // M2 : fleet désactivé (RC Auto séparé au Luxembourg)
  },
  S2_commerce: {
    fire: 0.25,
    liability: 0.30,  // +0.05 ex-fleet → liability
    dependency: 0.15,
    equipment: 0.15,
    cyber: 0.15,
    fleet: 0.00,      // M2 : fleet désactivé (RC Auto séparé au Luxembourg)
  },
  S2_artisanat: {
    fire: 0.35,       // +0.05 ex-fleet → fire
    liability: 0.20,
    dependency: 0.10,
    equipment: 0.25,
    cyber: 0.10,
    fleet: 0.00,      // M2 : fleet désactivé (RC Auto séparé au Luxembourg)
  },
  S2_industrie: {
    fire: 0.30,       // +0.05 ex-fleet → fire
    liability: 0.20,
    dependency: 0.15,
    equipment: 0.25,
    cyber: 0.10,
    fleet: 0.00,      // M2 : fleet désactivé (RC Auto séparé au Luxembourg)
  },

  // ── S3 — PME structurée ─────────────────────────────────────────────
  S3_services: {
    fire: 0.15,
    liability: 0.20,
    dependency: 0.20,  // Plus de structure = plus de dépendances
    equipment: 0.10,
    cyber: 0.35,       // +0.05 ex-fleet → cyber (exposition principale services)
    fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },
  S3_commerce: {
    fire: 0.20,
    liability: 0.30,  // +0.10 ex-fleet → liability (exposition dominante commerce)
    dependency: 0.20,
    equipment: 0.15,
    cyber: 0.15,
    fleet: 0.00,       // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },
  S3_artisanat: {
    fire: 0.30,       // +0.05 ex-fleet → fire (exposition dominante artisanat)
    liability: 0.20,
    dependency: 0.15,
    equipment: 0.25,
    cyber: 0.10,
    fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },
  S3_industrie: {
    fire: 0.30,       // +0.05 ex-fleet → fire (exposition dominante industrie)
    liability: 0.15,
    dependency: 0.20,
    equipment: 0.25,
    cyber: 0.10,
    fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },

  // ── S4 — PME industrielle / à risque ────────────────────────────────
  S4_services: {
    // Cas rare : service avec hazmat (ex: labo médical)
    fire: 0.25,
    liability: 0.20,
    dependency: 0.20,
    equipment: 0.15,
    cyber: 0.20,      // +0.05 ex-fleet → cyber (exposition principale services)
    fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },
  S4_commerce: {
    // Commerce avec hazmat (ex: station-service, droguerie)
    fire: 0.40,       // +0.10 ex-fleet → fire (exposition dominante hazmat commerce)
    liability: 0.20,
    dependency: 0.15,
    equipment: 0.15,
    cyber: 0.10,
    fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },
  S4_artisanat: {
    // Artisan à risque (menuiserie, carrosserie, serrurerie)
    fire: 0.40,       // +0.05 ex-fleet → fire (exposition dominante artisanat hazmat)
    liability: 0.15,
    dependency: 0.10,
    equipment: 0.25,
    cyber: 0.10,
    fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },
  S4_industrie: {
    // Industrie classique avec process et matières dangereuses
    fire: 0.35,       // +0.05 ex-fleet → fire (exposition dominante industrie hazmat)
    liability: 0.15,
    dependency: 0.20,
    equipment: 0.25,
    cyber: 0.05,
    fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
  },
}

/**
 * Résout les poids pour un couple (segment, activité).
 * Fallback sur les poids par défaut si la combinaison n'existe pas.
 */
export function resolveWeights(
  segment: CompanySegment,
  activity: ActivityCategory
): CategoryWeights {
  const key = `${segment}_${activity}`
  return SEGMENT_ACTIVITY_WEIGHTS[key] ?? DEFAULT_WEIGHTS_FALLBACK
}

// Fallback importé de scoring.ts — single source of truth (voir DEFAULT_WEIGHTS)
import { DEFAULT_WEIGHTS as DEFAULT_WEIGHTS_FALLBACK } from './scoring'

// ---------------------------------------------------------------------------
// 7. GRILLE DE QUALIFICATION PROPORTIONNELLE
// ---------------------------------------------------------------------------

/**
 * Pour chaque segment, les seuils de qualification sont ajustés.
 * Le score global va de 0 (aucun risque) à 100 (risque maximum).
 *
 * Logique de souscription :
 * - S1 a des seuils plus indulgents (un coiffeur à 45 n'est pas le même
 *   risque qu'une menuiserie à 45)
 * - S4 a des seuils plus stricts (l'exigence est proportionnelle au danger)
 *
 * Les seuils définissent les BORNES SUPÉRIEURES de chaque niveau.
 * Exemple S2 : score <= 30 → Niveau +2, score <= 45 → Niveau +1, etc.
 */
export interface QualificationThresholds {
  segment: CompanySegment
  label: string
  /** Score max pour Niveau +2 (Excellence) */
  excellenceMax: number
  /** Score max pour Niveau +1 (Amélioré) */
  improvedMax: number
  /** Score max pour Niveau 0 (Conforme) */
  compliantMax: number
  /** Au-dessus de compliantMax → Niveau -1 (Dégradé) */
  /** Score au-dessus duquel le risque est techniquement inassurable en l'état */
  declineThreshold: number
}

export const QUALIFICATION_THRESHOLDS: Record<CompanySegment, QualificationThresholds> = {
  S1: {
    segment: 'S1',
    label: 'Micro-service',
    excellenceMax: 20,     // Score <= 20 : micro-structure exemplaire
    improvedMax: 35,       // Score <= 35 : bon petit professionnel
    compliantMax: 55,      // Score <= 55 : acceptable pour un micro
    declineThreshold: 80,  // Au-delà : même un micro est trop risqué
  },
  S2: {
    segment: 'S2',
    label: 'Petit professionnel',
    excellenceMax: 20,
    improvedMax: 35,
    compliantMax: 50,      // Plus strict que S1
    declineThreshold: 75,
  },
  S3: {
    segment: 'S3',
    label: 'PME structurée',
    excellenceMax: 18,     // On attend plus d'une PME structurée
    improvedMax: 30,
    compliantMax: 45,
    declineThreshold: 70,
  },
  S4: {
    segment: 'S4',
    label: 'PME industrielle / à risque',
    excellenceMax: 15,     // Exigence maximale
    improvedMax: 25,
    compliantMax: 40,      // Le plancher est plus bas
    declineThreshold: 60,  // Seuil de refus plus bas : tolérance zéro
  },
}

/**
 * Résout le niveau de qualification à partir du score et du segment.
 */
export function resolveQualificationLevel(
  score: number,
  segment: CompanySegment
): QualificationLevel {
  const thresholds = QUALIFICATION_THRESHOLDS[segment]
  if (score <= thresholds.excellenceMax) return 2
  if (score <= thresholds.improvedMax) return 1
  if (score <= thresholds.compliantMax) return 0
  return -1
}

// ---------------------------------------------------------------------------
// 8. DESCRIPTION DES NIVEAUX DE QUALIFICATION PAR SEGMENT
// ---------------------------------------------------------------------------

/**
 * Ce que signifie concrètement chaque niveau pour chaque segment.
 * Sert à la génération du rapport et à la compréhension du courtier.
 */
export interface LevelDescription {
  level: QualificationLevel
  /** Label technique interne */
  label: string
  /**
   * Label orienté client — plus positif et motivant que le label technique.
   * C1 Sales : "Dégradé" → "À Risque", "Excellence" → "Privilège", etc.
   */
  clientLabel: string
  /** Couleur CSS associée pour l'affichage client */
  clientColor: string
  description: string
  /** Exemples concrets pour ce segment */
  examples: string[]
}

export const LEVEL_DESCRIPTIONS: Record<CompanySegment, LevelDescription[]> = {
  S1: [
    {
      level: 2,
      label: 'Excellence',
      clientLabel: 'Profil Privilège',
      clientColor: '#22c55e',
      description: 'Micro-entreprise exemplaire : toutes les bonnes pratiques de base sont en place, historique vierge, protection proactive.',
      examples: [
        'Extincteur + détecteur de fumée en place et vérifiés',
        'Sauvegardes automatiques des données',
        'Zéro sinistre sur 5 ans',
        'Assurance RC existante et à jour',
      ],
    },
    {
      level: 1,
      label: 'Amélioré',
      clientLabel: 'Profil Optimisé',
      clientColor: '#84cc16',
      description: 'Bonne gestion pour une micro-structure, quelques points d\'amélioration mineurs.',
      examples: [
        'Détection incendie présente mais partielle',
        'Sauvegardes en place mais pas testées',
        'Un sinistre mineur dans l\'historique',
      ],
    },
    {
      level: 0,
      label: 'Conforme',
      clientLabel: 'Profil Standard',
      clientColor: '#f59e0b',
      description: 'Niveau minimum acceptable : les obligations légales de base sont respectées, mais pas d\'effort de prévention particulier.',
      examples: [
        'Local aux normes de base',
        'Pas de détection incendie mais local petit et accessible',
        'Pas de sauvegarde formalisée',
      ],
    },
    {
      level: -1,
      label: 'Dégradé',
      clientLabel: 'Profil À Risque',
      clientColor: '#ef4444',
      description: 'Non-conformités même pour une micro-structure : manquements aux obligations de base ou sinistralité anormale.',
      examples: [
        'Local non conforme (issues de secours bloquées)',
        'Sinistres récurrents',
        'Aucune mesure de protection élémentaire',
        'Activité à risque non déclarée',
      ],
    },
  ],
  S2: [
    {
      level: 2,
      label: 'Excellence',
      clientLabel: 'Profil Privilège',
      clientColor: '#22c55e',
      description: 'Petit professionnel exemplaire avec des pratiques de prévention au-dessus de la norme : maintenance préventive, formation, documentation.',
      examples: [
        'Détection incendie complète et contrat de maintenance',
        'Contrats sous-traitance avec clauses RC',
        'Sauvegardes testées et MFA en place',
        'Zéro sinistre sur 3 ans',
      ],
    },
    {
      level: 1,
      label: 'Amélioré',
      clientLabel: 'Profil Optimisé',
      clientColor: '#84cc16',
      description: 'Bonne gestion avec quelques axes d\'amélioration identifiés.',
      examples: [
        'Détection partielle mais plan d\'amélioration',
        'Maintenance curative mais réactive',
        'Formation cyber des salariés réalisée',
      ],
    },
    {
      level: 0,
      label: 'Conforme',
      clientLabel: 'Profil Standard',
      clientColor: '#f59e0b',
      description: 'Obligations légales et réglementaires respectées, pas de non-conformité majeure, mais pas d\'effort de prévention au-delà du minimum.',
      examples: [
        'Contrôles périodiques à jour',
        'Extincteurs vérifiés annuellement',
        'Pas de plan de continuité mais activité peu sensible',
      ],
    },
    {
      level: -1,
      label: 'Dégradé',
      clientLabel: 'Profil À Risque',
      clientColor: '#ef4444',
      description: 'Manquements réglementaires ou sinistralité préoccupante pour ce profil.',
      examples: [
        'Contrôles périodiques en retard',
        'Pas de détection incendie malgré obligation',
        'Sinistralité RC récurrente (3+ réclamations)',
        'Sous-traitance non encadrée',
      ],
    },
  ],
  S3: [
    {
      level: 2,
      label: 'Excellence',
      clientLabel: 'Profil Privilège',
      clientColor: '#22c55e',
      description: 'PME avec culture de prévention mature : PCA testé, maintenance préventive structurée, formation continue, certifications.',
      examples: [
        'PCA rédigé, testé et mis à jour annuellement',
        'Sprinklers + détection complète + contrat maintenance',
        'Certification qualité (ISO 9001 ou équivalent)',
        'Programme de formation cyber annuel',
        'Fournisseurs diversifiés et qualifiés',
      ],
    },
    {
      level: 1,
      label: 'Amélioré',
      clientLabel: 'Profil Optimisé',
      clientColor: '#84cc16',
      description: 'PME bien gérée avec des mesures de prévention significatives mais non exhaustives.',
      examples: [
        'PCA rédigé mais non testé',
        'Détection complète sans sprinklers',
        'Maintenance préventive en place',
        'Sauvegardes externalisées et testées',
      ],
    },
    {
      level: 0,
      label: 'Conforme',
      clientLabel: 'Profil Standard',
      clientColor: '#f59e0b',
      description: 'PME respectant ses obligations réglementaires sans effort de prévention au-delà. Niveau plancher pour acceptation standard.',
      examples: [
        'Obligations Commodo respectées si applicable',
        'Contrôles périodiques à jour',
        'Extincteurs et détection de base',
        'Pas de PCA mais procédures de reprise informelles',
      ],
    },
    {
      level: -1,
      label: 'Dégradé',
      clientLabel: 'Profil À Risque',
      clientColor: '#ef4444',
      description: 'Non-conformités significatives pour une PME de cette taille. Risque structurel non traité.',
      examples: [
        'Pas de détection incendie sur un site de 20+ salariés',
        'Pas de maintenance préventive sur équipements critiques',
        'Dépendance fournisseur unique non traitée',
        'Sinistralité élevée sans plan de remédiation',
        'Aucune mesure cyber sur infrastructure IT',
      ],
    },
  ],
  S4: [
    {
      level: 2,
      label: 'Excellence',
      clientLabel: 'Profil Privilège',
      clientColor: '#22c55e',
      description: 'Entreprise à risque exemplaire : toutes les mesures de prévention et protection best-in-class sont en place, auditées et maintenues.',
      examples: [
        'Sprinklers + détection + compartimentage + fumivores',
        'Stockage matières dangereuses aux normes (armoires ATEX)',
        'PCA testé semestriellement',
        'Double source d\'approvisionnement critique',
        'Audit prévention externe annuel',
        'Certification ISO 14001 ou équivalent',
      ],
    },
    {
      level: 1,
      label: 'Amélioré',
      clientLabel: 'Profil Optimisé',
      clientColor: '#84cc16',
      description: 'Mesures de prévention significatives au-delà du réglementaire, avec plan d\'amélioration documenté.',
      examples: [
        'Détection complète + extincteurs automatiques',
        'Stockage hazmat conforme avec bac de rétention',
        'PCA rédigé et testé',
        'Maintenance préventive structurée',
      ],
    },
    {
      level: 0,
      label: 'Conforme',
      clientLabel: 'Profil Standard',
      clientColor: '#f59e0b',
      description: 'Strict minimum réglementaire respecté. Pour un S4, c\'est un niveau fragile : une seule défaillance peut basculer en dégradé.',
      examples: [
        'Autorisation Commodo obtenue et à jour',
        'Stockage hazmat dans les limites autorisées',
        'Détection incendie conforme au permis',
        'Contrôles périodiques obligatoires à jour',
      ],
    },
    {
      level: -1,
      label: 'Dégradé',
      clientLabel: 'Profil À Risque',
      clientColor: '#ef4444',
      description: 'Non-conformités sur un profil à risque : situation grave du point de vue souscription. Refus probable ou conditions très restrictives.',
      examples: [
        'Dépassement des seuils Commodo autorisés',
        'Stockage hazmat non conforme',
        'Pas de détection incendie sur site industriel',
        'Sinistres majeurs récents non remédiés',
        'Équipements critiques obsolètes sans maintenance',
        'Aucun PCA sur activité avec dépendance forte',
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// 9. MATRICE DE DÉCISION SOUSCRIPTION
// ---------------------------------------------------------------------------

/**
 * Chaque cellule de la matrice (segment x niveau) donne :
 * - La décision de souscription
 * - Une fourchette INDICATIVE de coefficient de prime (pour référence souscripteur)
 * - Une fourchette de franchise (en EUR)
 * - Des conditions particulières textuelles
 *
 * ⚠️ IMPORTANT — PAS DE DOUBLE MULTIPLICATEUR ⚠️
 *
 * Le coefficient technique AUTORITAIRE est celui produit par le pricing engine
 * (computeIntegratedPricing → PricingResult.finalCoefficient).
 *
 * Les champs premiumMultiplierMin/Max ci-dessous sont des FOURCHETTES INDICATIVES
 * attendues pour cette cellule. Ils servent au souscripteur pour détecter un
 * coefficient technique aberrant (hors fourchette = signal d'alerte), mais
 * NE DOIVENT PAS être multipliés au coefficient technique.
 *
 * Prime finale = Prime_base × PricingResult.finalCoefficient (SEULE formule valide)
 */
export interface UnderwritingCell {
  segment: CompanySegment
  level: QualificationLevel
  decision: UnderwritingDecision
  /** Label court de la décision */
  decisionLabel: string
  /**
   * Fourchette INDICATIVE du coefficient attendu pour cette cellule.
   * Ne PAS appliquer comme multiplicateur supplémentaire au pricing engine.
   * Usage : contrôle de cohérence souscripteur uniquement.
   */
  premiumMultiplierMin: number
  premiumMultiplierMax: number
  /** Franchise minimum recommandée en EUR */
  deductibleMin: number
  /** Franchise maximum recommandée en EUR */
  deductibleMax: number
  /** Conditions particulières (texte libre pour le rapport) */
  conditions: string[]
  /** Validité de l'offre en mois */
  offerValidityMonths: number
}

/**
 * Matrice complète : 4 segments x 4 niveaux = 16 cellules.
 *
 * Lecture : la clé est "segment_level" (ex: "S1_2" pour S1 Excellence).
 * Le niveau est signé : -1, 0, 1, 2.
 */
export const UNDERWRITING_MATRIX: Record<string, UnderwritingCell> = {
  // ── S1 — Micro-service ──────────────────────────────────────────────

  'S1_2': {
    segment: 'S1',
    level: 2,
    decision: 'accept',
    decisionLabel: 'Acceptation directe — tarif préférentiel',
    premiumMultiplierMin: 0.70,
    premiumMultiplierMax: 0.85,
    deductibleMin: 250,
    deductibleMax: 500,
    conditions: [
      'Conditions standard Multi Pro',
      'Pas de condition particulière',
    ],
    offerValidityMonths: 3,
  },
  'S1_1': {
    segment: 'S1',
    level: 1,
    decision: 'accept',
    decisionLabel: 'Acceptation — tarif standard',
    premiumMultiplierMin: 0.85,
    premiumMultiplierMax: 1.00,
    deductibleMin: 250,
    deductibleMax: 500,
    conditions: [
      'Conditions standard Multi Pro',
    ],
    offerValidityMonths: 3,
  },
  'S1_0': {
    segment: 'S1',
    level: 0,
    decision: 'accept',
    decisionLabel: 'Acceptation — tarif de base',
    premiumMultiplierMin: 1.00,
    premiumMultiplierMax: 1.15,
    deductibleMin: 500,
    deductibleMax: 1_000,
    conditions: [
      'Conditions standard Multi Pro',
      'Recommandation de mise en place d\'un extincteur vérifié',
    ],
    offerValidityMonths: 2,
  },
  'S1_-1': {
    segment: 'S1',
    level: -1,
    decision: 'accept_conditions',
    decisionLabel: 'Acceptation sous conditions',
    premiumMultiplierMin: 1.20,
    premiumMultiplierMax: 1.50,
    deductibleMin: 1_000,
    deductibleMax: 2_500,
    conditions: [
      'Mise en conformité des points signalés sous 6 mois',
      'Visite de prévention à 12 mois',
      'Franchise majorée',
      'Exclusion des sinistres liés aux non-conformités identifiées si non remédiées',
    ],
    offerValidityMonths: 1,
  },

  // ── S2 — Petit professionnel ────────────────────────────────────────

  'S2_2': {
    segment: 'S2',
    level: 2,
    decision: 'accept',
    decisionLabel: 'Acceptation directe — tarif préférentiel',
    premiumMultiplierMin: 0.70,
    premiumMultiplierMax: 0.85,
    deductibleMin: 500,
    deductibleMax: 1_000,
    conditions: [
      'Conditions standard Multi Pro',
      'Clause de maintien des mesures de prévention',
    ],
    offerValidityMonths: 3,
  },
  'S2_1': {
    segment: 'S2',
    level: 1,
    decision: 'accept',
    decisionLabel: 'Acceptation — tarif standard',
    premiumMultiplierMin: 0.90,
    premiumMultiplierMax: 1.00,
    deductibleMin: 500,
    deductibleMax: 1_500,
    conditions: [
      'Conditions standard Multi Pro',
    ],
    offerValidityMonths: 3,
  },
  'S2_0': {
    segment: 'S2',
    level: 0,
    decision: 'accept',
    decisionLabel: 'Acceptation — tarif de base',
    premiumMultiplierMin: 1.00,
    premiumMultiplierMax: 1.20,
    deductibleMin: 1_000,
    deductibleMax: 2_500,
    conditions: [
      'Conditions standard Multi Pro',
      'Plan de prévention recommandé',
      'Contrôle des installations dans les 12 mois',
    ],
    offerValidityMonths: 2,
  },
  'S2_-1': {
    segment: 'S2',
    level: -1,
    decision: 'accept_conditions',
    decisionLabel: 'Acceptation sous conditions strictes',
    premiumMultiplierMin: 1.25,
    premiumMultiplierMax: 1.60,
    deductibleMin: 2_500,
    deductibleMax: 5_000,
    conditions: [
      'Plan de prévention obligatoire sous 3 mois',
      'Mise en conformité réglementaire sous 6 mois',
      'Visite de prévention obligatoire sous 6 mois',
      'Franchise majorée sur les catégories dégradées',
      'Clause résolutoire si non-conformité persistante à 12 mois',
    ],
    offerValidityMonths: 1,
  },

  // ── S3 — PME structurée ─────────────────────────────────────────────

  'S3_2': {
    segment: 'S3',
    level: 2,
    decision: 'accept',
    decisionLabel: 'Acceptation directe — tarif préférentiel',
    premiumMultiplierMin: 0.70,
    premiumMultiplierMax: 0.85,
    deductibleMin: 1_000,
    deductibleMax: 2_500,
    conditions: [
      'Conditions standard Multi Pro',
      'Clause de maintien des mesures de prévention et du PCA',
      'Audit de prévention tous les 2 ans',
    ],
    offerValidityMonths: 3,
  },
  'S3_1': {
    segment: 'S3',
    level: 1,
    decision: 'accept',
    decisionLabel: 'Acceptation — tarif standard',
    premiumMultiplierMin: 0.90,
    premiumMultiplierMax: 1.05,
    deductibleMin: 1_500,
    deductibleMax: 5_000,
    conditions: [
      'Conditions standard Multi Pro',
      'PCA recommandé si non existant',
    ],
    offerValidityMonths: 2,
  },
  'S3_0': {
    segment: 'S3',
    level: 0,
    decision: 'accept_conditions',
    decisionLabel: 'Acceptation sous conditions',
    premiumMultiplierMin: 1.05,
    premiumMultiplierMax: 1.30,
    deductibleMin: 2_500,
    deductibleMax: 7_500,
    conditions: [
      'Plan de prévention obligatoire sous 6 mois',
      'PCA exigé sous 12 mois',
      'Visite de prévention sous 6 mois',
      'Franchise majorée',
    ],
    offerValidityMonths: 2,
  },
  'S3_-1': {
    segment: 'S3',
    level: -1,
    decision: 'defer',
    decisionLabel: 'Report — en attente de remédiation',
    premiumMultiplierMin: 1.40,
    premiumMultiplierMax: 1.80,
    deductibleMin: 5_000,
    deductibleMax: 15_000,
    conditions: [
      'Soumission au comité de souscription',
      'Audit de prévention obligatoire avant acceptation',
      'Plan de remédiation écrit exigé',
      'Franchise élevée sur catégories dégradées',
      'Possibilité d\'exclusions spécifiques',
      'Durée contrat limitée à 1 an non reconductible sans amélioration',
    ],
    offerValidityMonths: 1,
  },

  // ── S4 — PME industrielle / à risque ────────────────────────────────

  'S4_2': {
    segment: 'S4',
    level: 2,
    decision: 'accept',
    decisionLabel: 'Acceptation — tarif ajusté au risque',
    premiumMultiplierMin: 0.80,
    premiumMultiplierMax: 0.95,
    deductibleMin: 2_500,
    deductibleMax: 10_000,
    conditions: [
      'Conditions Multi Pro avec avenants risques spéciaux',
      'Clause de maintien des protections (sprinklers, stockage hazmat)',
      'Audit de prévention annuel',
      'Déclaration annuelle des stocks matières dangereuses',
    ],
    offerValidityMonths: 2,
  },
  'S4_1': {
    segment: 'S4',
    level: 1,
    decision: 'accept_conditions',
    decisionLabel: 'Acceptation sous conditions',
    premiumMultiplierMin: 1.00,
    premiumMultiplierMax: 1.25,
    deductibleMin: 5_000,
    deductibleMax: 15_000,
    conditions: [
      'Avenants risques spéciaux obligatoires',
      'Plan de prévention incendie sous 6 mois',
      'Visite de prévention sous 3 mois',
      'Déclaration annuelle stocks et activités',
      'Clause de maintien des protections',
    ],
    offerValidityMonths: 2,
  },
  'S4_0': {
    segment: 'S4',
    level: 0,
    decision: 'accept_conditions',
    decisionLabel: 'Acceptation sous conditions strictes',
    premiumMultiplierMin: 1.20,
    premiumMultiplierMax: 1.50,
    deductibleMin: 7_500,
    deductibleMax: 25_000,
    conditions: [
      'Soumission au comité de souscription pour validation',
      'Audit de prévention obligatoire avant mise en risque',
      'Plan de prévention obligatoire sous 3 mois',
      'PCA exigé sous 6 mois',
      'Franchise élevée sur dommages aux biens',
      'Exclusion possible des risques environnementaux',
      'Contrat annuel non reconductible sans amélioration du score',
    ],
    offerValidityMonths: 1,
  },
  'S4_-1': {
    segment: 'S4',
    level: -1,
    decision: 'decline',
    decisionLabel: 'Refus — risque techniquement inassurable en l\'état',
    premiumMultiplierMin: 0, // N/A
    premiumMultiplierMax: 0, // N/A
    deductibleMin: 0,        // N/A
    deductibleMax: 0,        // N/A
    conditions: [
      'Refus motivé avec détail des non-conformités',
      'Indication des actions correctives nécessaires pour réévaluation',
      'Possibilité de resoumettre après remédiation documentée',
      'Orientation vers un courtier spécialisé ou le marché de Londres',
    ],
    offerValidityMonths: 0,
  },
}

// ---------------------------------------------------------------------------
// 10. FONCTION DE DÉCISION COMPLÈTE
// ---------------------------------------------------------------------------

export interface UnderwritingResult {
  /** Segment résolu */
  segment: CompanySegment
  /** Catégorie d'activité résolue */
  activity: ActivityCategory
  /** Poids des catégories appliqués */
  weights: CategoryWeights
  /** Questions applicables pour ce segment */
  applicableQuestions: QuestionApplicability
  /** Score global recalculé avec les poids proportionnés */
  adjustedGlobalScore: number
  /** Niveau de qualification */
  qualificationLevel: QualificationLevel
  /** Cellule de la matrice de décision */
  underwritingCell: UnderwritingCell
  /** Description du niveau pour le rapport */
  levelDescription: LevelDescription
  /** Le score dépasse-t-il le seuil de refus absolu ? */
  exceedsDeclineThreshold: boolean
}

/**
 * Fonction principale : produit la décision de souscription complète
 * à partir des données entreprise et des scores par catégorie.
 *
 * Cette fonction :
 * 1. Résout le segment de l'entreprise
 * 2. Résout la catégorie d'activité
 * 3. Applique les poids proportionnés
 * 4. Recalcule le score global avec ces poids
 * 5. Détermine le niveau de qualification
 * 6. Consulte la matrice de décision
 * 7. Vérifie le seuil de refus absolu
 *
 * Le score global passé en paramètre (categoryScores) est celui calculé
 * par les questions applicables — les questions non applicables ont un
 * score de 0 et ne contribuent pas.
 */
export function computeUnderwritingDecision(
  company: CompanyData,
  categoryScores: Record<RiskCategory, number>
): UnderwritingResult {
  // 1. Résolution du segment
  const segment = resolveSegment(company)

  // 2. Résolution de l'activité
  const activity = resolveActivityCategory(company.naceCode)

  // 3. Poids proportionnés
  const weights = resolveWeights(segment, activity)

  // 4. Questions applicables
  const applicableQuestions = QUESTION_APPLICABILITY[segment]

  // 5. Score global ajusté
  const adjustedGlobalScore = Object.entries(categoryScores).reduce(
    (sum, [cat, score]) => sum + score * (weights[cat as RiskCategory] || 0),
    0
  )
  const roundedScore = Math.round(adjustedGlobalScore * 100) / 100

  // 6. Niveau de qualification
  const qualificationLevel = resolveQualificationLevel(roundedScore, segment)

  // 7. Cellule de la matrice
  const matrixKey = `${segment}_${qualificationLevel}`
  const underwritingCell = UNDERWRITING_MATRIX[matrixKey]

  // 8. Description du niveau
  const levelDescription = LEVEL_DESCRIPTIONS[segment].find(
    d => d.level === qualificationLevel
  )!

  // 9. Seuil de refus absolu
  const exceedsDeclineThreshold =
    roundedScore > QUALIFICATION_THRESHOLDS[segment].declineThreshold

  // Si le seuil de refus absolu est dépassé, forcer la décision à decline
  // même si la matrice donnerait autre chose
  const finalCell = exceedsDeclineThreshold
    ? {
        ...underwritingCell,
        decision: 'decline' as UnderwritingDecision,
        decisionLabel: 'Refus — score au-dessus du seuil d\'acceptabilité pour ce profil',
        premiumMultiplierMin: 0,
        premiumMultiplierMax: 0,
        conditions: [
          `Score ${roundedScore} dépasse le seuil de refus (${QUALIFICATION_THRESHOLDS[segment].declineThreshold}) pour le segment ${segment}`,
          'Refus motivé avec détail des non-conformités',
          'Actions correctives nécessaires avant réévaluation',
        ],
      }
    : underwritingCell

  return {
    segment,
    activity,
    weights,
    applicableQuestions,
    adjustedGlobalScore: roundedScore,
    qualificationLevel,
    underwritingCell: finalCell,
    levelDescription,
    exceedsDeclineThreshold,
  }
}

// ---------------------------------------------------------------------------
// 11. RECALCUL DU SCORE AVEC QUESTIONS APPLICABLES
// ---------------------------------------------------------------------------

/**
 * Recalcule le score d'une catégorie en ne prenant en compte que les
 * questions applicables au segment. Les questions non applicables sont
 * exclues et les poids sont renormalisés.
 *
 * Exemple : si S1 a 4 questions fire applicables sur 6, les poids des
 * 4 questions sont renormalisés pour sommer à 1.0 au sein de la catégorie.
 */
export function computeAdjustedCategoryScore(
  factors: { questionKey: string; factorScore: number; weight: number }[],
  segment: CompanySegment
): number {
  const applicability = QUESTION_APPLICABILITY[segment]

  // Filtrer les questions applicables
  const applicableFactors = factors.filter(f => applicability[f.questionKey] === true)

  if (applicableFactors.length === 0) return 0

  // Renormaliser les poids
  const totalWeight = applicableFactors.reduce((sum, f) => sum + f.weight, 0)
  if (totalWeight === 0) return 0

  const normalizedScore = applicableFactors.reduce(
    (sum, f) => sum + f.factorScore * (f.weight / totalWeight),
    0
  )

  // Échelle 0-100
  return Math.round(normalizedScore * 10 * 100) / 100
}

// ---------------------------------------------------------------------------
// 12. CALCUL DE PRIME PROPORTIONNÉ
// ---------------------------------------------------------------------------

/**
 * Calcule la prime ajustée en appliquant le multiplicateur de la matrice.
 *
 * basePremium : prime de base calculée par computePremium() (scoring.ts)
 * result : résultat de computeUnderwritingDecision()
 *
 * Retourne { min, max } en EUR.
 * Retourne { min: 0, max: 0 } si la décision est un refus.
 */
export function computeAdjustedPremium(
  basePremium: number,
  result: UnderwritingResult
): { min: number; max: number } {
  if (result.underwritingCell.decision === 'decline') {
    return { min: 0, max: 0 }
  }
  return {
    min: Math.round(basePremium * result.underwritingCell.premiumMultiplierMin),
    max: Math.round(basePremium * result.underwritingCell.premiumMultiplierMax),
  }
}

// ---------------------------------------------------------------------------
// 13. UTILITAIRES D'AFFICHAGE
// ---------------------------------------------------------------------------

export function getSegmentLabel(segment: CompanySegment): string {
  const labels: Record<CompanySegment, string> = {
    S1: 'Micro-service',
    S2: 'Petit professionnel',
    S3: 'PME structurée',
    S4: 'PME industrielle / à risque',
  }
  return labels[segment]
}

export function getQualificationLabel(level: QualificationLevel): string {
  const labels: Record<QualificationLevel, string> = {
    [-1]: 'Dégradé',
    [0]: 'Conforme',
    [1]: 'Amélioré',
    [2]: 'Excellence',
  }
  return labels[level]
}

export function getDecisionLabel(decision: UnderwritingDecision): string {
  const labels: Record<UnderwritingDecision, string> = {
    accept: 'Acceptation',
    accept_conditions: 'Acceptation sous conditions',
    defer: 'Report',
    decline: 'Refus',
  }
  return labels[decision]
}

export function getDecisionColor(decision: UnderwritingDecision): string {
  const colors: Record<UnderwritingDecision, string> = {
    accept: '#22c55e',           // Vert
    accept_conditions: '#f59e0b', // Orange
    defer: '#f97316',             // Orange foncé
    decline: '#ef4444',           // Rouge
  }
  return colors[decision]
}

export function getQualificationColor(level: QualificationLevel): string {
  const colors: Record<QualificationLevel, string> = {
    [2]: '#22c55e',   // Vert
    [1]: '#84cc16',   // Vert-jaune
    [0]: '#f59e0b',   // Orange
    [-1]: '#ef4444',  // Rouge
  }
  return colors[level]
}
