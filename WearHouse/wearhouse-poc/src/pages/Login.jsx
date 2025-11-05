import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useLocation, useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from?.pathname || "/";

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("Signing in…");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg("Login failed: " + error.message);
    setMsg("Welcome back!");
    nav(from, { replace: true });
  }

  return (
    <div>
      <h2>Log in</h2>
      <form className="form" onSubmit={onSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button className="btn" type="submit">Log In</button>
      </form>
      <div className="message">{msg}</div>
      <p>Need an account? <Link to="/auth/signup">Sign up</Link></p>
    </div>
  );
}
