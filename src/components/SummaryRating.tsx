import { useState, useEffect } from 'react'

export interface SummaryRatingProps {
  value: number | undefined
  onChange: (value: number) => void
  disabled?: boolean
  loading?: boolean
  label?: string // optional label text
}

/**
 * SummaryRating: 5-star interactive rating for the generated summary.
 * - Shows outline stars; filled for current selection.
 * - Hover previews selection.
 * - Disabled when summary is not present or user cannot edit (still shows existing value).
 */
export default function SummaryRating({ value, onChange, disabled, loading, label = 'Rate summary:' }: SummaryRatingProps) {
  const [hover, setHover] = useState<number | null>(null)
  const effective = hover !== null ? hover : (value || 0)

  useEffect(() => {
    if (hover !== null && disabled) setHover(null)
  }, [disabled, hover])

  return (
    <div className="flex items-center gap-1" aria-label={label} title={disabled ? 'Rating disabled' : label}>
      <span className="text-xs text-muted-foreground select-none">{label}</span>
      {[1,2,3,4,5].map((n) => {
        const filled = n <= effective
        return (
          <button
            key={n}
            type="button"
            disabled={disabled || loading}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => { if (!disabled) onChange(n) }}
            className={`p-0.5 transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            aria-pressed={value === n}
            aria-label={`Rate ${n} star${n>1?'s':''}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={filled ? 0 : 1}
              className={`w-5 h-5 ${filled ? 'text-yellow-500' : 'text-muted-foreground'}`}
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.173c.969 0 1.371 1.24.588 1.81l-3.378 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.539 1.118l-3.379-2.454a1 1 0 00-1.175 0l-3.379 2.454c-.783.57-1.838-.196-1.539-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.393c-.783-.57-.38-1.81.588-1.81h4.173a1 1 0 00.95-.69l1.287-3.966z" />
            </svg>
          </button>
        )
      })}
      {value ? (
        <span className="text-xs text-muted-foreground ml-1">{value}/5</span>
      ) : null}
    </div>
  )
}
