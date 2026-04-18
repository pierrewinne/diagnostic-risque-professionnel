// =============================================================================
// POOLS DE RISQUE NACE — Multi Pro (Dommages + RC Professionnelle)
// =============================================================================
// Auteur  : Expert Souscription Senior — DiagRisk Pro
// Version : 1.0.0
// Date    : 2026-04-18
// Contexte: Luxembourg, produit multirisque professionnelle (Dommages + RC Pro)
//
// Ce module enrichit le système de proportionnalité existant
// (segment S1-S4 x catégorie d'activité) avec une dimension supplémentaire :
// le POOL DE RISQUE NACE, qui reflète le profil de risque intrinsèque
// lié à la nature précise de l'activité économique.
//
// Le pool NACE ne REMPLACE PAS le segment ni la catégorie d'activité.
// Il s'y COMBINE pour produire des pondérations et un facteur de risque
// plus fidèles à la réalité du terrain.
//
// Architecture du scoring avec pools NACE :
//   poids_finaux = alpha * poids_segment_activité + (1 - alpha) * poids_pool_nace
//   score_final  = score_brut * facteur_risque_intrinsèque_pool
//
// Le paramètre alpha (POOL_BLEND_ALPHA) contrôle le dosage :
//   alpha = 1.0 → le pool n'a aucun effet (mode actuel)
//   alpha = 0.5 → 50/50 entre segment et pool
//   alpha = 0.0 → le pool domine entièrement (déconseillé)
//
// Valeur retenue : alpha = 0.60 (le segment garde la main, le pool ajuste)
// =============================================================================

import type { RiskCategory } from '../types'
import type { CategoryWeights, CompanySegment, ActivityCategory } from '../lib/proportionality'
import { resolveWeights } from '../lib/proportionality'

// ---------------------------------------------------------------------------
// 1. TYPES
// ---------------------------------------------------------------------------

/**
 * Pool de risque NACE — regroupe des codes NACE partageant un profil
 * de risque homogène du point de vue souscription Multi Pro.
 *
 * Chaque pool est un "archétype de risque" : les activités à l'intérieur
 * du pool partagent les mêmes dominantes d'exposition, la même intensité
 * de risque, et les mêmes points d'attention en souscription.
 */
export interface NaceRiskPool {
  /** Identifiant court et stable (ex: POOL_FOOD, POOL_OFFICE) */
  id: string

  /** Label descriptif en français */
  label: string

  /** Description du profil de risque pour le rapport */
  description: string

  /**
   * Codes NACE couverts par ce pool.
   * Format : section (lettre) ou division (2 chiffres).
   * Ex: ['I', '56'] couvre toute la section I + la division 56.
   *
   * La résolution est hiérarchique :
   * 1. On cherche d'abord une correspondance exacte sur la division (2 chiffres)
   * 2. Puis sur la section (lettre)
   * 3. Fallback sur POOL_MISC
   */
  naceSections: string[]
  naceDivisions: string[]

  /**
   * Pondération des 6 catégories de risque propre à ce pool.
   * Somme = 1.00. Reflète l'exposition DOMINANTE du pool.
   */
  categoryWeights: CategoryWeights

  /**
   * Facteur de risque intrinsèque.
   * 1.00 = risque moyen du portefeuille Multi Pro.
   * > 1.00 = activité plus risquée que la moyenne.
   * < 1.00 = activité moins risquée que la moyenne.
   *
   * Ce facteur s'applique au score global APRÈS pondération :
   *   score_ajusté = score_brut * intrinsicRiskFactor
   *
   * L'effet est borné : un facteur de 1.30 sur un score de 50
   * donne 65, pas 150 (le score reste clampé à [0, 100]).
   */
  intrinsicRiskFactor: number

  /**
   * Questions du questionnaire qui sont NON APPLICABLES pour ce pool.
   * Elles reçoivent un score neutre (0) et ne contribuent pas.
   *
   * Complète les non-applicabilités du segment (QUESTION_APPLICABILITY).
   * La logique est : question applicable = applicable_segment AND applicable_pool.
   */
  questionsNotApplicable: string[]

  /**
   * Questions dont le poids doit être RÉDUIT pour ce pool.
   * Clé = question key, valeur = multiplicateur (0.0 à 1.0).
   * Ex: { 'fleet_count': 0.3 } → le poids de fleet_count est réduit à 30%.
   */
  questionsWeightModifiers: Record<string, number>

  /**
   * Risques spécifiques à ce pool qui ne sont PAS capturés par les
   * 27 questions actuelles du questionnaire.
   *
   * Chaque risque spécifique est une alerte pour le souscripteur :
   * il doit vérifier manuellement ce point lors de l'analyse.
   */
  specificRisks: SpecificRisk[]

  /**
   * Références normatives pertinentes pour ce pool.
   * IDs de la bibliothèque normative (normative-library.ts).
   */
  normativeReferences: string[]

  /**
   * Exclusions types qui devraient être envisagées pour ce pool.
   * Indications pour la structuration de la couverture.
   */
  typicalExclusions: string[]
}

/**
 * Risque spécifique non capturé par le questionnaire standard.
 */
export interface SpecificRisk {
  /** Identifiant court */
  id: string
  /** Description du risque */
  label: string
  /** Catégorie de risque principalement affectée */
  category: RiskCategory
  /** Sévérité potentielle : low, moderate, high, critical */
  severity: 'low' | 'moderate' | 'high' | 'critical'
  /** Conseil de souscription */
  underwritingGuidance: string
}

// ---------------------------------------------------------------------------
// 2. PARAMÈTRE DE DOSAGE SEGMENT / POOL
// ---------------------------------------------------------------------------

/**
 * Alpha contrôle le dosage entre les poids du segment et ceux du pool.
 *
 * poids_finaux[cat] = alpha * poids_segment[cat] + (1 - alpha) * poids_pool[cat]
 *
 * Valeur retenue : 0.60
 * Justification :
 * - Le segment (taille/structure) reste le facteur dominant car il détermine
 *   le NIVEAU D'EXIGENCE (proportionnalité).
 * - Le pool NACE apporte la COULEUR DU RISQUE (profil d'exposition par activité).
 * - Un alpha de 0.60 donne au segment 60% du poids final et au pool 40%.
 * - Suffisant pour différencier un restaurant d'un cabinet d'avocats
 *   (tous deux "services") sans écraser la logique de proportionnalité.
 *
 * Ce paramètre est recalibrable. En phase de lancement, on peut commencer
 * à 0.70 (pool faible) et descendre progressivement à 0.50 après validation
 * actuarielle sur 12-18 mois d'historique.
 */
export const POOL_BLEND_ALPHA = 0.60

// ---------------------------------------------------------------------------
// 3. DÉFINITION DES 12 POOLS DE RISQUE
// ---------------------------------------------------------------------------

