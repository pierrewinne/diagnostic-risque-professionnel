import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { categories } from '../data/questionnaire'
import { getRiskLevel, getRiskLevelColor } from '../lib/scoring'
import Badge from '../components/ui/Badge'
import ScoreGauge from '../components/ui/ScoreGauge'
import type { RiskLevel } from '../types'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts'
import { ArrowLeft, FileText, Building2, Shield, Download } from 'lucide-react'
import { downloadDiagnosticPdf } from '../lib/generatePdf'
import type { ReportData } from '../components/pdf/DiagnosticReport'
import { useAuth } from '../hooks/useAuth'

interface DiagnosticData {
  id: string
  status: string
  global_score: number
  risk_level: RiskLevel
  created_at: string
  companies: {
    name: string
    sector: string
    employees: number
    revenue: number
    city: string
    contact_name: string
  }
}

interface CategoryScoreRow {
  category: string
  score: number
  risk_level: string
  weight: number
}

interface OfferRow {
  type: string
  premium: number
  score_used: number
  discount_pct: number
  conditions: string
}

interface PreventionPlanRow {
  id: string
  total_discount_pct: number
  improved_global_score: number
  prevention_actions: {
    action_label: string
    description: string
    category: string
    score_reduction: number
    deadline_months: number
    estimated_cost_min: number
    estimated_cost_max: number
    status: string
  }[]
}

