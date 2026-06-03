import { useTranslation } from 'react-i18next'
import type { DownloadData } from '#/lib/releases-data'
import { pickPrimaryAsset, osLabel, LATEST_PAGE_URL } from '#/lib/releases'
import { AppleMark, WindowsMark, LinuxMark } from '#/components/site/icons'
import { useClientOSArch } from './use-os-arch'

export function DownloadButton({ data }: { data: DownloadData }) {
  const { t } = useTranslation()
  const { os, arch } = useClientOSArch({ os: data.serverOS, arch: null })
  const asset = data.release ? pickPrimaryAsset(data.release.assets, os, arch) : null
  const href = asset?.url ?? data.release?.htmlUrl ?? LATEST_PAGE_URL
  const Icon = os === 'Windows' ? WindowsMark : os === 'Linux' ? LinuxMark : AppleMark
  const label = os === 'unknown' ? t('download.buttonGeneric') : t('download.buttonForOs', { os: osLabel(os) })
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--st-green)] px-8 py-5 text-2xl font-bold text-white no-underline transition-all hover:opacity-90 md:w-auto"
    >
      <Icon className="text-[26px]" />
      {label}
    </a>
  )
}
