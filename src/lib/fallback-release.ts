import {
  classifyAsset,
  RELEASES_PAGE_URL,
  type ReleaseAsset,
  type ReleaseData,
} from './releases'

// Last-known-good release snapshot. Used ONLY when the live GitHub API fetch
// fails or returns nothing (Workers share egress IPs -> anon rate limit, or
// GitHub is down). Guarantees the download page always renders direct file
// links so users never get bounced to the GitHub releases page.
//
// UPDATE THIS on every new release: bump FALLBACK_TAG and list the published
// asset filenames. Classification is reused from classifyAsset() so the labels
// and badges stay consistent with live data — no duplicated logic here.
const FALLBACK_TAG = 'v0.4.0'

const FALLBACK_ASSET_NAMES = [
  'LazySheet_0.4.0_aarch64.dmg',
  'LazySheet_0.4.0_amd64.AppImage',
  'LazySheet_0.4.0_amd64.deb',
  'LazySheet_0.4.0_x64-setup.exe',
  'LazySheet_0.4.0_x64_en-US.msi',
]

function buildAsset(name: string): ReleaseAsset | null {
  const c = classifyAsset(name)
  if (!c) return null
  return {
    name,
    url: `${RELEASES_PAGE_URL}/download/${FALLBACK_TAG}/${name}`,
    size: 0,
    ...c,
  }
}

export const FALLBACK_RELEASE: ReleaseData = {
  tag: FALLBACK_TAG,
  name: FALLBACK_TAG,
  htmlUrl: `${RELEASES_PAGE_URL}/tag/${FALLBACK_TAG}`,
  publishedAt: '',
  assets: FALLBACK_ASSET_NAMES.map(buildAsset).filter(
    (a): a is ReleaseAsset => a !== null,
  ),
}
