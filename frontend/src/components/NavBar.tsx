import { CurrentUser } from "../types";
import { logout } from "../api";
import { IconSun, IconMoon, IconInfo, IconLogOut } from "./Icons";

interface Props {
  user: CurrentUser | null;
  onLogout: () => void;
  onProfile: () => void;
  onInfo: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export default function NavBar({ user, onLogout, onProfile, onInfo, theme, onToggleTheme }: Props) {
  const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
  const isDark = theme === "dark";

  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <nav style={navStyle}>
      {/* ── Left: logo ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <img src="/favicon.png" alt="o!btc" style={{ width: 24, height: 24, objectFit: "contain" }} />
        <span style={logoTextStyle}>o!btc</span>
      </div>

      {/* ── Right: actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>

        {/* Info & FAQ */}
        <button
          onClick={onInfo}
          className="nav-info-btn"
          title="Info & FAQ"
          style={ghostBtn}
        >
          <IconInfo size={14} strokeWidth={2} style={{ color: isDark ? "rgba(255,255,255,0.6)" : "var(--muted)" }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Info</span>
        </button>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{ ...ghostBtn, padding: "5px 8px" }}
        >
          {isDark
            ? <IconSun size={15} strokeWidth={2} style={{ color: "#fff" }} />
            : <IconMoon size={15} strokeWidth={2} style={{ color: "#4a4a62" }} />}
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />

        {user ? (
          <>
            {/* Avatar + username */}
            <button onClick={onProfile} style={userBtn} title="My profile">
              {user.avatar_url
                ? <img src={user.avatar_url} alt={user.username} style={avatarStyle} />
                : <div style={{ ...avatarStyle, background: "rgba(255,102,170,0.2)" }} />}
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", maxWidth: 120,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.username}
              </span>
            </button>

            {/* Logout */}
            <button onClick={handleLogout} title="Logout" style={{ ...ghostBtn, padding: "5px 8px" }}>
              <IconLogOut size={14} strokeWidth={2} style={{ color: "var(--muted)" }} />
              <span className="nav-logout-text" style={{ fontSize: 12, color: "var(--muted)" }}>
                Logout
              </span>
            </button>
          </>
        ) : (
          <a
            href={`${BASE_URL}/auth/login`}
            className="btn-pink"
            style={{ textDecoration: "none", fontSize: 13 }}
          >
            Login with osu!
          </a>
        )}
      </div>
    </nav>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const navStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 20px",
  height: 52,
  background: "var(--card)",
  borderBottom: "1px solid var(--border)",
  position: "sticky",
  top: 0,
  zIndex: 100,
  backdropFilter: "blur(8px)",
};

const logoTextStyle: React.CSSProperties = {
  fontFamily: "var(--font-d)",
  fontWeight: 800,
  fontSize: 15,
  color: "#ff66aa",
  letterSpacing: "0.02em",
};

const ghostBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  cursor: "pointer",
  padding: "5px 10px",
  transition: "border-color 0.15s",
};

const userBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  cursor: "pointer",
  padding: "4px 10px 4px 5px",
  transition: "border-color 0.15s",
};

const avatarStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  objectFit: "cover",
  border: "1.5px solid rgba(255,102,170,0.4)",
  flexShrink: 0,
};
