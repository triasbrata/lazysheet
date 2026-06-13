import { FileSpreadsheet, Copy, Search, Sun, X } from 'lucide-react'
import { FILE_NAME } from './mock-data'

export function WindowChrome(): JSX.Element {
  return (
    <div className="flex h-10 items-center gap-2 border-b border-[#e6e6e6] bg-[#fafafa]/60 px-3">
      {/* LEFT: traffic lights + filename */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div className="flex gap-2">
          <span className="size-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
          <span className="size-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
          <span className="size-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
        </div>
        <FileSpreadsheet size={14} className="shrink-0 text-[#737373]" />
        <span className="truncate text-[13px] font-medium text-[#1a1a1a]/90">{FILE_NAME}</span>
        <Copy size={13} className="shrink-0 text-[#737373]" />
      </div>

      {/* CENTER: fake search */}
      <div className="flex justify-center">
        <div className="flex w-80 max-w-[40vw] cursor-default items-center gap-2 rounded-md border border-[#e6e6e6] bg-white px-2.5 py-1 text-xs text-[#737373] shadow-sm">
          <Search size={14} className="shrink-0" />
          <span className="flex-1 truncate text-left">Search commands…</span>
          <kbd className="rounded border border-[#e6e6e6] bg-[#f7f7f7] px-1.5 py-0.5 font-mono text-[10px] font-medium">
            ⌘P
          </kbd>
        </div>
      </div>

      {/* RIGHT: Sun + X */}
      <div className="flex flex-1 items-center justify-end gap-0.5">
        <div className="cursor-default rounded p-1 hover:bg-[#f0f0f0]">
          <Sun size={16} className="text-[#737373]" />
        </div>
        <div className="cursor-default rounded p-1 hover:bg-[#f0f0f0]">
          <X size={16} className="text-[#737373]" />
        </div>
      </div>
    </div>
  )
}
