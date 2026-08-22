import { useEffect } from "react";
import { setStoredToken } from "../api";

/**
 * Halaman callback OAuth — dibuka setelah redirect dari backend.
 * Baca session_token dari hash, simpan ke localStorage, redirect ke /.
 */
export default function AuthCallback() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#session_token=")) {
      const token = hash.slice("#session_token=".length);
      setStoredToken(token);
    }
    window.location.replace("/");
  }, []);

  return <p style={{ color: "#fff", textAlign: "center", marginTop: 80 }}>Logging in…</p>;
}
