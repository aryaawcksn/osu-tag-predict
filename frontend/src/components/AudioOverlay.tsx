import { useEffect, useState } from "react";
import { subscribeAudio, stopAudio, toggleAudio, TrackInfo } from "../utils/audioStore";
import { IconPlay, IconPause } from "./Icons";

const HIDE_AFTER_MS = 15000;

export default function AudioOverlay() {
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return subscribeAudio((t, p) => {
      setTrack(t);
      setPlaying(p);
      if (t) setVisible(true);
    });
  }, []);

  // Auto-hide after 15s of no activity
  useEffect(() => {
    if (!track) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [track, playing]);

  if (!track) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? "0" : "120%"})`,
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s",
        opacity: visible ? 1 : 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(20,17,32,0.88)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,102,170,0.3)",
        borderRadius: 40,
        padding: "8px 16px 8px 12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        minWidth: 240,
        maxWidth: "calc(100vw - 40px)",
        pointerEvents: visible ? "auto" : "none",
      }}
      onMouseEnter={() => setVisible(true)}
    >
      {/* EQ bars / cover placeholder */}
      <div style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0, overflow: "hidden",
        background: "rgba(255,102,170,0.15)", border: "1px solid rgba(255,102,170,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {playing ? (
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 16 }}>
            {[1, 1.5, 0.8, 1.3, 1].map((h, i) => (
              <div key={i} style={{ width: 3, borderRadius: 2, background: "#ff66aa",
                animation: `eq-bar ${0.45 + i * 0.1}s ease-in-out infinite alternate`,
                height: `${h * 10}px` }} />
            ))}
          </div>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff66aa" strokeWidth="2">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        )}
      </div>

      {/* Track info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-d)", fontSize: 12, fontWeight: 700,
          color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {track.title}
        </div>
        <div style={{ fontFamily: "var(--font-m)", fontSize: 10, color: "rgba(255,255,255,0.5)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {track.artist}
        </div>
      </div>

      {/* Play/Pause */}
      <button
        onClick={() => { toggleAudio(); setVisible(true); }}
        style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: playing ? "rgba(255,102,170,0.9)" : "rgba(255,255,255,0.12)",
          border: `1px solid ${playing ? "#ff66aa" : "rgba(255,255,255,0.2)"}`,
          color: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", transition: "all 0.15s" }}>
        {playing
          ? <IconPause size={12} strokeWidth={2.5} />
          : <IconPlay size={12} strokeWidth={2.5} />}
      </button>

      {/* Stop */}
      <button
        onClick={() => stopAudio()}
        title="Stop"
        style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.45)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, transition: "all 0.15s" }}>
        ■
      </button>
    </div>
  );
}
