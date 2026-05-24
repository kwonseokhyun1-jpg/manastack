import { useId } from 'react'

export function ManaIcon({ className = 'h-5 w-5' }: { className?: string }) {
  const gradientId = useId()

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      role="presentation"
    >
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#b8e4ff" />
          <stop offset="45%" stopColor="#0e68ab" />
          <stop offset="100%" stopColor="#042a4a" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill={`url(#${gradientId})`} />
      <ellipse cx="9" cy="8.5" rx="3.2" ry="2" fill="#ffffff" opacity="0.5" />
      <circle cx="15.5" cy="15" r="1.2" fill="#ffffff" opacity="0.25" />
    </svg>
  )
}
