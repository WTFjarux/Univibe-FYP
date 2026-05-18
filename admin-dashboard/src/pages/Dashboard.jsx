// admin-frontend/src/pages/Dashboard.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FileText,
  MessageSquare,
  Calendar,
  Flag,
  Clock,
  TrendingUp,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import api from '../api/axios';
import useAuthStore from '../store/authStore';
import UserAvatar from '../components/users/UserAvatar';

/**
 * Admin Dashboard Page
 * 
 * Displays platform statistics, moderation overview, and recent users.
 * Uses Zustand auth store for user data and axios for API calls.
 */
function Dashboard() {
  // ============================================
  // AUTH STORE
  // ============================================
  const admin = useAuthStore((state) => state.admin); 
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // ============================================
  // STATE
  // ============================================
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // ============================================
  // REDIRECT IF NOT AUTHENTICATED
  // ============================================
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // ============================================
  // FETCH DASHBOARD STATS
  // ============================================
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/api/admin/dashboard/stats');
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.message || 'Failed to load dashboard data');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HANDLE LOGOUT
  // ============================================
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // ============================================
  // STAT CARDS DATA
  // ============================================
  const statCards = [
    {
      label: 'Total Users',
      value: stats?.users?.total || 0,
      sub: `${stats?.users?.active || 0} online now`,
      icon: Users,
      color: '#8b5cf6',
      bg: '#f3e8ff',
      path: '/users',
    },
    {
      label: 'Total Posts',
      value: stats?.content?.totalPosts || 0,
      sub: `${stats?.content?.deletedPosts || 0} deleted`,
      icon: FileText,
      color: '#3b82f6',
      bg: '#eff6ff',
      path: '/posts',
    },
    {
      label: 'Total Comments',
      value: stats?.content?.totalComments || 0,
      sub: `${stats?.content?.deletedComments || 0} deleted`,
      icon: MessageSquare,
      color: '#10b981',
      bg: '#ecfdf5',
      path: '/comments',
    },
    {
      label: 'Total Events',
      value: stats?.events?.total || 0,
      sub: `${stats?.events?.pending || 0} pending`,
      icon: Calendar,
      color: '#f59e0b',
      bg: '#fffbeb',
      path: '/events',
    },
  ];

  const moderationCards = [
    {
      label: 'Pending Reports',
      value: stats?.moderation?.pendingReports || 0,
      icon: Flag,
      color: '#ef4444',
      bg: '#fef2f2',
      breakdown: [
        { label: 'Posts', count: stats?.moderation?.reports?.posts || 0 },
        { label: 'Comments', count: stats?.moderation?.reports?.comments || 0 },
        { label: 'Users', count: stats?.moderation?.reports?.users || 0 },
        { label: 'Events', count: stats?.moderation?.reports?.events || 0 },
      ],
    },
    {
      label: 'Pending Approvals',
      value: stats?.moderation?.pendingApprovals || 0,
      icon: Clock,
      color: '#f59e0b',
      bg: '#fffbeb',
    },
    {
      label: 'Banned Users',
      value: stats?.users?.banned || 0,
      icon: AlertTriangle,
      color: '#ef4444',
      bg: '#fef2f2',
    },
  ];

  // ============================================
  // LOADING SKELETON
  // ============================================
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: '#e5e7eb' }} />
          <div className="h-4 w-64 rounded mt-2 animate-pulse" style={{ backgroundColor: '#e5e7eb' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-6 animate-pulse"
              style={{ backgroundColor: '#f3f4f6', height: '120px' }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: '#ef4444' }} />
          <p style={{ fontFamily: 'Sofia Sans', color: '#ef4444', fontWeight: 500 }}>
            {error}
          </p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#8b5cf6', fontFamily: 'Sofia Sans', fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // DASHBOARD CONTENT
  // ============================================
  return (
    <div className="space-y-8">
      {/* WELCOME HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl"
            style={{ fontFamily: 'Sofia Sans', fontWeight: 700, color: '#111827' }}
          >
            Welcome back, {admin?.name || 'Admin'}
          </h1>
          <p className="mt-1 text-sm" style={{ fontFamily: 'Sofia Sans', color: '#6b7280' }}>
            Here's what's happening on your platform today.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-all"
          style={{ fontFamily: 'Sofia Sans' }}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* MAIN STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            onClick={() => card.path && navigate(card.path)}
            className="rounded-2xl p-6 border transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer"
            style={{ backgroundColor: '#ffffff', borderColor: '#f3f4f6' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.bg }}
              >
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <TrendingUp className="w-4 h-4" style={{ color: '#9ca3af' }} />
            </div>
            <p className="text-3xl" style={{ fontFamily: 'Sofia Sans', fontWeight: 700, color: '#111827' }}>
              {card.value.toLocaleString()}
            </p>
            <p className="text-sm mt-1" style={{ fontFamily: 'Sofia Sans', fontWeight: 500, color: '#6b7280' }}>
              {card.label}
            </p>
            <p className="text-xs mt-0.5" style={{ fontFamily: 'Sofia Sans', color: '#9ca3af' }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* MODERATION OVERVIEW */}
      <div>
        <h2 className="text-xl mb-4" style={{ fontFamily: 'Sofia Sans', fontWeight: 700, color: '#111827' }}>
          Moderation Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {moderationCards.map((card, index) => (
            <div
              key={index}
              className="rounded-2xl p-6 border"
              style={{ backgroundColor: '#ffffff', borderColor: '#f3f4f6' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: card.bg }}>
                  <card.icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <p className="text-2xl" style={{ fontFamily: 'Sofia Sans', fontWeight: 700, color: card.color }}>
                  {card.value.toLocaleString()}
                </p>
              </div>
              <p className="text-sm" style={{ fontFamily: 'Sofia Sans', fontWeight: 500, color: '#6b7280' }}>
                {card.label}
              </p>
              {card.breakdown && (
                <div className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: '#f3f4f6' }}>
                  {card.breakdown.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span style={{ fontFamily: 'Sofia Sans', color: '#6b7280' }}>{item.label}</span>
                      <span style={{ fontFamily: 'Sofia Sans', fontWeight: 600, color: '#111827' }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* RECENT USERS - Using UserAvatar */}
      {stats?.users?.recent && stats.users.recent.length > 0 && (
        <div>
          <h2 className="text-xl mb-4" style={{ fontFamily: 'Sofia Sans', fontWeight: 700, color: '#111827' }}>
            Recent Users
          </h2>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: '#ffffff', borderColor: '#f3f4f6' }}
          >
            {stats.users.recent.map((user, index) => (
              <div
                key={user._id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                style={{
                  borderBottom:
                    index < stats.users.recent.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}
                onClick={() => navigate(`/users/${user._id}`)}
              >
                <div className="flex items-center gap-3">
                  <UserAvatar user={user} size="sm" gradient="from-purple-400 to-purple-600" />
                  <div>
                    <p className="text-sm" style={{ fontFamily: 'Sofia Sans', fontWeight: 600, color: '#111827' }}>
                      {user.name}
                    </p>
                    <p className="text-xs" style={{ fontFamily: 'Sofia Sans', color: '#6b7280' }}>
                      @{user.username || user.email?.split('@')[0]}
                    </p>
                  </div>
                </div>
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: user.isOnline ? '#10b981' : '#9ca3af',
                    opacity: user.isOnline ? 1 : 0.3,
                  }}
                  title={user.isOnline ? 'Online' : 'Offline'}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;