import type React from 'react'
import { useTranslation } from 'react-i18next'
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
import { resolveVersion } from '#/lib/version'

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

function buildFeatureVersions(t: (key: string) => string): Record<string, BentoTile[]> {
  return {
    'v0.4.0': [
      {
        id: 'group-by',
        span: 'md:col-start-5 md:col-span-4 md:row-start-1 md:row-span-3',
        tone: 'accent',
        icon: GroupIcon,
        title: t('bento.groupBy.title'),
        description: t('bento.groupBy.description'),
        media: { src: '/shots/application-summary.png', alt: t('bento.groupBy.mediaAlt') },
        render: () => (
          <ul className="space-y-2 text-sm font-medium text-on-surface">
            <li className="flex items-center gap-2">
              <CheckIcon className="text-[16px] text-primary" />
              {t('bento.groupBy.bullet1')}
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="text-[16px] text-primary" />
              {t('bento.groupBy.bullet2')}
            </li>
          </ul>
        ),
      },
      {
        id: 'formats',
        span: 'md:col-start-9 md:col-span-4 md:row-start-2',
        tone: 'tint',
        icon: ExcelIcon,
        title: t('bento.formats.title'),
        description: t('bento.formats.description'),
        render: () => (
          <div className="flex flex-wrap gap-2">
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
        span: 'md:col-start-11 md:col-span-2 md:row-start-1',
        icon: LayersIcon,
        title: t('bento.multiSheet.title'),
        description: t('bento.multiSheet.description'),
      },
      {
        id: 'command',
        span: 'md:col-start-9 md:col-span-2 md:row-start-3',
        icon: KeyboardIcon,
        title: t('bento.command.title'),
        description: t('bento.command.description'),
      },
      {
        id: 'virtualized',
        span: 'md:col-start-1 md:col-span-4 md:row-start-1',
        tone: 'plain',
        icon: BoltIcon,
        title: t('bento.virtualized.title'),
        description: t('bento.virtualized.description'),
      },
      {
        id: 'filters',
        span: 'md:col-start-9 md:col-span-2 md:row-start-1',
        icon: FilterIcon,
        title: t('bento.filters.title'),
        description: t('bento.filters.description'),
      },
      {
        id: 'sticky',
        span: 'md:col-start-1 md:col-span-2 md:row-start-3',
        icon: PinIcon,
        title: t('bento.sticky.title'),
        description: t('bento.sticky.description'),
      },
      {
        id: 'resize',
        span: 'md:col-start-1 md:col-span-4 md:row-start-2',
        icon: ResizeIcon,
        title: t('bento.resize.title'),
        description: t('bento.resize.description'),
      },
      {
        id: 'format',
        span: 'md:col-start-11 md:col-span-2 md:row-start-3',
        icon: PaletteIcon,
        title: t('bento.format.title'),
        description: t('bento.format.description'),
      },
      {
        id: 'copy',
        span: 'md:col-start-1 md:col-span-6 md:row-start-4',
        icon: CopyIcon,
        title: t('bento.copy.title'),
        description: t('bento.copy.description'),
      },
      {
        id: 'find',
        span: 'md:col-start-3 md:col-span-2 md:row-start-3',
        icon: SearchIcon,
        title: t('bento.find.title'),
        description: t('bento.find.description'),
      },
      {
        id: 'native',
        span: 'md:col-start-7 md:col-span-6 md:row-start-4',
        tone: 'plain',
        icon: AppleMark,
        title: t('bento.native.title'),
        description: t('bento.native.description'),
      },
    ],
  }
}

// Order = radial stagger from the center anchor outward (group-by first), so the
// scroll-linked assembly builds center-first like the WWDC bento reveal.
export function useBentoTiles(activeTag: string): BentoTile[] {
  const { t } = useTranslation()
  const map = buildFeatureVersions(t)
  const version = resolveVersion(Object.keys(map), activeTag)
  return (version ? map[version] : []) ?? []
}
