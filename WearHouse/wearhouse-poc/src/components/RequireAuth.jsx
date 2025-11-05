import { useAuth } from "../contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="message">Checking your session…</div>;
  if (!user) return <Navigate to="/auth/login" state={{ from: loc }} replace />;
  return children;
}
