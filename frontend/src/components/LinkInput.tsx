import { useState, useRef, DragEvent } from "react";
import { predictFromLink, predictFromUpload } from "../api";
import { PredictResult } from "../types";

interface Props {
  onResult: (r: PredictResult) => void;
  onError: (e: string) => void;
  onLoading: (v: boolean) => void;
  loading: boolean;
}

export default function LinkInput({ onResult, onError, onLoading, loading }: Props) {
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!link.trim()) return;
    onLoading(true);
    try {
      const result = await predictFromLink(link.trim());
      onResult(result);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      onLoading(false);
    }
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith(".osu")) {
      onError("Hanya file .osu yang didukung.");
      return;
    }
    onLoading(true);
    try {
      const result = await predictFromUpload(file);
      onResult(result);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      onLoading(false);
    }
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
          disabled={loading}
          style={inputStyle}
        />
        <button type="submit" disabled={loading || !link.trim()} style={btnStyle}>
          {loading ? "Loading…" : "Predict"}
        </button>
      </form>

      {/* Divider */}
      <div style={{ textAlign: "center", color: "#a7a9be", fontSize: 13 }}>or upload a .osu file</div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#ff6b9d" : "#2e2d3d"}`,
          borderRadius: 12,
          padding: "32px 16px",
          textAlign: "center",
          cursor: loading ? "not-allowed" : "pointer",
          color: "#a7a9be",
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
          disabled={loading}
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

const btnStyle: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#ff6b9d",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};
