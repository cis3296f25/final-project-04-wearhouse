import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";

export default function Account() {
  const { user } = useAuth();

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <div>
      <h2>Account</h2>
      <p>Email: <strong>{user?.email}</strong></p>
      <button className="btn secondary" onClick={logout}>Sign out</button>
    </div>
  );
}
