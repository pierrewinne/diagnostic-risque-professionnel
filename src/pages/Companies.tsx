import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Building2, PlusCircle } from 'lucide-react'

interface CompanyRow {
  id: string
  name: string
  sector: string | null
  employees: number | null
  revenue: number | null
  city: string | null
  created_at: string
}

export default function Companies() {
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('companies')
      .select('id, name, sector, employees, revenue, city, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setCompanies(data)
        setLoading(false)
      })
  }, [])

  const sectorLabels: Record<string, string> = {
    industry: 'Industrie',
    commerce: 'Commerce',
    services: 'Services / Conseil',
    construction: 'BTP / Construction',
    logistics: 'Logistique / Transport',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entreprises</h1>
          <p className="text-gray-500 mt-1">{companies.length} entreprise{companies.length > 1 ? 's' : ''} enregistrée{companies.length > 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/diagnostic/new"
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition"
        >
          <PlusCircle className="w-5 h-5" />
          Nouveau diagnostic
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : companies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Aucune entreprise pour le moment</p>
          <Link
            to="/diagnostic/new"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            <PlusCircle className="w-5 h-5" />
            Créer un premier diagnostic
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Entreprise</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Secteur</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Effectif</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">CA</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Ville</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.map(company => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{company.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{company.sector ? sectorLabels[company.sector] || company.sector : '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">{company.employees ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">{company.revenue ? `${company.revenue.toLocaleString('fr-FR')}€` : '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{company.city || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{new Date(company.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
