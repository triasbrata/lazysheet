import type React from 'react'
import {
  GroupIcon,
  BoltIcon,
  LayersIcon,
  SearchIcon,
  FilterIcon,
  PinIcon,
  ResizeIcon,
  KeyboardIcon,
  PaletteIcon,
  CopyIcon,
  AppleMark,
  CheckIcon,
  ExcelIcon,
} from '#/components/site/icons'

type IconComponent = (props: { className?: string }) => JSX.Element

export type BentoTile = {
  id: string
  span: string
  tone?: 'plain' | 'tint' | 'accent'
  icon?: IconComponent
  title: string
  description?: string
  render?: () => React.ReactNode
  media?: { src: string; alt: string }
  layout?: 'stack' | 'band'
}

const FILE_FORMATS = ['.xlsx', '.xlsm', '.xls', '.csv', '.tsv']

// Order = radial stagger from the center anchor outward (group-by first), so the
// scroll-linked assembly builds center-first like the WWDC bento reveal.
export const BENTO_TILES: BentoTile[] = [
  {
    id: 'group-by',
    span: 'md:col-start-5 md:col-span-4 md:row-start-2 md:row-span-2',
    tone: 'accent',
    icon: GroupIcon,
    title: 'Group-by Summary',
    description:
      'Summarize data by any column in seconds. Select a range, choose your category and value columns, and get instant roll-ups with SUM, AVG, MIN, MAX, and COUNT — no pivot-table setup.',
    media: { src: '/shots/application-summary.png', alt: 'Group-by summary' },
    render: () => (
      <ul className="space-y-2 text-sm font-medium text-on-surface">
        <li className="flex items-center gap-2">
          <CheckIcon className="text-[16px] text-primary" />
          Multi-level grouping across up to 6 columns
        </li>
        <li className="flex items-center gap-2">
          <CheckIcon className="text-[16px] text-primary" />
          Instant SUM / AVG / MIN / MAX / COUNT on any range selection
        </li>
      </ul>
    ),
  },
  {
    id: 'formats',
    span: 'md:col-start-5 md:col-span-4 md:row-start-1',
    tone: 'tint',
    icon: ExcelIcon,
    title: 'Wide Format Support',
    description: 'Open .xlsx, .xlsm, .xls, .csv, and .tsv files — no conversion, no setup.',
    render: () => (
      <div className="mt-5 flex flex-wrap gap-2">
        {FILE_FORMATS.map((ext) => (
          <span
            key={ext}
            className="rounded-lg border border-surface-container-high bg-white px-2.5 py-1 text-xs font-medium text-on-surface-variant"
          >
            {ext}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: 'multi-sheet',
    span: 'md:col-start-1 md:col-span-4 md:row-start-2',
    icon: LayersIcon,
    title: 'Multi-sheet Navigation',
    description: 'Switch between worksheet tabs in any workbook from the bottom tab bar.',
  },
  {
    id: 'command',
    span: 'md:col-start-9 md:col-span-4 md:row-start-2',
    icon: KeyboardIcon,
    title: 'Command Palette',
    description:
      'Cmd+K to jump to any cell reference or run an action — keyboard-first navigation.',
  },
  {
    id: 'virtualized',
    span: 'md:col-start-1 md:col-span-4 md:row-start-1',
    tone: 'plain',
    icon: BoltIcon,
    title: 'Virtualized Rendering',
    description:
      'LazySheet only renders the rows you can see. Scroll through massive sheets with smooth, lag-free movement regardless of hardware.',
    render: () => (
      <div className="mt-8 border-t border-surface-container-high pt-8">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Scroll Latency</span>
          <span className="font-bold text-primary">0.1ms</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full w-[20%] rounded-full bg-primary" />
        </div>
      </div>
    ),
  },
  {
    id: 'filters',
    span: 'md:col-start-9 md:col-span-4 md:row-start-1',
    icon: FilterIcon,
    title: 'Column Filters',
    description:
      'Click the funnel on any header. 14 filter types plus an Excel-style value checklist.',
  },
  {
    id: 'sticky',
    span: 'md:col-start-1 md:col-span-4 md:row-start-3',
    icon: PinIcon,
    title: 'Sticky Header Row',
    description:
      'Mark any row as the header — it stays pinned while you scroll through the data.',
  },
  {
    id: 'resize',
    span: 'md:col-start-9 md:col-span-4 md:row-start-3',
    icon: ResizeIcon,
    title: 'Resizable Columns & Rows',
    description: 'Drag to resize, double-click to autofit. Sizes are remembered per file.',
  },
  {
    id: 'format',
    span: 'md:col-start-4 md:col-span-3 md:row-start-4',
    icon: PaletteIcon,
    title: 'Rich Cell Formatting',
    description:
      'Fonts, colors, alignment, merged cells, and clickable hyperlinks preserved from .xlsx files.',
  },
  {
    id: 'copy',
    span: 'md:col-start-7 md:col-span-3 md:row-start-4',
    icon: CopyIcon,
    title: 'Copy as Image',
    description: 'Capture a group-by summary report as a PNG straight to your clipboard.',
  },
  {
    id: 'find',
    span: 'md:col-start-1 md:col-span-3 md:row-start-4',
    icon: SearchIcon,
    title: 'Find in Sheet',
    description: 'Full-text search with Cmd+F. Jump between matches highlighted across the sheet.',
  },
  {
    id: 'native',
    span: 'md:col-start-10 md:col-span-3 md:row-start-4',
    tone: 'plain',
    icon: AppleMark,
    title: 'Native macOS Integration',
    description: "Drag & drop, 'Open With', and Recent Files support built in.",
  },
]
