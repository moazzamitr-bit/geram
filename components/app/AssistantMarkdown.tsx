import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/assistant/markdown";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) =>
        n.t === "bold" ? (
          <strong key={i} className="font-bold">{n.v}</strong>
        ) : n.t === "link" ? (
          <a key={i} href={n.href} className="font-bold underline underline-offset-4">{n.v}</a>
        ) : (
          <Fragment key={i}>{n.v}</Fragment>
        )
      )}
    </>
  );
}

/** Renders the safe markdown subset as React elements (no innerHTML). */
export function AssistantMarkdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) =>
        b.t === "p" ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                <Inlines nodes={l} />
              </Fragment>
            ))}
          </p>
        ) : b.t === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pr-5">
            {b.items.map((it, j) => <li key={j}><Inlines nodes={it} /></li>)}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1 pr-5">
            {b.items.map((it, j) => <li key={j}><Inlines nodes={it} /></li>)}
          </ol>
        )
      )}
    </div>
  );
}
