import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { categories } from '../data/questionnaire'
import { computeCategoryScore, computeGlobalScore, getRiskLevel, getRiskLevelColor, DEFAULT_WEIGHTS } from '../lib/scoring'
import { generatePreventionPlan, computeImprovedCategoryScore, computeDiscount, computePremium, type PreventionActionDef } from '../lib/prevention'
import Badge from '../components/ui/Badge'
import ScoreGauge from '../components/ui/ScoreGauge'
import type { RiskCategory } from '../types'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts'
import { ChevronRight, ArrowLeft, Shield } from 'lucide-react'

interface AnswerRow {
  question_key: string
  answer_value: string
  factor_score: number
  category: string
}

interface CompanyData {
  revenue: number
  employees: number
  sector: string
}

export default function ScoringResults() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [, setAnswers] = useState<AnswerRow[]>([])
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [categoryScores, setCategoryScores] = useState<Record<RiskCategory, number>>({} as Record<RiskCategory, number>)
  const [globalScore, setGlobalScore] = useState(0)
  const [preventionActions, setPreventionActions] = useState<PreventionActionDef[]>([])
  const [improvedScores, setImprovedScores] = useState<Record<RiskCategory, number>>({} as Record<RiskCategory, number>)
  const [improvedGlobalScore, setImprovedGlobalScore] = useState(0)
  const [discountPct, setDiscountPct] = useState(0)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadAndCompute()
  }, [id])

  async function loadAndCompute() {
    if (!id) return

    // Load answers and company data
    const [answersRes, diagRes] = await Promise.all([
      supabase.from('risk_answers').select('*').eq('diagnostic_id', id),
      supabase.from('diagnostics').select('company_id, companies(revenue, employees, sector)').eq('id', id).single(),
    ])

    if (!answersRes.data || !diagRes.data) {
      setLoading(false)
      return
    }

    const ans = answersRes.data as AnswerRow[]
    setAnswers(ans)

    const comp = (diagRes.data as unknown as { company_id: string; companies: CompanyData }).companies
    setCompany(comp)

    // Load sector weights
    let w = { ...DEFAULT_WEIGHTS }
    if (comp?.sector) {
      const { data: sectorData } = await supabase
        .from('sector_profiles')
        .select('category_weights')
        .eq('sector', comp.sector)
        .single()
      if (sectorData?.category_weights) {
        w = sectorData.category_weights as unknown as Record<RiskCategory, number>
      }
    }
    setWeights(w)

    // Compute scores per category
    const catScores: Record<string, number> = {}
    const catImproved: Record<string, number> = {}
    const allPreventionActions: PreventionActionDef[] = []

    for (const cat of categories) {
      const catAnswers = ans.filter(a => a.category === cat.key)
      const factors = cat.questions.map(q => {
        const answer = catAnswers.find(a => a.question_key === q.key)
        return {
          questionKey: q.key,
          factorScore: answer?.factor_score ?? 0,
          weight: q.weight,
        }
      })

      catScores[cat.key] = computeCategoryScore(factors)

      // Generate prevention
      const actions = generatePreventionPlan(factors.map(f => ({ questionKey: f.questionKey, factorScore: f.factorScore })))
      const catActions = actions.filter(a => a.category === cat.key)
      allPreventionActions.push(...catActions)

      catImproved[cat.key] = computeImprovedCategoryScore(factors, catActions)
    }

    setCategoryScores(catScores as Record<RiskCategory, number>)
    setImprovedScores(catImproved as Record<RiskCategory, number>)

    const gScore = computeGlobalScore(catScores as Record<RiskCategory, number>, w)
    setGlobalScore(gScore)

    const gImproved = computeGlobalScore(catImproved as Record<RiskCategory, number>, w)
    setImprovedGlobalScore(gImproved)

    setPreventionActions(allPreventionActions)

    const discount = computeDiscount(gScore, gImproved)
    setDiscountPct(discount)

    setLoading(false)
  }

  async function saveAndContinue() {
    if (!id || !company) return
    setSaved(true)

    const riskLevel = getRiskLevel(globalScore)

    // Save diagnostic score
    await supabase
      .from('diagnostics')
      .update({ global_score: globalScore, risk_level: riskLevel, status: 'completed' })
      .eq('id', id)

    // Save category scores
    const catScoreRows = Object.entries(categoryScores).map(([category, score]) => ({
      diagnostic_id: id,
      category,
      score,
      risk_level: getRiskLevel(score),
      weight: weights[category as RiskCategory],
    }))

    await supabase
      .from('category_scores')
      .upsert(catScoreRows, { onConflict: 'diagnostic_id,category' })

    // Save prevention plan
    const { data: plan } = await supabase
      .from('prevention_plans')
      .upsert({
        diagnostic_id: id,
        status: 'draft',
        total_discount_pct: discountPct,
        improved_global_score: improvedGlobalScore,
      }, { onConflict: 'diagnostic_id' })
      .select()
      .single()

    if (plan) {
      // Delete existing actions and re-insert
      await supabase.from('prevention_actions').delete().eq('plan_id', plan.id)

      const actionRows = preventionActions.map(a => ({
        plan_id: plan.id,
        category: a.category,
        action_label: a.actionLabel,
        description: a.description,
        score_reduction: a.scoreReduction,
        target_question_key: a.targetQuestionKey,
        deadline_months: a.deadlineMonths,
        estimated_cost_min: a.estimatedCostMin,
        estimated_cost_max: a.estimatedCostMax,
        status: 'pending' as const,
      }))

      if (actionRows.length > 0) {
        await supabase.from('prevention_actions').insert(actionRows)
      }
    }

    // Save offers
    const premiumA = computePremium(globalScore, company.revenue, company.employees)
    const premiumB = Math.round(premiumA * (1 - discountPct / 100))

    await supabase.from('offers').upsert([
      {
        diagnostic_id: id,
        type: 'A',
        premium: premiumA,
        score_used: globalScore,
        discount_pct: 0,
        conditions: 'Couverture standard basée sur le risque actuel. Aucun engagement de prévention requis.',
      },
      {
        diagnostic_id: id,
        type: 'B',
        premium: premiumB,
        score_used: improvedGlobalScore,
        discount_pct: discountPct,
        conditions: `Engagement sur ${preventionActions.length} actions de prévention. Vérification à 12 mois.`,
      },
    ], { onConflict: 'diagnostic_id,type' })

    navigate(`/diagnostic/${id}`)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Calcul du scoring en cours...</div>
  }

  const radarData = categories.map(cat => ({
    category: cat.label.split(' / ')[0],
    'Score actuel': Math.round(categoryScores[cat.key as RiskCategory] || 0),
    'Score amélioré': Math.round(improvedScores[cat.key as RiskCategory] || 0),
  }))

  const riskLevel = getRiskLevel(globalScore)
  const improvedRiskLevel = getRiskLevel(improvedGlobalScore)
  const premiumA = company ? computePremium(globalScore, company.revenue, company.employees) : 0
  const premiumB = company ? Math.round(premiumA * (1 - discountPct / 100)) : 0

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 mb-2 inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Résultats du diagnostic</h1>
          <p className="text-gray-500 mt-1">Scoring, plan de prévention et double offre</p>
        </div>
      </div>

      {/* Global score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Score global actuel</h3>
          <ScoreGauge score={Math.round(globalScore)} size="lg" />
          <Badge level={riskLevel} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Score amélioré (après prévention)</h3>
          <ScoreGauge score={Math.round(improvedGlobalScore)} size="lg" />
          <Badge level={improvedRiskLevel} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Décote prévention</h3>
          <p className="text-5xl font-bold text-green-600 my-4">-{discountPct}%</p>
          <p className="text-sm text-gray-500">{preventionActions.length} actions de prévention</p>
        </div>
      </div>

      {/* Radar chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Radar de risque</h3>
        <div className="h-96">
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

      {/* Category detail */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Détail par catégorie</h3>
        <div className="space-y-3">
          {categories.map(cat => {
            const score = Math.round(categoryScores[cat.key as RiskCategory] || 0)
            const improved = Math.round(improvedScores[cat.key as RiskCategory] || 0)
            const level = getRiskLevel(score)
            return (
              <div key={cat.key} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50">
                <div className="w-40 font-medium text-sm">{cat.label}</div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${score}%`, backgroundColor: getRiskLevelColor(level) }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right font-bold">{score}/100</div>
                <Badge level={level} />
                <div className="w-20 text-right text-sm text-green-600">{improved < score ? `→ ${improved}` : '—'}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Prevention plan */}
      {preventionActions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">Plan de prévention recommandé</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Action</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Catégorie</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Impact</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Délai</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Coût estimé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preventionActions.map((action, idx) => {
                  const catLabel = categories.find(c => c.key === action.category)?.label || action.category
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <p className="font-medium text-gray-900">{action.actionLabel}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{action.description}</p>
                      </td>
                      <td className="py-3 px-3 text-gray-600">{catLabel.split(' / ')[0]}</td>
                      <td className="py-3 px-3 text-center text-green-600 font-medium">-{action.scoreReduction} pts</td>
                      <td className="py-3 px-3 text-center">{action.deadlineMonths} mois</td>
                      <td className="py-3 px-3 text-right">
                        {action.estimatedCostMin > 0
                          ? `${action.estimatedCostMin.toLocaleString('fr-FR')}€ - ${action.estimatedCostMax.toLocaleString('fr-FR')}€`
                          : 'Variable'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Double offer comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="text-center mb-6">
            <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium mb-3">Offre A</span>
            <h3 className="text-xl font-bold text-gray-900">Risque actuel</h3>
          </div>
          <div className="text-center mb-6">
            <p className="text-4xl font-bold text-gray-900">{premiumA.toLocaleString('fr-FR')}€</p>
            <p className="text-sm text-gray-500 mt-1">Prime annuelle</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Score de risque</span>
              <span className="font-medium">{Math.round(globalScore)}/100</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Niveau</span>
              <Badge level={riskLevel} />
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Prévention</span>
              <span className="text-gray-400">Aucune obligation</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-green-500 p-6 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">Recommandé</span>
          </div>
          <div className="text-center mb-6">
            <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium mb-3">Offre B</span>
            <h3 className="text-xl font-bold text-gray-900">Risque amélioré</h3>
          </div>
          <div className="text-center mb-6">
            <p className="text-4xl font-bold text-green-600">{premiumB.toLocaleString('fr-FR')}€</p>
            <p className="text-sm text-gray-500 mt-1">Prime annuelle <span className="text-green-600 font-medium">(-{discountPct}%)</span></p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Score amélioré</span>
              <span className="font-medium">{Math.round(improvedGlobalScore)}/100</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Niveau</span>
              <Badge level={improvedRiskLevel} />
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Actions prévention</span>
              <span className="font-medium">{preventionActions.length} actions</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Économie annuelle</span>
              <span className="font-bold text-green-600">{(premiumA - premiumB).toLocaleString('fr-FR')}€</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <button
          onClick={saveAndContinue}
          disabled={saved}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50"
        >
          {saved ? 'Sauvegardé' : 'Valider et sauvegarder'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
