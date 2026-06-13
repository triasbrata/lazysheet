import { QUERY_ITEMS } from './mock-data'
import { ChevronRight } from 'lucide-react'

interface MockContextMenuProps {
  open: boolean
  submenuOpen: boolean
  highlightQuery: boolean
  highlightInsert: boolean
}

const item =
  'flex items-center gap-2 rounded-md px-2 py-1 cursor-default'

export function MockContextMenu({
  open,
  submenuOpen,
  highlightQuery,
  highlightInsert,
}: MockContextMenuProps): JSX.Element | null {
  if (!open) return null

  return (
    <div className="absolute z-30 left-[34%] top-[30%] w-52 rounded-lg bg-white p-1 text-[13px] text-[#1a1a1a] shadow-md ring-1 ring-black/10">
      <div className={item}>Summarize range…</div>

      <div className="-mx-1 my-1 h-px bg-[#ececec]" />

      <div className={item}>
        Copy
        <ChevronRight size={14} className="ml-auto" />
      </div>

      <div className="relative">
        <div
          className={`${item}${highlightQuery ? ' bg-[#f0f0f0]' : ''}`}
        >
          Copy as Query
          <ChevronRight size={14} className="ml-auto" />
        </div>
        {submenuOpen && (
          <div className="absolute left-full top-8 -ml-1 w-32 rounded-lg bg-white p-1 shadow-lg ring-1 ring-black/10">
            {QUERY_ITEMS.map((q) => (
              <div
                key={q}
                className={`${item}${q === 'INSERT' && highlightInsert ? ' bg-[#f0f0f0]' : ''}`}
              >
                {q}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="-mx-1 my-1 h-px bg-[#ececec]" />

      <div className={item}>
        Resize
        <ChevronRight size={14} className="ml-auto" />
      </div>
    </div>
  )
}
