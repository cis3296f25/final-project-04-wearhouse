import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Browse() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setMsg("Loading…");
      // Change "items" to whatever table you want to show.
      const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) setMsg("Load failed: " + error.message);
      else { setRows(data ?? []); setMsg(""); }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <section className="items-wrap">
      <h3>Table: items</h3>
      {msg && <div className="message">{msg}</div>}
      <div className="grid">
        {rows.map(r => (
          <article key={r.id ?? crypto.randomUUID()} className="card">
            {r.image_url ? <img src={r.image_url} alt={r.name ?? "row image"} /> : null}
            <div className="title">{r.name ?? "(no name)"}</div>
            <div className="meta">{[r.category, r.color].filter(Boolean).join(" • ") || "—"}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
