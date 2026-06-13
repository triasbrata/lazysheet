interface MockCursorProps {
  x: number
  y: number
  clicking?: boolean
}

export function MockCursor({ x, y, clicking = false }: MockCursorProps): JSX.Element {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-40 transition-all duration-500 ease-out"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {clicking && (
        <span className="absolute -left-1 -top-1 size-5 rounded-full bg-[#1a1a1a]/20 animate-ping" />
      )}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M5 3l14 8-6 1.5L9 19 5 3z"
          fill="#1a1a1a"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
