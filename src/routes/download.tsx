import { createFileRoute, redirect } from '@tanstack/react-router'
import { DEFAULT_LOCALE } from '#/i18n/config'

export const Route = createFileRoute('/download')({
  beforeLoad: () => {
    throw redirect({ to: '/$locale/download', params: { locale: DEFAULT_LOCALE } })
  },
})
