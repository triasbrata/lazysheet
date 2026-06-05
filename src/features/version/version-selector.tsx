import type { ReleaseData } from '#/lib/releases'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'

export function VersionSelector({ releases, selectedTag }: { releases: ReleaseData[]; selectedTag: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (releases.length <= 1) return null

  const onChange = (tag: string) => {
    void navigate({ to: '.', search: (prev) => ({ ...prev, v: tag }) })
  }

  return (
    <Select value={selectedTag} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={t('nav.versionAria')} className="h-9 w-auto gap-2 text-sm font-medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {releases.map((r, i) => (
          <SelectItem key={r.tag} value={r.tag}>
            {r.tag}{i === 0 ? ` (${t('nav.versionLatest')})` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
