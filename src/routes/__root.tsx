import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'
import '#/lib/fontawesome'
import { LOCALE_META, localeFromPathname } from '#/i18n/config'

const SITE_URL = 'https://lazysheet.brata.cloud'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'LazySheet | Fast, Native Excel & CSV Viewer' },
      {
        name: 'description',
        content:
          'LazySheet is a fast, free and open-source desktop viewer for Excel, CSV and TSV files. Open huge sheets instantly with zero latency on macOS, Windows and Linux.',
      },
      { name: 'theme-color', content: '#ffffff' },
      { property: 'og:title', content: 'LazySheet — Fast, Simple Spreadsheet Viewer' },
      {
        property: 'og:description',
        content:
          'Open Excel, CSV and TSV files instantly. Free and open source for macOS, Windows and Linux.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:image', content: `${SITE_URL}/app-icon-512.png` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'LazySheet — Fast, Simple Spreadsheet Viewer' },
      {
        name: 'twitter:description',
        content:
          'Open Excel, CSV and TSV files instantly. Free and open source for macOS, Windows and Linux.',
      },
      { name: 'twitter:url', content: SITE_URL },
      { name: 'twitter:image', content: `${SITE_URL}/app-icon-512.png` },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/app-icon.png', type: 'image/png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const locale = localeFromPathname(pathname)
  const lang = LOCALE_META[locale].htmlLang

  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
