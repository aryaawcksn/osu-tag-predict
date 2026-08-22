import { CurrentUser } from "../types";
import { logout } from "../api";

interface Props {
  user: CurrentUser | null;
  onLogout: () => void;
}

// NavBar displays username when authenticated, login button when guest (Requirements 2.4, 6.3)
export default function NavBar({ user, onLogout }: Props) {
  const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <nav style={navStyle}>
      <span style={{ fontWeight: 700, fontSize: 16, color: "#ff6b9d" }}>
        osu! Playstyle
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {user ? (
          <>
            <span style={{ color: "#fffffe", fontSize: 14 }}>{user.username}</span>
            <button onClick={handleLogout} style={btnSecondaryStyle}>
              Logout
            </button>
          </>
        ) : (
          <a href={`${BASE_URL}/auth/login`} style={btnLinkStyle}>
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
  padding: "12px 24px",
  background: "#0f0e17",
  borderBottom: "1px solid #2e2d3d",
  position: "sticky",
  top: 0,
  zIndex: 100,
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  border: "1px solid #2e2d3d",
  background: "transparent",
  color: "#a7a9be",
  fontSize: 13,
  cursor: "pointer",
};

const btnLinkStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  border: "none",
  background: "#ff6b9d",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};
