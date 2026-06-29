'use client';

// The static waveform (two beats) when running, a flat line when paused.
const BEATS = 'M0 12 L6 12 L8 9.5 L10 12 L13 12 L15 3 L17 21 L19 12 L24 12 L30 12 L32 9.5 L34 12 L37 12 L39 3 L41 21 L43 12 L48 12';
const FLAT = 'M0 12 H48';

// A heartbeat trace: the waveform stays put and a bright "trace light" sweeps along
// it (EKG-monitor style). When paused, the waveform flattens but the light keeps
// sweeping. The faint full path sits under the bright moving dash.
export function Heartbeat({ running }: { running: boolean }) {
  const d = running ? BEATS : FLAT;
  return (
    <svg viewBox="0 0 48 24" className="w-12 h-6 flex-shrink-0 text-emerald-500" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray="16 84"
        className="animate-ekg-trace"
      />
    </svg>
  );
}
