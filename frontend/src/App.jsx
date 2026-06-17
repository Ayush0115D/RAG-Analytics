import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import { getMe } from "./api";

function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("rag_token");
    if (!token) {
      setChecking(false);
      setValid(false);
      return;
    }
    getMe()
      .then(() => setValid(true))
      .catch(() => {
        localStorage.removeItem("rag_token");
        localStorage.removeItem("rag_user");
        setValid(false);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!valid) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("rag_token");
    if (!token) {
      setChecking(false);
      setValid(false);
      return;
    }
    getMe()
      .then(() => setValid(true))
      .catch(() => {
        localStorage.removeItem("rag_token");
        localStorage.removeItem("rag_user");
        setValid(false);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (valid) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { pathname } = useLocation();

  if (pathname === "/dashboard") {
    return (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    );
  }

  return (
    <PublicRoute>
      <AuthPage />
    </PublicRoute>
  );
}
