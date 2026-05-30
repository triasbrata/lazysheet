import { describe, it, expect } from 'vitest'
import { detectOSFromUA } from './os'

describe('detectOSFromUA', () => {
  it('detects macOS from a real macOS Safari UA', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15'
    expect(detectOSFromUA(ua)).toBe('macOS')
  })

  it('detects macOS from a macOS Chrome UA', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    expect(detectOSFromUA(ua)).toBe('macOS')
  })

  it('detects Windows from a Windows Chrome UA', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    expect(detectOSFromUA(ua)).toBe('Windows')
  })

  it('detects Windows from a Windows Edge UA', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
    expect(detectOSFromUA(ua)).toBe('Windows')
  })

  it('detects Linux from a Linux X11 Firefox UA', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0'
    expect(detectOSFromUA(ua)).toBe('Linux')
  })

  it('detects Linux from a Ubuntu Chrome UA', () => {
    const ua =
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0'
    expect(detectOSFromUA(ua)).toBe('Linux')
  })

  it('returns unknown for Android Chrome UA (mobile, no desktop build)', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36'
    expect(detectOSFromUA(ua)).toBe('unknown')
  })

  it('returns unknown for iPhone Safari UA (mobile, no desktop build)', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'
    expect(detectOSFromUA(ua)).toBe('unknown')
  })

  it('returns unknown for iPad Safari UA', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'
    expect(detectOSFromUA(ua)).toBe('unknown')
  })

  it('returns unknown for empty string', () => {
    expect(detectOSFromUA('')).toBe('unknown')
  })

  it('returns unknown for undefined', () => {
    expect(detectOSFromUA(undefined)).toBe('unknown')
  })

  it('returns unknown for null', () => {
    expect(detectOSFromUA(null)).toBe('unknown')
  })

  it('returns unknown for a random bot string', () => {
    const ua =
      'Googlebot/2.1 (+http://www.google.com/bot.html)'
    expect(detectOSFromUA(ua)).toBe('unknown')
  })

  it('returns unknown for a Curl UA', () => {
    const ua = 'curl/8.6.0'
    expect(detectOSFromUA(ua)).toBe('unknown')
  })
})
