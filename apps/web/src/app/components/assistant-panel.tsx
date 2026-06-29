'use client';

import { useState, useRef, useEffect } from 'react';

// Baseline AI mark: a monochrome, boxy robot head (the 🤖 emoji) in the Baseline
// logo's line style — currentColor panel outlines (theme-adaptive) with solid eyes
// and a friendly smile, echoing the logo's outlined squircle + filled dots.
export function BaselineAIMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={`${className} text-neutral-900 dark:text-white`} viewBox="2.2 0.3 23.6 23.6" fill="none" aria-hidden="true">
      {/* antenna */}
      <path d="M14 4.8V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="2.1" r="1" fill="currentColor" />
      {/* ears */}
      <rect x="2" y="11.2" width="2.4" height="4.6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="23.6" y="11.2" width="2.4" height="4.6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      {/* head */}
      <rect x="4.6" y="4.8" width="18.8" height="17.4" rx="3.2" stroke="currentColor" strokeWidth="1.6" />
      {/* happy anime eyes (^ ^) */}
      <path d="M9.2 12.9 L10.6 11.4 L12 12.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 12.9 L17.4 11.4 L18.8 12.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* happy smile */}
      <path
        d="M10.6 16.9 C 12.1 18.9, 15.9 18.9, 17.4 16.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        shapeRendering="geometricPrecision"
      />
    </svg>
  );
}

// NOTE: This is a UI preview of the planned Baseline assistant. Replies are scripted
// (no model wired up yet) — but the "Create" buttons on a suggestion really do create
// the goal via the existing API, so the suggest→act flow is genuine. When wired for
// real, the conversation would be powered by Claude with tool access to the user's
// metrics + goals.

interface Suggestion {
  label: string; // the goal text (also the payload title)
}
interface Msg {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  suggestions?: Suggestion[];
}

const SEED: Msg[] = [
  {
    id: 1,
    role: 'assistant',
    text: "Hi — I'm Baseline AI. I can set up goals, surface trends, and keep your streaks alive. Tell me what you want to focus on, or pick a starter below.",
  },
];

const STARTERS = ['Help me code more consistently', 'Suggest a weekly goal', 'Am I reviewing enough?'];

// Scripted stand-in for the model — loosely keyed to the message.
function demoReply(input: string, id: number): Msg {
  const t = input.toLowerCase();
  if (t.includes('cod') || t.includes('ship') || t.includes('build') || t.includes('feature')) {
    return {
      id,
      role: 'assistant',
      text: 'Nice — breaking a big push into clear, finishable goals helps. Want to add one of these?',
      suggestions: [{ label: 'Ship the next feature' }, { label: 'Clear my PR backlog' }],
    };
  }
  if (t.includes('review') || t.includes('pr')) {
    return {
      id,
      role: 'assistant',
      text: 'Reviewing keeps things moving for everyone. A concrete goal:',
      suggestions: [{ label: 'Review my teammates’ open PRs' }],
    };
  }
  if (t.includes('learn') || t.includes('read') || t.includes('study')) {
    return {
      id,
      role: 'assistant',
      text: 'Learning goals work best when they’re finishable. For example:',
      suggestions: [{ label: 'Finish the course I started' }, { label: 'Read one technical book' }],
    };
  }
  return {
    id,
    role: 'assistant',
    text: "Once connected, I'll suggest goals from your recent activity and help you track them. For now, a starting point:",
    suggestions: [{ label: 'Finish what I started this week' }],
  };
}

interface AssistantPanelProps {
  onCreateGoal: (payload: Record<string, unknown>) => Promise<void>;
  onClose?: () => void;
}

export function AssistantPanel({ onCreateGoal, onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [created, setCreated] = useState<Record<string, boolean>>({});
  const idRef = useRef(100);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typing]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    setMessages((m) => [...m, { id: idRef.current++, role: 'user', text: trimmed }]);
    setInput('');
    setTyping(true);
    const replyId = idRef.current++;
    window.setTimeout(() => {
      setMessages((m) => [...m, demoReply(trimmed, replyId)]);
      setTyping(false);
    }, 650);
  }

  async function create(s: Suggestion) {
    if (created[s.label]) return;
    await onCreateGoal({ title: s.label });
    setCreated((c) => ({ ...c, [s.label]: true }));
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex-shrink-0">
        <BaselineAIMark className="w-7 h-7 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">Baseline AI</p>
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-tight">Goal setting &amp; insights</p>
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Preview</span>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Collapse assistant"
            className="ml-0.5 w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${m.role === 'user' ? '' : 'w-full'}`}>
              <div
                className={`text-sm leading-relaxed px-3 py-2 rounded-2xl ${
                  m.role === 'user'
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-br-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
              {m.suggestions && (
                <div className="mt-2 space-y-2">
                  {m.suggestions.map((s) => {
                    const done = created[s.label];
                    return (
                      <div
                        key={s.label}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/[0.06]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{s.label}</p>
                        </div>
                        <button
                          onClick={() => create(s)}
                          disabled={done}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors ${
                            done
                              ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 cursor-default'
                              : 'bg-emerald-600 text-white hover:bg-emerald-500'
                          }`}
                        >
                          {done ? '✓ Added' : 'Create'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl rounded-bl-sm px-3 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce [animation-delay:-0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce [animation-delay:-0.1s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Starter chips (only before the first user message) */}
      {messages.every((m) => m.role !== 'user') && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 p-3 border-t border-neutral-100 dark:border-neutral-800 flex-shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Baseline anything…"
          className="flex-1 text-sm px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors flex-shrink-0"
          aria-label="Send"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
