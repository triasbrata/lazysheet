# LazySheet Landing — CLAUDE.md

## Stack

- **Framework**: TanStack Start (React 19, file-based routing via `src/routes/`)
- **Styling**: Tailwind CSS v4
- **UI library**: shadcn/ui + Radix UI (installed via `pnpm dlx shadcn@latest add <component>`)
- **Icons**: Lucide React, FontAwesome
- **Deploy**: Cloudflare Workers via Wrangler
- **Package manager**: pnpm

## Project Structure

```
src/
  components/   # library/UI components ONLY (shadcn, radix wrappers)
    ui/         # shadcn-generated components
  routes/       # file-based pages (TanStack Router)
  lib/          # utilities (cn, etc.)
  styles.css    # global styles
```

## Component Placement Rule

**`src/components/` is reserved for library and UI-library components only** (e.g., shadcn/ui, Radix primitives, headless wrappers).

All custom/app-specific components — page sections, site-wide layout pieces, feature components — must live **outside** `src/components/`. Place them co-located with their route or in a dedicated top-level folder:

```
src/
  sections/     # page sections (hero, pricing, faq, etc.)
  layouts/      # shared layout components (nav, footer, etc.)
  features/     # feature-specific components
  routes/       # pages — components used only in one route can live here
```

Never add custom components to `src/components/` or any subfolder of it.

## shadcn

Install new shadcn components with:

```bash
pnpm dlx shadcn@latest add <component>
```

## Imports

Use the `#/*` alias for `src/*`:

```ts
import { Button } from '#/components/ui/button'
import { Nav } from '#/layouts/nav'
```

## Testing Rule

**Every feature change MUST ship with unit tests.** No feature PR is complete without accompanying tests covering the new/changed behavior.

- Coverage gate: **95%** — `pnpm test` must keep coverage at or above 95%.
- New feature → add UT in the same change.
- Changed feature → update/extend UT to cover the change.
- Do not merge if coverage drops below 95%.

## Commands

```bash
pnpm dev        # dev server on :3000
pnpm build      # production build
pnpm deploy     # build + deploy to Cloudflare
pnpm test       # vitest
```
