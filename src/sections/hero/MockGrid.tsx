import { COLS, GRID, SELECTION } from './mock-data'

// Column widths: A=140, B=140, C=88
const COL_WIDTHS: Record<string, number> = { A: 140, B: 140, C: 88 }

export function MockGrid(): JSX.Element {
  return (
    <div className="relative text-[12px] text-[var(--m-fg)]">
      {/* Column ruler */}
      <div
        className="flex h-[26px] border-b transition-colors duration-500"
        style={{ borderColor: 'var(--m-border)', backgroundColor: 'var(--m-surface)' }}
      >
        {/* Corner cell */}
        <div
          className="w-11 shrink-0 border-r"
          style={{ borderColor: 'var(--m-border)' }}
        />
        {COLS.map((letter) => (
          <div
            key={letter}
            style={{
              width: COL_WIDTHS[letter],
              borderColor: 'var(--m-border)',
              backgroundColor: 'color-mix(in oklab, var(--m-accent) 15%, transparent)',
              color: 'var(--m-fg)',
            }}
            className="flex shrink-0 items-center justify-center border-r text-[10px] uppercase"
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Data row 1 */}
      <div className="flex h-[28px]">
        {/* Row number */}
        <div
          className="w-11 shrink-0 flex items-center justify-center border-r border-b text-[10px]"
          style={{
            borderColor: 'var(--m-border)',
            backgroundColor: 'color-mix(in oklab, var(--m-accent) 15%, transparent)',
            color: 'var(--m-fg)',
          }}
        >
          1
        </div>
        {GRID.map((value, i) => (
          <div
            key={i}
            style={{ width: i === 2 ? 88 : 140, borderColor: 'var(--m-border)' }}
            className="relative flex shrink-0 items-center justify-end border-r border-b px-2 tabular-nums"
          >
            {value}
          </div>
        ))}
      </div>

      {/* Marching-ants selection frame (A1:C1 always selected) */}
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        aria-hidden
      >
        <rect
          className="mock-selection-ants"
          x={SELECTION.left}
          y={SELECTION.top}
          width={SELECTION.width}
          height={SELECTION.height}
        />
      </svg>

      {/* Anchor handle */}
      <div
        className="pointer-events-none absolute size-1.5 transition-colors duration-500"
        style={{
          left: SELECTION.left + SELECTION.width - 3,
          top: SELECTION.top + SELECTION.height - 3,
          backgroundColor: 'var(--m-accent)',
        }}
      />
    </div>
  )
}
