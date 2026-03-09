import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

export interface ReportData {
  company: {
    name: string
    sector: string
    employees: number
    revenue: number
    city: string
    contact_name: string
  }
  diagnostic: {
    created_at: string
    global_score: number
    risk_level: string
  }
  categoryScores: {
    category: string
    label: string
    score: number
    risk_level: string
    weight: number
  }[]
  preventionActions: {
    action_label: string
    description: string
    category: string
    category_label: string
    score_reduction: number
    deadline_months: number
    estimated_cost_min: number
    estimated_cost_max: number
  }[]
  offers: {
    typeA: { premium: number; score: number }
    typeB: { premium: number; score: number; discount_pct: number }
  }
  improvedGlobalScore: number
  discountPct: number
  brokerName: string
}

const colors = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  text: '#111827',
  textLight: '#6b7280',
  bgLight: '#f3f4f6',
  white: '#ffffff',
  green: '#22c55e',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  border: '#e5e7eb',
}

function riskColor(level: string): string {
  switch (level) {
    case 'low': return colors.green
    case 'moderate': return colors.yellow
    case 'high': return colors.orange
    case 'critical': return colors.red
    default: return colors.textLight
  }
}

function riskLabel(level: string): string {
  switch (level) {
    case 'low': return 'Faible'
    case 'moderate': return 'Modéré'
    case 'high': return 'Élevé'
    case 'critical': return 'Critique'
    default: return level
  }
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR')
}

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: colors.text },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBrand: { fontSize: 10, color: colors.primary, fontFamily: 'Helvetica-Bold' },
  headerPage: { fontSize: 8, color: colors.textLight },
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, textAlign: 'center', fontSize: 7, color: colors.textLight },
  coverPage: { padding: 40, fontFamily: 'Helvetica', justifyContent: 'center', alignItems: 'center' },
  coverBrand: { fontSize: 28, color: colors.primary, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  coverSubtitle: { fontSize: 14, color: colors.textLight, marginBottom: 60 },
  coverCompany: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: colors.text, marginBottom: 12 },
  coverMeta: { fontSize: 11, color: colors.textLight, marginBottom: 6 },
  coverLine: { width: 60, height: 3, backgroundColor: colors.primary, marginBottom: 40, marginTop: 40 },
  sectionTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: colors.primaryDark, marginBottom: 16 },
  sectionSubtitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: colors.text, marginBottom: 8 },
  scoreBox: { alignItems: 'center', padding: 20, backgroundColor: colors.bgLight, borderRadius: 6, marginBottom: 16 },
  scoreNumber: { fontSize: 42, fontFamily: 'Helvetica-Bold' },
  scoreLabel: { fontSize: 10, color: colors.textLight, marginTop: 4 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 8 },
  scoreBadgeText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.white },
  summaryText: { fontSize: 11, lineHeight: 1.6, color: colors.text, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.bgLight },
  summaryLabel: { fontSize: 10, color: colors.textLight },
  summaryValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoCell: { width: '50%', paddingVertical: 8, paddingHorizontal: 4 },
  infoLabel: { fontSize: 8, color: colors.textLight, textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.5 },
  infoValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bgLight },
  catLabel: { width: '30%', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  catBarContainer: { width: '35%', height: 10, backgroundColor: colors.bgLight, borderRadius: 5, overflow: 'hidden' },
  catBar: { height: 10, borderRadius: 5 },
  catScore: { width: '12%', fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  catWeight: { width: '10%', fontSize: 8, color: colors.textLight, textAlign: 'right' },
  table: { marginTop: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.bgLight, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4 },
  tableHeaderCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: colors.textLight, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.bgLight },
  tableCell: { fontSize: 9 },
  tableCellBold: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  offerContainer: { flexDirection: 'row', gap: 16, marginTop: 12 },
  offerBox: { flex: 1, padding: 16, borderRadius: 6, borderWidth: 2 },
  offerTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 4 },
  offerSubtitle: { fontSize: 9, color: colors.textLight, textAlign: 'center', marginBottom: 12 },
  offerPremium: { fontSize: 28, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 4 },
  offerPremiumLabel: { fontSize: 9, color: colors.textLight, textAlign: 'center', marginBottom: 12 },
  offerDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.bgLight },
  offerDetailLabel: { fontSize: 9, color: colors.textLight },
  offerDetailValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  methBlock: { marginBottom: 12 },
  methText: { fontSize: 9, lineHeight: 1.6, color: colors.text },
  scaleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  scaleColor: { width: 12, height: 12, borderRadius: 2, marginRight: 8 },
  scaleLabel: { fontSize: 9, width: 60, fontFamily: 'Helvetica-Bold' },
  scaleDesc: { fontSize: 9, color: colors.textLight },
})

