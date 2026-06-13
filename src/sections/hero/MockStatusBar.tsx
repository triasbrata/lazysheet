export function MockStatusBar({ version }: { version: string }): JSX.Element {
  return (
    <div
      className="flex h-6 items-center justify-between border-t px-3 text-[11px] transition-colors duration-500"
      style={{ borderColor: 'var(--m-border)', backgroundColor: 'var(--m-surface)', color: 'var(--m-muted-fg)' }}
    >
      {/* LEFT: range ref + summary */}
      <div className="flex items-center gap-3">
        <span className="min-w-[3rem] font-mono font-medium" style={{ color: 'var(--m-fg)' }}>A1:C1</span>
        <span className="truncate">1R × 3C · 3 cells</span>
      </div>

      {/* RIGHT: version + zoom controls */}
      <div className="flex items-center gap-2">
        <span className="font-mono">LazySheet {version}</span>
        <div className="flex items-center gap-0.5">
          <span className="cursor-default rounded px-1.5 py-0.5">−</span>
          <span className="cursor-default rounded px-1.5 py-0.5 font-mono">100%</span>
          <span className="cursor-default rounded px-1.5 py-0.5">+</span>
        </div>
      </div>
    </div>
  )
}
