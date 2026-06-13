import { Check, ChevronDown, X, Settings as SettingsIcon } from 'lucide-react'
import { DEFAULT_THEMES, PALETTE_THEMES, THEMES } from './mock-data'
import type { ThemeSwatch } from './mock-data'

export function MockSettings({
  open,
  themeMenuOpen,
  highlightId,
  appliedThemeId,
}: {
  open: boolean
  themeMenuOpen: boolean
  highlightId: string | null
  appliedThemeId: string
}): JSX.Element | null {
  if (!open) return null

  function Toggle() {
    return (
      <div className="h-5 w-9 rounded-full p-0.5" style={{ backgroundColor: 'var(--m-border)' }}>
        <div className="h-4 w-4 rounded-full bg-white" />
      </div>
    )
  }

  function SelectTrigger({ label }: { label: string }) {
    return (
      <div
        className="flex w-44 items-center justify-between rounded-md border px-2.5 py-1 text-sm"
        style={{ borderColor: 'var(--m-border)' }}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} style={{ color: 'var(--m-muted-fg)' }} />
      </div>
    )
  }

  function renderItem(item: ThemeSwatch) {
    return (
      <div
        key={item.id}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
        style={item.id === highlightId ? { backgroundColor: 'var(--m-hover)' } : undefined}
      >
        {item.swatch ? (
          <span
            className="h-3 w-3 shrink-0 rounded-full border"
            style={{ backgroundColor: item.swatch, borderColor: 'var(--m-border)' }}
          />
        ) : (
          <span className="h-3 w-3 shrink-0" />
        )}
        <span>{item.name}</span>
        {item.id === appliedThemeId && <Check size={16} className="ml-auto lucide-check" />}
      </div>
    )
  }

  function ThemeDropdown() {
    return (
      <div
        className="absolute right-0 z-40 mt-1 w-56 rounded-lg p-1 shadow-lg ring-1 ring-black/10"
        style={{ backgroundColor: 'var(--m-popover)' }}
      >
        <div className="px-2 py-1 text-xs" style={{ color: 'var(--m-muted-fg)' }}>
          Default
        </div>
        {DEFAULT_THEMES.map(renderItem)}
        <div className="my-1 h-px" style={{ backgroundColor: 'var(--m-border)' }} />
        <div className="px-2 py-1 text-xs" style={{ color: 'var(--m-muted-fg)' }}>
          Color Palettes
        </div>
        {PALETTE_THEMES.map(renderItem)}
      </div>
    )
  }

  function SettingRow({
    title,
    description,
    control,
  }: {
    title: string
    description: string
    control: JSX.Element
  }) {
    return (
      <div className="flex items-start justify-between gap-4 py-3">
        <div className="flex min-w-0 max-w-[60%] flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs" style={{ color: 'var(--m-muted-fg)' }}>
            {description}
          </span>
        </div>
        <div className="shrink-0">{control}</div>
      </div>
    )
  }

  const themeName = THEMES[appliedThemeId as 'light' | 'palenight']?.name ?? 'Light'

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
      <div
        className="relative w-[640px] max-w-[88%] rounded-xl p-4 text-sm shadow-2xl ring-1 ring-black/10 transition-colors duration-500"
        style={{ backgroundColor: 'var(--m-popover)', color: 'var(--m-fg)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <SettingsIcon size={16} />
          <span className="text-base font-semibold">Settings</span>
        </div>
        <button
          type="button"
          className="absolute right-3 top-3"
          style={{ color: 'var(--m-muted-fg)' }}
        >
          <X size={16} />
        </button>

        {/* Rows */}
        <div className="mt-3">
          <SettingRow
            title="Ask before closing a sheet"
            description="Confirm when a sheet has unsaved changes"
            control={<Toggle />}
          />
          <div className="border-t" style={{ borderColor: 'var(--m-border)' }}>
            <SettingRow
              title="Theme"
              description="Material Theme color palette"
              control={
                <div className="relative">
                  <SelectTrigger label={themeName} />
                  {themeMenuOpen && <ThemeDropdown />}
                </div>
              }
            />
          </div>
          <div className="border-t" style={{ borderColor: 'var(--m-border)' }}>
            <SettingRow
              title="Language"
              description="Interface language"
              control={<SelectTrigger label="English" />}
            />
          </div>
          <div className="border-t" style={{ borderColor: 'var(--m-border)' }}>
            <SettingRow
              title="Disable running text"
              description="Stop long filenames from scrolling"
              control={<Toggle />}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