export default function DiagnosticDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null)
  const [catScores, setCatScores] = useState<CategoryScoreRow[]>([])
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [plan, setPlan] = useState<PreventionPlanRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const { profile } = useAuth()

  useEffect(() => {
    loadDiagnostic()
  }, [id])

  async function loadDiagnostic() {
    if (!id) return
    const [diagRes, scoresRes, offersRes, planRes] = await Promise.all([
      supabase
        .from('diagnostics')
        .select('id, status, global_score, risk_level, created_at, companies(name, sector, employees, revenue, city, contact_name)')
        .eq('id', id)
        .single(),
      supabase.from('category_scores').select('*').eq('diagnostic_id', id),
      supabase.from('offers').select('*').eq('diagnostic_id', id),
      supabase.from('prevention_plans').select('*, prevention_actions(*)').eq('diagnostic_id', id).single(),
    ])

    if (diagRes.data) setDiagnostic(diagRes.data as unknown as DiagnosticData)
    if (scoresRes.data) setCatScores(scoresRes.data as CategoryScoreRow[])
    if (offersRes.data) setOffers(offersRes.data as OfferRow[])
    if (planRes.data) setPlan(planRes.data as unknown as PreventionPlanRow)
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement...</div>
  if (!diagnostic) return <div className="text-center py-12 text-gray-500">Diagnostic introuvable</div>

  const offerA = offers.find(o => o.type === 'A')
  const offerB = offers.find(o => o.type === 'B')

  async function handleDownloadPdf() {
    if (!diagnostic || !offerA || !offerB) return
    setGeneratingPdf(true)
    try {
      const sectorLabels: Record<string, string> = {
        industry: 'Industrie', commerce: 'Commerce', services: 'Services / Conseil',
        construction: 'BTP / Construction', logistics: 'Logistique / Transport',
      }
      const reportData: ReportData = {
        company: {
          name: diagnostic.companies.name,
          sector: sectorLabels[diagnostic.companies.sector] || diagnostic.companies.sector,
          employees: diagnostic.companies.employees,
          revenue: diagnostic.companies.revenue,
          city: diagnostic.companies.city,
          contact_name: diagnostic.companies.contact_name,
        },
        diagnostic: {
          created_at: diagnostic.created_at,
          global_score: diagnostic.global_score,
          risk_level: diagnostic.risk_level,
        },
        categoryScores: catScores.map(cs => {
          const cat = categories.find(c => c.key === cs.category)
          return {
            category: cs.category,
            label: cat?.label || cs.category,
            score: cs.score,
            risk_level: cs.risk_level || getRiskLevel(cs.score),
            weight: cs.weight,
          }
        }),
        preventionActions: (plan?.prevention_actions || []).map(a => {
          const cat = categories.find(c => c.key === a.category)
          return {
            action_label: a.action_label,
            description: a.description,
            category: a.category,
            category_label: cat?.label?.split(' / ')[0] || a.category,
            score_reduction: a.score_reduction,
            deadline_months: a.deadline_months,
            estimated_cost_min: a.estimated_cost_min,
            estimated_cost_max: a.estimated_cost_max,
          }
        }),
        offers: {
          typeA: { premium: offerA.premium, score: offerA.score_used },
          typeB: { premium: offerB.premium, score: offerB.score_used, discount_pct: offerB.discount_pct },
        },
        improvedGlobalScore: plan?.improved_global_score ?? diagnostic.global_score,
        discountPct: plan?.total_discount_pct ?? 0,
        brokerName: profile?.full_name || profile?.email || 'Courtier',
      }
      await downloadDiagnosticPdf(reportData)
    } catch (e) {
      console.error('PDF generation error:', e)
      alert('Erreur lors de la génération du PDF')
    }
    setGeneratingPdf(false)
  }

  // Build radar data from category scores
  const radarData = categories.map(cat => {
    const catScore = catScores.find(s => s.category === cat.key)
    return {
      category: cat.label.split(' / ')[0],
      'Score actuel': Math.round(catScore?.score || 0),
      'Score amélioré': plan ? Math.round(
        (catScore?.score || 0) * (1 - (plan.total_discount_pct / 100))
      ) : Math.round(catScore?.score || 0),
    }
  })

  const riskLevel = (diagnostic.risk_level || 'moderate') as RiskLevel

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{diagnostic.companies.name}</h1>
              <p className="text-gray-500">
                {diagnostic.companies.city} · {diagnostic.companies.employees} employés ·
                CA: {diagnostic.companies.revenue?.toLocaleString('fr-FR')}€
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Diagnostic du {new Date(diagnostic.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {diagnostic.status === 'completed' && (
              <button
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {generatingPdf ? 'Génération...' : 'Télécharger PDF'}
              </button>
            )}
            {diagnostic.status === 'draft' && (
              <Link
                to={`/diagnostic/${id}/questionnaire`}
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
              >
                Reprendre le questionnaire
              </Link>
            )}
          </div>
        </div>
      </div>

      {diagnostic.status !== 'completed' ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <FileText className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <p className="text-yellow-800 font-medium">Ce diagnostic est en brouillon</p>
          <p className="text-yellow-600 text-sm mt-1">Complétez le questionnaire pour obtenir les résultats</p>
          <Link
            to={`/diagnostic/${id}/questionnaire`}
            className="inline-flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700 mt-4"
          >
            Reprendre le questionnaire
          </Link>
        </div>
      ) : (
        <>
          {/* Score summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Score global</h3>
              <ScoreGauge score={Math.round(diagnostic.global_score)} size="lg" />
              <Badge level={riskLevel} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Score amélioré</h3>
              <ScoreGauge score={Math.round(plan?.improved_global_score ?? diagnostic.global_score)} size="lg" />
              {plan && <Badge level={getRiskLevel(plan.improved_global_score)} />}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Décote prévention</h3>
              <p className="text-5xl font-bold text-green-600 my-4">-{plan?.total_discount_pct ?? 0}%</p>
              <p className="text-sm text-gray-500">{plan?.prevention_actions?.length ?? 0} actions</p>
            </div>
          </div>

          {/* Radar */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Radar de risque</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" className="text-xs" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Score actuel" dataKey="Score actuel" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                  <Radar name="Score amélioré" dataKey="Score amélioré" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category scores */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Scores par catégorie</h3>
            <div className="space-y-3">
              {catScores.map(cs => {
                const cat = categories.find(c => c.key === cs.category)
                const level = getRiskLevel(cs.score)
                return (
                  <div key={cs.category} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50">
                    <div className="w-40 font-medium text-sm">{cat?.label || cs.category}</div>
                    <div className="flex-1">
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${cs.score}%`, backgroundColor: getRiskLevelColor(level) }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-right font-bold">{Math.round(cs.score)}/100</div>
                    <Badge level={level} />
                    <div className="w-12 text-right text-xs text-gray-400">{Math.round(cs.weight * 100)}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Offers */}
          {offerA && offerB && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                <div className="text-center mb-4">
                  <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium mb-2">Offre A</span>
                  <h3 className="text-lg font-bold">Risque actuel</h3>
                </div>
                <p className="text-4xl font-bold text-center text-gray-900 mb-1">{offerA.premium.toLocaleString('fr-FR')}€</p>
                <p className="text-sm text-gray-500 text-center mb-4">Prime annuelle</p>
                <p className="text-sm text-gray-500">{offerA.conditions}</p>
              </div>
              <div className="bg-white rounded-xl border-2 border-green-500 p-6 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">Recommandé</span>
                </div>
                <div className="text-center mb-4">
                  <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium mb-2">Offre B</span>
                  <h3 className="text-lg font-bold">Risque amélioré</h3>
                </div>
                <p className="text-4xl font-bold text-center text-green-600 mb-1">{offerB.premium.toLocaleString('fr-FR')}€</p>
                <p className="text-sm text-gray-500 text-center mb-4">Prime annuelle <span className="text-green-600">(-{offerB.discount_pct}%)</span></p>
                <p className="text-sm text-gray-500">{offerB.conditions}</p>
                <div className="mt-4 text-center">
                  <p className="text-lg font-bold text-green-600">
                    Économie: {(offerA.premium - offerB.premium).toLocaleString('fr-FR')}€/an
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Prevention actions */}
          {plan && plan.prevention_actions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold">Plan de prévention</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Action</th>
                      <th className="text-center py-2 px-3 font-medium text-gray-500">Impact</th>
                      <th className="text-center py-2 px-3 font-medium text-gray-500">Délai</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Coût estimé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {plan.prevention_actions.map((action, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-3">
                          <p className="font-medium text-gray-900">{action.action_label}</p>
                          <p className="text-xs text-gray-500">{action.description}</p>
                        </td>
                        <td className="py-3 px-3 text-center text-green-600 font-medium">-{action.score_reduction} pts</td>
                        <td className="py-3 px-3 text-center">{action.deadline_months} mois</td>
                        <td className="py-3 px-3 text-right">
                          {action.estimated_cost_min > 0
                            ? `${action.estimated_cost_min.toLocaleString('fr-FR')}€ - ${action.estimated_cost_max.toLocaleString('fr-FR')}€`
                            : 'Variable'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
