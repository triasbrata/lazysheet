import { useEffect, useRef, useState } from 'react'
import { CopyIcon, CheckIcon } from '#/components/site/icons'

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const onCopy = () => {
    navigator.clipboard
      .writeText(command)
      .then(() => {
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <div className="group flex items-center justify-between gap-4 rounded-lg border border-surface-container-highest bg-[#0f172a] px-4 py-3 text-left">
      <code className="overflow-x-auto whitespace-pre font-mono text-sm text-[#e2e8f0]">
        {command}
      </code>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="flex shrink-0 items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs font-medium text-white opacity-0 transition-all focus-visible:opacity-100 group-hover:opacity-100 hover:bg-white/20"
      >
        {copied ? (
          <CheckIcon className="text-[14px] text-[var(--st-green)]" />
        ) : (
          <CopyIcon className="text-[14px]" />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
