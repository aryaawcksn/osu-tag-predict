import { useState, useRef, DragEvent } from "react";

interface Props {
  onLinkSubmit: (url: string) => void;
  onFileSubmit: (file: File) => void;
  onError: (e: string) => void;
  onLoading: (v: boolean) => void;
  loading: boolean;
  disabled?: boolean;
}

export default function LinkInput({ onLinkSubmit, onFileSubmit, onError, loading, disabled }: Props) {
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isDisabled = loading || !!disabled;

  function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = link.trim();
    if (!trimmed) return;

    // Reject non-osu modes before submitting
    const modeMatch = trimmed.match(/#(taiko|fruits|mania)\/\d+/);
    if (modeMatch) {
      onError(`Mode "${modeMatch[1]}" tidak didukung. Hanya beatmap osu! standard (#osu/...) yang bisa diprediksi.`);
      return;
    }

    onLinkSubmit(trimmed);
    setLink("");
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".osu")) {
      onError("Only .osu files are supported.");
      return;
    }
    onFileSubmit(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Link row */}
      <form onSubmit={handleLinkSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="https://osu.ppy.sh/beatmapsets/123#osu/456  (osu! standard only)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={isDisabled}
          className="osu-input"
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          type="submit"
          disabled={isDisabled || !link.trim()}
          className="btn-pink"
          style={{ padding: "8px 20px", opacity: isDisabled || !link.trim() ? 0.45 : 1, cursor: isDisabled || !link.trim() ? "not-allowed" : "pointer" }}
        >
          {loading ? "Loading…" : "Predict"}
        </button>
      </form>

      {/* Divider */}
      <div style={{ textAlign: "center", color: "var(--muted2)", fontSize: 12 }}>or upload a .osu file</div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!isDisabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={isDisabled ? undefined : handleDrop}
        onClick={() => !isDisabled && fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#ff66aa" : "rgba(180,130,220,0.25)"}`,
          borderRadius: 10,
          padding: "28px 16px",
          textAlign: "center",
          cursor: isDisabled ? "not-allowed" : "pointer",
          color: isDisabled ? "var(--muted2)" : "var(--muted)",
          fontSize: 13,
          transition: "border-color 0.2s, background 0.2s",
          background: dragging ? "rgba(255,102,170,0.06)" : "transparent",
        }}
      >
        <div style={{ marginBottom: 6, display: "flex", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: isDisabled ? 0.4 : 0.6 }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        Drop <code style={{ fontFamily: "var(--font-m)", color: "#ff66aa", fontSize: 12 }}>.osu</code> file here, or click to browse
        <input
          ref={fileRef}
          type="file"
          accept=".osu"
          style={{ display: "none" }}
          disabled={isDisabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
