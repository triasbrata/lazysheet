import { useEffect, useState } from 'react'
import { detectClientOSArch, type OS, type Arch } from '#/lib/os'

export function useClientOSArch(initial: { os: OS; arch: Arch | null }): { os: OS; arch: Arch | null } {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    let cancelled = false
    detectClientOSArch().then((detected) => {
      if (cancelled) return
      // only update if we actually learned something better
      setValue((prev) => {
        const os = detected.os !== 'unknown' ? detected.os : prev.os
        const arch = detected.arch ?? prev.arch
        if (os === prev.os && arch === prev.arch) return prev
        return { os, arch }
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  return value
}
