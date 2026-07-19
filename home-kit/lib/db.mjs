// Storage layer. Uses Supabase when configured; otherwise falls back to a local
// JSON file so the pipeline still runs (and diffs) before the DB is wired up.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export function makeStore(cfg) {
  const key = cfg.supabase?.key || cfg.supabase?.serviceKey;
  const useSupabase = cfg.supabase?.url && !cfg.supabase.url.startsWith("FILL-IN") &&
    key && !String(key).startsWith("FILL-IN");
  return useSupabase ? supabaseStore(cfg, key) : jsonStore(cfg);
}

function supabaseStore(cfg, key) {
  const sb = createClient(cfg.supabase.url, key, { auth: { persistSession: false } });
  return {
    kind: "supabase",
    async loadPrior() {
      const { data, error } = await sb.from("listings").select("*");
      if (error) throw error;
      return new Map((data || []).map((r) => [r.mls_number, r]));
    },
    async upsert(rows) {
      if (!rows.length) return;
      const { error } = await sb.from("listings").upsert(rows, { onConflict: "mls_number" });
      if (error) throw error;
    },
    async recordEvents(events) {
      if (!events.length) return;
      const { error } = await sb.from("listing_events").insert(events);
      if (error) throw error;
    },
    async unreportedEvents() {
      const { data, error } = await sb.from("listing_events").select("*").eq("reported", false)
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async markReported(ids) {
      if (!ids.length) return;
      await sb.from("listing_events").update({ reported: true }).in("id", ids);
    },
    async currentBoard() {
      const { data } = await sb.from("listings").select("*")
        .in("status", ["active", "coming_soon"]).order("price", { ascending: true });
      return data || [];
    },
  };
}

function jsonStore(cfg) {
  const path = cfg.jsonFallback || "./listings.json";
  const read = () => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { listings: {}, events: [] });
  const write = (d) => writeFileSync(path, JSON.stringify(d, null, 2));
  return {
    kind: "json",
    async loadPrior() { return new Map(Object.entries(read().listings)); },
    async upsert(rows) { const d = read(); for (const r of rows) d.listings[r.mls_number] = r; write(d); },
    async recordEvents(events) { const d = read(); d.events.push(...events); write(d); },
    async unreportedEvents() { return read().events.filter((e) => !e.reported); },
    async markReported(ids) {
      const d = read(); const s = new Set(ids);
      d.events.forEach((e, i) => { if (s.has(e.id ?? i)) e.reported = true; }); write(d);
    },
    async currentBoard() {
      return Object.values(read().listings)
        .filter((l) => ["active", "coming_soon"].includes(l.status))
        .sort((a, b) => a.price - b.price);
    },
  };
}
