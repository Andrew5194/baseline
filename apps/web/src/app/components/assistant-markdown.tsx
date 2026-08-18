import React from 'react';

/**
 * The small subset of Markdown the assistant actually emits: paragraphs, bullet and
 * numbered lists, bold, italic and inline code.
 *
 * Deliberately builds React elements rather than HTML — model output is untrusted,
 * and there is no dangerouslySetInnerHTML here for it to exploit. Anything this does
 * not recognise falls through as literal text, so an unsupported construct renders
 * plainly instead of disappearing.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const t = m[0];
    if (t.startsWith('**')) {
      out.push(<strong key={`${key}-b${i++}`} className="font-semibold">{t.slice(2, -2)}</strong>);
    } else if (t.startsWith('`')) {
      out.push(
        <code key={`${key}-c${i++}`} className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[0.85em]">
          {t.slice(1, -1)}
        </code>,
      );
    } else {
      out.push(<em key={`${key}-i${i++}`}>{t.slice(1, -1)}</em>);
    }
    last = at + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*(\d+)[.)]\s+(.*)$/;

export function AssistantMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];

  // Consecutive list lines become one list; everything else accumulates into a
  // paragraph until a blank line or a list closes it.
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (!para.length) return;
    const key = `p${blocks.length}`;
    blocks.push(
      <p key={key} className="whitespace-pre-wrap">
        {para.map((l, i) => (
          <React.Fragment key={`${key}-l${i}`}>
            {i > 0 && <br />}
            {inline(l, `${key}-l${i}`)}
          </React.Fragment>
        ))}
      </p>,
    );
    para = [];
  };

  const flushList = () => {
    if (!list) return;
    const key = `l${blocks.length}`;
    const items = list.items.map((it, i) => <li key={`${key}-i${i}`}>{inline(it, `${key}-i${i}`)}</li>);
    blocks.push(
      list.ordered
        ? <ol key={key} className="list-decimal pl-5 space-y-1">{items}</ol>
        : <ul key={key} className="list-disc pl-5 space-y-1">{items}</ul>,
    );
    list = null;
  };

  for (const line of lines) {
    const bullet = BULLET.exec(line);
    const numbered = NUMBER.exec(line);

    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((numbered ? numbered[2] : bullet![1]).trim());
      continue;
    }

    flushList();
    if (!line.trim()) flushPara();
    else para.push(line);
  }
  flushPara();
  flushList();

  return <div className="space-y-2">{blocks}</div>;
}
