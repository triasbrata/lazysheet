export function MockStatusBar({ selected }: { selected: boolean }): JSX.Element {
  return (
    <div className="flex h-6 items-center justify-between border-t border-[#e6e6e6] bg-[#f7f7f7]/40 px-3 text-[11px] text-[#737373]">
      {/* LEFT: cell ref + value/size */}
      <div className="flex items-center gap-3">
        <span className="min-w-[3rem] font-mono font-medium text-[#1a1a1a]/80">
          {selected ? 'A1:C1' : 'C1'}
        </span>
        <span className="truncate">{selected ? '1R × 3C · 3 cells' : '28'}</span>
      </div>

      {/* RIGHT: zoom controls */}
      <div className="flex items-center gap-0.5">
        <span className="cursor-default rounded px-1.5 py-0.5">−</span>
        <span className="cursor-default rounded px-1.5 py-0.5 font-mono">100%</span>
        <span className="cursor-default rounded px-1.5 py-0.5">+</span>
      </div>
    </div>
  )
}
