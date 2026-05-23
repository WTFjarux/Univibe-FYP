// admin-frontend/src/pages/Events.jsx

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, CheckCircle, XCircle, Star, Trash2, Calendar,
  MapPin, Users, Clock, MapPinIcon, ChevronLeft, ChevronRight,
  Link, Video, Tag, CheckCircle2, LogOut,
} from 'lucide-react';
import API_BASE_URL from '../config';
import useAuthStore from '../store/authStore';
import UserAvatar from '../components/users/UserAvatar';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/**
 * Events Approval Page
 * 
 * Review, approve, reject, feature, and delete events.
 * Uses Zustand auth store for token management.
 * Uses ConfirmDialog for destructive action confirmations.
 * Uses UserAvatar for organizer profile pictures.
 */
function Events() {
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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false, title: '', message: '', variant: 'danger', onConfirm: null, loading: false,
  });

  // Reject reason state
  const [rejectEventId, setRejectEventId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Touch/swipe refs
  const touchStartX = useRef({});
  const touchEndX = useRef({});

  // ============================================
  // REDIRECT IF NOT AUTHENTICATED
  // ============================================
  useEffect(() => {
    if (!isAuthenticated && !accessToken) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, accessToken, navigate]);

  // ============================================
  // FETCH EVENTS
  // ============================================
  const fetchEvents = useCallback(() => {
    if (!accessToken) return;
    setLoading(true); setError('');
    const params = new URLSearchParams({ page, limit: 12, status: filter, search });
    fetch(`${API_BASE_URL}/api/admin/events?${params}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
      .then((response) => {
        if (response.status === 401) { logout(); navigate('/login', { replace: true }); throw new Error('Session expired'); }
        if (response.status === 403) throw new Error('You do not have permission to view events');
        return response.json();
      })
      .then((data) => {
        if (data.success) { setEvents(data.data.events); setTotalPages(data.data.pagination.pages); }
        else setError(data.message || 'Failed to fetch events');
        setLoading(false);
      })
      .catch((err) => { if (err.message !== 'Session expired') setError(err.message || 'Network error'); setLoading(false); });
  }, [page, filter, search, accessToken, logout, navigate]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ============================================
  // HANDLE APPROVE EVENT
  // ============================================
  const handleApprove = async (id) => {
    if (!accessToken) return;
    setActionLoading(id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/events/${id}/approve`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.status === 401) { logout(); navigate('/login', { replace: true }); return; }
      const data = await response.json();
      if (data.success) {
        setEvents((prev) => prev.map((e) => (e._id === id ? { ...e, approvalStatus: 'approved' } : e)));
      }
    } catch (err) { console.error('Approve error:', err); }
    finally { setActionLoading(null); }
  };

  // ============================================
  // HANDLE REJECT EVENT
  // ============================================
  const handleReject = async (id, reason) => {
    if (!accessToken) return;
    setActionLoading(id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/events/${id}/reject`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (response.status === 401) { logout(); navigate('/login', { replace: true }); return; }
      const data = await response.json();
      if (data.success) {
        setEvents((prev) => prev.map((e) => (e._id === id ? { ...e, approvalStatus: 'rejected', rejectionReason: reason } : e)));
      }
      setShowRejectInput(false);
      setRejectEventId(null);
      setRejectReason('');
    } catch (err) { console.error('Reject error:', err); }
    finally { setActionLoading(null); }
  };

  // ============================================
  // HANDLE FEATURE/UNFEATURE EVENT
  // ============================================
  const handleFeature = async (id) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/events/${id}/feature`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.status === 401) { logout(); navigate('/login', { replace: true }); return; }
      const data = await response.json();
      if (data.success) {
        setEvents((prev) => prev.map((e) => (e._id === id ? { ...e, isFeatured: data.isFeatured } : e)));
      }
    } catch (err) { console.error('Feature error:', err); }
  };

  // ============================================
  // HANDLE DELETE EVENT
  // ============================================
  const handleDelete = async (id) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/events/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (response.status === 401) { logout(); navigate('/login', { replace: true }); return; }
      const data = await response.json();
      if (data.success) {
        setEvents((prev) => prev.filter((e) => e._id !== id));
      }
    } catch (err) { console.error('Delete error:', err); }
  };

  // ============================================
  // CONFIRM ACTIONS
  // ============================================
  const confirmApprove = (id) => {
    setConfirmDialog({
      isOpen: true, title: 'Approve Event',
      message: 'Are you sure you want to approve this event? It will become visible to all users.',
      variant: 'info', loading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        await handleApprove(id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
      },
    });
  };

  const confirmReject = (id) => {
    setRejectEventId(id);
    setRejectReason('');
    setShowRejectInput(true);
  };

  const submitReject = () => {
    if (!rejectReason.trim()) return;
    setConfirmDialog({
      isOpen: true, title: 'Reject Event',
      message: `Are you sure you want to reject this event?\nReason: ${rejectReason}`,
      variant: 'danger', loading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        await handleReject(rejectEventId, rejectReason);
        setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
      },
    });
  };

  const confirmDelete = (id) => {
    setConfirmDialog({
      isOpen: true, title: 'Delete Event',
      message: 'Are you sure you want to permanently delete this event? This action cannot be undone.',
      variant: 'danger', loading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        await handleDelete(id);
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

  // ============================================
  // HANDLE SEARCH
  // ============================================
  const handleSearch = () => { setPage(1); fetchEvents(); };

  // ============================================
  // HELPERS
  // ============================================
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const getCategoryColor = (category) => {
    const colors = { Academic: '#dbeafe', Social: '#fce7f3', Sports: '#dcfce7', Career: '#fef3c7', Cultural: '#ede9fe', Workshop: '#fed7aa', Other: '#f3f4f6' };
    return colors[category] || '#f3f4f6';
  };

  const getCategoryTextColor = (category) => {
    const colors = { Academic: '#1d4ed8', Social: '#be185d', Sports: '#15803d', Career: '#92400e', Cultural: '#6d28d9', Workshop: '#9a3412', Other: '#374151' };
    return colors[category] || '#374151';
  };

  const getStatusBadge = (status) => {
    const badges = {
      upcoming: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Upcoming' },
      ongoing: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ongoing' },
      completed: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Completed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
    };
    return badges[status] || badges.upcoming;
  };

  // Helper to check if event is completed or cancelled
  const isEventFinalized = (event) => {
    return event.status === 'completed' || event.status === 'cancelled';
  };

  const prevImage = (eventId, totalImages, e) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => ({ ...prev, [eventId]: prev[eventId] ? (prev[eventId] - 1 + totalImages) % totalImages : totalImages - 1 }));
  };

  const nextImage = (eventId, totalImages, e) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => ({ ...prev, [eventId]: prev[eventId] ? (prev[eventId] + 1) % totalImages : 1 }));
  };

  const handleTouchStart = (eventId, e) => { touchStartX.current[eventId] = e.touches[0].clientX; };
  const handleTouchMove = (eventId, e) => { touchEndX.current[eventId] = e.touches[0].clientX; };
  const handleTouchEnd = (eventId, totalImages) => {
    if (!touchStartX.current[eventId] || !touchEndX.current[eventId]) return;
    const diff = touchStartX.current[eventId] - touchEndX.current[eventId];
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextImage(eventId, totalImages, { stopPropagation: () => {} });
      else prevImage(eventId, totalImages, { stopPropagation: () => {} });
    }
    touchStartX.current[eventId] = null;
    touchEndX.current[eventId] = null;
  };

  const filters = [
    { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' },
  ];

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>Events Approval</h1>
          <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Sofia Sans' }}>{events.length} events • {filter} filter</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-5 py-3 rounded-full border border-gray-200 bg-white shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input type="text" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="border-none outline-none bg-transparent text-sm text-gray-900 w-48" style={{ fontFamily: 'Sofia Sans' }} />
          </div>
          <button onClick={confirmLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-all" style={{ fontFamily: 'Sofia Sans' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${filter === f.value ? 'bg-purple-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
            style={{ fontFamily: 'Sofia Sans' }}>{f.label}</button>
        ))}
      </div>

      {/* Reject Reason Input Modal */}
      {showRejectInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowRejectInput(false); setRejectEventId(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Sofia Sans' }}>Rejection Reason</h2>
              <button onClick={() => { setShowRejectInput(false); setRejectEventId(null); }} className="p-2 rounded-full hover:bg-gray-100"><XCircle size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6">
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..." rows={3} autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                style={{ fontFamily: 'Sofia Sans' }} />
              <button onClick={submitReject} disabled={!rejectReason.trim()}
                className="mt-4 w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors" style={{ fontFamily: 'Sofia Sans' }}>
                Submit & Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-[3px] border-gray-200 border-t-purple-500 rounded-full animate-spin" /></div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3" style={{ fontFamily: 'Sofia Sans' }}>{error}</p>
          <button onClick={fetchEvents} className="px-5 py-2 rounded-xl bg-purple-500 text-white font-semibold" style={{ fontFamily: 'Sofia Sans' }}>Retry</button>
        </div>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
          {events.map(event => {
            const images = event.imageUrls || [];
            const currentImageIndex = activeImageIndex[event._id] || 0;
            const totalImages = images.length;
            const statusBadge = getStatusBadge(event.status);
            const eventFinalized = isEventFinalized(event);

            return (
              <div key={event._id} className={`bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-lg ${
                event.approvalStatus === 'rejected' ? 'border-red-200 bg-red-50/20' :
                event.approvalStatus === 'approved' ? 'border-green-100' : 'border-yellow-200'
              }`}>
                {/* Image Carousel */}
                {totalImages > 0 ? (
                  <div className="relative" style={{ height: '320px' }}>
                    <img src={images[currentImageIndex]} alt={`${event.title} - Image ${currentImageIndex + 1}`}
                      className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(images[currentImageIndex], '_blank')}
                      onTouchStart={(e) => handleTouchStart(event._id, e)} onTouchMove={(e) => handleTouchMove(event._id, e)}
                      onTouchEnd={() => handleTouchEnd(event._id, totalImages)} />
                    {totalImages > 1 && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-medium px-3 py-1 rounded-full" style={{ fontFamily: 'Sofia Sans' }}>{currentImageIndex + 1} / {totalImages}</div>
                    )}
                    {totalImages > 1 && (<>
                      <button onClick={(e) => prevImage(event._id, totalImages, e)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg"><ChevronLeft size={20} className="text-gray-700" /></button>
                      <button onClick={(e) => nextImage(event._id, totalImages, e)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg"><ChevronRight size={20} className="text-gray-700" /></button>
                    </>)}
                    {totalImages > 1 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, idx) => (
                          <button key={idx} onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => ({ ...prev, [event._id]: idx })); }}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/60 hover:bg-white/80'}`} />
                        ))}
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm ${event.approvalStatus === 'approved' ? 'bg-green-500 text-white' : event.approvalStatus === 'rejected' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`} style={{ fontFamily: 'Sofia Sans' }}>{event.approvalStatus}</span>
                    </div>
                    {event.isFeatured && <div className="absolute top-3 left-3"><Star size={20} className="text-yellow-500 fill-yellow-500 drop-shadow-sm" /></div>}
                    {/* Show "Completed/Cancelled" overlay badge if event is finalized */}
                    {eventFinalized && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-sm font-bold px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm" style={{ fontFamily: 'Sofia Sans' }}>
                          {event.status === 'completed' ? 'Event Completed' : 'Event Cancelled'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative h-48 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                    <Calendar size={48} className="text-purple-300" />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm ${event.approvalStatus === 'approved' ? 'bg-green-500 text-white' : event.approvalStatus === 'rejected' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`} style={{ fontFamily: 'Sofia Sans' }}>{event.approvalStatus}</span>
                    </div>
                    {event.isFeatured && <div className="absolute top-3 left-3"><Star size={20} className="text-yellow-500 fill-yellow-500 drop-shadow-sm" /></div>}
                    {eventFinalized && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-sm font-bold px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm" style={{ fontFamily: 'Sofia Sans' }}>
                          {event.status === 'completed' ? 'Event Completed' : 'Event Cancelled'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: getCategoryColor(event.category), color: getCategoryTextColor(event.category), fontFamily: 'Sofia Sans' }}>{event.category}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${event.visibility === 'campus' ? 'bg-blue-50 text-blue-600' : event.visibility === 'public' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-600'}`} style={{ fontFamily: 'Sofia Sans' }}>{event.visibility}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadge.bg} ${statusBadge.text} flex items-center gap-1`} style={{ fontFamily: 'Sofia Sans' }}>{event.status === 'completed' && <CheckCircle2 size={12} />}{statusBadge.label}</span>
                    {event.isOnline ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-600 flex items-center gap-1" style={{ fontFamily: 'Sofia Sans' }}><Video size={12} /> Online</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-50 text-orange-600 flex items-center gap-1" style={{ fontFamily: 'Sofia Sans' }}><MapPinIcon size={12} /> In Person</span>
                    )}
                  </div>

                  <h3 className="font-bold text-lg text-gray-900 mb-2 leading-snug" style={{ fontFamily: 'Sofia Sans' }}>{event.title}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed" style={{ fontFamily: 'Sofia Sans' }}>{event.description}</p>

                  {event.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {event.tags.map((tag, idx) => (
                        <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium flex items-center gap-1" style={{ fontFamily: 'Sofia Sans' }}><Tag size={10} />{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Calendar size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2"><span className="text-xs text-gray-400 font-medium w-10" style={{ fontFamily: 'Sofia Sans' }}>START</span><span style={{ fontFamily: 'Sofia Sans' }}>{formatDate(event.startDate)}</span></div>
                        <div className="flex items-center gap-2"><span className="text-xs text-gray-400 font-medium w-10" style={{ fontFamily: 'Sofia Sans' }}>END</span><span style={{ fontFamily: 'Sofia Sans' }}>{formatDate(event.endDate)}</span></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={15} className="text-gray-400 flex-shrink-0" />
                      <span style={{ fontFamily: 'Sofia Sans' }} className="truncate">{event.location}</span>
                    </div>
                  </div>

                  {/* Organizer - Using UserAvatar */}
                  <div className="flex items-center gap-3 mb-4 pt-3 border-t border-gray-100">
                    <UserAvatar user={event.organizer || { name: event.organizerName }} size="sm" gradient="from-purple-400 to-purple-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate" style={{ fontFamily: 'Sofia Sans' }}>{event.organizer?.name || event.organizerName || 'Unknown'}</p>
                      <p className="text-xs text-gray-400" style={{ fontFamily: 'Sofia Sans' }}>{new Date(event.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {event.rejectionReason && (
                    <p className="text-xs text-red-500 mb-3 bg-red-50 rounded-lg px-3 py-2" style={{ fontFamily: 'Sofia Sans' }}>Reason: {event.rejectionReason}</p>
                  )}

                  {/* Finalized event message */}
                  {eventFinalized && (
                    <div className="text-xs text-amber-600 mb-3 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-2" style={{ fontFamily: 'Sofia Sans' }}>
                      <CheckCircle2 size={14} />
                      This event has {event.status === 'completed' ? 'ended' : 'been cancelled'} and cannot be approved or rejected.
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    {/* Show approve/reject only for pending events that are NOT finalized */}
                    {event.approvalStatus === 'pending' && !eventFinalized && (
                      <>
                        <button onClick={() => confirmApprove(event._id)} disabled={actionLoading === event._id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-50" style={{ fontFamily: 'Sofia Sans' }}>
                          <CheckCircle size={16} /> Approve
                        </button>
                        <button onClick={() => confirmReject(event._id)} disabled={actionLoading === event._id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50" style={{ fontFamily: 'Sofia Sans' }}>
                          <XCircle size={16} /> Reject
                        </button>
                      </>
                    )}
                    
                    {/* Show pending badge for finalized events that are still pending */}
                    {event.approvalStatus === 'pending' && eventFinalized && (
                      <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold" style={{ fontFamily: 'Sofia Sans' }}>
                        <Clock size={16} /> Pending Review (Event Ended)
                      </div>
                    )}

                    <button onClick={() => handleFeature(event._id)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors ${event.isFeatured ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={{ fontFamily: 'Sofia Sans' }}>
                      <Star size={16} className={event.isFeatured ? 'fill-yellow-500 text-yellow-500' : ''} />
                    </button>
                    <button onClick={() => confirmDelete(event._id)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gray-100 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors" style={{ fontFamily: 'Sofia Sans' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && !loading && (
            <div className="col-span-full text-center py-20">
              <Calendar size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500" style={{ fontFamily: 'Sofia Sans' }}>No events found</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pb-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-gray-50">‹</button>
          <span className="text-sm font-semibold text-gray-700" style={{ fontFamily: 'Sofia Sans' }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-gray-50">›</button>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen} onClose={closeConfirmDialog}
        onConfirm={confirmDialog.onConfirm} title={confirmDialog.title}
        message={confirmDialog.message} variant={confirmDialog.variant}
        loading={confirmDialog.loading}
      />
    </div>
  );
}

export default Events;