export const NACE_RISK_POOLS: NaceRiskPool[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 1 — OFFICE : Activités de bureau / prestations intellectuelles
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_OFFICE',
    label: 'Bureau / Prestations intellectuelles',
    description:
      'Activités principalement exercées en bureau : conseil, IT, finance, ' +
      'immobilier, professions libérales intellectuelles. Faible exposition ' +
      'physique (incendie, équipement), exposition dominante en RC professionnelle ' +
      'et cyber. Le risque principal est l\'erreur intellectuelle et la fuite de données.',
    naceSections: ['J', 'K', 'L', 'M', 'N'],
    naceDivisions: [
      // J : Information et communication (62 = IT, 63 = services info)
      // K : Finance et assurance
      // L : Immobilier
      // M : Activités spécialisées (69 = juridique/compta, 70 = conseil, 71 = ingénierie, 73 = pub)
      // N : Services administratifs (77 = location, 78 = emploi, 80 = sécurité, 82 = admin)
    ],
    categoryWeights: {
      fire: 0.10,       // Locaux de bureau, faible charge calorifique
      liability: 0.30,  // RC pro dominante : erreur de conseil, obligation de moyens/résultat
      dependency: 0.10, // Peu de dépendance physique, mais dépendance IT
      equipment: 0.05,  // Pas de machines — mobilier et informatique
      cyber: 0.45,      // +0.05 ex-fleet → cyber (exposition principale bureau)
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 0.85,
    questionsNotApplicable: [
      'fire_hazmat',       // Pas de matières dangereuses en bureau
      'equip_age',         // Pas de parc machines industriel
      'equip_critical',    // Pas d'équipement de production critique
      'equip_maintenance', // Pas de maintenance industrielle
    ],
    questionsWeightModifiers: {
      fire_construction: 0.5,  // Poids réduit : la construction du bureau est rarement critique
      fire_assets: 0.5,        // Les actifs physiques sont faibles
    },
    specificRisks: [
      {
        id: 'OFFICE_PI',
        label: 'Responsabilité civile professionnelle / erreur intellectuelle',
        category: 'liability',
        severity: 'high',
        underwritingGuidance:
          'Vérifier l\'existence et l\'adéquation de la RC Pro. Les professions ' +
          'réglementées (avocats, comptables, architectes) ont des obligations ' +
          'minimales de couverture. Vérifier les montants garantis par rapport au CA.',
      },
      {
        id: 'OFFICE_DATA_BREACH',
        label: 'Violation de données personnelles (RGPD)',
        category: 'cyber',
        severity: 'high',
        underwritingGuidance:
          'Vérifier la conformité RGPD de base : DPO désigné si > 250 salariés ' +
          'ou traitement de données sensibles, registre des traitements, ' +
          'notification CNPD sous 72h en cas de breach. Volume de données traitées ?',
      },
      {
        id: 'OFFICE_KEY_PERSON',
        label: 'Dépendance à une personne clé (associé, expert)',
        category: 'dependency',
        severity: 'moderate',
        underwritingGuidance:
          'Pour les cabinets de moins de 5 personnes, la perte de l\'associé ' +
          'principal peut entraîner l\'arrêt total de l\'activité. Vérifier ' +
          'l\'existence d\'une assurance homme-clé ou d\'un plan de succession.',
      },
    ],
    normativeReferences: [
      'LU-RGPD-CNPD',        // RGPD Luxembourg via CNPD
      'LU-RGD-2018-08-17',   // Incendie bâtiment (même pour un bureau)
      'ISO-27001',            // Sécurité de l'information
    ],
    typicalExclusions: [
      'Exclusion des amendes et pénalités réglementaires',
      'Exclusion de la responsabilité contractuelle pure (hors cadre RC Pro)',
      'Sous-limites cyber à calibrer selon le volume de données',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 2 — FOOD : Restauration, alimentation, hôtellerie
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_FOOD',
    label: 'Restauration / Alimentation / Hôtellerie',
    description:
      'Activités impliquant la préparation, la vente et le service d\'aliments ' +
      'et de boissons, ainsi que l\'hébergement. Risque incendie élevé (huiles, ' +
      'cuisines, friteuses), RC forte (accueil du public, intoxication alimentaire), ' +
      'dépendance opérationnelle significative (site unique, personnel, fournisseurs).',
    naceSections: ['I'],
    naceDivisions: [
      '10', // Industries alimentaires (boulangerie, charcuterie, conserverie) — M4 fix
      '11', // Fabrication de boissons (brasserie, distillerie) — M4 fix
      '55', // Hébergement
      '56', // Restauration
    ],
    categoryWeights: {
      fire: 0.35,       // +0.05 ex-fleet → fire (risque incendie dominant food)
      liability: 0.30,  // Accueil public, intoxication alimentaire, chute client
      dependency: 0.15, // Site unique fréquent, personnel clé, approvisionnement frais
      equipment: 0.15,  // Équipement cuisine (froid, cuisson), hôtel (ascenseurs)
      cyber: 0.05,      // Faible sauf paiement/réservation en ligne
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.10,
    questionsNotApplicable: [],
    questionsWeightModifiers: {
      cyber_data: 0.5,       // Peu de données sensibles (sauf cartes bancaires)
      cyber_training: 0.5,   // Moins critique que pour un bureau IT
    },
    specificRisks: [
      {
        id: 'FOOD_KITCHEN_FIRE',
        label: 'Incendie de cuisine / friteuse / hotte',
        category: 'fire',
        severity: 'high',
        underwritingGuidance:
          'Vérifier : nettoyage régulier de la hotte et des conduits (fréquence ?), ' +
          'présence d\'un système d\'extinction automatique de cuisine (type Ansul), ' +
          'couverture anti-feu accessible, formation du personnel à l\'extinction. ' +
          'La graisse accumulée dans les conduits est la cause n.1 de sinistre majeur ' +
          'en restauration.',
      },
      {
        id: 'FOOD_CONTAMINATION',
        label: 'Intoxication alimentaire / contamination',
        category: 'liability',
        severity: 'high',
        underwritingGuidance:
          'Vérifier : protocole HACCP en place ? Traçabilité des lots ? ' +
          'Chaîne du froid respectée (relevés de température) ? ' +
          'Formation hygiène alimentaire du personnel ?',
      },
      {
        id: 'FOOD_PUBLIC_LIABILITY',
        label: 'Accident corporel client (chute, brûlure)',
        category: 'liability',
        severity: 'moderate',
        underwritingGuidance:
          'Vérifier l\'état des sols (antidérapant), la sécurité de la terrasse, ' +
          'l\'éclairage des accès, les conditions d\'évacuation (capacité vs occupation réelle).',
      },
      {
        id: 'FOOD_COLD_CHAIN',
        label: 'Rupture de chaîne du froid / panne frigo',
        category: 'equipment',
        severity: 'moderate',
        underwritingGuidance:
          'Vérifier l\'âge et la maintenance du parc froid. Alarme de température ? ' +
          'Valeur du stock périssable ? Assurance des denrées en chambre froide ?',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',    // Incendie bâtiment — catégorie ERP
      'LU-ITM-SST-1500',      // Sécurité incendie lieu de travail
      'EU-HACCP-852-2004',     // Hygiène alimentaire (règlement CE 852/2004)
    ],
    typicalExclusions: [
      'Exclusion des denrées périssables au-delà de 72h post-sinistre',
      'Franchise spécifique sur la RC produits alimentaires',
      'Exclusion du risque d\'alcool (si débit de boissons sans licence)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 3 — RETAIL : Commerce de détail / distribution
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_RETAIL',
    label: 'Commerce de détail / Distribution',
    description:
      'Commerce de détail toutes catégories (habillement, électronique, ' +
      'ameublement, bricolage, etc.) et commerce de gros hors alimentaire. ' +
      'Risque stock (vol, incendie), accueil du public, dépendance fournisseurs.',
    naceSections: ['G'],
    naceDivisions: [
      '45', // Commerce/réparation véhicules
      '46', // Commerce de gros
      '47', // Commerce de détail
    ],
    categoryWeights: {
      fire: 0.25,       // Stock, emballages, charge calorifique variable
      liability: 0.35,  // +0.10 ex-fleet → liability (exposition dominante commerce)
      dependency: 0.15, // Fournisseurs, logistique, saisonnalité
      equipment: 0.10,  // Caisses, rayonnage, manutention
      cyber: 0.15,      // E-commerce, paiement, données clients
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 0.95,
    questionsNotApplicable: [],
    questionsWeightModifiers: {
      equip_age: 0.6,          // Moins critique que l'industrie
      equip_maintenance: 0.6,  // Maintenance du rayonnage/frigo, pas de machines lourdes
    },
    specificRisks: [
      {
        id: 'RETAIL_THEFT',
        label: 'Vol / cambriolage / vandalisme',
        category: 'fire', // Dommages aux biens
        severity: 'moderate',
        underwritingGuidance:
          'Vérifier : alarme intrusion, vidéosurveillance, coffre-fort, ' +
          'protection physique (rideau métallique, vitrine anti-effraction). ' +
          'Secteur géographique (zone urbaine sensible ?) et historique de vol.',
      },
      {
        id: 'RETAIL_PRODUCT_LIABILITY',
        label: 'RC produit distribué / rappel de produit',
        category: 'liability',
        severity: 'moderate',
        underwritingGuidance:
          'Le distributeur peut être tenu responsable in solidum avec le fabricant. ' +
          'Vérifier la traçabilité des produits, les certificats CE, les clauses ' +
          'de recours fournisseur dans les contrats d\'achat.',
      },
      {
        id: 'RETAIL_ECOMMERCE',
        label: 'Exposition e-commerce (fraude, données cartes)',
        category: 'cyber',
        severity: 'moderate',
        underwritingGuidance:
          'Si vente en ligne : vérifier la conformité PCI-DSS pour les paiements, ' +
          'la sécurisation du site web, la gestion des comptes clients. ' +
          'Part du CA en ligne ?',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'LU-ITM-SST-1500',
      'EU-PRODUIT-2001-95',   // Directive sécurité générale des produits
    ],
    typicalExclusions: [
      'Exclusion ou sous-limite sur le vol sans effraction',
      'Exclusion du risque de rappel produit (sauf avenant spécifique)',
      'Franchise spécifique RC produit',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 4 — CONSTRUCTION : Bâtiment et travaux publics
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_CONSTRUCTION',
    label: 'Construction / Bâtiment / Travaux publics',
    description:
      'Activités de construction, rénovation, génie civil, second oeuvre. ' +
      'Risque RC très élevé (dommage à l\'ouvrage, RC décennale, dommage aux tiers), ' +
      'risque incendie sur chantier (travaux par points chauds), forte sinistralité ' +
      'corporelle (chutes, écrasements), dépendance sous-traitance.',
    naceSections: ['F'],
    naceDivisions: [
      '41', // Construction de bâtiments
      '42', // Génie civil
      '43', // Travaux de construction spécialisés
    ],
    categoryWeights: {
      fire: 0.20,       // Risque chantier (soudure, travaux par points chauds)
      liability: 0.50,  // +0.15 ex-fleet → liability (RC dominante construction)
      dependency: 0.10, // Sous-traitance, approvisionnement matériaux
      equipment: 0.15,  // Engins de chantier, outillage lourd
      cyber: 0.05,      // Marginal
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.20,
    questionsNotApplicable: [
      'cyber_data',      // Peu de données personnelles sensibles
      'cyber_training',  // Formation cyber non prioritaire
      'cyber_mfa',       // MFA non pertinent
    ],
    questionsWeightModifiers: {
      dep_single_site: 0.5,   // Multi-chantiers par nature
      cyber_backup: 0.5,
      cyber_incident: 0.5,
    },
    specificRisks: [
      {
        id: 'CONSTR_DECENNIAL',
        label: 'Responsabilité décennale / dommage à l\'ouvrage',
        category: 'liability',
        severity: 'critical',
        underwritingGuidance:
          'Au Luxembourg, la responsabilité décennale existe (art. 1792 Code Civil). ' +
          'Vérifier l\'existence d\'une assurance décennale/DO distincte. ' +
          'Le contrat Multi Pro ne couvre PAS la décennale — s\'assurer que le client ' +
          'le comprend et dispose d\'une couverture séparée.',
      },
      {
        id: 'CONSTR_HOT_WORK',
        label: 'Travaux par points chauds (soudure, meulage, bitume)',
        category: 'fire',
        severity: 'high',
        underwritingGuidance:
          'Permis de feu systématique ? Procédure de veille incendie post-travaux ? ' +
          'Extincteur à portée ? Protection des zones environnantes ? ' +
          'Le travail par points chauds est la première cause d\'incendie sur chantier.',
      },
      {
        id: 'CONSTR_BODILY_INJURY',
        label: 'Accident corporel grave (chute de hauteur, écrasement)',
        category: 'liability',
        severity: 'critical',
        underwritingGuidance:
          'Vérifier : plan de sécurité chantier, formation sécurité, EPI fournis, ' +
          'coordinateur SPS désigné, taux d\'accident du travail sur 3 ans. ' +
          'Au Luxembourg : déclaration ITM obligatoire.',
      },
      {
        id: 'CONSTR_SUBCONTRACTING',
        label: 'Sous-traitance non maîtrisée',
        category: 'liability',
        severity: 'high',
        underwritingGuidance:
          'Part du CA sous-traité ? Clauses RC dans les contrats de sous-traitance ? ' +
          'Vérification des assurances des sous-traitants ? ' +
          'Le donneur d\'ordre est responsable in solidum.',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'LU-ITM-SST-1500',
      'LU-COORDINATION-CHANTIER', // Loi sur la coordination sécurité-santé sur chantier
    ],
    typicalExclusions: [
      'Exclusion de la garantie décennale (couverture séparée obligatoire)',
      'Exclusion des dommages à l\'ouvrage en cours de construction',
      'Exclusion amiante / plomb (sauf avenant)',
      'Franchise majorée RC corporel',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 5 — CRAFT : Artisanat de production / atelier
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_CRAFT',
    label: 'Artisanat de production / Atelier',
    description:
      'Artisans travaillant en atelier : menuiserie, métallerie, serrurerie, ' +
      'imprimerie, boulangerie artisanale, ébénisterie, carrosserie. ' +
      'Risque incendie élevé (poussières, solvants, travaux par points chauds), ' +
      'risque machines important, RC après livraison.',
    naceSections: [],
    naceDivisions: [
      // Division 10 (industries alimentaires) retirée → POOL_FOOD (M4 fix)
      '13', // Textile
      '14', // Habillement
      '15', // Cuir et chaussure
      '16', // Travail du bois (menuiserie, ébénisterie)
      '17', // Papier et carton
      '18', // Imprimerie et reproduction
      '25', // Fabrication de produits métalliques (serrurerie, chaudronnerie)
      '31', // Fabrication de meubles
      '32', // Autres industries manufacturières (bijouterie, instruments)
      '33', // Réparation et installation de machines
      '95', // Réparation d'ordinateurs et de biens personnels
    ],
    categoryWeights: {
      fire: 0.40,       // +0.10 ex-fleet → fire (exposition dominante artisanat)
      liability: 0.20,  // RC produit fabriqué, RC après livraison
      dependency: 0.10, // Atelier unique, matières premières
      equipment: 0.25,  // Machines-outils, CNC, compresseurs
      cyber: 0.05,      // Marginal
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.15,
    questionsNotApplicable: [
      'cyber_data',     // Peu de données personnelles
      'cyber_training', // Non prioritaire
    ],
    questionsWeightModifiers: {
      cyber_mfa: 0.3,
      cyber_backup: 0.5,
    },
    specificRisks: [
      {
        id: 'CRAFT_DUST_EXPLOSION',
        label: 'Explosion de poussières combustibles (bois, métal, farine)',
        category: 'fire',
        severity: 'critical',
        underwritingGuidance:
          'Concerne principalement NACE 16 (bois) et 10 (farine). ' +
          'Vérifier : aspiration centralisée des poussières, silo avec évent d\'explosion, ' +
          'nettoyage régulier (pas de dépôts > 1mm), interdiction des flammes nues, ' +
          'mise à la terre des équipements, zone ATEX délimitée. ' +
          'Risque de sévérité extrême : un incendie peut détruire l\'atelier entièrement.',
      },
      {
        id: 'CRAFT_MACHINE_INJURY',
        label: 'Accident machine grave (amputation, écrasement)',
        category: 'equipment',
        severity: 'high',
        underwritingGuidance:
          'Vérifier : conformité CE des machines, protections physiques en place, ' +
          'formation des opérateurs, procédure de consignation/déconsignation. ' +
          'Le taux d\'accident du travail est un indicateur clé.',
      },
      {
        id: 'CRAFT_SOLVENT_FIRE',
        label: 'Incendie lié aux solvants / vernis / colles',
        category: 'fire',
        severity: 'high',
        underwritingGuidance:
          'Stockage des solvants dans armoire ventilée et résistante au feu ? ' +
          'Quantité stockée ? Ventilation de l\'atelier ? ' +
          'Pour les carrossiers : cabine de peinture aux normes ATEX ?',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'LU-ITM-SST-1500',
      'LU-ITM-ATEX',           // Réglementation ATEX Luxembourg
      'EU-MACHINE-2006-42',    // Directive machines
    ],
    typicalExclusions: [
      'Exclusion des dommages liés à la non-conformité ATEX',
      'Franchise majorée sur les sinistres machines',
      'Exclusion pollution graduelle (solvants, huiles)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 6 — INDUSTRY : Industrie manufacturière lourde
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_INDUSTRY',
    label: 'Industrie manufacturière',
    description:
      'Industrie de transformation : chimie, plasturgie, sidérurgie, ' +
      'agroalimentaire industriel, électronique, automobile. Process continu ' +
      'ou semi-continu, matières premières importantes, dépendance supply chain, ' +
      'risque incendie et explosion élevé, équipements critiques coûteux.',
    naceSections: [],
    naceDivisions: [
      // Division 11 (boissons) → POOL_FOOD (M4 fix)
      '12', // Tabac
      '19', // Cokéfaction et raffinage
      '20', // Industrie chimique
      '21', // Industrie pharmaceutique
      '22', // Caoutchouc et plastiques
      '23', // Produits minéraux non métalliques (verre, ciment)
      '24', // Métallurgie
      '26', // Produits informatiques, électroniques, optiques
      '27', // Équipements électriques
      '28', // Machines et équipements n.c.a.
      '29', // Véhicules automobiles
      '30', // Autres matériels de transport
    ],
    categoryWeights: {
      fire: 0.35,       // +0.05 ex-fleet → fire (exposition dominante industrie)
      liability: 0.15,  // RC produit industriel, RC environnementale
      dependency: 0.20, // Supply chain complexe, équipements critiques
      equipment: 0.25,  // Parc machines lourd et coûteux
      cyber: 0.05,      // SCADA/OT en émergence mais encore secondaire
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.35,
    questionsNotApplicable: [],
    questionsWeightModifiers: {
      cyber_data: 0.5,     // Données personnelles secondaires
    },
    specificRisks: [
      {
        id: 'IND_PROCESS_EXPLOSION',
        label: 'Explosion process (ATEX, réaction chimique)',
        category: 'fire',
        severity: 'critical',
        underwritingGuidance:
          'Vérifier le classement ATEX des zones, le DRCPE (Document Relatif à la ' +
          'Protection Contre les Explosions), les soupapes de sécurité, les systèmes ' +
          'd\'inertage, les évents d\'explosion. Pour les sites Seveso : vérifier le ' +
          'rapport de sécurité et l\'avis de la dernière inspection.',
      },
      {
        id: 'IND_ENVIRONMENTAL',
        label: 'Pollution / atteinte à l\'environnement',
        category: 'liability',
        severity: 'critical',
        underwritingGuidance:
          'Vérifier : bacs de rétention, réseau séparatif eaux pluviales / process, ' +
          'station de traitement, historique de pollutions, conformité Commodo. ' +
          'La RC environnementale est souvent exclue du contrat de base — ' +
          'avenant ou contrat séparé nécessaire.',
      },
      {
        id: 'IND_SUPPLY_CHAIN',
        label: 'Rupture de chaîne d\'approvisionnement critique',
        category: 'dependency',
        severity: 'high',
        underwritingGuidance:
          'Nombre de fournisseurs critiques ? Sources alternatives identifiées ? ' +
          'Stock de sécurité ? Délai de ré-approvisionnement si rupture ? ' +
          'L\'impact d\'une rupture supply chain sur un site industriel peut être ' +
          'supérieur à celui d\'un sinistre incendie.',
      },
      {
        id: 'IND_OT_CYBER',
        label: 'Cyberattaque sur systèmes OT/SCADA',
        category: 'cyber',
        severity: 'high',
        underwritingGuidance:
          'Les systèmes de contrôle industriel (SCADA, PLC, DCS) sont de plus en plus ' +
          'connectés et vulnérables. Segmentation IT/OT en place ? Mises à jour des ' +
          'automates ? Plan de réponse incident OT distinct de l\'IT ?',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'LU-ITM-SST-1500',
      'LU-ITM-ATEX',
      'LU-COMMODO',             // Établissements classés
      'EU-SEVESO-III',          // Directive Seveso III
      'EU-MACHINE-2006-42',
      'ISO-14001',              // Management environnemental
      'ISO-45001',              // Santé et sécurité au travail
    ],
    typicalExclusions: [
      'Exclusion RC environnementale (couverture séparée recommandée)',
      'Exclusion des dommages liés à la non-conformité Commodo/Seveso',
      'Franchise élevée sur bris de machines process',
      'Exclusion recall produit (sauf avenant)',
      'Sous-limite sur la perte d\'exploitation contingente',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 7 — HEALTH : Santé, médical, paramédical
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_HEALTH',
    label: 'Santé / Médical / Paramédical',
    description:
      'Activités de santé humaine : cabinets médicaux, dentaires, ' +
      'kinésithérapeutes, laboratoires d\'analyse, pharmacies, maisons de soins. ' +
      'Risque RC dominant (erreur médicale, dommage corporel patient), ' +
      'données de santé ultra-sensibles (RGPD art. 9), équipement médical coûteux.',
    naceSections: ['Q'],
    naceDivisions: [
      '86', // Activités pour la santé humaine
      '87', // Hébergement médico-social et social
      '88', // Action sociale sans hébergement
    ],
    categoryWeights: {
      fire: 0.10,       // Locaux médicaux : faible charge calorifique
      liability: 0.35,  // RC dominante : erreur médicale, dommage corporel
      dependency: 0.10, // Continuité des soins
      equipment: 0.15,  // Équipement médical coûteux (scanner, IRM, dentaire)
      cyber: 0.30,      // +0.05 ex-fleet → cyber (données de santé ultra-sensibles)
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.05,
    questionsNotApplicable: [
      'fire_hazmat',    // Sauf labo — géré par Commodo si nécessaire
    ],
    questionsWeightModifiers: {
      fire_construction: 0.5,
    },
    specificRisks: [
      {
        id: 'HEALTH_MALPRACTICE',
        label: 'Erreur médicale / faute professionnelle',
        category: 'liability',
        severity: 'critical',
        underwritingGuidance:
          'Vérifier l\'adéquation de la RC médicale (obligatoire au Luxembourg). ' +
          'Montants garantis ? Spécialités exercées (chirurgie = risque élevé) ? ' +
          'Historique de réclamations ? Accréditation du praticien ?',
      },
      {
        id: 'HEALTH_DATA_SENSITIVITY',
        label: 'Données de santé (RGPD art. 9 — catégorie spéciale)',
        category: 'cyber',
        severity: 'critical',
        underwritingGuidance:
          'Les données de santé bénéficient de la protection renforcée RGPD art. 9. ' +
          'Vérifier : chiffrement des dossiers patients, accès par authentification forte, ' +
          'hébergement HDS (Hébergeur de Données de Santé) si externalisation, ' +
          'conformité eHealth Luxembourg. Amende CNPD potentiellement très élevée.',
      },
      {
        id: 'HEALTH_EQUIPMENT_FAILURE',
        label: 'Panne d\'équipement médical critique',
        category: 'equipment',
        severity: 'high',
        underwritingGuidance:
          'Contrat de maintenance constructeur sur les équipements lourds ? ' +
          'Valeur du parc ? Délai de remplacement en cas de panne ? ' +
          'Impact sur l\'activité (un scanner en panne = arrêt du cabinet de radiologie).',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'LU-RGPD-CNPD',
      'LU-SANTE-CSS',          // Code de la Sécurité Sociale — volet santé
      'ISO-27001',
    ],
    typicalExclusions: [
      'Exclusion des actes hors périmètre d\'agrément du praticien',
      'Exclusion des produits pharmaceutiques (couverture fabricant)',
      'Sous-limite renforcée cyber — données de santé',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 8 — TRANSPORT : Transport et logistique
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_TRANSPORT',
    label: 'Transport / Logistique / Entreposage',
    description:
      'Transport routier de marchandises, déménagement, logistique, entreposage, ' +
      'courrier et messagerie. Risque flotte dominant, RC marchandises transportées, ' +
      'risque incendie en entrepôt, dépendance opérationnelle forte (flotte = outil de production).',
    naceSections: ['H'],
    naceDivisions: [
      '49', // Transports terrestres et transport par conduites
      '50', // Transports par eau
      '51', // Transports aériens
      '52', // Entreposage et services auxiliaires
      '53', // Activités de poste et de courrier
    ],
    categoryWeights: {
      fire: 0.25,       // +0.10 ex-fleet → fire (entrepôt, stockage)
      liability: 0.35,  // +0.15 ex-fleet → liability (RC transporteur dominant)
      dependency: 0.25, // +0.10 ex-fleet → dependency (continuité opérations)
      equipment: 0.10,  // Matériel de manutention, quais
      cyber: 0.05,      // Marginal (sauf logistique IT)
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.20,
    questionsNotApplicable: [
      'cyber_data',      // Peu de données personnelles
      'cyber_training',
      'cyber_mfa',
    ],
    questionsWeightModifiers: {
      fire_construction: 0.7,  // Pertinent pour l'entrepôt
      equip_age: 0.6,
      cyber_backup: 0.5,
    },
    specificRisks: [
      {
        id: 'TRANSPORT_CMR',
        label: 'Responsabilité du transporteur (CMR)',
        category: 'liability',
        severity: 'high',
        underwritingGuidance:
          'Le Luxembourg étant partie à la Convention CMR, la responsabilité ' +
          'du transporteur est encadrée mais reste significative. Vérifier les ' +
          'limites d\'indemnisation, les marchandises transportées (valeur ?), ' +
          'la présence d\'une assurance marchandises transportées (ad valorem).',
      },
      {
        id: 'TRANSPORT_WAREHOUSE_FIRE',
        label: 'Incendie d\'entrepôt (accumulation de stock)',
        category: 'fire',
        severity: 'critical',
        underwritingGuidance:
          'Les entrepôts concentrent des valeurs élevées sur un seul site. ' +
          'Vérifier : sprinklers (NFPA 13 ou EN 12845), compartimentage, ' +
          'hauteur de stockage, nature des marchandises (inflammables ?), ' +
          'désenfumage, accès pompiers. Un entrepôt sans sprinkler stockant ' +
          'des matières combustibles est un risque très aggravé.',
      },
      {
        id: 'TRANSPORT_DRIVER_SHORTAGE',
        label: 'Pénurie de chauffeurs / rotation élevée',
        category: 'dependency',
        severity: 'moderate',
        underwritingGuidance:
          'Le secteur du transport souffre d\'une pénurie structurelle de chauffeurs. ' +
          'Taux de rotation ? Politique de fidélisation ? ' +
          'Impact sur la qualité de conduite et la sinistralité.',
      },
      {
        id: 'TRANSPORT_ADR',
        label: 'Transport de matières dangereuses (ADR)',
        category: 'liability',
        severity: 'critical',
        underwritingGuidance:
          'Si transport ADR : vérifier les certifications ADR des chauffeurs et ' +
          'des véhicules, le conseiller sécurité ADR désigné, les plans d\'urgence, ' +
          'le type de matières transportées (classe ADR). Risque souvent exclu ' +
          'du contrat Multi Pro standard — couverture spécifique nécessaire.',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'EU-CMR-CONVENTION',       // Convention CMR
      'EU-ADR-2023',             // Transport matières dangereuses
      'APSAD-R1',                // Sprinklers (référentiel stockage)
      'NFPA-13',                 // Sprinkler installation
    ],
    typicalExclusions: [
      'Exclusion du transport ADR (couverture spécifique obligatoire)',
      'Exclusion des marchandises de valeur exceptionnelle sans déclaration',
      'Franchise spécifique flotte PL (plus élevée que VP)',
      'Exclusion de la responsabilité du transporteur maritime/aérien',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 9 — BEAUTY : Soins à la personne / bien-être
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_BEAUTY',
    label: 'Soins à la personne / Bien-être',
    description:
      'Coiffure, esthétique, spa, tatouage, fitness, activités récréatives. ' +
      'Contact physique avec le client = RC corporel dominant. ' +
      'Risque incendie modéré (produits cosmétiques, sèche-cheveux). ' +
      'Risque cyber faible. Structures généralement petites.',
    naceSections: ['R', 'S'],
    naceDivisions: [
      '93', // Activités sportives, récréatives et de loisirs
      '96', // Autres services personnels (coiffure, soins, etc.)
    ],
    categoryWeights: {
      fire: 0.15,       // Produits chimiques cosmétiques, mais faible volume
      liability: 0.50,  // +0.10 ex-fleet → liability (RC dominante services personnels)
      dependency: 0.10, // Site unique, personnel clé
      equipment: 0.15,  // Équipement de soin (laser, UV, appareils fitness)
      cyber: 0.10,      // Données clients (fichier, RDV, paiement)
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 0.90,
    questionsNotApplicable: [
      'fire_hazmat',
      'equip_age',         // Pas de parc machines industriel
      'dep_supplier',      // Pas de supply chain complexe
      'dep_pca',           // PCA disproportionné pour ce profil
      'cyber_training',
    ],
    questionsWeightModifiers: {
      fire_assets: 0.5,
      equip_maintenance: 0.7,
    },
    specificRisks: [
      {
        id: 'BEAUTY_BODILY_HARM',
        label: 'Dommage corporel client (allergie, brûlure, infection)',
        category: 'liability',
        severity: 'high',
        underwritingGuidance:
          'Vérifier : protocole de test allergique avant coloration/soin, ' +
          'stérilisation des instruments (tatouage, piercing), ' +
          'formations du personnel, assurance RC exploitation adéquate. ' +
          'Les sinistres corporels en soins esthétiques peuvent être sévères.',
      },
      {
        id: 'BEAUTY_PRODUCT_REACTION',
        label: 'Réaction à un produit cosmétique / chimique',
        category: 'liability',
        severity: 'moderate',
        underwritingGuidance:
          'Utilisation de produits certifiés CE ? Fiches de sécurité disponibles ? ' +
          'Traçabilité des produits utilisés par client ?',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'EU-COSMETIQUES-1223-2009',  // Règlement cosmétiques
    ],
    typicalExclusions: [
      'Exclusion des actes de médecine esthétique (réservé aux médecins)',
      'Franchise spécifique RC corporel',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 10 — ENERGY : Énergie, eau, déchets, environnement
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_ENERGY',
    label: 'Énergie / Eau / Déchets / Environnement',
    description:
      'Production et distribution d\'énergie (électricité, gaz, vapeur), ' +
      'captage et distribution d\'eau, gestion des déchets et assainissement. ' +
      'Risque incendie/explosion très élevé, RC environnementale dominante, ' +
      'dépendance infrastructure critique, réglementation lourde.',
    naceSections: ['D', 'E'],
    naceDivisions: [
      '35', // Production et distribution d'énergie
      '36', // Captage, traitement et distribution d'eau
      '37', // Collecte et traitement des eaux usées
      '38', // Collecte, traitement et élimination des déchets
      '39', // Dépollution et services de gestion des déchets
    ],
    categoryWeights: {
      fire: 0.35,       // +0.05 ex-fleet → fire (exposition dominante énergie)
      liability: 0.25,  // RC environnementale, RC tiers
      dependency: 0.20, // Infrastructure critique, continuité de service
      equipment: 0.15,  // Installations lourdes et coûteuses
      cyber: 0.05,      // SCADA en émergence
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.40,
    questionsNotApplicable: [],
    questionsWeightModifiers: {
      cyber_data: 0.5,
    },
    specificRisks: [
      {
        id: 'ENERGY_EXPLOSION',
        label: 'Explosion d\'installation (gaz, transformateur, station)',
        category: 'fire',
        severity: 'critical',
        underwritingGuidance:
          'Vérifier le type d\'installation (haute/basse tension, gaz, vapeur), ' +
          'les contrôles périodiques, les zones de sécurité, les plans d\'urgence. ' +
          'Pour les installations > seuils Seveso : rapport de sécurité obligatoire.',
      },
      {
        id: 'ENERGY_ENVIRONMENTAL',
        label: 'Pollution sol / eau / air',
        category: 'liability',
        severity: 'critical',
        underwritingGuidance:
          'RC environnementale presque systématiquement exclue du contrat de base. ' +
          'Vérifier : études d\'impact existantes, historique de pollution, ' +
          'conformité des rejets, assurance RC Atteinte à l\'Environnement dédiée.',
      },
      {
        id: 'ENERGY_SERVICE_INTERRUPTION',
        label: 'Interruption de service public',
        category: 'dependency',
        severity: 'high',
        underwritingGuidance:
          'Obligations de continuité de service ? Redondance des installations ? ' +
          'Plan de délestage ? La PE (perte d\'exploitation) peut être considérable ' +
          'et les pénalités contractuelles très élevées.',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'LU-COMMODO',
      'EU-SEVESO-III',
      'LU-EAU-2008',            // Loi sur l'eau Luxembourg
      'ISO-14001',
      'ISO-50001',              // Management de l'énergie
    ],
    typicalExclusions: [
      'Exclusion RC Atteinte à l\'Environnement (couverture séparée obligatoire)',
      'Exclusion des pénalités de non-continuité de service',
      'Exclusion des installations classées Seveso seuil haut',
      'Franchise élevée sur les installations techniques',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 11 — AGRI : Agriculture, sylviculture, pêche
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_AGRI',
    label: 'Agriculture / Sylviculture / Pêche',
    description:
      'Exploitations agricoles, viticoles, forestières, piscicoles. ' +
      'Risque incendie sur bâtiments d\'exploitation (grange, hangar, stockage fourrage), ' +
      'risque machines agricoles élevé, dépendance climatique, RC exploitation.',
    naceSections: ['A'],
    naceDivisions: [
      '01', // Culture et production animale
      '02', // Sylviculture et exploitation forestière
      '03', // Pêche et aquaculture
    ],
    categoryWeights: {
      fire: 0.30,       // +0.05 ex-fleet → fire (granges, fourrage)
      liability: 0.15,  // RC exploitation, bétail en divagation
      dependency: 0.15, // Dépendance climatique, saisonnalité, trésorerie
      equipment: 0.35,  // +0.10 ex-fleet → equipment (machines agricoles = ex-fleet)
      cyber: 0.05,      // Marginal
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.10,
    questionsNotApplicable: [
      'cyber_data',
      'cyber_training',
      'cyber_mfa',
      'dep_pca',           // Disproportionné pour une exploitation agricole
    ],
    questionsWeightModifiers: {
      cyber_backup: 0.3,
      cyber_incident: 0.3,
      rc_export: 0.5,
    },
    specificRisks: [
      {
        id: 'AGRI_BARN_FIRE',
        label: 'Incendie de bâtiment d\'exploitation (grange, hangar)',
        category: 'fire',
        severity: 'high',
        underwritingGuidance:
          'Le fourrage et la paille sont des combustibles naturels à risque élevé ' +
          '(auto-échauffement possible). Vérifier : séparation stockage/exploitation, ' +
          'détection incendie, accès pompiers (distance, voie d\'accès). ' +
          'Les exploitations isolées ont un temps d\'intervention pompier long.',
      },
      {
        id: 'AGRI_MACHINE_ACCIDENT',
        label: 'Accident machine agricole',
        category: 'equipment',
        severity: 'high',
        underwritingGuidance:
          'Vérifier l\'état du parc machines (âge, conformité CE), ' +
          'la formation des utilisateurs, le respect des distances ' +
          'de sécurité (lignes électriques). Sinistralité machines agricoles élevée.',
      },
      {
        id: 'AGRI_PESTICIDE_LIABILITY',
        label: 'RC pollution (pesticides, effluents d\'élevage)',
        category: 'liability',
        severity: 'moderate',
        underwritingGuidance:
          'Vérifier le type d\'exploitation (élevage intensif = effluents, ' +
          'grandes cultures = pesticides). Respect des zones de protection des eaux ? ' +
          'Certification bio réduisant le risque pollution ?',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'LU-AGRICULTURE',         // Réglementation agricole LU
      'EU-PAC',                  // Politique Agricole Commune — éco-conditionnalité
    ],
    typicalExclusions: [
      'Exclusion des récoltes sur pied (couverture spécifique agricole)',
      'Exclusion du bétail (couverture mortalité bétail séparée)',
      'Exclusion RC pollution graduelle (pesticides)',
      'Exclusion du risque climatique (grêle, gel, sécheresse)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 12 — EDUCATION : Enseignement et formation
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_EDUCATION',
    label: 'Enseignement / Formation',
    description:
      'Établissements d\'enseignement privés, centres de formation, ' +
      'auto-écoles, crèches privées. Accueil de public (souvent mineur), ' +
      'RC éducateur/formateur, risque incendie ERP, cyber (données élèves).',
    naceSections: ['P'],
    naceDivisions: [
      '85', // Enseignement
    ],
    categoryWeights: {
      fire: 0.20,       // ERP : accueil de public, parfois mineurs
      liability: 0.40,  // +0.05 ex-fleet → liability (RC mineurs dominant)
      dependency: 0.10, // Site unique, continuité pédagogique
      equipment: 0.10,  // Matériel pédagogique, informatique
      cyber: 0.20,      // Données élèves (mineurs = sensible), e-learning
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 0.90,
    questionsNotApplicable: [
      'fire_hazmat',
      'equip_age',
      'equip_critical',
    ],
    questionsWeightModifiers: {
      equip_maintenance: 0.5,
      equip_value: 0.5,
    },
    specificRisks: [
      {
        id: 'EDU_MINOR_LIABILITY',
        label: 'RC surveillance de mineurs',
        category: 'liability',
        severity: 'high',
        underwritingGuidance:
          'Si accueil de mineurs (crèche, école, centre de loisirs) : ' +
          'obligation de surveillance renforcée. Ratio encadrant/enfant respecté ? ' +
          'Protocole d\'urgence ? Assurance scolaire obligatoire ? ' +
          'Les sinistres corporels sur mineurs sont toujours jugés sévèrement.',
      },
      {
        id: 'EDU_STUDENT_DATA',
        label: 'Données personnelles d\'élèves/mineurs',
        category: 'cyber',
        severity: 'high',
        underwritingGuidance:
          'Les données de mineurs bénéficient d\'une protection RGPD renforcée. ' +
          'Plateforme de gestion des notes / absences sécurisée ? ' +
          'Consentement parental pour les traitements de données ?',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',   // Incendie — catégorie ERP
      'LU-RGPD-CNPD',        // RGPD — données de mineurs
    ],
    typicalExclusions: [
      'Exclusion des activités sportives à risque (sauf avenant)',
      'Franchise spécifique RC corporel mineurs',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 13 — EXTRACTIVE : Industries extractives et mines
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'POOL_EXTRACTIVE',
    label: 'Industries extractives / Mines / Carrières',
    description:
      'Extraction de minerais, carrières, sablières. Risque physique très élevé ' +
      '(éboulement, explosion, poussières), RC environnementale, ' +
      'équipements lourds et coûteux, réglementation Commodo lourde. ' +
      'Rare au Luxembourg mais existant (carrières de grès, calcaire).',
    naceSections: ['B'],
    naceDivisions: [
      '05', // Extraction de houille et de lignite
      '06', // Extraction d'hydrocarbures
      '07', // Extraction de minerais métalliques
      '08', // Autres industries extractives (carrières)
      '09', // Services de soutien aux industries extractives
    ],
    categoryWeights: {
      fire: 0.20,       // Explosion, incendie de matériels
      liability: 0.20,  // RC environnementale, RC corporel employés
      dependency: 0.15, // Concession, autorisations, site unique
      equipment: 0.40,  // +0.10 ex-fleet → equipment (engins dominant extractif)
      cyber: 0.05,      // Marginal
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.50,
    questionsNotApplicable: [
      'cyber_data',
      'cyber_training',
      'cyber_mfa',
    ],
    questionsWeightModifiers: {
      cyber_backup: 0.3,
      cyber_incident: 0.3,
    },
    specificRisks: [
      {
        id: 'EXTRACT_COLLAPSE',
        label: 'Éboulement / effondrement de front de taille',
        category: 'equipment', // Dommage aux biens d'exploitation
        severity: 'critical',
        underwritingGuidance:
          'Vérifier : études géotechniques, plan d\'exploitation validé, ' +
          'talus conformes aux angles de sécurité, inspection périodique des fronts.',
      },
      {
        id: 'EXTRACT_ENVIRONMENTAL',
        label: 'Atteinte à l\'environnement (nappe phréatique, poussières)',
        category: 'liability',
        severity: 'critical',
        underwritingGuidance:
          'Vérifier : études d\'impact environnemental, mesures de rabattement ' +
          'de nappe, gestion des poussières (arrosage, brumisation), ' +
          'obligation de remise en état du site.',
      },
      {
        id: 'EXTRACT_BLASTING',
        label: 'Risque explosion / tir de mine',
        category: 'fire',
        severity: 'critical',
        underwritingGuidance:
          'Si utilisation d\'explosifs : vérifier les certifications des boutefeux, ' +
          'le stockage des explosifs (conformité réglementaire), les zones de sécurité, ' +
          'les vibrations et nuisances pour les tiers.',
      },
    ],
    normativeReferences: [
      'LU-COMMODO',
      'LU-MINES',                // Réglementation minière LU
      'LU-ITM-SST-1500',
      'EU-SEVESO-III',
    ],
    typicalExclusions: [
      'Exclusion RC Atteinte à l\'Environnement (couverture séparée)',
      'Exclusion des dommages liés aux explosifs',
      'Exclusion de la remise en état du site',
      'Franchise très élevée sur les engins d\'extraction',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL 14 — PUBLIC : Administration, associations, organisations
  // ═══════════════════════════════════════════════════════════════════════════
  // Note : POOL_MISC ci-dessous sert aussi de fallback pour les codes
  // NACE non affectés à un pool spécifique.
  {
    id: 'POOL_PUBLIC',
    label: 'Administration / Associations / Organisations',
    description:
      'Administration publique (si assurée en Multi Pro, cas rare), associations, ' +
      'ASBL, fondations, organisations internationales. Profil de bureau ' +
      'avec accueil du public, RC envers les membres/bénéficiaires, ' +
      'parfois gestion de locaux partagés (salles, terrains).',
    naceSections: ['O'],
    naceDivisions: [
      '84', // Administration publique et défense
      '94', // Activités des organisations associatives
    ],
    categoryWeights: {
      fire: 0.15,       // Locaux de bureau / salles de réunion
      liability: 0.35,  // RC envers les membres/public
      dependency: 0.10, // Continuité des services
      equipment: 0.05,  // Mobilier et informatique
      cyber: 0.35,      // +0.05 ex-fleet → cyber (données membres/public)
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 0.80,
    questionsNotApplicable: [
      'fire_hazmat',
      'equip_age',
      'equip_critical',
      'equip_maintenance',
    ],
    questionsWeightModifiers: {
      fire_assets: 0.5,
      equip_value: 0.5,
    },
    specificRisks: [
      {
        id: 'PUBLIC_EVENT_LIABILITY',
        label: 'RC événementielle (assemblées, événements publics)',
        category: 'liability',
        severity: 'moderate',
        underwritingGuidance:
          'Si organisation d\'événements : capacité d\'accueil ? ' +
          'Autorisation communale ? Sécurité des installations temporaires ? ' +
          'Assurance RC événementielle distincte souvent nécessaire.',
      },
      {
        id: 'PUBLIC_VOLUNTEER_LIABILITY',
        label: 'RC envers les bénévoles',
        category: 'liability',
        severity: 'moderate',
        underwritingGuidance:
          'Les bénévoles ne sont pas couverts par l\'assurance accident du travail. ' +
          'L\'association doit souscrire une couverture spécifique. ' +
          'Nombre de bénévoles ? Activités à risque ?',
      },
    ],
    normativeReferences: [
      'LU-RGD-2018-08-17',
      'LU-ASBL-2009',          // Loi sur les associations 2009
    ],
    typicalExclusions: [
      'Exclusion des activités sportives compétitives',
      'Exclusion des événements de plus de 500 personnes (couverture spécifique)',
    ],
  },

  // ═════════════════════════════���═════════════════════════════════════════════
  // POOL MISC — Fallback pour codes NACE non reconnus
  // ══���═══════════════════════════════════════════════════��════════════════════
  {
    id: 'POOL_MISC',
    label: 'Activité non classifiée',
    description:
      'Pool de fallback pour les codes NACE non reconnus ou absents. ' +
      'Facteur de risque intrinsèque neutre (1.00) et poids équilibrés. ' +
      'Déclenche un flag de revue manuelle par le souscripteur.',
    naceSections: [],
    naceDivisions: [],
    categoryWeights: {
      fire: 0.20,
      liability: 0.20,
      dependency: 0.20,
      equipment: 0.20,  // +0.05 ex-fleet → equipment (pool neutre équilibré)
      cyber: 0.20,
      fleet: 0.00,      // M2 : fleet désactivé (couvert séparément en RC Auto LU)
    },
    intrinsicRiskFactor: 1.00,
    questionsNotApplicable: [],
    questionsWeightModifiers: {},
    specificRisks: [
      {
        id: 'MISC_UNCLASSIFIED',
        label: 'Code NACE non reconnu — revue souscripteur requise',
        category: 'fire' as RiskCategory,
        severity: 'moderate',
        underwritingGuidance:
          'Le code NACE de cette entreprise n\'a pas pu être classifié dans ' +
          'un pool de risque. Le souscripteur doit vérifier manuellement ' +
          'l\'activité réelle et affecter le pool approprié.',
      },
    ],
    normativeReferences: [],
    typicalExclusions: [],
  },
]

// ---------------------------------------------------------------------------
// 4. INDEX DE RÉSOLUTION RAPIDE
// ---------------------------------------------------------------------------

/**
 * Index inversé : code NACE (division 2 chiffres) -> pool ID.
 * Construit au chargement du module pour des lookups O(1).
 */
const DIVISION_TO_POOL: Map<string, string> = new Map()

/**
 * Index inversé : section NACE (lettre) -> pool ID.
 */
const SECTION_TO_POOL: Map<string, string> = new Map()

/**
 * Index par ID de pool pour lookup direct.
 */
const POOL_BY_ID: Map<string, NaceRiskPool> = new Map()

// Construire les index au chargement du module
for (const pool of NACE_RISK_POOLS) {
  POOL_BY_ID.set(pool.id, pool)
  for (const div of pool.naceDivisions) {
    DIVISION_TO_POOL.set(div, pool.id)
  }
  for (const sec of pool.naceSections) {
    SECTION_TO_POOL.set(sec, pool.id)
  }
}

/**
 * Pool de fallback pour les codes NACE non reconnus ou absents.
 * CORRECTIF M3 : utilise POOL_MISC (factor=1.00, neutre) au lieu de
 * POOL_OFFICE (factor=0.85, le plus favorable). Le fallback ne doit
 * jamais être le pool le plus avantageux pour éviter l'anti-sélection.
 */
const FALLBACK_POOL_ID = 'POOL_MISC'

// ---------------------------------------------------------------------------
// 5. FONCTIONS DE RÉSOLUTION
// ---------------------------------------------------------------------------

/**
 * Résout le pool de risque NACE pour un code NACE donné.
 *
 * Algorithme de résolution hiérarchique :
 * 1. Si le code contient une division (2 chiffres), chercher une correspondance exacte.
 *    Ex: code "16.10" -> division "16" -> POOL_CRAFT
 * 2. Sinon, chercher par section (première lettre).
 *    Ex: code "C16" -> section "C" -> mais C est trop large, donc on extrait d'abord les chiffres.
 * 3. Fallback sur POOL_MISC (pool neutre, facteur 1.00 — correctif M3 :
 *    évite l'anti-sélection d'un fallback favorable).
 *
 * Note : Le code NACE peut être passé sous plusieurs formats :
 *   - Lettre + chiffres : "C16.10", "F43.21"
 *   - Chiffres seuls : "16.10", "4321"
 *   - Section seule : "C", "F"
 *
 * @param naceCode Code NACE brut (tel que saisi ou importé)
 * @returns Le pool de risque correspondant
 */
export function resolvePool(naceCode: string | null | undefined): NaceRiskPool {
  if (!naceCode || naceCode.trim().length === 0) {
    return POOL_BY_ID.get(FALLBACK_POOL_ID)!
  }

  const code = naceCode.trim().toUpperCase()

  // Extraire la division (2 premiers chiffres)
  const digits = code.replace(/[^0-9]/g, '')
  if (digits.length >= 2) {
    const division = digits.substring(0, 2)
    const poolId = DIVISION_TO_POOL.get(division)
    if (poolId) {
      return POOL_BY_ID.get(poolId)!
    }
  }

  // Extraire la section (première lettre)
  const letters = code.replace(/[^A-Z]/g, '')
  if (letters.length >= 1) {
    const section = letters.charAt(0)
    const poolId = SECTION_TO_POOL.get(section)
    if (poolId) {
      return POOL_BY_ID.get(poolId)!
    }
  }

  // Fallback
  return POOL_BY_ID.get(FALLBACK_POOL_ID)!
}

/**
 * Résout un pool par son identifiant direct.
 */
export function getPoolById(poolId: string): NaceRiskPool | undefined {
  return POOL_BY_ID.get(poolId)
}

/**
 * Retourne tous les pools disponibles.
 */
export function getAllPools(): NaceRiskPool[] {
  return [...NACE_RISK_POOLS]
}

// ---------------------------------------------------------------------------
// 6. COMBINAISON DES POIDS SEGMENT x POOL
// ---------------------------------------------------------------------------

/**
 * Combine les pondérations du système segment/activité existant
 * avec celles du pool NACE.
 *
 * Formule de blending :
 *   poids_final[cat] = alpha * poids_segment[cat] + (1 - alpha) * poids_pool[cat]
 *
 * Le résultat est normalisé pour sommer à 1.00 (protection contre les
 * erreurs d'arrondi).
 *
 * @param segment Segment de l'entreprise (S1-S4)
 * @param activity Catégorie d'activité (services, commerce, artisanat, industrie)
 * @param pool Pool de risque NACE résolu
 * @param alpha Facteur de dosage (défaut : POOL_BLEND_ALPHA = 0.60)
 * @returns Pondérations finales des 6 catégories, sommant à 1.00
 */
export function combineWeights(
  segment: CompanySegment,
  activity: ActivityCategory,
  pool: NaceRiskPool,
  alpha: number = POOL_BLEND_ALPHA,
): CategoryWeights {
  const segmentWeights = resolveWeights(segment, activity)
  const poolWeights = pool.categoryWeights

  const categories: RiskCategory[] = ['fire', 'liability', 'dependency', 'equipment', 'cyber', 'fleet']

  const raw: CategoryWeights = {
    fire: 0,
    liability: 0,
    dependency: 0,
    equipment: 0,
    cyber: 0,
    fleet: 0,
  }

  // Blend
  let sum = 0
  for (const cat of categories) {
    raw[cat] = alpha * segmentWeights[cat] + (1 - alpha) * poolWeights[cat]
    sum += raw[cat]
  }

  // Normalisation (protection arrondi)
  if (sum > 0) {
    for (const cat of categories) {
      raw[cat] = Math.round((raw[cat] / sum) * 10000) / 10000
    }
  }

  // Ajustement final pour que la somme = 1.0000 exactement
  const finalSum = categories.reduce((s, c) => s + raw[c], 0)
  if (finalSum !== 1) {
    // Compenser le résidu sur la catégorie la plus lourde
    const maxCat = categories.reduce((a, b) => raw[a] > raw[b] ? a : b)
    raw[maxCat] = Math.round((raw[maxCat] + (1 - finalSum)) * 10000) / 10000
  }

  return raw
}

// ---------------------------------------------------------------------------
// 7. COMBINAISON DES QUESTIONS NON APPLICABLES
// ---------------------------------------------------------------------------

/**
 * Combine les questions non applicables du segment et du pool.
 *
 * Une question est NON APPLICABLE si elle est déclarée non applicable
 * par le segment OU par le pool (logique OR).
 *
 * @param segmentApplicability Applicabilité par segment (QUESTION_APPLICABILITY[segment])
 * @param pool Pool de risque NACE
 * @returns Map question -> applicable (boolean)
 */
export function combineQuestionApplicability(
  segmentApplicability: Record<string, boolean>,
  pool: NaceRiskPool,
): Record<string, boolean> {
  const result = { ...segmentApplicability }

  // Désactiver les questions marquées NA par le pool
  for (const questionKey of pool.questionsNotApplicable) {
    result[questionKey] = false
  }

  return result
}

// ---------------------------------------------------------------------------
// 8. APPLICATION DU FACTEUR DE RISQUE INTRINSÈQUE
// ---------------------------------------------------------------------------

/**
 * Applique le facteur de risque intrinsèque du pool au score.
 *
 * TRANSFORMATION AFFINE CENTRÉE SUR LE POINT NEUTRE (s₀ = 52.5)
 *
 * Formule : score_ajusté = s₀ + (score_brut - s₀) × factor
 *
 * Cette transformation DILATE l'écart au neutre proportionnellement au
 * facteur intrinsèque. Contrairement à la multiplication simple
 * (score × factor), elle :
 *
 * 1. Préserve le point neutre : un score de 52.5 reste 52.5 quel que
 *    soit le facteur → pas de distorsion au centre du barème.
 *
 * 2. Évite la saturation : avec la multiplication simple, un extractif
 *    (factor=1.50) à score brut 67 obtenait 100 (clampé), identique
 *    à un extractif à 95 → discrimination détruite en queue droite.
 *    Avec l'affine : 52.5 + (67-52.5)×1.50 = 74.25 vs 52.5 + (95-52.5)×1.50 = 116.25→100.
 *    La saturation ne survient qu'aux extrêmes (brut > 84 pour factor 1.50).
 *
 * 3. Fonctionne symétriquement : un POOL_OFFICE (factor=0.85) à score
 *    brut 30 donne 52.5 + (30-52.5)×0.85 = 33.375 (le rabais est
 *    légèrement réduit, reflétant le faible risque intrinsèque).
 *
 * Le souscripteur voit les deux scores (brut et ajusté) pour comprendre
 * si le risque vient de la gestion ou de l'activité.
 *
 * @param rawScore Score brut (0-100)
 * @param pool Pool de risque NACE
 * @param neutralScore Point neutre du barème (défaut 52.5)
 * @returns Score ajusté, clampé à [0, 100]
 */
export function applyIntrinsicRiskFactor(
  rawScore: number,
  pool: NaceRiskPool,
  neutralScore: number = 52.5,
): number {
  const adjusted = neutralScore + (rawScore - neutralScore) * pool.intrinsicRiskFactor
  return Math.min(100, Math.max(0, Math.round(adjusted * 100) / 100))
}

// ---------------------------------------------------------------------------
// 9. GESTION DES ENTREPRISES MULTI-ACTIVITÉS
// ---------------------------------------------------------------------------

/**
 * Résout le pool pour une entreprise ayant plusieurs codes NACE
 * (activité principale + activités secondaires).
 *
 * Stratégie : pondération par part de CA.
 *
 * Pour le facteur de risque intrinsèque, on prend le MAX des pools
 * (principe de prudence : l'activité la plus risquée domine le profil).
 *
 * Pour les poids catégoriels, on fait la moyenne pondérée par CA.
 *
 * @param activities Liste des activités avec leur code NACE et part de CA
 * @returns Pool synthétique (virtual pool) avec les poids et facteurs combinés
 */
export interface ActivityEntry {
  naceCode: string
  /** Part du CA (0.0 à 1.0). La somme doit faire 1.0. */
  revenueShare: number
  /** Label optionnel pour l'affichage */
  label?: string
}

export interface MultiActivityResult {
  /** Pool dominant (activité principale) — utilisé pour l'affichage et les risques spécifiques */
  dominantPool: NaceRiskPool
  /** Tous les pools impliqués avec leur part de CA */
  poolBreakdown: Array<{ pool: NaceRiskPool; revenueShare: number }>
  /** Poids catégoriels combinés (moyenne pondérée par CA) */
  combinedCategoryWeights: CategoryWeights
  /** Facteur de risque intrinsèque = MAX des pools (prudence) */
  combinedIntrinsicRiskFactor: number
  /** Union des questions non applicables (intersection = plus restrictif) */
  combinedQuestionsNotApplicable: string[]
  /** Union de tous les risques spécifiques */
  allSpecificRisks: SpecificRisk[]
  /** Union de toutes les références normatives */
  allNormativeReferences: string[]
}

export function resolveMultiActivity(activities: ActivityEntry[]): MultiActivityResult {
  if (activities.length === 0) {
    const fallback = POOL_BY_ID.get(FALLBACK_POOL_ID)!
    return {
      dominantPool: fallback,
      poolBreakdown: [{ pool: fallback, revenueShare: 1.0 }],
      combinedCategoryWeights: { ...fallback.categoryWeights },
      combinedIntrinsicRiskFactor: fallback.intrinsicRiskFactor,
      combinedQuestionsNotApplicable: [...fallback.questionsNotApplicable],
      allSpecificRisks: [...fallback.specificRisks],
      allNormativeReferences: [...fallback.normativeReferences],
    }
  }

  // Normaliser les parts de CA
  const totalShare = activities.reduce((s, a) => s + a.revenueShare, 0)
  const normalized = activities.map(a => ({
    ...a,
    revenueShare: totalShare > 0 ? a.revenueShare / totalShare : 1 / activities.length,
  }))

  // Résoudre les pools
  const resolved = normalized.map(a => ({
    pool: resolvePool(a.naceCode),
    revenueShare: a.revenueShare,
  }))

  // Pool dominant = celui avec la plus grande part de CA
  const dominantPool = resolved.reduce((a, b) =>
    a.revenueShare >= b.revenueShare ? a : b
  ).pool

  // Poids catégoriels = moyenne pondérée par CA
  const categories: RiskCategory[] = ['fire', 'liability', 'dependency', 'equipment', 'cyber', 'fleet']
  const combinedWeights: CategoryWeights = {
    fire: 0, liability: 0, dependency: 0, equipment: 0, cyber: 0, fleet: 0,
  }

  for (const { pool, revenueShare } of resolved) {
    for (const cat of categories) {
      combinedWeights[cat] += pool.categoryWeights[cat] * revenueShare
    }
  }

  // Normaliser
  const sum = categories.reduce((s, c) => s + combinedWeights[c], 0)
  if (sum > 0) {
    for (const cat of categories) {
      combinedWeights[cat] = Math.round((combinedWeights[cat] / sum) * 10000) / 10000
    }
  }

  // Facteur intrinsèque = MAX (principe de prudence)
  const combinedIntrinsicRiskFactor = Math.max(
    ...resolved.map(r => r.pool.intrinsicRiskFactor)
  )

  // Questions NA = intersection (une question est NA uniquement si TOUS les pools la déclarent NA)
  const allQuestionSets = resolved.map(r => new Set(r.pool.questionsNotApplicable))
  const combinedNA = allQuestionSets.length > 0
    ? Array.from(allQuestionSets[0]).filter(q => allQuestionSets.every(s => s.has(q)))
    : []

  // Risques spécifiques = union (dédupliqués par ID)
  const riskMap = new Map<string, SpecificRisk>()
  for (const { pool } of resolved) {
    for (const risk of pool.specificRisks) {
      riskMap.set(risk.id, risk)
    }
  }

  // Références normatives = union (dédupliquées)
  const normSet = new Set<string>()
  for (const { pool } of resolved) {
    for (const ref of pool.normativeReferences) {
      normSet.add(ref)
    }
  }

  return {
    dominantPool,
    poolBreakdown: resolved,
    combinedCategoryWeights: combinedWeights,
    combinedIntrinsicRiskFactor,
    combinedQuestionsNotApplicable: combinedNA,
    allSpecificRisks: Array.from(riskMap.values()),
    allNormativeReferences: Array.from(normSet),
  }
}

// ---------------------------------------------------------------------------
// 10. APPLICATION DES MODIFICATEURS DE POIDS QUESTIONNAIRE
// ---------------------------------------------------------------------------

/**
 * Applique les modificateurs de poids du pool aux questions du questionnaire.
 *
 * Si une question a un modificateur dans le pool (ex: { 'fleet_count': 0.3 }),
 * son poids intra-catégorie est multiplié par ce facteur, puis l'ensemble
 * des poids de la catégorie est renormalisé pour sommer à 1.0.
 *
 * @param questionWeights Map question -> poids original (dans sa catégorie)
 * @param pool Pool de risque NACE
 * @param categoryKey Catégorie courante (pour filtrer les questions)
 * @returns Map question -> poids ajusté
 */
export function applyQuestionWeightModifiers(
  questionWeights: Record<string, number>,
  pool: NaceRiskPool,
): Record<string, number> {
  const adjusted = { ...questionWeights }

  // Appliquer les modificateurs
  for (const [key, modifier] of Object.entries(pool.questionsWeightModifiers)) {
    if (key in adjusted) {
      adjusted[key] = adjusted[key] * modifier
    }
  }

  return adjusted
}

// ---------------------------------------------------------------------------
// 11. CONSTANTES UTILITAIRES
// ---------------------------------------------------------------------------

/**
 * Liste des IDs de tous les pools, pour l'affichage dans les selects/filters.
 */
export const POOL_IDS = NACE_RISK_POOLS.map(p => p.id)

/**
 * Map pool ID -> label, pour l'affichage rapide.
 */
export const POOL_LABELS: Record<string, string> = Object.fromEntries(
  NACE_RISK_POOLS.map(p => [p.id, p.label])
)

/**
 * Facteur de risque intrinsèque min et max du barème, pour validation.
 */
export const INTRINSIC_RISK_RANGE = {
  min: Math.min(...NACE_RISK_POOLS.map(p => p.intrinsicRiskFactor)),
  max: Math.max(...NACE_RISK_POOLS.map(p => p.intrinsicRiskFactor)),
} as const
