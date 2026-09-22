import { useEffect, useState, useRef } from "react";
import { BeatmapRecord } from "../types";
import { ALL_TAGS } from "../constants";
import { voteBeatmapTags, getUserBeatmapVotes } from "../api";

interface Props {
  beatmap: BeatmapRecord;
  onClose: () => void;
}

export default function TagVoteModal({ beatmap, onClose }: Props) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [previouslyVoted, setPreviouslyVoted] = useState<Set<string>>(new Set());
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingVotes, setLoadingVotes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    getUserBeatmapVotes(beatmap.beatmap_id)
      .then(res => {
        if (!isMounted) return;
        const voted = new Set(res.voted_tags ?? []);
        setPreviouslyVoted(voted);
        setSelectedTags(new Set(voted));
        setTagCounts(res.tag_counts ?? {});
      })
      .catch(() => {})
      .finally(() => { if (isMounted) setLoadingVotes(false); });
    return () => { isMounted = false; };
  }, [beatmap.beatmap_id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  function toggleTag(tag: string) {
    if (submitting) return;
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  async function handleConfirm() {
    if (selectedTags.size === 0) { setError("Select at least 1 tag."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await voteBeatmapTags(beatmap.beatmap_id, Array.from(selectedTags));
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit. Make sure you're logged in.");
      setSubmitting(false);
    }
  }

  const filteredTags = ALL_TAGS.filter(t => t.toLowerCase().includes(search.toLowerCase().trim()));
  const title = beatmap.title ?? `Beatmap #${beatmap.beatmap_id}`;

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div style={modalStyle} ref={modalRef}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <h3 style={titleStyle}>Help find the right tags</h3>
            <p style={subtitleStyle}>Vote tags that match this beatmap.</p>
          </div>
          <button onClick={onClose} disabled={submitting} style={closeBtnStyle} aria-label="Close">✕</button>
        </div>

        {/* Beatmap info */}
        <div style={beatmapInfoStyle}>
          <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, color: "#fff", fontSize: 13,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {beatmap.artist && <span>by {beatmap.artist} </span>}
            {beatmap.version && <span style={{ color: "var(--pink)" }}>[{beatmap.version}] </span>}
            {beatmap.difficulty_rating != null && (
              <span style={{ color: "#ffd700", marginLeft: 4 }}>★ {beatmap.difficulty_rating.toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Search tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="osu-input"
            style={{ fontSize: 12, padding: "7px 28px 7px 12px" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={clearSearchBtnStyle}>✕</button>
          )}
        </div>

        {/* Tag grid */}
        <div style={tagScrollStyle}>
          {loadingVotes ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
              Loading votes…
            </div>
          ) : filteredTags.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted2)", fontSize: 12 }}>
              No tags matching "{search}".
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {filteredTags.map(tag => {
                const isSelected = selectedTags.has(tag);
                const wasVoted = previouslyVoted.has(tag);
                const voteCount = tagCounts[tag] || 0;
                return (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}
                    style={tagItemStyle(isSelected, voteCount > 0)}>
                    {voteCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#ffd700" }}>| {voteCount} |</span>
                    )}
                    <span>{isSelected ? "✓ " : voteCount > 0 ? "" : "+ "}{tag}</span>
                    {wasVoted && (
                      <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3,
                        background: "rgba(184,233,148,0.15)", color: "#b8e994",
                        border: "1px solid rgba(184,233,148,0.35)" }}>
                        Voted
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selection info */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            Selected: <strong style={{ color: "var(--pink)" }}>{selectedTags.size}</strong>
          </span>
          {selectedTags.size > 0 && (
            <button onClick={() => setSelectedTags(new Set())}
              style={{ background: "transparent", border: "none", color: "var(--muted2)", fontSize: 11, cursor: "pointer" }}>
              Reset
            </button>
          )}
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={submitting} className="btn-ghost"
            style={{ fontSize: 12, padding: "7px 16px" }}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm}
            disabled={submitting || selectedTags.size === 0}
            className="btn-pink"
            style={{ fontSize: 12, padding: "7px 18px",
              opacity: submitting || selectedTags.size === 0 ? 0.45 : 1,
              cursor: submitting || selectedTags.size === 0 ? "not-allowed" : "pointer" }}>
            {submitting ? "Submitting…" : `Confirm (${selectedTags.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 2000,
  background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const modalStyle: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: 12, padding: 20, width: "100%", maxWidth: 520,
  boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
  display: "flex", flexDirection: "column", maxHeight: "90vh",
};
const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-d)", fontSize: 16, fontWeight: 800, color: "#fff", margin: 0,
};
const subtitleStyle: React.CSSProperties = {
  fontSize: 12, color: "var(--muted)", marginTop: 3,
};
const closeBtnStyle: React.CSSProperties = {
  background: "transparent", border: "none", color: "var(--muted)",
  fontSize: 16, cursor: "pointer", padding: 4, lineHeight: 1,
};
const beatmapInfoStyle: React.CSSProperties = {
  background: "var(--card2)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 12px", marginBottom: 12,
};
const clearSearchBtnStyle: React.CSSProperties = {
  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
  background: "transparent", border: "none", color: "var(--muted)",
  fontSize: 11, cursor: "pointer",
};
const tagScrollStyle: React.CSSProperties = {
  maxHeight: 250, overflowY: "auto",
  background: "var(--card2)", border: "1px solid var(--border)",
  borderRadius: 8, padding: 10,
  scrollbarWidth: "thin", scrollbarColor: "rgba(255,102,170,0.25) transparent",
};
function tagItemStyle(active: boolean, hasVotes: boolean): React.CSSProperties {
  return {
    padding: "4px 10px", borderRadius: 6, fontSize: 11,
    fontFamily: "var(--font-m)", fontWeight: active ? 600 : 400,
    cursor: "pointer", border: "1px solid",
    background: active ? "rgba(255,102,170,0.18)" : hasVotes ? "rgba(255,215,0,0.05)" : "rgba(255,255,255,0.03)",
    color: active ? "var(--pink)" : hasVotes ? "#fff" : "var(--muted)",
    borderColor: active ? "var(--pink)" : hasVotes ? "rgba(255,215,0,0.35)" : "var(--border)",
    transition: "all 0.12s ease",
    display: "inline-flex", alignItems: "center", gap: 5,
  };
}
const errorStyle: React.CSSProperties = {
  marginTop: 10, padding: "8px 12px", background: "#1e0a10",
  border: "1px solid #7f1d1d", borderRadius: 6, color: "#fca5a5", fontSize: 12,
};
