import { createFileRoute, redirect } from '@tanstack/react-router'
import { DEFAULT_LOCALE } from '#/i18n/config'

export const Route = createFileRoute('/guide')({
  beforeLoad: () => {
    throw redirect({ to: '/$locale/guide', params: { locale: DEFAULT_LOCALE } })
  },
})
