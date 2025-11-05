import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function CreateUser() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [closet, setCloset] = useState("");    // number (int4)
  const [zip, setZip] = useState("");          // number (int8)
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState([]);

  async function loadUsers() {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("user_id", { ascending: true });
    if (error) setMsg("Load failed: " + error.message);
    else setRows(data || []);
  }

  useEffect(() => { loadUsers(); }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("Saving…");

    // Convert numeric inputs safely; allow empty → null
    const user_closet = closet === "" ? null : Number(closet);
    const user_zip    = zip === "" ? null : Number(zip);

    const { error } = await supabase.from("users").insert([
      {
        user_email: email.trim(),
        user_password: password,       // (plain text demo; in production, do NOT store plain passwords)
        user_closet,
        user_zip,
      },
    ]);

    if (error) {
      setMsg("Insert failed: " + error.message);
      return;
    }

    setMsg("Saved!");
    setEmail("");
    setPassword("");
    setCloset("");
    setZip("");

    // Refresh list
    await loadUsers();
  }

  return (
    <div>
      <h2>Create Account (demo)</h2>

      <form className="form" onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Password (demo only)"
          value={password}
          onChange={e=>setPassword(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Closet size (int)"
          value={closet}
          onChange={e=>setCloset(e.target.value)}
        />
        <input
          type="number"
          placeholder="ZIP code (int)"
          value={zip}
          onChange={e=>setZip(e.target.value)}
        />
        <button className="btn" type="submit">Add User</button>
      </form>

      <div className="message" aria-live="polite">{msg}</div>

      <h3>users table</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>user_id</th>
              <th>user_email</th>
              <th>user_password</th>
              <th>user_closet</th>
              <th>user_zip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.user_id}>
                <td>{r.user_id}</td>
                <td>{r.user_email}</td>
                <td>{r.user_password}</td>
                <td>{r.user_closet ?? "—"}</td>
                <td>{r.user_zip ?? "—"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center" }}>No rows yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
