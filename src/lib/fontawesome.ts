// Font Awesome setup for SSR (TanStack Start).
// Disable runtime CSS injection and import the stylesheet manually so the
// icons are sized correctly on the server-rendered HTML (no layout flash).
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'

config.autoAddCss = false
