import { useEffect, useRef, useState } from "react";
import { Playlist, BeatmapRecord, CurrentUser } from "../types";
import { getUserPlaylists, createPlaylist, deletePlaylist, updatePlaylist, removeFromPlaylist, lovePlaylist, unlovePlaylist } from "../api";
import { BeatmapCard } from "./BeatmapCard";
import { starColor } from "../utils/starColor";
import { IconExternalLink, IconDownload, IconBookmark, IconPlay, IconPause } from "./Icons";
import SaveToPlaylistModal from "./SaveToPlaylistModal";
import { playPreview as _playPreview, pauseAudio, resumeAudio, subscribeAudio } from "../utils/audioStore";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function fmt(n?: number | null, d = 1) {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(d);
}

// Group beatmaps by beatmapset_id, preserving playlist order
function groupBySet(beatmaps: BeatmapRecord[]): Array<{ key: string; diffs: BeatmapRecord[] }> {
  const map = new Map<string, BeatmapRecord[]>();
  const order: string[] = [];
  for (const bm of beatmaps) {
    const key = bm.beatmapset_id ?? bm.beatmap_id;
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(bm);
  }
  return order.map(key => ({ key, diffs: map.get(key)! }));
}

// ── Grouped set card (multiple diffs from same set in playlist) ───────────────
function GroupedSetCard({ diffs, currentUser }: { diffs: BeatmapRecord[]; currentUser: CurrentUser | null }) {
  const sorted = [...diffs].sort((a, b) => (a.difficulty_rating ?? 0) - (b.difficulty_rating ?? 0));
  const midIdx = Math.max(0, Math.floor((sorted.length - 1) / 2));
  const [selectedIdx, setSelectedIdx] = useState(midIdx);
  const [hovered, setHovered] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const diff = sorted[selectedIdx];
  const starCol = starColor(diff?.difficulty_rating);
  const bgImg = diff?.card_url || diff?.cover_url ||
    (diff?.beatmapset_id ? `https://assets.ppy.sh/beatmaps/${diff.beatmapset_id}/covers/card.jpg` : null);

  const topLabels = [...(diff?.labels ?? [])].sort((a, b) => b.probability - a.probability).slice(0, 3);
  const maxProb = topLabels[0]?.probability ?? 1;

  const webUrl = diff?.beatmapset_id
    ? `https://osu.ppy.sh/beatmapsets/${diff.beatmapset_id}#osu/${diff.beatmap_id}`
    : `https://osu.ppy.sh/beatmaps/${diff?.beatmap_id}`;
  const dlParams = new URLSearchParams();
  if (diff?.title) dlParams.set("title", diff.title);
  if (diff?.artist) dlParams.set("artist", diff.artist);
  const dlUrl = diff?.beatmapset_id ? `${BASE_URL}/proxy/download/${diff.beatmapset_id}?${dlParams}` : null;
  const previewUrl = diff?.beatmapset_id ? `https://b.ppy.sh/preview/${diff.beatmapset_id}.mp3` : null;

  const beatmapsetId = diff?.beatmapset_id ?? "";

  // Sync playing state from global store
  useEffect(() => {
    return subscribeAudio((track, globalPlaying) => {
      const isOurs = track?.beatmapsetId === beatmapsetId && stopRef.current !== null;
      setPlaying(isOurs && globalPlaying);
    });
  }, [beatmapsetId]);

  useEffect(() => () => { stopRef.current = null; }, []);

  function togglePlay(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!previewUrl) return;
    if (playing) {
      pauseAudio();
    } else if (stopRef.current) {
      resumeAudio();
    } else {
      stopRef.current = _playPreview(
        previewUrl,
        { title: diff?.title ?? "Unknown", artist: diff?.artist ?? "Unknown", beatmapsetId },
        () => { stopRef.current = null; },
      );
    }
  }

  return (
    <>
      <div
        style={{
          background: "var(--card)", border: `1px solid ${hovered ? "rgba(255,102,170,0.45)" : "rgba(180,130,220,0.18)"}`,
          borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column",
          transition: "border-color 0.2s, transform 0.15s, box-shadow 0.2s",
          transform: hovered ? "translateY(-2px)" : "none",
          boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.45)" : "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Cover */}
        <div style={{ position: "relative", height: 130, overflow: "hidden", background: "var(--bg)", flexShrink: 0 }}>
          {bgImg && <img src={bgImg} alt="" loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: hovered ? 0.45 : 0.65, transition: "opacity 0.2s" }} />}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
            background: "linear-gradient(to bottom, transparent 30%, var(--card) 100%)" }} />
          {diff?.status && (
            <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 700,
              padding: "2px 7px", borderRadius: 4, color: "#b8e994", background: "rgba(0,0,0,0.6)",
              fontFamily: "var(--font-m)", border: "1px solid #b8e99488", letterSpacing: "0.06em" }}>
              {diff.status.toUpperCase()}
            </span>
          )}
          {playing && (
            <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 2, alignItems: "flex-end" }}>
              {[1, 1.5, 0.8, 1.2, 1].map((h, i) => (
                <div key={i} style={{ width: 3, borderRadius: 2, background: "#ff66aa",
                  animation: `eq-bar ${0.5 + i * 0.1}s ease-in-out infinite alternate`,
                  height: `${h * 10}px` }} />
              ))}
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
            opacity: hovered ? 1 : 0, transition: "opacity 0.18s" }}>
            {previewUrl && (
              <button onClick={togglePlay}
                style={{ width: 44, height: 44, borderRadius: "50%",
                  background: playing ? "rgba(255,102,170,0.9)" : "rgba(0,0,0,0.65)",
                  border: `2px solid ${playing ? "#ff66aa" : "rgba(255,255,255,0.35)"}`,
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", backdropFilter: "blur(4px)" }}>
                {playing ? <IconPause size={18} strokeWidth={2.5} /> : <IconPlay size={18} strokeWidth={2.5} />}
              </button>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <a href={webUrl} target="_blank" rel="noopener noreferrer"
                style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.25)",
                  color: "#fff", textDecoration: "none", backdropFilter: "blur(4px)",
                  display: "flex", alignItems: "center", gap: 4 }}>
                <IconExternalLink size={12} strokeWidth={2.5} /> osu!
              </a>
              {dlUrl && (
                <a href={dlUrl}
                  style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: "rgba(255,102,170,0.75)", border: "1px solid rgba(255,102,170,0.5)",
                    color: "#fff", textDecoration: "none", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", gap: 4 }}>
                  <IconDownload size={12} strokeWidth={2.5} /> .osz
                </a>
              )}
              {currentUser && (
                <button onClick={() => setShowPlaylist(true)}
                  style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.25)",
                    color: "#fff", cursor: "pointer", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", gap: 4 }}>
                  <IconBookmark size={12} strokeWidth={2.5} /> Save
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "12px 14px 8px", flex: 1 }}>
          <div style={{ fontFamily: "var(--font-d)", fontWeight: 800, fontSize: 14, color: "var(--text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
            {diff?.title ?? `Beatmapset`}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {diff?.artist}
          </div>

          {/* Active diff */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: starCol, display: "inline-block" }} />
            <span style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 12, color: starCol }}>
              {diff?.version ?? "—"}
            </span>
            <span style={{ fontFamily: "var(--font-m)", fontSize: 11, color: "#ffd700",
              background: "rgba(255,204,0,0.1)", border: "1px solid rgba(255,204,0,0.25)",
              borderRadius: 4, padding: "1px 6px" }}>
              ★ {fmt(diff?.difficulty_rating)}
            </span>
          </div>

          {/* Labels */}
          {topLabels.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
              {topLabels.map(l => (
                <div key={l.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--font-m)", fontSize: 10, color: "var(--muted)" }}>{l.label}</span>
                    <span style={{ fontFamily: "var(--font-m)", fontSize: 10, color: starCol, fontWeight: 600 }}>
                      {(l.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${(l.probability / maxProb) * 100}%`, height: "100%", borderRadius: 2,
                      background: `linear-gradient(90deg, ${starCol}cc, ${starCol}55)` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Diff picker */}
        <div style={{ borderTop: "1px solid rgba(180,130,220,0.1)", padding: "8px 10px",
          display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 4,
          background: "rgba(0,0,0,0.2)" }}>
          {sorted.map((d, i) => {
            const col = starColor(d.difficulty_rating);
            const active = i === selectedIdx;
            return (
              <button key={d.beatmap_id} title={`${d.version ?? "?"} ★${fmt(d.difficulty_rating)}`}
                onClick={() => setSelectedIdx(i)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5,
                  border: `1px solid ${active ? col : "transparent"}`,
                  background: active ? `${col}1a` : "transparent", cursor: "pointer" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: col, display: "inline-block" }} />
                <span style={{ fontFamily: "var(--font-d)", fontSize: 11, fontWeight: active ? 700 : 500,
                  color: active ? col : "var(--muted2)", whiteSpace: "nowrap" }}>
                  {d.version ?? `#${d.beatmap_id}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {showPlaylist && currentUser && diff && (
        <SaveToPlaylistModal
          beatmapId={diff.beatmap_id}
          beatmapTitle={`${diff.title ?? "Beatmap"} [${diff.version ?? ""}]`}
          onClose={() => setShowPlaylist(false)}
        />
      )}
    </>
  );
}

interface Props {
  username: string;
  initialPlaylistId?: number;
  currentUser: CurrentUser | null;
  onBack: () => void;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

export default function PlaylistPage({ username, initialPlaylistId, currentUser, onBack }: Props) {
  const isMobile = useIsMobile();
  const [owner, setOwner] = useState<{ username: string; avatar_url?: string; osu_id: number } | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(initialPlaylistId ?? null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const isOwner = currentUser?.username === username;

  useEffect(() => {
    getUserPlaylists(username)
      .then(res => { setOwner(res.owner); setPlaylists(res.playlists); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  const activePl = playlists.find(p => p.id === activeId) ?? playlists[0] ?? null;

  // Compute most common tags across ALL playlists of this user (public+own)
  const tagCount: Record<string, number> = {};
  playlists.forEach(pl =>
    pl.top_tags.forEach(t => { tagCount[t] = (tagCount[t] ?? 0) + 1; })
  );
  const globalTopTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const pl = await createPlaylist(newName.trim());
      setPlaylists(prev => [pl, ...prev]);
      setActiveId(pl.id);
      setNewName("");
    } catch { /* ignore */ }
    setCreating(false);
  }

  async function handleDelete(id: number) {
    await deletePlaylist(id).catch(() => {});
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function handleTogglePublic(pl: Playlist) {
    const updated = await updatePlaylist(pl.id, { is_public: !pl.is_public }).catch(() => null);
    if (updated) setPlaylists(prev => prev.map(p => p.id === pl.id ? updated : p));
  }

  async function handleLove(pl: Playlist) {
    if (!currentUser || currentUser.username === username) return;
    try {
      if (pl.loved) {
        const res = await unlovePlaylist(pl.id);
        setPlaylists(prev => prev.map(p => p.id === pl.id
          ? { ...p, loved: false, love_count: res.love_count } : p));
      } else {
        const res = await lovePlaylist(pl.id);
        setPlaylists(prev => prev.map(p => p.id === pl.id
          ? { ...p, loved: true, love_count: res.love_count, love_snapshot_hash: res.snapshot_hash } : p));
      }
    } catch { /* ignore */ }
  }

  async function handleUnsave(playlistId: number, beatmapId: string) {
    await removeFromPlaylist(playlistId, beatmapId).catch(() => {});
    setPlaylists(prev => prev.map(p => p.id !== playlistId ? p : {
      ...p,
      item_count: p.item_count - 1,
      beatmaps: p.beatmaps.filter(b => b.beatmap_id !== beatmapId),
    }));
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px" }}>
      <button onClick={onBack} className="btn-ghost" style={{ marginBottom: 28, fontSize: 13 }}>
        ← Back
      </button>

      {/* Profile header */}
      {owner && (
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {owner.avatar_url ? (
            <img src={owner.avatar_url} alt={owner.username}
              style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover",
                border: "3px solid rgba(255,102,170,0.5)", marginBottom: 12 }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: "50%",
              background: "rgba(255,102,170,0.2)", margin: "0 auto 12px" }} />
          )}
          <h1 style={{ fontFamily: "var(--font-d)", fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>
            {owner.username}'s Playlists
          </h1>
          {globalTopTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 10 }}>
              {globalTopTags.map(t => (
                <span key={t} style={{ fontFamily: "var(--font-m)", fontSize: 11, padding: "3px 10px",
                  borderRadius: 20, background: "rgba(255,102,170,0.14)", border: "1px solid rgba(255,102,170,0.5)",
                  color: "#ff66aa" }}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--muted2)", marginTop: 8 }}>
            {playlists.length} playlist{playlists.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {loading && <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading…</p>}

      {!loading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "220px 1fr",
          gap: isMobile ? 16 : 20,
          alignItems: "start",
        }}>
          {/* Sidebar: playlist list */}
          <div>
            {isOwner && (
              <div style={{ marginBottom: 12 }}>
                <input className="osu-input" placeholder="New playlist…" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                  style={{ fontSize: 12, marginBottom: 6 }} />
                <button className="btn-pink" onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  style={{ width: "100%", fontSize: 12, padding: "7px 0",
                    opacity: !newName.trim() || creating ? 0.45 : 1 }}>
                  {creating ? "Creating…" : "+ New Playlist"}
                </button>
              </div>
            )}

            {playlists.length === 0 ? (
              <p style={{ color: "var(--muted2)", fontSize: 12, padding: "12px 0" }}>
                {isOwner ? "No playlists yet." : "No public playlists."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {playlists.map(pl => {
                  const active = (activeId ?? playlists[0]?.id) === pl.id;
                  return (
                    <div key={pl.id}
                      style={{ borderRadius: 8, overflow: "hidden",
                        background: active ? "rgba(255,102,170,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(255,102,170,0.45)" : "var(--border)"}` }}>
                      <button onClick={() => setActiveId(pl.id)}
                        style={{ display: "block", width: "100%", padding: "10px 12px",
                          background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                        <div style={{ fontFamily: "var(--font-d)", fontSize: 13, fontWeight: 700,
                          color: active ? "var(--pink)" : "var(--text)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {pl.name}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>{pl.item_count} maps · {pl.is_public ? "Public" : "Private"}</span>
                          {!isOwner && currentUser && (
                            <span
                              onClick={e => { e.stopPropagation(); handleLove(pl); }}
                              title={pl.loved ? "Remove love" : "Love this playlist"}
                              style={{ color: pl.loved ? "#ff66aa" : "var(--muted2)", cursor: "pointer",
                                fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                              {pl.loved ? "♥" : "♡"} {pl.love_count}
                            </span>
                          )}
                        </div>
                      </button>
                      {isOwner && (
                        <div style={{ display: "flex", gap: 4, padding: "0 8px 8px" }}>
                          <button onClick={() => handleTogglePublic(pl)}
                            style={{ flex: 1, fontSize: 10, padding: "3px 0", borderRadius: 5,
                              border: "1px solid var(--border)", background: "transparent",
                              color: "var(--muted)", cursor: "pointer" }}>
                            {pl.is_public ? "Make Private" : "Make Public"}
                          </button>
                          <button onClick={() => handleDelete(pl.id)}
                            style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5,
                              border: "1px solid #7f1d1d", background: "transparent",
                              color: "#fca5a5", cursor: "pointer" }}>
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main: active playlist beatmaps */}
          <div>
            {activePl ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 800, color: "var(--text)", margin: 0 }}>
                    {activePl.name}
                  </h2>
                  <p style={{ fontSize: 12, color: "var(--muted2)", marginTop: 3 }}>
                    {activePl.item_count} beatmap{activePl.item_count !== 1 ? "s" : ""}
                    {activePl.top_tags.length > 0 && (
                      <> · top tags: <span style={{ color: "#ff66aa" }}>{activePl.top_tags.slice(0, 3).join(", ")}</span></>
                    )}
                  </p>
                </div>
                {activePl.beatmaps.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)",
                    background: "var(--card2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    This playlist is empty.
                  </div>
                ) : (
                  <>
                    <DiffDistribution distribution={activePl.diff_distribution ?? []} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                      {groupBySet(activePl.beatmaps).map(({ key, diffs }) =>
                        diffs.length === 1 ? (
                          <BeatmapCard key={key} record={diffs[0]} currentUser={currentUser} />
                        ) : (
                          <GroupedSetCard key={key} diffs={diffs} currentUser={currentUser} />
                        )
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                Select a playlist to view its beatmaps.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Difficulty Distribution ───────────────────────────────────────────────────

function DiffDistribution({ distribution }: { distribution: { range: string; count: number; color: string }[] }) {
  if (!distribution || distribution.length === 0) return null;
  const max = Math.max(...distribution.map(d => d.count), 1);
  const total = distribution.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{ marginBottom: 16, padding: "12px 14px",
      background: "var(--card2)", borderRadius: 10, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-m)", letterSpacing: "0.06em" }}>
          DIFFICULTY DISTRIBUTION
        </span>
        <span style={{ fontSize: 10, color: "var(--muted2)", fontFamily: "var(--font-m)" }}>
          {total} map{total !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 52 }}>
        {distribution.map(d => {
          const hasAny = d.count > 0;
          const heightPct = hasAny ? Math.max((d.count / max) * 100, 10) : 4;
          return (
            <div key={d.range} style={{ flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}
              title={`${d.range}: ${d.count} map${d.count !== 1 ? "s" : ""}`}>
              {/* Count label — only show if non-zero */}
              <div style={{ fontSize: 9, fontFamily: "var(--font-m)", fontWeight: 700,
                color: hasAny ? d.color : "transparent", minHeight: 12, lineHeight: 1 }}>
                {hasAny ? d.count : ""}
              </div>
              {/* Bar */}
              <div style={{
                width: "100%",
                background: hasAny ? `${d.color}30` : "rgba(255,255,255,0.04)",
                border: `1px solid ${hasAny ? d.color + "60" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "3px 3px 0 0",
                height: `${heightPct}%`,
                transition: "height 0.35s ease",
                position: "relative", overflow: "hidden",
              }}>
                {hasAny && (
                  <div style={{ position: "absolute", inset: 0,
                    background: `${d.color}50`, borderRadius: "3px 3px 0 0" }} />
                )}
              </div>
              {/* Label */}
              <div style={{ fontSize: 8, color: hasAny ? "var(--muted)" : "var(--muted2)",
                fontFamily: "var(--font-m)", whiteSpace: "nowrap", opacity: hasAny ? 1 : 0.4 }}>
                {d.range.replace("★", "")}★
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
