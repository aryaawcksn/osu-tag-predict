import { CurrentUser } from "../types";
import { logout } from "../api";

interface Props {
  user: CurrentUser | null;
  onLogout: () => void;
  onProfile: () => void;
}

export default function NavBar({ user, onLogout, onProfile }: Props) {
  const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

  async function handleLogout() {
    await logout();
    onLogout();
  }

  return (
    <nav style={navStyle}>
      <span style={{ fontWeight: 700, fontSize: 16, color: "#ff6b9d" }}>
        osu! Beatmap Tag Analyzer
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {user ? (
          <>
            {user.avatar_url && (
              <img
                src={user.avatar_url}
                alt={user.username}
                style={avatarStyle}
              />
            )}
            <button
              onClick={onProfile}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#fffffe", fontSize: 14, fontWeight: 600 }}
            >
              {user.username}
            </button>
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
  padding: "10px 24px",
  background: "#0f0e17",
  borderBottom: "1px solid #2e2d3d",
  position: "sticky",
  top: 0,
  zIndex: 100,
};

const avatarStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid #2e2d3d",
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "5px 12px",
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
