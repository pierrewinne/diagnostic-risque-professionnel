import { getRiskLevelLabel } from '../../lib/scoring'
import type { RiskLevel } from '../../types'

const colors: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export default function Badge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[level]}`}
    >
      {getRiskLevelLabel(level)}
    </span>
  )
}
