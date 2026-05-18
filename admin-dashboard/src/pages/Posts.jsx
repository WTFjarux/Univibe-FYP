// admin-frontend/src/pages/Posts.jsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Trash2, RotateCcw, ChevronLeft, ChevronRight,
  Eye, X, Heart, MessageCircle, Flag, MapPin,
  LogOut, ExternalLink,
} from 'lucide-react';
import API_BASE_URL, { getFullImageUrl as getImgUrl } from '../config';
import useAuthStore from '../store/authStore';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import UserAvatar from '../components/users/UserAvatar';

function Posts() {
  const navigate = useNavigate();

  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false, title: '', message: '', variant: 'danger', onConfirm: null, loading: false,
  });

  useEffect(() => {
    if (!isAuthenticated && !accessToken) navigate('/login', { replace: true });
  }, [isAuthenticated, accessToken, navigate]);

  const fetchPosts = useCallback(() => {
    if (!accessToken) return;
    setLoading(true); setError('');
    const params = new URLSearchParams({ page, limit: 20, status: filter, search });
    fetch(`${API_BASE_URL}/api/admin/posts?${params}`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    })
      .then((response) => {
        if (response.status === 401) { logout(); navigate('/login', { replace: true }); throw new Error('Session expired'); }
        if (response.status === 403) throw new Error('You do not have permission to view posts');
        return response.json();
      })
      .then((data) => {
        if (data.success) { setPosts(data.data.posts); setTotalPages(data.data.pagination.pages); }
        else setError(data.message || 'Failed to fetch posts');
        setLoading(false);
      })
      .catch((err) => { if (err.message !== 'Session expired') setError(err.message || 'Network error'); setLoading(false); });
  }, [page, filter, search, accessToken, logout, navigate]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleSearch = () => { setPage(1); fetchPosts(); };

  const handleDelete = async (postId) => {
    if (!accessToken) return;
    setActionLoading(postId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Moderator action' }),
      });
      if (response.status === 401) { logout(); navigate('/login', { replace: true }); return; }
      const data = await response.json();
      if (data.success) {
        setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, isDeleted: true } : p)));
        setSelectedPost(null);
      } else alert(data.message || 'Failed to delete post');
    } catch (err) { alert('Network error. Please try again.'); }
    finally { setActionLoading(null); }
  };

  const handleRestore = async (postId) => {
    if (!accessToken) return;
    setActionLoading(postId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/posts/${postId}/restore`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      if (response.status === 401) { logout(); navigate('/login', { replace: true }); return; }
      const data = await response.json();
      if (data.success) {
        setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, isDeleted: false } : p)));
        setSelectedPost(null);
      } else alert(data.message || 'Failed to restore post');
    } catch (err) { alert('Network error. Please try again.'); }
    finally { setActionLoading(null); }
  };

  const confirmDelete = (postId) => {
    setConfirmDialog({
      isOpen: true, title: 'Remove Post',
      message: 'Are you sure you want to remove this post? The user will be notified and the post will be hidden from view.',
      variant: 'danger', loading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        await handleDelete(postId);
        setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
      },
    });
  };

  const confirmRestore = (postId) => {
    setConfirmDialog({
      isOpen: true, title: 'Restore Post',
      message: 'Are you sure you want to restore this post? It will become visible to users again.',
      variant: 'info', loading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        await handleRestore(postId);
        setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
      },
    });
  };

  const confirmLogout = () => {
    setConfirmDialog({
      isOpen: true, title: 'Logout',
      message: 'Are you sure you want to logout from the admin panel?',
      variant: 'warning', loading: false,
      onConfirm: () => { logout(); navigate('/login', { replace: true }); },
    });
  };

  const closeConfirmDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Filter options similar to Comments page
  const filters = [
    { value: 'all', label: 'All Posts' },
    { value: 'reported', label: 'Reported' },
    { value: 'anonymous', label: 'Anonymous' },
    { value: 'deleted', label: 'Deleted' },
  ];

  // Visibility helper functions
  const getVisibilityDisplayName = (visibility) => {
    const names = {
      campus: "Campus",
      connections: "Connections",
    };
    return names[visibility] || "Public";
  };

  const getVisibilityBadgeColor = (visibility) => {
    const colors = {
      campus: "#3b82f6",
      connections: "#8b5cf6",
    };
    return colors[visibility] || "#9ca3af";
  };

  // Render images with blur background
  const renderPostImages = (images, isDeleted = false) => {
    if (!images?.length) return null;
    
    const imageCount = images.length;
    const opacityClass = isDeleted ? 'opacity-50' : '';
    
    if (imageCount === 1) {
      const imageUrl = getImgUrl(images[0].url);
      return (
        <div className={`relative w-full overflow-hidden ${opacityClass}`} style={{ backgroundColor: '#f0f2f5' }}>
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-2xl scale-110 opacity-60"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <div className="relative flex items-center justify-center" style={{ minHeight: '200px' }}>
            <img
              src={imageUrl}
              alt="Post image"
              className="w-auto h-auto max-w-full max-h-[500px] object-contain"
              style={{ maxHeight: '500px', minHeight: '200px' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/500x300?text=Image+failed+to+load';
              }}
            />
          </div>
        </div>
      );
    }
    
    if (imageCount === 2) {
      return (
        <div className={`grid grid-cols-2 gap-[3px] overflow-hidden ${opacityClass}`}>
          {images.map((img, idx) => {
            const imageUrl = getImgUrl(img.url);
            return (
              <div key={idx} className="relative bg-[#f0f2f5]" style={{ paddingBottom: '100%' }}>
                <div 
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-xl scale-110 opacity-60"
                  style={{ backgroundImage: `url(${imageUrl})` }}
                />
                <img
                  src={imageUrl}
                  alt={`Post ${idx + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/400x400?text=Error';
                  }}
                />
              </div>
            );
          })}
        </div>
      );
    }
    
    return (
      <div className={`overflow-hidden ${opacityClass}`}>
        <div className="grid grid-cols-2 gap-[3px]">
          {images.slice(0, 4).map((img, idx) => {
            const imageUrl = getImgUrl(img.url);
            const isLastWithMore = idx === 3 && images.length > 4;
            return (
              <div key={idx} className="relative bg-[#f0f2f5]" style={{ paddingBottom: '100%' }}>
                <div 
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-xl scale-110 opacity-60"
                  style={{ backgroundImage: `url(${imageUrl})` }}
                />
                <img
                  src={imageUrl}
                  alt={`Post ${idx + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/400x400?text=Error';
                  }}
                />
                {isLastWithMore && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xl font-bold">+{images.length - 4}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header - Similar to Comments page */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>Posts Moderation</h1>
          <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Sofia Sans' }}>{posts.length} posts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-5 py-3 rounded-full border border-gray-200 bg-white shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Search posts..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="border-none outline-none bg-transparent text-sm text-gray-900 w-48" 
              style={{ fontFamily: 'Sofia Sans' }} 
            />
          </div>
          <button 
            onClick={confirmLogout} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-all" 
            style={{ fontFamily: 'Sofia Sans' }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Filters - Similar to Comments page */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button 
            key={f.value} 
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
              filter === f.value 
                ? 'bg-purple-500 text-white shadow-sm' 
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
            style={{ fontFamily: 'Sofia Sans' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-9 h-9 border-[3px] border-gray-200 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3" style={{ fontFamily: 'Sofia Sans' }}>{error}</p>
          <button 
            onClick={fetchPosts} 
            className="px-5 py-2 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 transition-colors" 
            style={{ fontFamily: 'Sofia Sans' }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div 
              key={post._id} 
              className={`bg-white rounded-xl border p-5 transition-colors ${
                post.isDeleted ? 'border-red-200 bg-red-50/30' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              {/* Post Header */}
              <div className="flex items-start gap-4">
                {post.isAnonymous ? (
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 border border-dashed border-gray-300">
                    <Eye size={18} className="text-gray-400" />
                  </div>
                ) : (
                  <UserAvatar user={post.user} size="sm" gradient="from-purple-500 to-purple-600" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>
                      {post.isAnonymous ? 'Anonymous' : post.user?.name || 'Unknown User'}
                    </span>
                    <span className="text-xs text-gray-400" style={{ fontFamily: 'Sofia Sans' }}>
                      @{post.isAnonymous ? 'anonymous' : post.user?.username || 'user'}
                    </span>
                    {post.visibility && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ 
                          backgroundColor: `${getVisibilityBadgeColor(post.visibility)}15`,
                          color: getVisibilityBadgeColor(post.visibility)
                        }}
                      >
                        <MapPin size={10} />
                        {getVisibilityDisplayName(post.visibility)}
                      </span>
                    )}
                    {post.isAnonymous && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">
                        Anonymous
                      </span>
                    )}
                    {post.isDeleted && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                        Deleted
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-400" style={{ fontFamily: 'Sofia Sans' }}>
                    <span>{formatTimeAgo(post.createdAt)}</span>

                  </div>
                  
                  {/* Post Content */}
                  {post.content && (
                    <p className={`text-sm mb-3 ${post.isDeleted ? 'text-gray-400 line-through' : 'text-gray-700'}`} style={{ fontFamily: 'Sofia Sans' }}>
                      {post.content}
                    </p>
                  )}

                  {/* Post Images with Blur Background */}
                  {post.images?.length > 0 && (
                    <div className="mb-3 -mx-1">
                      {renderPostImages(post.images, post.isDeleted)}
                    </div>
                  )}

                  {/* Post Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-3 mt-2" style={{ fontFamily: 'Sofia Sans' }}>
                    <span className="flex items-center gap-1">
                      <Heart size={12} className="text-red-500 fill-red-500" /> {post.likes?.length || 0} likes
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={12} /> {post.commentCount || 0} comments
                    </span>
                    <span className={`flex items-center gap-1 ${post.reportCount > 0 ? 'text-red-500 font-semibold' : ''}`}>
                      <Flag size={12} /> {post.reportCount || 0} reports
                    </span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button 
                    onClick={() => setSelectedPost(post)} 
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title="View details"
                  >
                    <ExternalLink size={16} className="text-gray-500" />
                  </button>
                  {post.isDeleted ? (
                    <button 
                      onClick={() => confirmRestore(post._id)} 
                      disabled={actionLoading === post._id}
                      className="px-3 py-1.5 rounded-full bg-green-50 text-green-600 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
                      style={{ fontFamily: 'Sofia Sans' }}
                    >
                      <RotateCcw size={14} className="inline mr-1" /> Restore
                    </button>
                  ) : (
                    <button 
                      onClick={() => confirmDelete(post._id)} 
                      disabled={actionLoading === post._id}
                      className="px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                      style={{ fontFamily: 'Sofia Sans' }}
                    >
                      <Trash2 size={14} className="inline mr-1" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {posts.length === 0 && !loading && (
            <div className="text-center py-20">
              <p className="text-gray-500" style={{ fontFamily: 'Sofia Sans' }}>No posts found</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination - Similar to Comments page */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-8">
          <button 
            onClick={() => setPage((p) => Math.max(1, p - 1))} 
            disabled={page === 1}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium disabled:opacity-30 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'Sofia Sans' }}
          >
            Previous
          </button>
          <span className="py-2 text-sm font-semibold text-gray-700" style={{ fontFamily: 'Sofia Sans' }}>
            {page} / {totalPages}
          </span>
          <button 
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
            disabled={page === totalPages}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium disabled:opacity-30 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'Sofia Sans' }}
          >
            Next
          </button>
        </div>
      )}

      {/* POST DETAIL MODAL */}
      {selectedPost && (
        <div onClick={() => setSelectedPost(null)} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-[500px] max-h-[90vh] overflow-auto shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-[17px] font-bold text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>Post Details</h2>
              <button onClick={() => setSelectedPost(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center gap-2.5 mb-3">
                {selectedPost.isAnonymous ? (
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Eye size={18} className="text-gray-400" />
                  </div>
                ) : (
                  <UserAvatar user={selectedPost.user} size="sm" gradient="from-purple-500 to-purple-600" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[15px] font-semibold text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>
                      {selectedPost.isAnonymous ? 'Anonymous' : selectedPost.user?.name || 'Unknown'}
                    </span>
                    {selectedPost.isAnonymous && (
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Anonymous</span>
                    )}
                    {selectedPost.isDeleted && (
                      <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Deleted</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[11px] text-gray-500">{formatTimeAgo(selectedPost.createdAt)}</span>
                    <span className="text-[11px] text-gray-500">·</span>
                    <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
                      <MapPin size={9} />
                      {selectedPost.visibility === 'campus' ? 'Campus' : 'Connections'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedPost.content && (
                <p className="text-[14px] leading-relaxed text-gray-700 mb-3 whitespace-pre-wrap break-words" style={{ fontFamily: 'Sofia Sans' }}>
                  {selectedPost.content}
                </p>
              )}

              {selectedPost.images?.length > 0 && (
                <div className="mb-4 rounded-xl overflow-hidden bg-gray-100">
                  {selectedPost.images.length === 1 ? (
                    <div className="relative">
                      <div 
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-2xl scale-110 opacity-60"
                        style={{ backgroundImage: `url(${getImgUrl(selectedPost.images[0].url)})` }}
                      />
                      <div className="relative flex items-center justify-center" style={{ minHeight: '200px' }}>
                        <img 
                          src={getImgUrl(selectedPost.images[0].url)} 
                          alt="Post" 
                          className="w-auto h-auto max-w-full max-h-[400px] object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-[3px]">
                      {selectedPost.images.slice(0, 4).map((img, i) => {
                        const imageUrl = getImgUrl(img.url);
                        return (
                          <div key={i} className="relative bg-gray-100" style={{ paddingBottom: '100%' }}>
                            <div 
                              className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-xl scale-110 opacity-60"
                              style={{ backgroundImage: `url(${imageUrl})` }}
                            />
                            <img 
                              src={imageUrl} 
                              alt={`Post ${i + 1}`} 
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 py-2 border-y border-gray-100 mb-3">
                <span className="flex items-center gap-1.5 text-[13px] text-gray-600">
                  <Heart size={14} className="text-red-500 fill-red-500" /> {selectedPost.likes?.length || 0} likes
                </span>
                <span className="flex items-center gap-1.5 text-[13px] text-gray-600">
                  <MessageCircle size={14} /> {selectedPost.commentCount || 0} comments
                </span>
                <span className={`flex items-center gap-1.5 text-[13px] ${selectedPost.reportCount > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                  <Flag size={14} /> {selectedPost.reportCount || 0} reports
                </span>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                {[
                  ['Post ID', selectedPost._id],
                  ['Author', selectedPost.isAnonymous ? 'Anonymous' : selectedPost.user?.name || 'Unknown'],
                  ['Username', selectedPost.isAnonymous ? '-' : `@${selectedPost.user?.username}`],
                  ['Email', selectedPost.isAnonymous ? '-' : (selectedPost.user?.email || '-')],
                  ['Visibility', getVisibilityDisplayName(selectedPost.visibility)],
                  ['Status', selectedPost.isDeleted ? 'Deleted' : 'Active'],
                  ['Created At', new Date(selectedPost.createdAt).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1.5 px-2 border-b border-gray-200/50 last:border-0">
                    <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{label}</span>
                    <span className="text-[11px] text-gray-900 font-medium text-right max-w-[60%] break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 px-4 py-3 border-t border-gray-200 sticky bottom-0 bg-white">
              {selectedPost.isDeleted ? (
                <button 
                  onClick={() => confirmRestore(selectedPost._id)} 
                  disabled={actionLoading === selectedPost._id}
                  className="flex-1 py-2 rounded-lg bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  Restore Post
                </button>
              ) : (
                <button 
                  onClick={() => confirmDelete(selectedPost._id)} 
                  disabled={actionLoading === selectedPost._id}
                  className="flex-1 py-2 rounded-lg bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Remove Post
                </button>
              )}
              <button 
                onClick={() => setSelectedPost(null)}
                className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

export default Posts;