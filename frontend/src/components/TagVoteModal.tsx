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

  // Load existing votes & tag counts on mount
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
      .catch(() => {
        // Not logged in or error loading votes — still allow selection
      })
      .finally(() => {
        if (isMounted) setLoadingVotes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [beatmap.beatmap_id]);

  // Handle ESC key and backdrop click
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
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (selectedTags.size === 0) {
      setError("Pilih minimal 1 tag untuk di-vote.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await voteBeatmapTags(beatmap.beatmap_id, Array.from(selectedTags));
      // Langsung tutup modal setelah confirm sukses
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengirim vote. Pastikan Anda sudah login.");
      setSubmitting(false);
    }
  }

  const filteredTags = ALL_TAGS.filter(t =>
    t.toLowerCase().includes(search.toLowerCase().trim())
  );

  const title = beatmap.title ?? `Beatmap #${beatmap.beatmap_id}`;

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div style={modalStyle} ref={modalRef}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <h3 style={titleHeadingStyle}>Help find the right tags</h3>
            <p style={subtitleStyle}>
              Vote atau pilih tag yang paling sesuai untuk beatmap ini.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={closeBtnStyle}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Beatmap Info Card */}
        <div style={beatmapInfoStyle}>
          <div style={{ fontWeight: 700, color: "#fffffe", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: "#a7a9be", marginTop: 2 }}>
            {beatmap.artist && <span>by {beatmap.artist} </span>}
            {beatmap.version && <span style={{ color: "#ff6b9d" }}>[{beatmap.version}] </span>}
            {beatmap.difficulty_rating != null && (
              <span style={{ color: "#ffd700", marginLeft: 4 }}>★ {beatmap.difficulty_rating.toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* Search filter */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Cari tag (misal: jumps, stream, tech)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={searchInputStyle}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={clearSearchBtnStyle}
            >
              ✕
            </button>
          )}
        </div>

        {/* Scrollable tag selection container */}
        <div style={tagScrollContainerStyle}>
          {loadingVotes ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "#a7a9be", fontSize: 12 }}>
              Memuat data vote…
            </div>
          ) : filteredTags.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "#636e72", fontSize: 12 }}>
              Tidak ada tag yang cocok dengan "{search}".
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {filteredTags.map(tag => {
                const isSelected = selectedTags.has(tag);
                const wasVoted = previouslyVoted.has(tag);
                const voteCount = tagCounts[tag] || 0;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={tagItemStyle(isSelected, voteCount > 0)}
                  >
                    {voteCount > 0 && (
                      <span style={voteCountBadgeStyle}>
                        | {voteCount} |
                      </span>
                    )}
                    <span>{isSelected ? "✓ " : (voteCount > 0 ? "" : "+ ")}{tag}</span>
                    {wasVoted && (
                      <span style={votedBadgeStyle}>Voted</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selection info & Error */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 11, color: "#a7a9be" }}>
            Dipilih: <strong style={{ color: "#ff6b9d" }}>{selectedTags.size}</strong> tag
          </span>
          {selectedTags.size > 0 && (
            <button
              onClick={() => setSelectedTags(new Set())}
              style={{ background: "transparent", border: "none", color: "#636e72", fontSize: 11, cursor: "pointer" }}
            >
              Reset pilihan
            </button>
          )}
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {/* Actions */}
        <div style={actionRowStyle}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={cancelBtnStyle}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || selectedTags.size === 0}
            style={{
              ...confirmBtnStyle,
              opacity: submitting || selectedTags.size === 0 ? 0.5 : 1,
              cursor: submitting || selectedTags.size === 0 ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Mengirim..." : `Confirm (${selectedTags.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  background: "#1a1929",
  border: "1px solid #2e2d3d",
  borderRadius: 14,
  padding: 20,
  width: "100%",
  maxWidth: 520,
  boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
  display: "flex",
  flexDirection: "column",
  maxHeight: "90vh",
};

const titleHeadingStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#fffffe",
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#a7a9be",
  marginTop: 3,
  marginBottom: 0,
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#a7a9be",
  fontSize: 16,
  cursor: "pointer",
  padding: 4,
  lineHeight: 1,
};

const beatmapInfoStyle: React.CSSProperties = {
  background: "#0f0e17",
  border: "1px solid #2e2d3d",
  borderRadius: 8,
  padding: "8px 12px",
  marginBottom: 12,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 30px 8px 12px",
  background: "#0f0e17",
  border: "1px solid #2e2d3d",
  borderRadius: 8,
  color: "#fffffe",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
};

const clearSearchBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  background: "transparent",
  border: "none",
  color: "#a7a9be",
  fontSize: 11,
  cursor: "pointer",
};

const tagScrollContainerStyle: React.CSSProperties = {
  maxHeight: 250,
  overflowY: "auto",
  background: "#0f0e17",
  border: "1px solid #2e2d3d",
  borderRadius: 8,
  padding: 10,
  scrollbarWidth: "thin",
  scrollbarColor: "#ff6b9d #0f0e17",
};

function tagItemStyle(active: boolean, hasVotes: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    border: "1px solid",
    background: active
      ? "rgba(255,107,157,0.22)"
      : hasVotes
      ? "rgba(255,215,0,0.06)"
      : "rgba(255,255,255,0.03)",
    color: active ? "#ff6b9d" : hasVotes ? "#fffffe" : "#a7a9be",
    borderColor: active ? "#ff6b9d" : hasVotes ? "rgba(255,215,0,0.4)" : "#2e2d3d",
    transition: "all 0.12s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  };
}

const voteCountBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#ffd700",
  letterSpacing: "0.5px",
};

const votedBadgeStyle: React.CSSProperties = {
  fontSize: 9,
  padding: "1px 4px",
  borderRadius: 3,
  background: "rgba(184,233,148,0.2)",
  color: "#b8e994",
  border: "1px solid rgba(184,233,148,0.4)",
  marginLeft: 2,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 16,
  justifyContent: "flex-end",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 7,
  border: "1px solid #2e2d3d",
  background: "transparent",
  color: "#a7a9be",
  fontSize: 12,
  cursor: "pointer",
};

const confirmBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: 7,
  border: "none",
  background: "#ff6b9d",
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "8px 12px",
  background: "#2a0a14",
  border: "1px solid #7f1d1d",
  borderRadius: 6,
  color: "#fca5a5",
  fontSize: 12,
};
