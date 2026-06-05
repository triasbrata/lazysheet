import { describe, it, expect } from 'vitest'

// fontawesome.ts sets config.autoAddCss = false as a side effect.
// Import order matters: first the side-effect module, then read the config.
describe('fontawesome setup', () => {
  it('sets config.autoAddCss to false (disables runtime CSS injection for SSR)', async () => {
    await import('#/lib/fontawesome')
    const { config } = await import('@fortawesome/fontawesome-svg-core')
    expect(config.autoAddCss).toBe(false)
  })
})
