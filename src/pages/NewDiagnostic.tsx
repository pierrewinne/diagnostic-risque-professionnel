import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Building2, ChevronRight } from 'lucide-react'

interface SectorProfile {
  sector: string
  label: string
}

export default function NewDiagnostic() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sectors, setSectors] = useState<SectorProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    nace_code: '',
    sector: '',
    employees: '',
    revenue: '',
    city: '',
    address: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  })

  useEffect(() => {
    supabase.from('sector_profiles').select('sector, label').then(({ data }) => {
      if (data) setSectors(data)
    })
  }, [])

  function updateForm(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)

    // Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: form.name,
        nace_code: form.nace_code || null,
        sector: form.sector || null,
        employees: form.employees ? parseInt(form.employees) : null,
        revenue: form.revenue ? parseFloat(form.revenue) : null,
        city: form.city || null,
        address: form.address || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (companyError || !company) {
      alert('Erreur lors de la création: ' + companyError?.message)
      setLoading(false)
      return
    }

    // Create diagnostic
    const { data: diagnostic, error: diagError } = await supabase
      .from('diagnostics')
      .insert({
        company_id: company.id,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    if (diagError || !diagnostic) {
      alert('Erreur lors de la création du diagnostic: ' + diagError?.message)
      setLoading(false)
      return
    }

    navigate(`/diagnostic/${diagnostic.id}/questionnaire`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nouveau diagnostic</h1>
        <p className="text-gray-500 mt-1">Identifiez l'entreprise pour démarrer l'analyse de risque</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Identification de l'entreprise</h2>
            <p className="text-sm text-gray-500">Informations générales</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => updateForm('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secteur d'activité *</label>
            <select
              value={form.sector}
              onChange={e => updateForm('sector', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              required
            >
              <option value="">Sélectionner un secteur</option>
              {sectors.map(s => (
                <option key={s.sector} value={s.sector}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code NACE</label>
            <input
              type="text"
              value={form.nace_code}
              onChange={e => updateForm('nace_code', e.target.value)}
              placeholder="ex: 25.11"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effectif *</label>
            <input
              type="number"
              value={form.employees}
              onChange={e => updateForm('employees', e.target.value)}
              placeholder="Nombre de salariés"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              required
              min={1}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chiffre d'affaires annuel (EUR) *</label>
            <input
              type="number"
              value={form.revenue}
              onChange={e => updateForm('revenue', e.target.value)}
              placeholder="ex: 2000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              required
              min={0}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
            <input
              type="text"
              value={form.city}
              onChange={e => updateForm('city', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input
              type="text"
              value={form.address}
              onChange={e => updateForm('address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-medium text-gray-900 mb-4">Contact principal</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={e => updateForm('contact_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={e => updateForm('contact_email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={e => updateForm('contact_phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Démarrer le questionnaire'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
