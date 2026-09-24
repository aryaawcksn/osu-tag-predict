import { CurrentUser } from "../types";
import { logout } from "../api";
import { IconSun, IconMoon } from "./Icons";

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

  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <nav style={navStyle}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="10" stroke="#ff66aa" strokeWidth="2" />
          <circle cx="11" cy="11" r="5.5" stroke="#ff66aa" strokeWidth="2" />
          <circle cx="11" cy="11" r="1.5" fill="#ff66aa" />
        </svg>
        <span style={logoTextStyle}>o!btc</span>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Info button — hidden on mobile */}
        <button
          onClick={onInfo}
          className="nav-info-btn"
          style={infoButtonStyle}
        >
          Notices
        </button>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          style={themeToggleStyle}
        >
          {theme === "dark" ? <IconSun size={15} strokeWidth={2} /> : <IconMoon size={15} strokeWidth={2} />}
        </button>

        {user ? (
          <>
            {user.avatar_url && (
              <img src={user.avatar_url} alt={user.username} style={avatarStyle} />
            )}
            <button onClick={onProfile} style={userNameStyle}>
              {user.username}
            </button>
            <button onClick={handleLogout} className="btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }}>
              Logout
            </button>
          </>
        ) : (
          <a href={`${BASE_URL}/auth/login`} className="btn-pink" style={{ textDecoration: "none", fontSize: 13 }}>
            Login with osu!
          </a>
        )}
      </div>
    </nav>
  );
}

const navStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 24px",
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

const avatarStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  objectFit: "cover",
  border: "1.5px solid rgba(255,102,170,0.4)",
};

const userNameStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
};

const infoButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  color: "var(--muted)",
  padding: "5px 12px",
  transition: "border-color 0.15s, color 0.15s",
};

const themeToggleStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 15,
  padding: "4px 8px",
  lineHeight: 1,
  transition: "border-color 0.15s",
};
