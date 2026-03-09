import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PlusCircle, Building2, FileText, TrendingUp } from 'lucide-react'
import Badge from '../components/ui/Badge'
import type { RiskLevel } from '../types'

interface DiagnosticRow {
  id: string
  status: string
  global_score: number | null
  risk_level: string | null
  created_at: string
  companies: { name: string } | null
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [diagnostics, setDiagnostics] = useState<DiagnosticRow[]>([])
  const [stats, setStats] = useState({ total: 0, completed: 0, companies: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [diagResult, companyResult] = await Promise.all([
      supabase
        .from('diagnostics')
        .select('id, status, global_score, risk_level, created_at, companies(name)')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
    ])

    if (diagResult.data) {
      setDiagnostics(diagResult.data as unknown as DiagnosticRow[])
      setStats({
        total: diagResult.data.length,
        completed: diagResult.data.filter(d => d.status === 'completed').length,
        companies: companyResult.count || 0,
      })
    }
    setLoading(false)
  }

  const statCards = [
    { label: 'Diagnostics', value: stats.total, icon: FileText, color: 'bg-primary-100 text-primary-600' },
    { label: 'Complétés', value: stats.completed, icon: TrendingUp, color: 'bg-green-100 text-green-600' },
    { label: 'Entreprises', value: stats.companies, icon: Building2, color: 'bg-purple-100 text-purple-600' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-1">Bienvenue, {profile?.full_name || 'Utilisateur'}</p>
        </div>
        <Link
          to="/diagnostic/new"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition"
        >
          <PlusCircle className="w-5 h-5" />
          Nouveau diagnostic
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Diagnostics récents</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Chargement...</div>
        ) : diagnostics.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Aucun diagnostic pour le moment</p>
            <Link
              to="/diagnostic/new"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              <PlusCircle className="w-5 h-5" />
              Créer votre premier diagnostic
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {diagnostics.map(diag => (
              <Link
                key={diag.id}
                to={`/diagnostic/${diag.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {diag.companies?.name || 'Entreprise'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(diag.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {diag.global_score !== null && (
                    <span className="text-lg font-bold">{Math.round(diag.global_score)}/100</span>
                  )}
                  {diag.risk_level && <Badge level={diag.risk_level as RiskLevel} />}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    diag.status === 'completed' ? 'bg-green-100 text-green-700' :
                    diag.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {diag.status === 'completed' ? 'Complété' : diag.status === 'draft' ? 'Brouillon' : 'Archivé'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
