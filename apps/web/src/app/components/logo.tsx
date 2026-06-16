// Baseline mark: an outlined squircle with a progress line + dots. Monochrome and
// theme-adaptive — dark in light mode, white in dark mode (via currentColor).
// Single source of truth — used in the sidebar, auth pages, etc.
export function Logo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      className={`${className} text-neutral-900 dark:text-white`}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="24" height="24" rx="6.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 20h13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M6.5 20 L11 14 L15 16 L20.5 8.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="14" r="1.45" fill="currentColor" />
      <circle cx="15" cy="16" r="1.45" fill="currentColor" />
      <circle cx="20.5" cy="8.5" r="1.6" fill="currentColor" />
    </svg>
  );
}
