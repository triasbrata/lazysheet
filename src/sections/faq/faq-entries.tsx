import type React from 'react'
import { useTranslation } from 'react-i18next'
import { LockIcon, LinuxMark, TerminalIcon } from '#/components/site/icons'
import { CopyCommand } from '#/features/faq/copy-command'
import { compareVersions } from '#/lib/version'

type IconComponent = (props: { className?: string }) => JSX.Element

export type FaqEntry = {
  id: string
  version: string
  icon: IconComponent
  question: string
  body: React.ReactNode
}

export function useFaqEntries(activeTag: string): FaqEntry[] {
  const { t } = useTranslation()

  const all: FaqEntry[] = [
    {
      id: 'unsigned',
      version: 'v0.4.0',
      icon: LockIcon,
      question: t('faq.unsignedQuestion'),
      body: (
        <>
          <p className="mb-4 text-on-surface-variant">
            {t('faq.unsignedAnswerPre')}{' '}
            <span className="inline-flex items-center gap-1 font-medium text-on-surface">
              <TerminalIcon className="text-[14px]" />
              {t('faq.terminal')}
            </span>{' '}
            app and run:
          </p>

          <CopyCommand command={'xattr -dr com.apple.quarantine "/Applications/LazySheet.app"'} />

          <p className="mt-4 text-sm text-on-surface-variant">
            {t('faq.unsignedAnswerPost')}
          </p>
        </>
      ),
    },
    {
      id: 'deb-deps',
      version: 'v0.4.0',
      icon: LinuxMark,
      question: t('faq.debQuestion'),
      body: (
        <>
          <p className="mb-4 text-on-surface-variant">
            {t('faq.debAnswerPre')}
          </p>

          <CopyCommand command={'sudo apt install -y libjavascriptcoregtk-4.1-0 libsoup-3.0-0 libsoup-3.0-common libwebkit2gtk-4.1-0'} />

          <p className="mt-4 text-sm text-on-surface-variant">
            {t('faq.debAnswerPost')}
          </p>
        </>
      ),
    },
  ]

  return all.filter((e) => compareVersions(e.version, activeTag) <= 0)
}
