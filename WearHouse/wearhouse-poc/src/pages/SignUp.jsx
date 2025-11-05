import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("Creating account…");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return setMsg("Sign up failed: " + error.message);
    // If your project requires email confirmation, user must check email.
    setMsg("Success! Check your email to confirm your account.");
  }

  return (
    <div>
      <h2>Create account</h2>
      <form className="form" onSubmit={onSubmit}>
        <input type="email" placeholder="Email" value={email}
               onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Password (min 6 chars)" value={password}
               onChange={e=>setPassword(e.target.value)} required />
        <button className="btn" type="submit">Sign Up</button>
      </form>
      <div className="message">{msg}</div>
    </div>
  );
}
