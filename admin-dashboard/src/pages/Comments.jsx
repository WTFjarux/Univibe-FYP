// admin-frontend/src/pages/Comments.jsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, Flag, LogOut } from 'lucide-react';
import API_BASE_URL, { getFullImageUrl } from '../config';
import useAuthStore from '../store/authStore';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/**
 * Comments Moderation Page
 * 
 * View and moderate all platform comments.
 * Uses Zustand auth store for token management.
 * Uses ConfirmDialog for destructive action confirmations.
 */
function Comments() {
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
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [avatarErrors, setAvatarErrors] = useState({});
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

  // ============================================
  // REDIRECT IF NOT AUTHENTICATED
  // ============================================
  useEffect(() => {
    if (!isAuthenticated && !accessToken) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, accessToken, navigate]);

  // ============================================
  // FETCH COMMENTS
  // ============================================
  const fetchComments = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ page, limit: 20, status: filter, search });

    fetch(`${API_BASE_URL}/api/admin/comments?${params}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
      .then((response) => {
        if (response.status === 401) { logout(); navigate('/login', { replace: true }); throw new Error('Session expired'); }
        if (response.status === 403) throw new Error('You do not have permission to view comments');
        return response.json();
      })
      .then((data) => {
        if (data.success) { setComments(data.data.comments); setTotalPages(data.data.pagination.pages); }
        else setError(data.message || 'Failed to fetch comments');
        setLoading(false);
      })
      .catch((err) => {
        if (err.message !== 'Session expired') setError(err.message || 'Network error');
        setLoading(false);
      });
  }, [page, filter, search, accessToken, logout, navigate]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // ============================================
  // HANDLE SEARCH
  // ============================================
  const handleSearch = () => { setPage(1); fetchComments(); };

  // ============================================
  // HANDLE DELETE COMMENT
  // ============================================
  const handleDelete = async (id) => {
    if (!accessToken) return;
    setActionLoading(id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/comments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (response.status === 401) { logout(); navigate('/login', { replace: true }); return; }

      const data = await response.json();
      if (data.success) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === id ? { ...c, isDeleted: true, content: '[removed by moderator]' } : c
          )
        );
      } else {
        alert(data.message || 'Failed to delete comment');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================
  // CONFIRM DELETE
  // ============================================
  const confirmDelete = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Comment',
      message: 'Are you sure you want to remove this comment? This action cannot be undone.',
      variant: 'danger',
      loading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        await handleDelete(id);
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
  // FILTER OPTIONS
  // ============================================
  const filters = [
    { value: 'all', label: 'All' },
    { value: 'reported', label: 'Reported' },
    { value: 'deleted', label: 'Deleted' },
  ];

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>Comments Moderation</h1>
          <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Sofia Sans' }}>{comments.length} comments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-5 py-3 rounded-full border border-gray-200 bg-white shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input type="text" placeholder="Search comments..." value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="border-none outline-none bg-transparent text-sm text-gray-900 w-48" style={{ fontFamily: 'Sofia Sans' }} />
          </div>
          <button onClick={confirmLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-all" style={{ fontFamily: 'Sofia Sans' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${filter === f.value ? 'bg-purple-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
            style={{ fontFamily: 'Sofia Sans' }}>{f.label}</button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-9 h-9 border-[3px] border-gray-200 border-t-purple-500 rounded-full animate-spin" /></div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3" style={{ fontFamily: 'Sofia Sans' }}>{error}</p>
          <button onClick={fetchComments} className="px-5 py-2 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 transition-colors" style={{ fontFamily: 'Sofia Sans' }}>Retry</button>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment._id} className={`bg-white rounded-xl border p-5 transition-colors ${comment.isDeleted ? 'border-red-200 bg-red-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start gap-4">
                {comment.user?.profilePicture && !avatarErrors[comment._id] ? (
                  <img src={getFullImageUrl(comment.user.profilePicture)} alt="" onError={() => setAvatarErrors((prev) => ({ ...prev, [comment._id]: true }))}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-gray-100" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ fontFamily: 'Sofia Sans' }}>
                    {comment.user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>{comment.user?.name || 'Unknown'}</span>
                    <span className="text-xs text-gray-400" style={{ fontFamily: 'Sofia Sans' }}>@{comment.user?.username || 'user'}</span>
                    {comment.isDeleted && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Deleted</span>}
                  </div>
                  <p className={`text-sm mb-2 ${comment.isDeleted ? 'text-gray-400 line-through' : 'text-gray-700'}`} style={{ fontFamily: 'Sofia Sans' }}>{comment.content}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400" style={{ fontFamily: 'Sofia Sans' }}>
                    <span className="truncate max-w-[200px]">Post: {comment.post?.content?.substring(0, 40) || '...'}</span>
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`flex items-center gap-1 text-sm font-semibold ${comment.reportCount > 0 ? 'text-red-500' : 'text-gray-300'}`} style={{ fontFamily: 'Sofia Sans' }}><Flag size={14} /> {comment.reportCount || 0}</span>
                  {!comment.isDeleted && (
                    <button onClick={() => confirmDelete(comment._id)} disabled={actionLoading === comment._id}
                      className="px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50" style={{ fontFamily: 'Sofia Sans' }}>
                      <Trash2 size={14} className="inline mr-1" />Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {comments.length === 0 && !loading && <div className="text-center py-20"><p className="text-gray-500" style={{ fontFamily: 'Sofia Sans' }}>No comments found</p></div>}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-8">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium disabled:opacity-30 hover:bg-gray-50 transition-colors" style={{ fontFamily: 'Sofia Sans' }}>Previous</button>
          <span className="py-2 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Sofia Sans' }}>{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium disabled:opacity-30 hover:bg-gray-50 transition-colors" style={{ fontFamily: 'Sofia Sans' }}>Next</button>
        </div>
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

export default Comments;