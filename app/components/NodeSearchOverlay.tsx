import React from "react";
import type { ChatNode } from "@/types/chat";
import { cn } from "@/app/lib/utils";

type SearchResult = {
  node: ChatNode;
  score: number;
  matchType: "substring" | "subsequence";
};

type ScoreResult = {
  score: number;
  matchType: SearchResult["matchType"];
};

function normalizeText(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getNodeSearchText(node: ChatNode): string {
  const data = node.data;
  const content = typeof data?.content === "string" ? data.content : "";
  const label = typeof data?.label === "string" ? data.label : "";
  const role = typeof data?.role === "string" ? data.role : "";
  return [label, role, content].filter(Boolean).join(" ").trim();
}

// Lower score = better match.
function scoreMatch(queryRaw: string, textRaw: string): ScoreResult | null {
  const query = normalizeText(queryRaw);
  const text = normalizeText(textRaw);
  if (!query) return null;
  if (!text) return null;

  const idx = text.indexOf(query);
  if (idx >= 0) {
    // Prefer earlier occurrences, and smaller length difference.
    const lengthPenalty = Math.min(
      2000,
      Math.max(0, text.length - query.length)
    );
    return { score: idx * 10 + lengthPenalty, matchType: "substring" };
  }

  // Fallback: subsequence match (characters appear in order).
  let ti = 0;
  let gaps = 0;
  for (let qi = 0; qi < query.length; qi++) {
    const ch = query[qi];
    const foundAt = text.indexOf(ch, ti);
    if (foundAt === -1) return null;
    gaps += Math.max(0, foundAt - ti);
    ti = foundAt + 1;
  }
  // Prefer tighter subsequences.
  return {
    score: 2000 + gaps * 5 + Math.max(0, text.length - query.length),
    matchType: "subsequence",
  };
}

function truncateMiddle(s: string, max: number): string {
  const str = (s || "").trim();
  if (str.length <= max) return str;
  const head = Math.max(0, Math.floor(max * 0.6));
  const tail = Math.max(0, max - head - 1);
  return `${str.slice(0, head)}…${str.slice(Math.max(0, str.length - tail))}`;
}

function highlightSubstring(text: string, query: string): React.ReactNode {
  const q = normalizeText(query);
  if (!q) return text;

  // Highlight only when we have a real substring in the original text (case-insensitive).
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="rounded bg-yellow-200/70 dark:bg-yellow-500/30 px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}

export default function NodeSearchOverlay({
  isOpen,
  nodes,
  onClose,
  onSelectNode,
}: {
  isOpen: boolean;
  nodes: ChatNode[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const results = React.useMemo(() => {
    const q = normalizeText(query);
    if (!q) return [] as SearchResult[];

    const ranked: SearchResult[] = [];
    for (const node of nodes) {
      const text = getNodeSearchText(node);
      const scored = scoreMatch(q, text);
      if (!scored) continue;
      ranked.push({ node, score: scored.score, matchType: scored.matchType });
    }
    ranked.sort((a, b) => a.score - b.score);
    return ranked.slice(0, 12);
  }, [nodes, query]);

  const safeSelectedIndex =
    results.length === 0
      ? -1
      : Math.min(Math.max(selectedIndex, 0), results.length - 1);
  const selected = safeSelectedIndex >= 0 ? results[safeSelectedIndex] : null;

  React.useEffect(() => {
    if (!isOpen) return;
    // Reset query/selection each time we open (Spotlight-like).
    setQuery("");
    setSelectedIndex(0);
    // Focus input (external system: DOM focus).
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((i) => (i + 1) % results.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((i) => (i - 1 + results.length) % results.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!selected) return;
      onSelectNode(selected.node.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm pt-20"
      onMouseDown={(e) => {
        // Click outside closes, click inside doesn’t.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(720px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-gray-200/70 dark:border-zinc-800/70 bg-white/90 dark:bg-zinc-950/90 shadow-2xl">
        <div className="px-4 py-3 border-b border-gray-200/70 dark:border-zinc-800/70">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search nodes…"
            className="w-full bg-transparent outline-none text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500"
          />
          <div className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
            ↑/↓ to navigate, Enter to focus, Esc to close
          </div>
        </div>

        <div className="max-h-[min(60vh,520px)] overflow-y-auto">
          {query.trim() !== "" && results.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500 dark:text-zinc-500">
              No matches.
            </div>
          )}

          {results.map((r, idx) => {
            const data = r.node.data;
            const role =
              data?.role === "user"
                ? "You"
                : data?.role === "assistant"
                ? "Assistant"
                : "Node";
            const content =
              typeof data?.content === "string" ? data.content : "";
            const label = typeof data?.label === "string" ? data.label : "";
            const title = label || role;
            const isActive = idx === safeSelectedIndex;

            return (
              <button
                type="button"
                key={r.node.id}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-gray-100 dark:border-zinc-900/60 transition-colors",
                  isActive
                    ? "bg-blue-50/80 dark:bg-blue-950/30"
                    : "hover:bg-gray-50/80 dark:hover:bg-zinc-900/40"
                )}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => onSelectNode(r.node.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {title}
                  </div>
                  <div className="text-[11px] text-gray-400 dark:text-zinc-500 font-mono">
                    {r.node.id}
                  </div>
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-zinc-300 overflow-hidden">
                  {r.matchType === "substring"
                    ? highlightSubstring(
                        truncateMiddle(
                          content || getNodeSearchText(r.node),
                          180
                        ),
                        query
                      )
                    : truncateMiddle(content || getNodeSearchText(r.node), 180)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
