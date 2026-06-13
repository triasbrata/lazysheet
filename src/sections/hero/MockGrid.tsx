import { COLS, GRID } from './mock-data'

// Column widths: A=140, B=140, C=88
const COL_WIDTHS: Record<string, number> = { A: 140, B: 140, C: 88 }

export function MockGrid({ selected }: { selected: boolean }): JSX.Element {
  return (
    <div className="relative text-[12px] text-[#1a1a1a]">
      {/* Column ruler */}
      <div className="flex h-[26px] border-b border-[#e6e6e6] bg-[#f7f7f7]/85">
        {/* Corner cell */}
        <div className="w-11 shrink-0 border-r border-[#e6e6e6]" />
        {COLS.map((letter) => (
          <div
            key={letter}
            style={{ width: COL_WIDTHS[letter] }}
            className={`flex shrink-0 items-center justify-center border-r border-[#e6e6e6] text-[10px] uppercase ${
              selected
                ? 'bg-[#2b2b2b]/[0.08] text-[#1a1a1a]'
                : 'text-[#737373]'
            }`}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Data row 1 */}
      <div className="flex h-[28px]">
        {/* Row number */}
        <div
          className={`w-11 shrink-0 flex items-center justify-center border-r border-b border-[#e6e6e6] text-[10px] ${
            selected
              ? 'bg-[#2b2b2b]/[0.10] text-[#1a1a1a]'
              : 'bg-[#f7f7f7]/85 text-[#737373]'
          }`}
        >
          1
        </div>
        {GRID.map((value, i) => (
          <div
            key={i}
            style={{ width: i === 2 ? 88 : 140 }}
            className="relative flex shrink-0 items-center justify-end border-r border-b border-[#e6e6e6] px-2 tabular-nums"
          >
            {value}
          </div>
        ))}
      </div>

      {/* Marching-ants selection overlay (A1:C1) */}
      {selected && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute border-2 border-dashed border-[#2b2b2b]"
            style={{ left: 44, top: 26, width: 368, height: 28 }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute size-1.5 bg-[#1a73e8]"
            style={{ left: 44 + 368 - 3, top: 26 + 28 - 3 }}
          />
        </>
      )}
    </div>
  )
}