function PageHeader({ pageNum }: { pageNum: number }) {
  return (
    <View style={s.header}>
      <Text style={s.headerBrand}>DiagRisk Pro</Text>
      <Text style={s.headerPage}>Page {pageNum}</Text>
    </View>
  )
}

function PageFooter() {
  return <Text style={s.footer}>Document confidentiel — Généré automatiquement par DiagRisk Pro</Text>
}

export default function DiagnosticReport({ data }: { data: ReportData }) {
  const dateStr = new Date(data.diagnostic.created_at).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const level = data.diagnostic.risk_level
  const levelColor = riskColor(level)
  const levelLabel = riskLabel(level)
  const improvedLevel = data.improvedGlobalScore <= 25 ? 'low' : data.improvedGlobalScore <= 50 ? 'moderate' : data.improvedGlobalScore <= 75 ? 'high' : 'critical'

  const summaryPhrases: Record<string, string> = {
    low: "Le profil de risque de l'entreprise est bien maîtrisé. Les fondamentaux de la prévention sont en place.",
    moderate: "Le profil de risque présente des axes d'amélioration identifiés. Un plan de prévention ciblé permettrait de réduire significativement l'exposition.",
    high: "Le profil de risque révèle une exposition significative nécessitant des actions de prévention prioritaires.",
    critical: "Le profil de risque est critique. Des mesures de prévention sont indispensables avant toute souscription dans des conditions standard.",
  }

  return (
    <Document>
      {/* Page 1: Cover */}
      <Page size="A4" style={s.coverPage}>
        <Text style={s.coverBrand}>DiagRisk Pro</Text>
        <Text style={s.coverSubtitle}>Diagnostic des Risques Professionnels</Text>
        <View style={s.coverLine} />
        <Text style={s.coverCompany}>{data.company.name}</Text>
        <Text style={s.coverMeta}>{data.company.city} — {data.company.sector}</Text>
        <Text style={s.coverMeta}>Diagnostic réalisé le {dateStr}</Text>
        <Text style={s.coverMeta}>Par {data.brokerName}</Text>
        <PageFooter />
      </Page>

      {/* Page 2: Executive Summary */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={2} />
        <Text style={s.sectionTitle}>Synthèse exécutive</Text>
        <View style={s.scoreBox}>
          <Text style={{ ...s.scoreNumber, color: levelColor }}>{Math.round(data.diagnostic.global_score)}/100</Text>
          <Text style={s.scoreLabel}>Score de risque global</Text>
          <View style={{ ...s.scoreBadge, backgroundColor: levelColor }}>
            <Text style={s.scoreBadgeText}>{levelLabel}</Text>
          </View>
        </View>
        <Text style={s.summaryText}>{summaryPhrases[level] || summaryPhrases.moderate}</Text>
        <Text style={s.sectionSubtitle}>Indicateurs clés</Text>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Catégories analysées</Text>
          <Text style={s.summaryValue}>{data.categoryScores.length}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Actions de prévention recommandées</Text>
          <Text style={s.summaryValue}>{data.preventionActions.length}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Score amélioré (après prévention)</Text>
          <Text style={s.summaryValue}>{Math.round(data.improvedGlobalScore)}/100 ({riskLabel(improvedLevel)})</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Décote tarifaire potentielle</Text>
          <Text style={{ ...s.summaryValue, color: colors.green }}>-{data.discountPct}%</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Économie annuelle estimée</Text>
          <Text style={{ ...s.summaryValue, color: colors.green }}>{fmt(data.offers.typeA.premium - data.offers.typeB.premium)}€</Text>
        </View>
        <PageFooter />
      </Page>

      {/* Page 3: Company Profile */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={3} />
        <Text style={s.sectionTitle}>Profil de l'entreprise</Text>
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Raison sociale</Text>
            <Text style={s.infoValue}>{data.company.name}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Secteur d'activité</Text>
            <Text style={s.infoValue}>{data.company.sector}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Effectif</Text>
            <Text style={s.infoValue}>{data.company.employees} salariés</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Chiffre d'affaires</Text>
            <Text style={s.infoValue}>{fmt(data.company.revenue)}€</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Localisation</Text>
            <Text style={s.infoValue}>{data.company.city}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Contact</Text>
            <Text style={s.infoValue}>{data.company.contact_name || '—'}</Text>
          </View>
        </View>
        <PageFooter />
      </Page>

      {/* Page 4: Category Scores */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={4} />
        <Text style={s.sectionTitle}>Analyse par catégorie de risque</Text>
        <View style={{ ...s.catRow, borderBottomWidth: 2, borderBottomColor: colors.border }}>
          <Text style={{ ...s.catLabel, fontSize: 8, color: colors.textLight }}>CATÉGORIE</Text>
          <Text style={{ ...s.tableHeaderCell, width: '35%' }}>SCORE</Text>
          <Text style={{ ...s.catScore, fontSize: 8, color: colors.textLight }}>NOTE</Text>
          <Text style={{ fontSize: 8, color: colors.textLight, width: '13%', textAlign: 'center' }}>NIVEAU</Text>
          <Text style={{ ...s.catWeight, fontSize: 8, color: colors.textLight }}>POIDS</Text>
        </View>
        {data.categoryScores.map((cs) => {
          const color = riskColor(cs.risk_level)
          return (
            <View key={cs.category} style={s.catRow}>
              <Text style={s.catLabel}>{cs.label}</Text>
              <View style={s.catBarContainer}>
                <View style={{ ...s.catBar, width: `${Math.min(100, cs.score)}%`, backgroundColor: color }} />
              </View>
              <Text style={s.catScore}>{Math.round(cs.score)}/100</Text>
              <View style={{ width: '13%', alignItems: 'center' }}>
                <View style={{ backgroundColor: color, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 7, color: colors.white, fontFamily: 'Helvetica-Bold' }}>{riskLabel(cs.risk_level)}</Text>
                </View>
              </View>
              <Text style={s.catWeight}>{Math.round(cs.weight * 100)}%</Text>
            </View>
          )
        })}
        <View style={{ marginTop: 20, padding: 12, backgroundColor: colors.bgLight, borderRadius: 6 }}>
          <Text style={{ fontSize: 9, color: colors.textLight }}>
            Le score global est calculé comme la moyenne pondérée des scores par catégorie selon les poids sectoriels. Un score plus élevé indique un risque plus important.
          </Text>
        </View>
        <PageFooter />
      </Page>

      {/* Page 5: Prevention Plan */}
      {data.preventionActions.length > 0 && (
        <Page size="A4" style={s.page}>
          <PageHeader pageNum={5} />
          <Text style={s.sectionTitle}>Plan de prévention recommandé</Text>
          <Text style={{ ...s.summaryText, marginBottom: 16 }}>
            Les actions suivantes ont été identifiées pour réduire le profil de risque. Leur mise en oeuvre permettrait
            de faire passer le score de {Math.round(data.diagnostic.global_score)}/100
            à {Math.round(data.improvedGlobalScore)}/100, soit une décote de {data.discountPct}%.
          </Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={{ ...s.tableHeaderCell, width: '35%' }}>ACTION</Text>
              <Text style={{ ...s.tableHeaderCell, width: '18%' }}>CATÉGORIE</Text>
              <Text style={{ ...s.tableHeaderCell, width: '12%', textAlign: 'center' }}>IMPACT</Text>
              <Text style={{ ...s.tableHeaderCell, width: '12%', textAlign: 'center' }}>DÉLAI</Text>
              <Text style={{ ...s.tableHeaderCell, width: '23%', textAlign: 'right' }}>COÛT ESTIMÉ</Text>
            </View>
            {data.preventionActions.map((action, idx) => (
              <View key={idx} style={s.tableRow}>
                <View style={{ width: '35%' }}>
                  <Text style={s.tableCellBold}>{action.action_label}</Text>
                  <Text style={{ fontSize: 7, color: colors.textLight, marginTop: 2 }}>{action.description}</Text>
                </View>
                <Text style={{ ...s.tableCell, width: '18%' }}>{action.category_label}</Text>
                <Text style={{ ...s.tableCellBold, width: '12%', textAlign: 'center', color: colors.green }}>-{action.score_reduction} pts</Text>
                <Text style={{ ...s.tableCell, width: '12%', textAlign: 'center' }}>{action.deadline_months} mois</Text>
                <Text style={{ ...s.tableCell, width: '23%', textAlign: 'right' }}>
                  {action.estimated_cost_min > 0 ? `${fmt(action.estimated_cost_min)}€ - ${fmt(action.estimated_cost_max)}€` : 'Variable'}
                </Text>
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}

      {/* Page 6: Offer Comparison */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={data.preventionActions.length > 0 ? 6 : 5} />
        <Text style={s.sectionTitle}>Comparaison des offres</Text>
        <Text style={{ ...s.summaryText, marginBottom: 20 }}>
          Deux offres sont proposées : l'Offre A basée sur le risque actuel, et l'Offre B intégrant un engagement de prévention avec décote tarifaire.
        </Text>
        <View style={s.offerContainer}>
          <View style={{ ...s.offerBox, borderColor: colors.border }}>
            <Text style={s.offerTitle}>Offre A</Text>
            <Text style={s.offerSubtitle}>Risque actuel</Text>
            <Text style={s.offerPremium}>{fmt(data.offers.typeA.premium)}€</Text>
            <Text style={s.offerPremiumLabel}>Prime annuelle</Text>
            <View style={s.offerDetail}>
              <Text style={s.offerDetailLabel}>Score de risque</Text>
              <Text style={s.offerDetailValue}>{Math.round(data.offers.typeA.score)}/100</Text>
            </View>
            <View style={s.offerDetail}>
              <Text style={s.offerDetailLabel}>Niveau</Text>
              <Text style={s.offerDetailValue}>{riskLabel(level)}</Text>
            </View>
            <View style={{ ...s.offerDetail, borderBottomWidth: 0 }}>
              <Text style={s.offerDetailLabel}>Prévention</Text>
              <Text style={{ ...s.offerDetailValue, color: colors.textLight }}>Aucune obligation</Text>
            </View>
          </View>
          <View style={{ ...s.offerBox, borderColor: colors.green }}>
            <View style={{ position: 'absolute', top: -8, left: 0, right: 0, alignItems: 'center' }}>
              <View style={{ backgroundColor: colors.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ fontSize: 7, color: colors.white, fontFamily: 'Helvetica-Bold' }}>RECOMMANDÉ</Text>
              </View>
            </View>
            <Text style={{ ...s.offerTitle, color: colors.green }}>Offre B</Text>
            <Text style={s.offerSubtitle}>Risque amélioré</Text>
            <Text style={{ ...s.offerPremium, color: colors.green }}>{fmt(data.offers.typeB.premium)}€</Text>
            <Text style={s.offerPremiumLabel}>Prime annuelle (-{data.offers.typeB.discount_pct}%)</Text>
            <View style={s.offerDetail}>
              <Text style={s.offerDetailLabel}>Score amélioré</Text>
              <Text style={s.offerDetailValue}>{Math.round(data.offers.typeB.score)}/100</Text>
            </View>
            <View style={s.offerDetail}>
              <Text style={s.offerDetailLabel}>Niveau</Text>
              <Text style={{ ...s.offerDetailValue, color: colors.green }}>{riskLabel(improvedLevel)}</Text>
            </View>
            <View style={s.offerDetail}>
              <Text style={s.offerDetailLabel}>Actions prévention</Text>
              <Text style={s.offerDetailValue}>{data.preventionActions.length} actions</Text>
            </View>
            <View style={{ ...s.offerDetail, borderBottomWidth: 0 }}>
              <Text style={s.offerDetailLabel}>Économie annuelle</Text>
              <Text style={{ ...s.offerDetailValue, color: colors.green }}>{fmt(data.offers.typeA.premium - data.offers.typeB.premium)}€</Text>
            </View>
          </View>
        </View>
        <PageFooter />
      </Page>

      {/* Page 7: Methodology */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={data.preventionActions.length > 0 ? 7 : 6} />
        <Text style={s.sectionTitle}>Annexe méthodologique</Text>
        <View style={s.methBlock}>
          <Text style={s.sectionSubtitle}>Méthodologie de scoring</Text>
          <Text style={s.methText}>
            Le diagnostic évalue l'entreprise sur six catégories de risque : Incendie / Dommages aux biens,
            Responsabilité Civile, Dépendance opérationnelle, Équipements / Machines, Cyber et Flotte / Véhicules.
            Chaque catégorie contient plusieurs facteurs évalués de 0 (risque nul) à 10 (risque maximal).
          </Text>
        </View>
        <View style={s.methBlock}>
          <Text style={s.sectionSubtitle}>Calcul des scores</Text>
          <Text style={s.methText}>
            Le score par catégorie est la moyenne pondérée des facteurs de risque, ramenée sur 100.
            Le score global est la somme pondérée des scores par catégorie selon le profil sectoriel.
          </Text>
        </View>
        <View style={s.methBlock}>
          <Text style={s.sectionSubtitle}>Échelle de risque</Text>
          <View style={s.scaleRow}>
            <View style={{ ...s.scaleColor, backgroundColor: colors.green }} />
            <Text style={s.scaleLabel}>0 – 25</Text>
            <Text style={{ ...s.scaleDesc, fontFamily: 'Helvetica-Bold' }}>Faible</Text>
            <Text style={{ ...s.scaleDesc, marginLeft: 8 }}>— Risque bien maîtrisé</Text>
          </View>
          <View style={s.scaleRow}>
            <View style={{ ...s.scaleColor, backgroundColor: colors.yellow }} />
            <Text style={s.scaleLabel}>26 – 50</Text>
            <Text style={{ ...s.scaleDesc, fontFamily: 'Helvetica-Bold' }}>Modéré</Text>
            <Text style={{ ...s.scaleDesc, marginLeft: 8 }}>— Axes d'amélioration identifiés</Text>
          </View>
          <View style={s.scaleRow}>
            <View style={{ ...s.scaleColor, backgroundColor: colors.orange }} />
            <Text style={s.scaleLabel}>51 – 75</Text>
            <Text style={{ ...s.scaleDesc, fontFamily: 'Helvetica-Bold' }}>Élevé</Text>
            <Text style={{ ...s.scaleDesc, marginLeft: 8 }}>— Prévention recommandée</Text>
          </View>
          <View style={s.scaleRow}>
            <View style={{ ...s.scaleColor, backgroundColor: colors.red }} />
            <Text style={s.scaleLabel}>76 – 100</Text>
            <Text style={{ ...s.scaleDesc, fontFamily: 'Helvetica-Bold' }}>Critique</Text>
            <Text style={{ ...s.scaleDesc, marginLeft: 8 }}>— Prévention indispensable</Text>
          </View>
        </View>
        <View style={s.methBlock}>
          <Text style={s.sectionSubtitle}>Calcul de la décote</Text>
          <Text style={s.methText}>
            Décote = min(25%, (Score actuel – Score amélioré) / Score actuel × 0.5). Bornée entre 5% et 25%.
          </Text>
        </View>
        <View style={{ marginTop: 20, padding: 12, backgroundColor: colors.bgLight, borderRadius: 6 }}>
          <Text style={{ fontSize: 8, color: colors.textLight, textAlign: 'center' }}>
            Ce rapport a été généré automatiquement par DiagRisk Pro. Les scores et recommandations sont fournis
            à titre indicatif et ne constituent pas un engagement contractuel.
          </Text>
        </View>
        <PageFooter />
      </Page>
    </Document>
  )
}
