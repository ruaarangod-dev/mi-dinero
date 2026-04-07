import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import AuthScreen from "./AuthScreen.jsx";
import FinanceApp from "./FinanceApp.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "linear-gradient(165deg,#0F1119 0%,#171B2D 50%,#0F1119 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
      <div style={{ fontSize: 40, animation: "pulse 1.5s infinite" }}>💸</div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}`}</style>
    </div>
  );

  if (!session) return <AuthScreen />;

  return <FinanceApp userId={session.user.id} userEmail={session.user.email} />;
}
