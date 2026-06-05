import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('concatenates two class strings with a space', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('merges conflicting tailwind classes (last wins)', () => {
    // twMerge ensures the latter padding wins
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('ignores falsy values (undefined, null, false, 0, empty string)', () => {
    expect(cn('text-red-500', undefined, false, null, '', 'font-bold')).toBe(
      'text-red-500 font-bold',
    )
  })

  it('handles conditional class arrays', () => {
    const active = true
    const disabled = false
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe('base active')
  })

  it('handles object syntax from clsx', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('returns empty string when all inputs are falsy', () => {
    expect(cn(undefined, false, null)).toBe('')
  })

  it('handles no arguments', () => {
    expect(cn()).toBe('')
  })

  it('merges conflicting text colors (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles array inputs from clsx', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c')
  })
})
