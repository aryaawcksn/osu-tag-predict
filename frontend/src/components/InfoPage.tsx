import { useState } from "react";

// ── Hardcoded content ────────────────────────────────────────────────────────

const ANNOUNCEMENTS = [
  {
    id: 1,
    date: "2026-09-20",
    title: "Model v16 is now live",
    body: "We've updated the prediction model to version 16 with improved accuracy across all playstyle categories. Re-labeling of existing beatmaps is ongoing — you may notice some tag changes over the coming days.",
    type: "update" as const,
  },
  {
    id: 2,
    date: "2026-09-15",
    title: "Public playlists & community loves",
    body: "You can now make your playlists public and let other players love them. Loved playlists appear in your profile, and you'll be notified when a playlist you loved gets updated.",
    type: "feature" as const,
  },

];

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is o!btc?",
    a: "osu! Beatmap Tag Collection (o!btc) is a community tool that uses a machine learning model to predict playstyle tags for osu! beatmaps. Tags like 'aim', 'stream', 'tech', or 'reading' help you find maps that match your playstyle.",
  },
  {
    q: "How accurate are the predictions?",
    a: "The model is around 80–85% accurate on average, but individual maps can vary. Some maps are genuinely hard to classify — hybrid maps especially. That's why community tag voting exists: your corrections feed back into the next model version.",
  },
  {
    q: "Why do I need to log in with osu!?",
    a: "Login lets us fetch your top/recent plays from the osu! API to analyze your dominant playstyle. It also lets you save beatmaps to playlists, and get personalized recommendations. We only read your public play data — we never write anything to your osu! account.",
  },
  {
    q: "How does playstyle analysis work?",
    a: "We take your top 100 (or recent 50) plays, run the prediction model on each beatmap, and average the probability scores across all your maps. The playstyle with the highest average score is considered dominant, but you'll also see a full breakdown.",
  },
  {
    q: "What do the tags mean?",
    a: "Tags roughly correspond to the mechanical skills a beatmap emphasizes: aim (cursor movement), stream (fast tapping), tech (complex patterns), reading (visual difficulty), stamina (sustained effort), speed (high BPM), and so on. A beatmap can have multiple tags.",
  },
  {
    q: "Why is a beatmap missing from the database?",
    a: "We crawl ranked beatmaps daily, but the database isn't exhaustive. You can paste any beatmap link into the predictor to run a fresh prediction — it will be stored automatically after that.",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const typeStyle: Record<string, { bg: string; color: string; label: string }> = {
  update:  { bg: "rgba(99,179,237,0.12)",  color: "#63b3ed", label: "Update"  },
  feature: { bg: "rgba(255,102,170,0.12)", color: "#ff66aa", label: "Feature" },
  notice:  { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24", label: "Notice"  },
};

// ── Components ───────────────────────────────────────────────────────────────

function AnnouncementCard({ ann }: { ann: typeof ANNOUNCEMENTS[0] }) {
  const t = typeStyle[ann.type];
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: "var(--font-m)",
          padding: "2px 8px", borderRadius: 4,
          background: t.bg, color: t.color, border: `1px solid ${t.color}50`,
        }}>
          {t.label.toUpperCase()}
        </span>
        <span style={{ fontSize: 11, color: "var(--muted2)", fontFamily: "var(--font-m)" }}>
          {formatDate(ann.date)}
        </span>
      </div>
      <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 8 }}>
        {ann.title}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
        {ann.body}
      </p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 10, overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 18px", background: "transparent", border: "none", cursor: "pointer",
          textAlign: "left", gap: 12,
        }}
      >
        <span style={{ fontFamily: "var(--font-d)", fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
          {q}
        </span>
        <span style={{
          fontSize: 16, color: "var(--muted)", flexShrink: 0,
          transform: open ? "rotate(45deg)" : "none",
          transition: "transform 0.2s",
          display: "inline-block",
        }}>
          +
        </span>
      </button>
      {open && (
        <div style={{
          padding: "0 18px 14px",
          fontSize: 13, color: "var(--muted)", lineHeight: 1.7,
          borderTop: "1px solid var(--border)",
          paddingTop: 12,
        }}>
          {a}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function InfoPage({ onBack }: Props) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>
      <button onClick={onBack} className="btn-ghost" style={{ marginBottom: 28, fontSize: 13 }}>
        ← Back
      </button>

      {/* Announcements */}
      <section style={{ marginBottom: 48 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontFamily: "var(--font-d)", fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>
            Announcements
          </h2>
          <p style={{ fontSize: 12, color: "var(--muted2)", marginTop: 4 }}>
            Latest updates and news about o!btc
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ANNOUNCEMENTS.map(ann => <AnnouncementCard key={ann.id} ann={ann} />)}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontFamily: "var(--font-d)", fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>
            FAQ
          </h2>
          <p style={{ fontSize: 12, color: "var(--muted2)", marginTop: 4 }}>
            Frequently asked questions
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQ.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
        </div>
      </section>
    </div>
  );
}
