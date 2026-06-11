// Records a scrolling video of the REAL running site at each target viewport,
// across every page. Drives a live dev/preview server (default
// http://localhost:3000) with Playwright chromium so real /public assets + fonts
// load (unlike the isolated vitest harness).
// Output: e2e-media/<page>-<w>x<h>.webm   (page = home | download | guide)
//
// Usage:
//   1. start the site:  pnpm dev   (or pnpm preview after pnpm build)
//   2. node scripts/record-responsive.mjs   (or: pnpm record:media)
//   Env: ORIGIN (default http://localhost:3000), LOCALE (default en),
//        OUT_DIR (default e2e-media)

import { chromium } from 'playwright'
import { mkdir, rename, readdir, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileP = promisify(execFile)
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'

/** Transcode the playwright .webm to a QuickTime-friendly .mp4 (h264, yuv420p). */
async function toMp4(webmPath, mp4Path) {
  await execFileP(FFMPEG, [
    '-y',
    '-i', webmPath,
    '-an', // no audio (videos are silent)
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    mp4Path,
  ])
}

const ORIGIN = process.env.ORIGIN ?? 'http://localhost:3000'
const LOCALE = process.env.LOCALE ?? 'en'
const OUT_DIR = process.env.OUT_DIR ?? 'e2e-media'
// Optional width filters (e.g. MAX_WIDTH=393 → only viewports <= 393px wide)
const MAX_WIDTH = process.env.MAX_WIDTH ? Number(process.env.MAX_WIDTH) : Infinity
const MIN_WIDTH = process.env.MIN_WIDTH ? Number(process.env.MIN_WIDTH) : 0

const ALL_PAGES = [
  { name: 'home', path: `/${LOCALE}` },
  { name: 'download', path: `/${LOCALE}/download` },
  { name: 'guide', path: `/${LOCALE}/guide` },
]
// Optional page filter: PAGES=home  or  PAGES=home,guide
const PAGES = process.env.PAGES
  ? ALL_PAGES.filter((p) => process.env.PAGES.split(',').includes(p.name))
  : ALL_PAGES

const VIEWPORTS = [
  // Desktop — pinned (>=1280): scroll-linked 300vh bento assembly is captured
  { group: 'desktop', w: 1920, h: 1080 },
  { group: 'desktop', w: 1536, h: 864 },
  { group: 'desktop', w: 1366, h: 768 },
  // Mobile — stacked single-column fade-in
  { group: 'mobile', w: 360, h: 800 },
  { group: 'mobile', w: 390, h: 844 },
  { group: 'mobile', w: 393, h: 873 },
  // Tablet — stacked single-column fade-in
  { group: 'tablet', w: 768, h: 1024 },
  { group: 'tablet', w: 810, h: 1080 },
  { group: 'tablet', w: 820, h: 1180 },
]

/** Slowly scroll top -> bottom -> settle, so the video shows the whole page. */
async function smoothScroll(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    window.scrollTo(0, 0)
    await sleep(1000)
    const maxY = () =>
      Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      ) - window.innerHeight
    // small step + longer dwell = slow, readable scroll (~1/8 viewport per tick)
    const step = Math.max(60, Math.round(window.innerHeight / 8))
    for (let y = 0; y <= maxY(); y += step) {
      window.scrollTo(0, y)
      await sleep(280)
    }
    window.scrollTo(0, maxY())
    await sleep(1200)
  })
}

async function recordOne(browser, pg, vp) {
  const size = { width: vp.w, height: vp.h }
  const ctx = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference', // let motion-safe animations + 300vh pin run
    recordVideo: { dir: OUT_DIR, size },
  })
  const page = await ctx.newPage()
  // NOTE: vite dev keeps an HMR websocket open, so 'networkidle' never fires.
  // Use 'load' + explicit element waits instead.
  await page.goto(ORIGIN + pg.path, { waitUntil: 'load', timeout: 60_000 })
  await page.waitForSelector('h1', { timeout: 30_000 })
  // bento grid only exists on the home page
  if (pg.name === 'home') {
    await page
      .waitForSelector('[data-testid="bento-grid"]', { timeout: 30_000 })
      .catch(() => {})
  }
  // give fonts + images (incl. the 2.4MB gif on home) a beat to paint
  await page.waitForTimeout(1200)
  try {
    await smoothScroll(page)
  } catch (err) {
    // "Execution context destroyed" = a late navigation/HMR reload mid-scroll.
    // Settle and retry once from the top.
    console.warn(`  ↻ scroll retry (${pg.name} ${vp.w}x${vp.h}): ${err.message}`)
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(1200)
    await smoothScroll(page)
  }
  const video = page.video()
  await ctx.close() // finalizes the .webm
  const tmpPath = await video.path()
  const base = `${pg.name}-${vp.w}x${vp.h}`
  const webmPath = path.join(OUT_DIR, `${base}.webm`)
  const mp4Name = `${base}.mp4`
  const mp4Path = path.join(OUT_DIR, mp4Name)
  await rename(tmpPath, webmPath)
  await rm(mp4Path, { force: true })
  await toMp4(webmPath, mp4Path)
  await rm(webmPath, { force: true }) // drop the intermediate webm
  console.log(`✓ ${pg.name} · ${vp.group} ${vp.w}x${vp.h} -> ${mp4Path}`)
  return mp4Name
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const produced = new Set()
  const viewports = VIEWPORTS.filter(
    (vp) => vp.w <= MAX_WIDTH && vp.w >= MIN_WIDTH,
  )
  const browser = await chromium.launch()
  try {
    for (const pg of PAGES) {
      for (const vp of viewports) {
        produced.add(await recordOne(browser, pg, vp))
      }
    }
  } finally {
    await browser.close()
  }
  // sweep stray intermediate .webm only (leave existing .mp4 from other runs)
  const stray = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.webm'))
  for (const f of stray) await rm(path.join(OUT_DIR, f), { force: true })
  console.log(
    `\nDone. ${PAGES.length * viewports.length} videos in ${OUT_DIR}/`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
