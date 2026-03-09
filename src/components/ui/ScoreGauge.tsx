import { getRiskLevel, getRiskLevelColor } from '../../lib/scoring'

interface Props {
  score: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizeConfig = {
  sm: { dimension: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-[10px]' },
  md: { dimension: 120, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-xs' },
  lg: { dimension: 160, strokeWidth: 10, fontSize: 'text-4xl', labelSize: 'text-sm' },
}

export default function ScoreGauge({ score, size = 'md', label }: Props) {
  const { dimension, strokeWidth, fontSize, labelSize } = sizeConfig[size]
  const radius = (dimension - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.min(100, Math.max(0, score))
  const offset = circumference - (clampedScore / 100) * circumference

  const riskLevel = getRiskLevel(clampedScore)
  const color = getRiskLevelColor(riskLevel)

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dimension, height: dimension }}>
        <svg
          width={dimension}
          height={dimension}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Score text in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${fontSize} font-bold`} style={{ color }}>
            {Math.round(clampedScore)}
          </span>
        </div>
      </div>
      {label && (
        <span className={`${labelSize} text-gray-500 font-medium`}>{label}</span>
      )}
    </div>
  )
}
