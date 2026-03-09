import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { categories, type Question } from '../data/questionnaire'
import ProgressBar from '../components/ui/ProgressBar'
import { ChevronLeft, ChevronRight, HelpCircle, Save } from 'lucide-react'
import * as Icons from 'lucide-react'

export default function Questionnaire() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState<string | null>(null)

  const allQuestions = categories.flatMap(c => c.questions)
  const answeredCount = Object.keys(answers).length
  const currentCategory = categories[currentCategoryIndex]

  useEffect(() => {
    loadExistingAnswers()
  }, [id])

  async function loadExistingAnswers() {
    if (!id) return
    const { data } = await supabase
      .from('risk_answers')
      .select('question_key, answer_value')
      .eq('diagnostic_id', id)

    if (data) {
      const existing: Record<string, string> = {}
      data.forEach(a => { existing[a.question_key] = a.answer_value })
      setAnswers(existing)
    }
  }

  function setAnswer(questionKey: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionKey]: value }))
  }

  async function saveAnswers() {
    if (!id) return
    setSaving(true)

    const upserts = Object.entries(answers).map(([questionKey, answerValue]) => {
      const question = allQuestions.find(q => q.key === questionKey)
      const option = question?.options.find(o => o.value === answerValue)
      return {
        diagnostic_id: id,
        category: question?.category || 'fire',
        question_key: questionKey,
        answer_value: answerValue,
        factor_score: option?.score ?? 0,
      }
    })

    const { error } = await supabase
      .from('risk_answers')
      .upsert(upserts, { onConflict: 'diagnostic_id,question_key' })

    if (error) {
      alert('Erreur de sauvegarde: ' + error.message)
    }
    setSaving(false)
  }

  async function handleNext() {
    await saveAnswers()
    if (currentCategoryIndex < categories.length - 1) {
      setCurrentCategoryIndex(prev => prev + 1)
      window.scrollTo(0, 0)
    } else {
      navigate(`/diagnostic/${id}/scoring`)
    }
  }

  function handlePrev() {
    if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex(prev => prev - 1)
      window.scrollTo(0, 0)
    }
  }

  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[currentCategory.icon] || Icons.HelpCircle

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Questionnaire de risques</h1>
        <p className="text-gray-500 mt-1">Répondez aux questions pour chaque catégorie de risque</p>
      </div>

      <ProgressBar current={answeredCount} total={allQuestions.length} label="Questions complétées" />

      {/* Category tabs */}
      <div className="flex gap-1 mt-6 mb-6 overflow-x-auto pb-2">
        {categories.map((cat, idx) => {
          const CatIcon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[cat.icon] || Icons.HelpCircle
          const catAnswered = cat.questions.filter(q => answers[q.key]).length
          const isComplete = catAnswered === cat.questions.length
          return (
            <button
              key={cat.key}
              onClick={() => { saveAnswers(); setCurrentCategoryIndex(idx) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                idx === currentCategoryIndex
                  ? 'bg-primary-600 text-white'
                  : isComplete
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CatIcon className="w-4 h-4" />
              {cat.label}
              {isComplete && <span className="text-xs">&#10003;</span>}
            </button>
          )
        })}
      </div>

      {/* Current category */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <IconComponent className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{currentCategory.label}</h2>
            <p className="text-sm text-gray-500">{currentCategory.description}</p>
          </div>
          <span className="ml-auto text-sm text-gray-400">
            {currentCategory.questions.filter(q => answers[q.key]).length} / {currentCategory.questions.length}
          </span>
        </div>

        <div className="space-y-6">
          {currentCategory.questions.map((question, qIdx) => (
            <QuestionCard
              key={question.key}
              question={question}
              index={qIdx}
              value={answers[question.key] || ''}
              onChange={value => setAnswer(question.key, value)}
              tooltipOpen={tooltipOpen === question.key}
              onToggleTooltip={() => setTooltipOpen(tooltipOpen === question.key ? null : question.key)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200">
          <button
            onClick={handlePrev}
            disabled={currentCategoryIndex === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Précédent
          </button>

          <button
            onClick={() => saveAnswers()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>

          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition"
          >
            {currentCategoryIndex === categories.length - 1 ? 'Calculer le scoring' : 'Suivant'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionCard({
  question,
  index,
  value,
  onChange,
  tooltipOpen,
  onToggleTooltip,
}: {
  question: Question
  index: number
  value: string
  onChange: (value: string) => void
  tooltipOpen: boolean
  onToggleTooltip: () => void
}) {
  return (
    <div className={`p-4 rounded-lg border ${value ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
          {index + 1}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <label className="font-medium text-gray-900">{question.label}</label>
            <button
              onClick={onToggleTooltip}
              className="text-gray-400 hover:text-gray-600"
              type="button"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          {tooltipOpen && (
            <p className="text-sm text-gray-500 mb-3 bg-gray-50 px-3 py-2 rounded-lg">
              {question.tooltip}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {question.options.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  value === option.value
                    ? 'bg-primary-600 text-white ring-2 ring-primary-600 ring-offset-2'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
