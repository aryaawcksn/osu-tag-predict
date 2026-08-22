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
    if (!link.trim()) return;
    onLinkSubmit(link.trim());
    setLink("");
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".osu")) {
      onError("Hanya file .osu yang didukung.");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Link input */}
      <form onSubmit={handleLinkSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="https://osu.ppy.sh/beatmapsets/123#osu/456"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={isDisabled}
          style={inputStyle}
        />
        <button type="submit" disabled={isDisabled || !link.trim()} style={btnStyle(isDisabled)}>
          {loading ? "Loading…" : "Predict"}
        </button>
      </form>

      {/* Divider */}
      <div style={{ textAlign: "center", color: "#a7a9be", fontSize: 13 }}>or upload a .osu file</div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!isDisabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={isDisabled ? undefined : handleDrop}
        onClick={() => !isDisabled && fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#ff6b9d" : "#2e2d3d"}`,
          borderRadius: 12,
          padding: "32px 16px",
          textAlign: "center",
          cursor: isDisabled ? "not-allowed" : "pointer",
          color: isDisabled ? "#555" : "#a7a9be",
          fontSize: 14,
          transition: "border-color 0.2s",
          background: dragging ? "#1a1929" : "transparent",
        }}
      >
        Drop .osu file here, or click to browse
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

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #2e2d3d",
  background: "#1a1929",
  color: "#fffffe",
  fontSize: 14,
  outline: "none",
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: disabled ? "#4a2030" : "#ff6b9d",
    color: disabled ? "#a7a9be" : "#fff",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    transition: "background 0.2s",
  };
}
