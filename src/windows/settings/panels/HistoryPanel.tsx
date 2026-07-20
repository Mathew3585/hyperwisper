import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Trash2, Check, Inbox, Pencil } from "lucide-react";
import { api, type HistoryEntry } from "@/lib/ipc";
import { events } from "@/lib/events";
import { PanelHeader } from "./common";

export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    refresh();

    const unsubs: Array<() => void> = [];
    events.onHistoryNew(() => {
      refresh();
    }).then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, []);

  async function refresh() {
    try {
      const list = await api.getHistory();
      setEntries(list);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCopy(entry: HistoryEntry) {
    try {
      await navigator.clipboard.writeText(entry.text);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(entry: HistoryEntry) {
    try {
      await api.deleteHistoryEntry(entry.id);
      await refresh();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleClear() {
    if (!confirm("Effacer tout l'historique ? Cette action est irréversible.")) return;
    try {
      await api.clearHistory();
      await refresh();
    } catch (err) {
      console.error(err);
    }
  }

  function startEdit(entry: HistoryEntry) {
    setEditingId(entry.id);
    setEditText(entry.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function saveEdit(entry: HistoryEntry) {
    // Local-only edit for now — replace text in the visible list.
    // Persisted edit lands in Phase 6 when settings/history get their own
    // mutation commands (right now history.rs is append-only by design).
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, text: editText, wordCount: editText.split(/\s+/).filter(Boolean).length } : e))
    );
    setEditingId(null);
    setEditText("");
  }

  const totalWords = entries.reduce((sum, e) => sum + e.wordCount, 0);

  return (
    <div className="space-y-8">
      <PanelHeader
        title="Historique"
        description="Toutes tes dictées sont stockées localement. Clique sur une entrée pour la recopier."
      />

      {entries.length > 0 && (
        <div className="flex items-center justify-between text-[11.5px] text-muted">
          <div className="flex items-center gap-4">
            <span>
              <span className="text-app font-medium tabular-nums">{entries.length}</span> dictée{entries.length > 1 ? "s" : ""}
            </span>
            <span>
              <span className="text-app font-medium tabular-nums">{totalWords}</span> mot{totalWords > 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={handleClear}
            className="text-[11.5px] text-muted hover:text-danger transition-colors"
            style={{ color: "hsl(var(--ember))" }}
          >
            Tout effacer
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
                transition={{ duration: 0.18 }}
                className="group rounded-lg border border-app bg-elevated px-4 py-3 hover:bg-hover transition-colors"
              >
                {editingId === entry.id ? (
                  <div className="space-y-2.5">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                      rows={Math.min(6, Math.max(2, editText.split("\n").length))}
                      className="w-full px-3 py-2 rounded-md border border-app bg-app text-[13.5px] text-app leading-relaxed font-sans focus:outline-none focus:border-sand transition-colors resize-none"
                      style={{ caretColor: "hsl(var(--sand))" }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") cancelEdit();
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(entry);
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-mono text-faint">
                        ⌘ + ↵ pour sauver · Esc pour annuler
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={cancelEdit}
                          className="text-[12px] font-medium px-2.5 py-1 rounded-md text-muted hover:bg-hover transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => saveEdit(entry)}
                          className="text-[12px] font-medium px-2.5 py-1 rounded-md transition-all duration-150 active:scale-[0.97]"
                          style={{
                            background: "hsl(var(--sand))",
                            color: "hsl(var(--accent-fg))",
                          }}
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] text-app leading-relaxed">{entry.text}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-[10.5px] font-mono text-faint tabular-nums">
                        <span>{formatTime(entry.timestamp)}</span>
                        <span>·</span>
                        <span>{entry.wordCount} mot{entry.wordCount > 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{(entry.durationMs / 1000).toFixed(1)}s audio</span>
                        <span>·</span>
                        <span className="truncate">{entry.model}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton
                        onClick={() => handleCopy(entry)}
                        label="Copier"
                        active={copiedId === entry.id}
                      >
                        {copiedId === entry.id ? (
                          <Check className="h-3 w-3 text-moss" strokeWidth={3} />
                        ) : (
                          <Copy className="h-3 w-3" strokeWidth={2.2} />
                        )}
                      </IconButton>
                      <IconButton onClick={() => startEdit(entry)} label="Modifier">
                        <Pencil className="h-3 w-3" strokeWidth={2.2} />
                      </IconButton>
                      <IconButton onClick={() => handleDelete(entry)} label="Supprimer" danger>
                        <Trash2 className="h-3 w-3" strokeWidth={2.2} />
                      </IconButton>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function IconButton({
  onClick,
  label,
  children,
  active,
  danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  const hoverClasses = danger
    ? "hover:bg-[hsl(var(--ember)/0.15)] hover:text-ember"
    : active
    ? "hover:bg-hover" // active text-moss stays via base color
    : "hover:bg-hover hover:text-app";
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center h-6 w-6 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))] ${
        active ? "text-moss" : "text-faint"
      } ${hoverClasses}`}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-app px-6 py-16 text-center space-y-3">
      <div className="flex justify-center">
        <Inbox className="h-8 w-8 text-faint" strokeWidth={1.6} />
      </div>
      <div className="text-[13px] text-soft font-medium">Aucune dictée pour le moment</div>
      <div className="text-[12px] text-muted max-w-[40ch] mx-auto leading-relaxed">
        Appuie sur <span className="font-mono text-app">Ctrl + Space</span> n'importe où dans Windows et parle. Tes dictées apparaîtront ici.
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
