// admin-frontend/src/pages/Users.jsx

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Ban,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  Mail,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Users as UsersIcon,
  SlidersHorizontal,
  X,
  ExternalLink,
  Eye,
  LogOut,
} from 'lucide-react';
import API_BASE_URL from '../config';
import useAuthStore from '../store/authStore';
import UserAvatar from '../components/users/UserAvatar';
import UserDetailModal from '../components/users/UserDetailModal';
import WarnUserModal from '../components/users/WarnUserModal';
import BanUserModal from '../components/users/BanUserModal';
import SuspendUserModal from '../components/users/SuspendUserModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/**
 * User Management Page
 * 
 * Features:
 * - List all users with search, filter, sort
 * - View user details in modal
 * - Warn, suspend, ban, unban users
 * - Force logout users
 * - Uses Zustand auth store for token management
 * - Uses ConfirmDialog for destructive action confirmations
 */
function Users() {
  const navigate = useNavigate();

  // ============================================
  // AUTH STORE
  // ============================================
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // ============================================
  // STATE
  // ============================================
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [filter, setFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [detailModalUser, setDetailModalUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [warnModalUser, setWarnModalUser] = useState(null);
  const [showWarnModal, setShowWarnModal] = useState(false);
  const [banModalUser, setBanModalUser] = useState(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [suspendModalUser, setSuspendModalUser] = useState(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    onConfirm: null,
    loading: false,
  });

  // Refs
  const debounceTimerRef = useRef(null);

  // ============================================
  // REDIRECT IF NOT AUTHENTICATED
  // ============================================
  useEffect(() => {
    if (!isAuthenticated && !accessToken) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, accessToken, navigate]);

  // ============================================
  // DEBOUNCE SEARCH
  // ============================================
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [search]);

  // ============================================
  // FETCH USERS
  // ============================================
  const fetchUsers = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ page, limit: 20, status: filter, role: roleFilter, search: debouncedSearch, sort });

    fetch(`${API_BASE_URL}/api/admin/users?${params}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
      .then((response) => {
        if (response.status === 401) { logout(); navigate('/login', { replace: true }); throw new Error('Session expired'); }
        if (response.status === 403) throw new Error('You do not have permission to view users');
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          setUsers(data.data.users);
          setTotalPages(data.data.pagination.pages);
          setTotalUsers(data.data.pagination.total);
        } else setError(data.message || 'Failed to fetch users');
        setLoading(false);
      })
      .catch((err) => {
        if (err.message !== 'Session expired') setError(err.message || 'Network error');
        setLoading(false);
      });
  }, [page, filter, roleFilter, debouncedSearch, sort, accessToken, logout, navigate]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ============================================
  // CLOSE ACTION MENU ON OUTSIDE CLICK
  // ============================================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionMenuOpen && !e.target.closest('[data-action-menu]')) setActionMenuOpen(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [actionMenuOpen]);

  // ============================================
  // HANDLE USER ACTIONS
  // ============================================
  const handleAction = async (userId, action, body = {}) => {
    if (!accessToken) { logout(); navigate('/login', { replace: true }); return; }
    setActionLoading(userId);

    try {
      const endpoints = {
        warn: `/api/admin/users/${userId}/warn`,
        ban: `/api/admin/users/${userId}/ban`,
        unban: `/api/admin/users/${userId}/unban`,
        suspend: `/api/admin/users/${userId}/suspend`,
        unsuspend: `/api/admin/users/${userId}/unsuspend`,
        logout: `/api/admin/users/${userId}/logout`,
      };
      const method = action === 'logout' ? 'DELETE' : 'PUT';

      const response = await fetch(`${API_BASE_URL}${endpoints[action]}`, {
        method,
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401) { logout(); navigate('/login', { replace: true }); return; }
      const data = await response.json();

      if (data.success) {
        fetchUsers();
        setActionMenuOpen(null);
        setShowWarnModal(false); setWarnModalUser(null);
        setShowBanModal(false); setBanModalUser(null);
        setShowSuspendModal(false); setSuspendModalUser(null);
      } else {
        alert(data.message || 'Action failed');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================
  // CONFIRM ACTION HELPER
  // ============================================
  const confirmAction = (userId, action, body = {}, config) => {
    const { title, message, variant = 'danger', userName = 'this user' } = config;

    const messages = {
      unban: {
        title: 'Unban User',
        message: `Are you sure you want to unban ${userName}? They will regain full access to the platform.`,
        variant: 'warning',
      },
      unsuspend: {
        title: 'Lift Suspension',
        message: `Are you sure you want to lift the suspension for ${userName}? They will regain access immediately.`,
        variant: 'warning',
      },
      logout: {
        title: 'Force Logout',
        message: `Are you sure you want to force logout ${userName} from all devices?`,
        variant: 'info',
      },
    };

    const defaultConfig = messages[action] || { title, message, variant };

    setConfirmDialog({
      isOpen: true,
      title: title || defaultConfig.title,
      message: message || defaultConfig.message,
      variant: variant || defaultConfig.variant,
      loading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        await handleAction(userId, action, body);
        setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
      },
    });
  };

  // ============================================
  // CONFIRM LOGOUT
  // ============================================
  const confirmLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Logout',
      message: 'Are you sure you want to logout from the admin panel?',
      variant: 'warning',
      loading: false,
      onConfirm: () => {
        logout();
        navigate('/login', { replace: true });
      },
    });
  };

  const closeConfirmDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  // ============================================
  // HELPERS
  // ============================================
  const getStatusBadge = (user) => {
    if (user.isBanned) return { label: 'Banned', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
    if (user.isSuspended) return { label: 'Suspended', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
    if (user.warningCount > 0) return { label: 'Warned', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' };
    return { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
  };

  const getRoleBadge = (role) => {
    const roles = {
      admin: { label: 'Admin', bg: 'bg-purple-50', text: 'text-purple-700' },
      moderator: { label: 'Mod', bg: 'bg-blue-50', text: 'text-blue-700' },
      user: { label: 'User', bg: 'bg-gray-50', text: 'text-gray-600' },
    };
    return roles[role] || roles.user;
  };

  const statusFilters = [
    { value: 'all', label: 'All Users' }, { value: 'active', label: 'Active' },
    { value: 'warned', label: 'Warned' }, { value: 'suspended', label: 'Suspended' }, { value: 'banned', label: 'Banned' },
  ];

  const roleFiltersList = [
    { value: 'all', label: 'All Roles' }, { value: 'user', label: 'Users' },
    { value: 'moderator', label: 'Moderators' }, { value: 'admin', label: 'Admins' },
  ];

  const hasActiveFilters = filter !== 'all' || roleFilter !== 'all' || search !== '' || sort !== 'newest';

  const clearFilters = () => {
    setFilter('all'); setRoleFilter('all'); setSearch(''); setDebouncedSearch(''); setSort('newest'); setPage(1);
  };

  const handleUserClick = (user, e) => {
    e.stopPropagation();
    setActionMenuOpen(actionMenuOpen === user._id ? null : user._id);
  };

  const openDetailModal = (user, e) => { e.stopPropagation(); setDetailModalUser(user); setShowDetailModal(true); setActionMenuOpen(null); };
  const openWarnModal = (user, e) => { e.stopPropagation(); setWarnModalUser(user); setShowWarnModal(true); setActionMenuOpen(null); };
  const openBanModal = (user, e) => { e.stopPropagation(); setBanModalUser(user); setShowBanModal(true); setActionMenuOpen(null); };
  const openSuspendModal = (user, e) => { e.stopPropagation(); setSuspendModalUser(user); setShowSuspendModal(true); setActionMenuOpen(null); };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>User Management</h1>
            <p className="mt-1 text-sm text-gray-500" style={{ fontFamily: 'Sofia Sans' }}>{totalUsers.toLocaleString()} total users registered</p>
          </div>
          <button onClick={confirmLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-all" style={{ fontFamily: 'Sofia Sans' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
      {/* SEARCH & FILTER BAR */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by name, email, or username..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-11 pr-10 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              style={{ fontFamily: 'Sofia Sans' }} />
            {search && (
              <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100">
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${showFilters || hasActiveFilters ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            style={{ fontFamily: 'Sofia Sans' }}>
            <SlidersHorizontal size={18} /> Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-purple-500" />}
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 bg-white cursor-pointer hover:bg-gray-50" style={{ fontFamily: 'Sofia Sans' }}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2" style={{ fontFamily: 'Sofia Sans' }}>Status:</span>
              {statusFilters.map((f) => (
                <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === f.value ? 'bg-purple-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  style={{ fontFamily: 'Sofia Sans' }}>{f.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2" style={{ fontFamily: 'Sofia Sans' }}>Role:</span>
              {roleFiltersList.map((f) => (
                <button key={f.value} onClick={() => { setRoleFilter(f.value); setPage(1); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${roleFilter === f.value ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  style={{ fontFamily: 'Sofia Sans' }}>{f.label}</button>
              ))}
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-3 text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1" style={{ fontFamily: 'Sofia Sans' }}>
                <X size={14} /> Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-1/4" /><div className="h-3 bg-gray-100 rounded w-1/3" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center"><AlertTriangle size={28} className="text-red-500" /></div>
          <p className="text-red-500 font-medium" style={{ fontFamily: 'Sofia Sans' }}>{error}</p>
          <button onClick={fetchUsers} className="mt-4 px-6 py-2.5 rounded-full bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-all">Retry</button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {users.map((user) => {
              const status = getStatusBadge(user);
              const role = getRoleBadge(user.role);
              return (
                <div key={user._id} data-action-menu
                  className={`bg-white rounded-xl border p-4 transition-all cursor-pointer ${actionMenuOpen === user._id ? 'border-purple-300 shadow-md bg-purple-50/30' : 'border-gray-100 hover:border-purple-200 hover:shadow-sm'}`}>
                  <div className="flex items-center gap-4" onClick={(e) => handleUserClick(user, e)}>
                    <div className="relative flex-shrink-0">
                      <UserAvatar user={user} size="lg" gradient="from-purple-400 to-purple-600" />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${user.isOnline ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>{user.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${role.bg} ${role.text}`} style={{ fontFamily: 'Sofia Sans' }}>{role.label}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${status.bg} ${status.text} ${status.border}`} style={{ fontFamily: 'Sofia Sans' }}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400" style={{ fontFamily: 'Sofia Sans' }}>
                        <span className="flex items-center gap-1"><Mail size={11} /><span className="truncate max-w-[200px]">{user.email}</span></span>
                        {user.username && <span>@{user.username}</span>}
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">{new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {user.warningCount > 0 && (<><span className="hidden sm:inline">•</span><span className="text-amber-600 font-medium">{user.warningCount} warning{user.warningCount > 1 ? 's' : ''}</span></>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400 hidden sm:block" style={{ fontFamily: 'Sofia Sans' }}>Click for options</span>
                      <MoreVertical size={18} className={`text-gray-400 transition-transform ${actionMenuOpen === user._id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Action Menu */}
                  {actionMenuOpen === user._id && (
                    <div className="mt-3 pt-3 border-t border-purple-100 grid grid-cols-2 sm:grid-cols-4 gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => openDetailModal(user, e)} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all" style={{ fontFamily: 'Sofia Sans' }}><Eye size={14} />View Details</button>
                      
                      {!user.isBanned && <button onClick={(e) => openWarnModal(user, e)} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-amber-600 hover:bg-amber-50 transition-all" style={{ fontFamily: 'Sofia Sans' }}><AlertTriangle size={14} />Warn</button>}
                      
                      {/* Unsuspend - with ConfirmDialog */}
                      {user.isSuspended ? (
                        <button
                          onClick={() => confirmAction(user._id, 'unsuspend', {}, { userName: user.name })}
                          disabled={actionLoading === user._id}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-50"
                          style={{ fontFamily: 'Sofia Sans' }}
                        ><UserCheck size={14} />Unsuspend</button>
                      ) : (!user.isBanned && (
                        <button onClick={(e) => openSuspendModal(user, e)} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-orange-600 hover:bg-orange-50 transition-all" style={{ fontFamily: 'Sofia Sans' }}><Clock size={14} />Suspend</button>
                      ))}
                      
                      {/* Unban - with ConfirmDialog */}
                      {user.isBanned ? (
                        <button
                          onClick={() => confirmAction(user._id, 'unban', {}, { userName: user.name })}
                          disabled={actionLoading === user._id}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-50"
                          style={{ fontFamily: 'Sofia Sans' }}
                        ><UserCheck size={14} />Unban</button>
                      ) : (
                        <button onClick={(e) => openBanModal(user, e)} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-all" style={{ fontFamily: 'Sofia Sans' }}><Ban size={14} />Ban</button>
                      )}
                      
                      {/* Force Logout - with ConfirmDialog */}
                      <button
                        onClick={() => confirmAction(user._id, 'logout', {}, { userName: user.name })}
                        disabled={actionLoading === user._id}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-all disabled:opacity-50"
                        style={{ fontFamily: 'Sofia Sans' }}
                      ><UserX size={14} />Force Logout</button>
                      
                      <button onClick={() => { navigate(`/users/${user._id}`); setActionMenuOpen(null); }} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-purple-600 hover:bg-purple-50 transition-all sm:col-span-2" style={{ fontFamily: 'Sofia Sans' }}><ExternalLink size={14} />View Full Profile</button>
                    </div>
                  )}
                </div>
              );
            })}
            {users.length === 0 && !loading && (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <UsersIcon size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium" style={{ fontFamily: 'Sofia Sans' }}>No users found</p>
                <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'Sofia Sans' }}>Try adjusting your search or filters</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 py-8">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2.5 rounded-xl border border-gray-200 flex items-center gap-2 text-sm font-medium disabled:opacity-30 hover:bg-gray-50" style={{ fontFamily: 'Sofia Sans', color: '#374151' }}><ChevronLeft size={16} />Previous</button>
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (pageNum === 1 || pageNum === totalPages || (pageNum >= page - 1 && pageNum <= page + 1)) {
                  return <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all ${page === pageNum ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`} style={{ fontFamily: 'Sofia Sans' }}>{pageNum}</button>;
                }
                if (pageNum === page - 2 || pageNum === page + 2) return <span key={pageNum} className="text-gray-400 text-sm">...</span>;
                return null;
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2.5 rounded-xl border border-gray-200 flex items-center gap-2 text-sm font-medium disabled:opacity-30 hover:bg-gray-50" style={{ fontFamily: 'Sofia Sans', color: '#374151' }}>Next<ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}

      {/* MODALS */}
      {showDetailModal && detailModalUser && (
        <UserDetailModal user={detailModalUser} onClose={() => { setShowDetailModal(false); setDetailModalUser(null); }} onRefresh={fetchUsers} onViewFullProfile={(userId) => { setShowDetailModal(false); navigate(`/users/${userId}`); }} />
      )}
      {showWarnModal && warnModalUser && (
        <WarnUserModal user={warnModalUser} onClose={() => { setShowWarnModal(false); setWarnModalUser(null); }} onSubmit={(reason, severity) => handleAction(warnModalUser._id, 'warn', { reason, severity })} loading={actionLoading === warnModalUser._id} />
      )}
      {showBanModal && banModalUser && (
        <BanUserModal user={banModalUser} onClose={() => { setShowBanModal(false); setBanModalUser(null); }} onSubmit={(reason) => handleAction(banModalUser._id, 'ban', { reason })} loading={actionLoading === banModalUser._id} />
      )}
      {showSuspendModal && suspendModalUser && (
        <SuspendUserModal user={suspendModalUser} onClose={() => { setShowSuspendModal(false); setSuspendModalUser(null); }} onSubmit={(reason, duration) => handleAction(suspendModalUser._id, 'suspend', { reason, duration })} loading={actionLoading === suspendModalUser._id} />
      )}

      {/* Confirm Dialog */}
       <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        loading={confirmDialog.loading}
      />
    </div>
  );
}

export default Users;