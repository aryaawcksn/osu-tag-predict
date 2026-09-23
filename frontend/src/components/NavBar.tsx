import { CurrentUser } from "../types";
import { logout } from "../api";

interface Props {
  user: CurrentUser | null;
  onLogout: () => void;
  onProfile: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export default function NavBar({ user, onLogout, onProfile, theme, onToggleTheme }: Props) {
  const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <nav style={navStyle}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img
          src="/favicon.png"
          alt="Bullet"
          style={{ width: "24px", height: "24px", objectFit: "contain" }}
        />
        <span style={logoTextStyle}>osu!BTC</span>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          style={themeToggleStyle}
        >
          {theme === "dark" ? "☀️" : "🌙"}
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
