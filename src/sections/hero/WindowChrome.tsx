import { FileSpreadsheet, Copy, Search, PanelRight, X } from 'lucide-react'
import { FILE_NAME } from './mock-data'

export function WindowChrome(): JSX.Element {
  return (
    <div
      className="flex h-10 items-center gap-2 border-b px-3 transition-colors duration-500"
      style={{ borderColor: 'var(--m-border)', backgroundColor: 'var(--m-surface)' }}
    >
      {/* LEFT: traffic lights + filename */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="size-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
        <span className="size-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
        <span className="size-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
        <FileSpreadsheet size={14} style={{ color: 'var(--m-muted-fg)' }} className="shrink-0" />
        <span className="truncate text-[13px] font-medium" style={{ color: 'var(--m-fg)' }}>
          {FILE_NAME}
        </span>
        <Copy size={13} style={{ color: 'var(--m-muted-fg)' }} className="shrink-0" />
      </div>

      {/* CENTER: fake search pill */}
      <div className="flex justify-center">
        <div
          className="flex w-80 max-w-[40vw] cursor-default items-center gap-2 rounded-md border px-2.5 py-1 text-xs shadow-sm"
          style={{
            borderColor: 'var(--m-border)',
            backgroundColor: 'var(--m-popover)',
            color: 'var(--m-muted-fg)',
          }}
        >
          <Search size={14} className="shrink-0" />
          <span className="flex-1 truncate text-left">Search commands…</span>
          <kbd
            className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium"
            style={{ borderColor: 'var(--m-border)' }}
          >
            ⌘P
          </kbd>
        </div>
      </div>

      {/* RIGHT: PanelRight + X */}
      <div className="flex flex-1 items-center justify-end gap-0.5">
        <div className="cursor-default rounded p-1">
          <PanelRight size={16} style={{ color: 'var(--m-muted-fg)' }} />
        </div>
        <div className="cursor-default rounded p-1">
          <X size={16} style={{ color: 'var(--m-muted-fg)' }} />
        </div>
      </div>
    </div>
  )
}
