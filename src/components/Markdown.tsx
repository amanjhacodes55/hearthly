import { Fragment, type ReactNode } from "react";

/**
 * Small, safe Markdown renderer → React elements (no dangerouslySetInnerHTML).
 * Supports headings, paragraphs, lists, code blocks, blockquotes, hr, **bold**, *italic*, `code`, [links](https://…).
 * Link targets are limited to http(s), mailto and relative URLs.
 */
function safeHref(h: string) {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(h.trim()) ? h.trim() : "#";
}

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s<)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    const t = m[0];
    if (m[1]) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(t.slice(2, -2), i)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(t.slice(1, -1), i)}</em>);
    else if (m[4]) {
      const mm = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      const href = safeHref(mm[2]);
      out.push(
        <a key={k} href={href} rel="noopener noreferrer nofollow" target={href.startsWith("http") ? "_blank" : undefined}>
          {mm[1]}
        </a>,
      );
    } else if (m[5])
      out.push(
        <a key={k} href={t} rel="noopener noreferrer nofollow" target="_blank">
          {t}
        </a>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={k++}>
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const Tag = (["h1", "h2", "h3"] as const)[h[1].length - 1];
      blocks.push(<Tag key={k++}>{inline(h[2], k)}</Tag>);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={k++} />);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""), k)}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++}>{inline(buf.join(" "), k)}</blockquote>);
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]); // never stall on an unexpected line
    blocks.push(
      <p key={k++}>
        {buf.map((l, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(l, k * 100 + j)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className={className ?? "prose-cc"}>{blocks}</div>;
}
