/**
 * Tiny, safe markdown subset for دستیار گرم answers: paragraphs, line breaks,
 * **bold**, "- " / "1. " lists, and links to geram.co only. It returns plain
 * data that the widget renders as React elements, so raw HTML in the model's
 * text is never interpreted (it shows as literal text).
 */

export type Inline = { t: "text"; v: string } | { t: "bold"; v: string } | { t: "link"; v: string; href: string };
export type Block =
  | { t: "p"; lines: Inline[][] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] };

/** Only same-site links: relative paths or https://geram.co / *.geram.co. Everything else becomes text. */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^\/(?!\/)[^\s]*$/.test(href)) return href;
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return null;
    if (u.hostname === "geram.co" || u.hostname.endsWith(".geram.co")) return u.toString();
  } catch {
    /* not a URL */
  }
  return null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+?)\*\*|__([^_]+?)__|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (v: string) => {
    if (!v) return;
    const prev = out[out.length - 1];
    if (prev && prev.t === "text") prev.v += v;
    else out.push({ t: "text", v });
  };
  while ((m = re.exec(src))) {
    push(src.slice(last, m.index));
    if (m[1] ?? m[2]) out.push({ t: "bold", v: (m[1] ?? m[2]) as string });
    else {
      const href = safeHref(m[4]);
      if (href) out.push({ t: "link", v: m[3], href });
      else push(m[3]);
    }
    last = re.lastIndex;
  }
  push(src.slice(last));
  // Stray markers the model left unbalanced should not show up as asterisks.
  for (const n of out) if (n.t === "text") n.v = n.v.replace(/\*\*/g, "").replace(/`/g, "");
  return out.filter((n) => n.v !== "");
}

const UL = /^\s*[-*•]\s+(.*)$/;
const OL = /^\s*([0-9۰-۹]+)[.)]\s+(.*)$/;

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };
  for (const rawLine of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/^\s*#{1,6}\s+(.*)$/, "**$1**").replace(/^\s*>\s?/, "");
    if (!line.trim() || /^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flush();
      continue;
    }
    const ul = UL.exec(line);
    const ol = ul ? null : OL.exec(line);
    if (ul) {
      if (!cur || cur.t !== "ul") {
        flush();
        cur = { t: "ul", items: [] };
      }
      (cur as Extract<Block, { t: "ul" }>).items.push(parseInline(ul[1]));
    } else if (ol) {
      if (!cur || cur.t !== "ol") {
        flush();
        cur = { t: "ol", items: [] };
      }
      (cur as Extract<Block, { t: "ol" }>).items.push(parseInline(ol[2]));
    } else {
      if (!cur || cur.t !== "p") {
        flush();
        cur = { t: "p", lines: [] };
      }
      (cur as Extract<Block, { t: "p" }>).lines.push(parseInline(line.trim()));
    }
  }
  flush();
  return blocks;
}
