import type { ReactNode } from 'react'

/** KAI's own small icon set: 24 px, drawn with one rounded stroke. */
const paths = {
  bell: <path d="M9 20h6M5 17h14l-2-3V9a5 5 0 00-10 0v5l-2 3z" />,
  settings: <><path d="M9 4l1-2h4l1 2 2 1 2-.2 2 3-1.2 1.8v2.4L21 14l-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1.2-1.8V9.8L3 8l2-3 2 .2z"/><circle cx="12" cy="11" r="3"/></>,
  folder: <path d="M3 7V5h7l2 2h9v13H3z" />,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 6.8v.4"/></>,
  chat: <path d="M20 11a8 8 0 01-8 8H8l-5 3 1.5-6A8 8 0 1120 11z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  right: <path d="M9 6l6 6-6 6" />,
  left: <path d="M15 6l-6 6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  warning: <path d="M12 4.5l8.5 14.5h-17L12 4.5zM12 10v4M12 16.9v.1" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  sparkle: (
    <path
      fill="currentColor"
      strokeWidth="0.6"
      d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9L11 3.5zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"
    />
  ),
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="10" rx="3" />
      <path d="M6 11.5a6 6 0 0012 0M12 17.5V21" />
    </>
  ),
  home: <path d="M4 11l8-6.5 8 6.5M6.5 9.5v10h11v-10" />,
  people: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <circle cx="16.5" cy="8" r="2.5" />
      <path d="M16.3 14.3c2.2.2 3.8 1.6 4.2 4.2" />
    </>
  ),
  todo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.3l2.4 2.4 4.6-5" />
    </>
  ),
  link: (
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2.5" />
      <path d="M5 15V7a2 2 0 012-2h8" />
    </>
  ),
  doc: <path d="M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M9.5 12h5M9.5 15.5h5" />,
  share: <path d="M12 15V4M8 7.5L12 4l4 3.5M7 11.5H5.5V20h13v-8.5H17" />,
  pencil: <path d="M5 19l1-4L16.5 4.5l3 3L9 18l-4 1z" />,
  play: <path fill="currentColor" d="M8 5.5v13l11-6.5-11-6.5z" />,
  retry: <path d="M5 12a7 7 0 0112.5-4.3M19 5v3.5h-3.5M19 12a7 7 0 01-12.5 4.3M5 19v-3.5h3.5" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof paths

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
