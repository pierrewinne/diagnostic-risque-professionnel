import type { RiskCategory } from '../types';

export type QuestionType = 'binary' | 'select' | 'numeric';

export interface QuestionOption {
  value: string;
  label: string;
  score: number; // 0-10
}

export interface Question {
  key: string;
  category: RiskCategory;
  label: string;
  tooltip: string;
  type: QuestionType;
  options: QuestionOption[];
  weight: number; // weight within category, sum to 1.0 per category
}

export interface CategoryConfig {
  key: RiskCategory;
  label: string;
  icon: string; // lucide icon name
  description: string;
  questions: Question[];
}

export const categories: CategoryConfig[] = [
  // ──────────────────────────────────────────────
  // A. Incendie / Dommages aux biens
  // ──────────────────────────────────────────────
  {
    key: 'fire',
    label: 'Incendie / Dommages aux biens',
    icon: 'Flame',
    description:
      "Évalue les risques liés aux incendies et aux dommages matériels pouvant affecter les locaux et les actifs de l'entreprise.",
    questions: [
      {
        key: 'fire_construction',
        category: 'fire',
        label: 'Type de construction du bâtiment principal',
        tooltip: 'Le type de matériaux influence la résistance au feu',
        type: 'select',
        options: [
          { value: 'beton', label: 'Béton', score: 2 },
          { value: 'mixte', label: 'Mixte', score: 5 },
          { value: 'bois', label: 'Bois', score: 8 },
        ],
        weight: 0.2,
      },
      {
        key: 'fire_detection',
        category: 'fire',
        label: 'Système de détection incendie installé ?',
        tooltip: 'Détection automatique (sprinklers, alarmes)',
        type: 'select',
        options: [
          { value: 'oui_complet', label: 'Oui, complet', score: 1 },
          { value: 'partiel', label: 'Partiel', score: 5 },
          { value: 'non', label: 'Non', score: 9 },
        ],
        weight: 0.2,
      },
      {
        key: 'fire_hazmat',
        category: 'fire',
        label: 'Stockage de matières inflammables ou dangereuses ?',
        tooltip: 'Produits chimiques, carburants, matières combustibles',
        type: 'select',
        options: [
          { value: 'non', label: 'Non', score: 0 },
          { value: 'limite', label: 'Limité', score: 5 },
          { value: 'important', label: 'Important', score: 9 },
        ],
        weight: 0.15,
      },
      {
        key: 'fire_distance',
        category: 'fire',
        label: "Distance aux services d'incendie",
        tooltip: "Temps d'intervention des pompiers",
        type: 'select',
        options: [
          { value: 'lt_5km', label: '< 5 km', score: 2 },
          { value: '5_15km', label: '5-15 km', score: 5 },
          { value: 'gt_15km', label: '> 15 km', score: 8 },
        ],
        weight: 0.1,
      },
      {
        key: 'fire_history',
        category: 'fire',
        label: 'Sinistres incendie dans les 5 dernières années ?',
        tooltip: 'Historique de sinistralité incendie',
        type: 'select',
        options: [
          { value: '0', label: '0 sinistre', score: 1 },
          { value: '1_2', label: '1-2 sinistres', score: 5 },
          { value: '3_plus', label: '3+ sinistres', score: 9 },
        ],
        weight: 0.2,
      },
      {
        key: 'fire_assets',
        category: 'fire',
        label: 'Valeur des actifs exposés',
        tooltip: 'Valeur totale des biens assurables sur site',
        type: 'select',
        options: [
          { value: 'lt_200k', label: '< 200K€', score: 2 },
          { value: '200k_1m', label: '200K-1M€', score: 5 },
          { value: 'gt_1m', label: '> 1M€', score: 8 },
        ],
        weight: 0.15,
      },
    ],
  },

  // ──────────────────────────────────────────────
  // B. Responsabilité Civile
  // ──────────────────────────────────────────────
  {
    key: 'liability',
    label: 'Responsabilité Civile',
    icon: 'Shield',
    description:
      "Mesure l'exposition de l'entreprise aux risques de responsabilité envers les tiers, clients et partenaires.",
    questions: [
      {
        key: 'rc_export',
        category: 'liability',
        label: "L'entreprise a-t-elle une activité d'export ?",
        tooltip: "L'export augmente l'exposition RC internationale",
        type: 'binary',
        options: [
          { value: 'non', label: 'Non', score: 2 },
          { value: 'oui', label: 'Oui', score: 7 },
        ],
        weight: 0.2,
      },
      {
        key: 'rc_subcontracting',
        category: 'liability',
        label: 'Recours à la sous-traitance ?',
        tooltip: 'Part du CA réalisée par des sous-traitants',
        type: 'select',
        options: [
          { value: 'non', label: 'Non', score: 1 },
          { value: 'lt_30', label: '< 30% CA', score: 4 },
          { value: 'gt_30', label: '> 30% CA', score: 8 },
        ],
        weight: 0.25,
      },
      {
        key: 'rc_claims',
        category: 'liability',
        label: 'Réclamations RC dans les 3 dernières années ?',
        tooltip: 'Litiges, mises en cause, sinistres RC',
        type: 'select',
        options: [
          { value: '0', label: '0', score: 1 },
          { value: '1_2', label: '1-2', score: 5 },
          { value: '3_plus', label: '3+', score: 9 },
        ],
        weight: 0.3,
      },
      {
        key: 'rc_bodily',
        category: 'liability',
        label: 'Le produit/service peut-il causer un dommage corporel ?',
        tooltip: 'Risque de blessure pour les utilisateurs ou tiers',
        type: 'binary',
        options: [
          { value: 'non', label: 'Non', score: 1 },
          { value: 'oui', label: 'Oui', score: 9 },
        ],
        weight: 0.25,
      },
    ],
  },

  // ──────────────────────────────────────────────
  // C. Dépendance opérationnelle
  // ──────────────────────────────────────────────
  {
    key: 'dependency',
    label: 'Dépendance opérationnelle',
    icon: 'Link',
    description:
      "Analyse la vulnérabilité de l'entreprise face aux interruptions d'activité et sa capacité de reprise.",
    questions: [
      {
        key: 'dep_single_site',
        category: 'dependency',
        label: "L'entreprise opère-t-elle sur un site unique ?",
        tooltip: 'Concentration du risque sur un seul lieu',
        type: 'binary',
        options: [
          { value: 'non', label: 'Non', score: 2 },
          { value: 'oui', label: 'Oui', score: 8 },
        ],
        weight: 0.25,
      },
      {
        key: 'dep_supplier',
        category: 'dependency',
        label: 'Dépendance à un fournisseur principal (> 50% achats) ?',
        tooltip: "Risque de rupture d'approvisionnement",
        type: 'binary',
        options: [
          { value: 'non', label: 'Non', score: 2 },
          { value: 'oui', label: 'Oui', score: 8 },
        ],
        weight: 0.25,
      },
      {
        key: 'dep_pca',
        category: 'dependency',
        label: "Un Plan de Continuité d'Activité (PCA) existe-t-il ?",
        tooltip: 'Document formalisant la reprise après sinistre',
        type: 'binary',
        options: [
          { value: 'oui', label: 'Oui', score: 1 },
          { value: 'non', label: 'Non', score: 9 },
        ],
        weight: 0.25,
      },
      {
        key: 'dep_recovery',
        category: 'dependency',
        label: "Délai estimé de reprise d'activité après sinistre majeur ?",
        tooltip: 'Temps pour retrouver une activité normale',
        type: 'select',
        options: [
          { value: 'lt_1_week', label: '< 1 semaine', score: 2 },
          { value: '1_4_weeks', label: '1-4 semaines', score: 5 },
          { value: 'gt_1_month', label: '> 1 mois', score: 9 },
        ],
        weight: 0.25,
      },
    ],
  },

  // ──────────────────────────────────────────────
  // D. Équipements / Machines
  // ──────────────────────────────────────────────
  {
    key: 'equipment',
    label: 'Équipements / Machines',
    icon: 'Cog',
    description:
      "Évalue les risques liés au parc machines et équipements, leur vétusté et la stratégie de maintenance.",
    questions: [
      {
        key: 'equip_age',
        category: 'equipment',
        label: 'Âge moyen du parc machines/équipements',
        tooltip: "L'obsolescence augmente le risque de panne",
        type: 'select',
        options: [
          { value: 'lt_5', label: '< 5 ans', score: 2 },
          { value: '5_10', label: '5-10 ans', score: 5 },
          { value: 'gt_10', label: '> 10 ans', score: 8 },
        ],
        weight: 0.25,
      },
      {
        key: 'equip_maintenance',
        category: 'equipment',
        label: 'Contrat de maintenance préventive en place ?',
        tooltip: 'Maintenance régulière et planifiée',
        type: 'binary',
        options: [
          { value: 'oui', label: 'Oui', score: 1 },
          { value: 'non', label: 'Non', score: 8 },
        ],
        weight: 0.3,
      },
      {
        key: 'equip_critical',
        category: 'equipment',
        label: "Une panne d'équipement critique arrêterait-elle la production ?",
        tooltip: 'Dépendance à un équipement clé',
        type: 'binary',
        options: [
          { value: 'non', label: 'Non', score: 2 },
          { value: 'oui', label: 'Oui', score: 8 },
        ],
        weight: 0.25,
      },
      {
        key: 'equip_value',
        category: 'equipment',
        label: 'Valeur totale du parc équipement',
        tooltip: 'Coût de remplacement du parc',
        type: 'select',
        options: [
          { value: 'lt_100k', label: '< 100K€', score: 2 },
          { value: '100k_500k', label: '100-500K€', score: 5 },
          { value: 'gt_500k', label: '> 500K€', score: 8 },
        ],
        weight: 0.2,
      },
    ],
  },

  // ──────────────────────────────────────────────
  // E. Cyber
  // ──────────────────────────────────────────────
  {
    key: 'cyber',
    label: 'Cyber',
    icon: 'ShieldAlert',
    description:
      "Évalue l'exposition aux risques numériques : cyberattaques, fuites de données et résilience informatique.",
    questions: [
      {
        key: 'cyber_data',
        category: 'cyber',
        label: "L'entreprise traite-t-elle des données personnelles sensibles ?",
        tooltip: 'Données de santé, financières, personnelles',
        type: 'binary',
        options: [
          { value: 'non', label: 'Non', score: 2 },
          { value: 'oui', label: 'Oui', score: 8 },
        ],
        weight: 0.2,
      },
      {
        key: 'cyber_backup',
        category: 'cyber',
        label: 'Sauvegardes automatiques et testées régulièrement ?',
        tooltip: 'Sauvegardes externalisées et restauration testée',
        type: 'binary',
        options: [
          { value: 'oui', label: 'Oui', score: 1 },
          { value: 'non', label: 'Non', score: 9 },
        ],
        weight: 0.25,
      },
      {
        key: 'cyber_training',
        category: 'cyber',
        label: 'Formation cybersécurité des employés dans les 12 derniers mois ?',
        tooltip: 'Sensibilisation au phishing, bonnes pratiques',
        type: 'binary',
        options: [
          { value: 'oui', label: 'Oui', score: 1 },
          { value: 'non', label: 'Non', score: 8 },
        ],
        weight: 0.2,
      },
      {
        key: 'cyber_mfa',
        category: 'cyber',
        label: 'Politique de mots de passe et MFA en place ?',
        tooltip: 'Authentification multi-facteurs, politique de mots de passe forte',
        type: 'binary',
        options: [
          { value: 'oui', label: 'Oui', score: 1 },
          { value: 'non', label: 'Non', score: 8 },
        ],
        weight: 0.15,
      },
      {
        key: 'cyber_incident',
        category: 'cyber',
        label: 'Incident cyber dans les 24 derniers mois ?',
        tooltip: 'Attaque, fuite de données, ransomware',
        type: 'binary',
        options: [
          { value: 'non', label: 'Non', score: 1 },
          { value: 'oui', label: 'Oui', score: 9 },
        ],
        weight: 0.2,
      },
    ],
  },

  // ──────────────────────────────────────────────
  // F. Flotte / Véhicules
  // ──────────────────────────────────────────────
  {
    key: 'fleet',
    label: 'Flotte / Véhicules',
    icon: 'Truck',
    description:
      "Analyse les risques liés à la flotte de véhicules d'entreprise, la sinistralité et les mesures de prévention routière.",
    questions: [
      {
        key: 'fleet_count',
        category: 'fleet',
        label: "Nombre de véhicules d'entreprise",
        tooltip: 'Taille de la flotte',
        type: 'select',
        options: [
          { value: '0', label: '0', score: 0 },
          { value: '1_5', label: '1-5', score: 3 },
          { value: '6_20', label: '6-20', score: 5 },
          { value: '20_plus', label: '20+', score: 8 },
        ],
        weight: 0.25,
      },
      {
        key: 'fleet_type',
        category: 'fleet',
        label: 'Type de flotte',
        tooltip: 'Les poids lourds sont plus exposés',
        type: 'select',
        options: [
          { value: 'vp', label: 'VP uniquement', score: 3 },
          { value: 'utilitaires', label: 'Utilitaires', score: 5 },
          { value: 'poids_lourds', label: 'Poids lourds', score: 8 },
        ],
        weight: 0.2,
      },
      {
        key: 'fleet_claims',
        category: 'fleet',
        label: 'Sinistralité flotte sur 3 ans',
        tooltip: 'Fréquence et gravité des sinistres auto',
        type: 'select',
        options: [
          { value: 'faible', label: 'Faible', score: 2 },
          { value: 'moyenne', label: 'Moyenne', score: 5 },
          { value: 'elevee', label: 'Élevée', score: 9 },
        ],
        weight: 0.3,
      },
      {
        key: 'fleet_policy',
        category: 'fleet',
        label: 'Politique de conduite et formation conducteurs ?',
        tooltip: 'Charte de conduite, éco-conduite, suivi',
        type: 'binary',
        options: [
          { value: 'oui', label: 'Oui', score: 1 },
          { value: 'non', label: 'Non', score: 8 },
        ],
        weight: 0.25,
      },
    ],
  },
];
