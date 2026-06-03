import { describe, it, expect } from 'vitest'
import en from './en.json'
import id from './id.json'
import zh from './zh.json'
import es from './es.json'

/**
 * Recursively collect all leaf key paths from a nested object.
 * E.g. { a: { b: 'x' } } → ['a.b']
 */
function collectKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return collectKeys(v as object, path)
    }
    return [path]
  })
}

const enKeys = collectKeys(en).sort()
const idKeys = collectKeys(id).sort()
const zhKeys = collectKeys(zh).sort()
const esKeys = collectKeys(es).sort()

describe('i18n key parity', () => {
  it('id.json has identical key structure to en.json', () => {
    expect(idKeys).toEqual(enKeys)
  })

  it('zh.json has identical key structure to en.json', () => {
    expect(zhKeys).toEqual(enKeys)
  })

  it('es.json has identical key structure to en.json', () => {
    expect(esKeys).toEqual(enKeys)
  })
})
