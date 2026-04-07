import { useState } from "react";
import { auth } from "./lib/db.js";

export default function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      if (mode === "signup") {
        await auth.signUp(email, password);
        setMessage("Cuenta creada! Revisa tu email para confirmar.");
      } else {
        await auth.signIn(email, password);
      }
    } catch (err) {
      setError(err.message || "Error");
    } finally { setLoading(false); }
  };

  return (
    <div style={s.wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}input:focus{outline:none;border-color:#34D399!important}`}</style>
      <div style={s.card}>
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>💸</div>
        <h1 style={s.title}>Mi Dinero</h1>
        <p style={s.sub}>{mode === "login" ? "Inicia sesion" : "Crea tu cuenta"}</p>
        <form onSubmit={handle}>
          <input type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={s.input} />
          <input type="password" placeholder="Contrasena (min 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={s.input} />
          {error && <div style={s.err}>{error}</div>}
          {message && <div style={s.ok}>{message}</div>}
          <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Cargando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
        <div style={s.links}>
          {mode === "login"
            ? <button onClick={() => { setMode("signup"); setError(null); setMessage(null); }} style={s.link}>No tengo cuenta</button>
            : <button onClick={() => { setMode("login"); setError(null); setMessage(null); }} style={s.link}>Ya tengo cuenta</button>}
        </div>
      </div>
    </div>
  );
}

const s = {
  wrap: { fontFamily: "'DM Sans',sans-serif", background: "linear-gradient(165deg,#0F1119 0%,#171B2D 50%,#0F1119 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, color: "#fff" },
  card: { width: "100%", maxWidth: 380, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 32 },
  title: { fontSize: 26, fontWeight: 700, textAlign: "center", marginBottom: 4, background: "linear-gradient(135deg,#34D399,#2DD4BF,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  sub: { textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24 },
  input: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 14, fontFamily: "'DM Sans'", marginBottom: 10 },
  btn: { width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#34D399,#2DD4BF)", color: "#0F1119", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans'", marginTop: 8 },
  err: { background: "rgba(232,98,92,0.15)", border: "1px solid #E8625C", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#E8625C", marginBottom: 8 },
  ok: { background: "rgba(52,211,153,0.15)", border: "1px solid #34D399", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#34D399", marginBottom: 8 },
  links: { display: "flex", justifyContent: "center", marginTop: 16 },
  link: { background: "none", border: "none", color: "#34D399", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans'" },
};
