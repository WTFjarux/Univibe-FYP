// admin-frontend/src/App.jsx

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Posts from "./pages/Posts";
import Comments from "./pages/Comments";
import Events from "./pages/Events";
import Users from "./pages/Users";
import Communities from "./pages/Communities";
import UserDetailPage from "./pages/UserDetailPage";
import Reports from "./pages/Reports";
import AdminLayout from "./components/layout/AdminLayout";
import useAuthStore from "./store/authStore";

// ============================================
// PLACEHOLDER PAGES (Keep for future use)
// ============================================

function Settings() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
      <h1
        style={{
          fontFamily: "Sofia Sans",
          fontWeight: 700,
          fontSize: 24,
          color: "#111827",
        }}
      >
        Settings
      </h1>
      <p className="text-gray-500 mt-2" style={{ fontFamily: "Sofia Sans" }}>
        Configure admin preferences
      </p>
      <span
        className="inline-block mt-3 px-3 py-1 rounded-full bg-purple-100 text-purple-600 text-xs font-semibold"
        style={{ fontFamily: "Sofia Sans" }}
      >
        Coming Soon
      </span>
    </div>
  );
}

// ============================================
// PROTECTED ROUTE WITH SESSION RESTORATION
// ============================================
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Try to restore session on mount
    restoreSession();
    setIsReady(true);
  }, []);

  // Show nothing while checking session
  if (!isReady) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#f8fafc" }}
      >
        <div className="w-8 h-8 border-[3px] border-gray-200 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ============================================
// APP
// ============================================
function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/comments" element={<Comments />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:userId" element={<UserDetailPage />} />
          <Route path="/events" element={<Events />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
