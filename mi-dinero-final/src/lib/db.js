import { supabase } from "./supabase.js";

// ─── Auth ──────────────────────────────────────────────────
export const auth = {
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  onAuthStateChange(cb) {
    return supabase.auth.onAuthStateChange(cb);
  },
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
};

// ─── Profile ───────────────────────────────────────────────
export const profiles = {
  async get(userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error && error.code !== "PGRST116") throw error;
    return data;
  },
  async update(userId, updates) {
    const { data, error } = await supabase.from("profiles").update(updates).eq("id", userId).select().single();
    if (error) throw error;
    return data;
  },
};

// ─── Transactions ──────────────────────────────────────────
export const transactions = {
  async getAll(userId) {
    const { data, error } = await supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async add(userId, tx) {
    const { data, error } = await supabase.from("transactions").insert({ user_id: userId, amount: tx.amount, type: tx.type, category: tx.category, note: tx.note || "", date: tx.date }).select().single();
    if (error) throw error;
    return data;
  },
  async update(txId, userId, updates) {
    const { data, error } = await supabase.from("transactions").update({ amount: updates.amount, type: updates.type, category: updates.category, note: updates.note || "", date: updates.date }).eq("id", txId).eq("user_id", userId).select().single();
    if (error) throw error;
    return data;
  },
  async remove(txId, userId) {
    const { error } = await supabase.from("transactions").delete().eq("id", txId).eq("user_id", userId);
    if (error) throw error;
  },
};

// ─── Goals ─────────────────────────────────────────────────
export const goals = {
  async getAll(userId) {
    const { data, error } = await supabase.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async add(userId, goal) {
    const { data, error } = await supabase.from("goals").insert({ user_id: userId, name: goal.name, target: goal.target, saved: goal.saved || 0, deadline: goal.deadline || null }).select().single();
    if (error) throw error;
    return data;
  },
  async update(goalId, userId, updates) {
    const { data, error } = await supabase.from("goals").update(updates).eq("id", goalId).eq("user_id", userId).select().single();
    if (error) throw error;
    return data;
  },
  async remove(goalId, userId) {
    const { error } = await supabase.from("goals").delete().eq("id", goalId).eq("user_id", userId);
    if (error) throw error;
  },
};

// ─── Alert Dismissals ──────────────────────────────────────
export const dismissals = {
  async getAll(userId) {
    const { data, error } = await supabase.from("alert_dismissals").select("alert_key").eq("user_id", userId);
    if (error) throw error;
    const map = {};
    (data || []).forEach((d) => { map[d.alert_key] = true; });
    return map;
  },
  async dismiss(userId, alertKey) {
    const { error } = await supabase.from("alert_dismissals").upsert({ user_id: userId, alert_key: alertKey }, { onConflict: "user_id,alert_key" });
    if (error) throw error;
  },
};
