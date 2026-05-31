// admin-frontend/src/pages/Communities.jsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  CheckCircle,
  XCircle,
  Building2,
  Users,
  Globe,
  Lock,
  School,
  Clock,
  LogOut,
  Tag,
  BookOpen,
  Mail,
  Calendar,
  Eye, // ✅ ADDED
} from "lucide-react";
import useAuthStore from "../store/authStore";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import API_BASE_URL from "../config";

const getFullImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url}`;
};

function Communities() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [imgErrors, setImgErrors] = useState({});

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    variant: "danger",
    onConfirm: null,
    loading: false,
  });
  const [rejectCommunityId, setRejectCommunityId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !accessToken) navigate("/login", { replace: true });
  }, [isAuthenticated, accessToken, navigate]);

  const fetchCommunities = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page, limit: 12 });
    if (filter !== "all") params.append("status", filter);
    if (search) params.append("search", search);

    fetch(`${API_BASE_URL}/api/admin/communities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (res.status === 401) {
          logout();
          navigate("/login", { replace: true });
          throw new Error("Session expired");
        }
        if (res.status === 403) throw new Error("Permission denied");
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          console.log("API Response:", data.data?.[0]?.contentSnapshot); // Debug
          setCommunities(data.data || []);
          setTotalPages(data.pagination?.pages || 1);
        } else setError(data.message || "Failed to fetch");
        setLoading(false);
      })
      .catch((err) => {
        if (err.message !== "Session expired")
          setError(err.message || "Network error");
        setLoading(false);
      });
  }, [page, filter, search, accessToken, logout, navigate]);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const fetchStats = useCallback(() => {
    if (!accessToken) return;
    fetch(`${API_BASE_URL}/api/admin/communities/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats({
            pending: data.data.pending?.total || 0,
            approved: data.data.approved?.total || 0,
            rejected: data.data.rejected?.total || 0,
            total: data.data.total || 0,
          });
        }
      })
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleApprove = async (id) => {
    if (!accessToken) return;
    setActionLoading(id);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/communities/${id}/approve`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notes: "Approved" }),
        },
      );
      if (res.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCommunities((prev) =>
          prev.map((c) =>
            c._id === id || c.contentId === id
              ? { ...c, status: "approved" }
              : c,
          ),
        );
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id, reason) => {
    if (!accessToken) return;
    setActionLoading(id);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/communities/${id}/reject`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason, allowResubmit: true }),
        },
      );
      if (res.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCommunities((prev) =>
          prev.map((c) =>
            c._id === id || c.contentId === id
              ? { ...c, status: "rejected", rejectionReason: reason }
              : c,
          ),
        );
        fetchStats();
      }
      setShowRejectInput(false);
      setRejectCommunityId(null);
      setRejectReason("");
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    const pendingIds = communities
      .filter((c) => c.status === "pending")
      .map((c) => c._id || c.contentId);
    if (pendingIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Bulk Approve",
      message: `Approve all ${pendingIds.length} pending communities?`,
      variant: "info",
      loading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/admin/communities/bulk-approve`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                communityIds: pendingIds,
                notes: "Bulk approved",
              }),
            },
          );
          const data = await res.json();
          if (data.success) {
            fetchCommunities();
            fetchStats();
          }
        } catch (err) {
          console.error(err);
        }
        setConfirmDialog((prev) => ({
          ...prev,
          isOpen: false,
          loading: false,
        }));
      },
    });
  };

  const confirmApprove = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: "Approve Community",
      message: "Make this community visible to all users?",
      variant: "info",
      loading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        await handleApprove(id);
        setConfirmDialog((prev) => ({
          ...prev,
          isOpen: false,
          loading: false,
        }));
      },
    });
  };

  const confirmReject = (id) => {
    setRejectCommunityId(id);
    setRejectReason("");
    setShowRejectInput(true);
  };

  const submitReject = () => {
    if (!rejectReason.trim()) return;
    setConfirmDialog({
      isOpen: true,
      title: "Reject Community",
      message: `Reject this community?\nReason: ${rejectReason}`,
      variant: "danger",
      loading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        await handleReject(rejectCommunityId, rejectReason);
        setConfirmDialog((prev) => ({
          ...prev,
          isOpen: false,
          loading: false,
        }));
      },
    });
  };

  const confirmLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Logout",
      message: "Are you sure?",
      variant: "warning",
      loading: false,
      onConfirm: () => {
        logout();
        navigate("/login", { replace: true });
      },
    });
  };

  const closeConfirmDialog = () =>
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  const handleSearch = () => {
    setPage(1);
    fetchCommunities();
  };
  const handleImgError = (id) =>
    setImgErrors((prev) => ({ ...prev, [id]: true }));

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filterCards = [
    {
      value: "pending",
      label: "Pending",
      icon: Clock,
      color: "text-yellow-600",
      border: "border-yellow-200",
      activeBg: "bg-yellow-50",
      count: stats.pending,
    },
    {
      value: "approved",
      label: "Approved",
      icon: CheckCircle,
      color: "text-green-600",
      border: "border-green-200",
      activeBg: "bg-green-50",
      count: stats.approved,
    },
    {
      value: "rejected",
      label: "Rejected",
      icon: XCircle,
      color: "text-red-600",
      border: "border-red-200",
      activeBg: "bg-red-50",
      count: stats.rejected,
    },
    {
      value: "all",
      label: "All",
      icon: Building2,
      color: "text-purple-600",
      border: "border-purple-200",
      activeBg: "bg-purple-50",
      count: stats.total,
    },
  ];

  const statusStyles = {
    pending: { border: "border-yellow-200", badge: "bg-yellow-500 text-white" },
    approved: { border: "border-green-200", badge: "bg-green-500 text-white" },
    rejected: { border: "border-red-200", badge: "bg-red-500 text-white" },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Communities Approval
          </h1>
          <p
            className="text-sm text-gray-500 mt-1"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Manage community and department creation requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-5 py-3 rounded-full border border-gray-200 bg-white shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="border-none outline-none bg-transparent text-sm text-gray-900 w-48"
              style={{ fontFamily: "Sofia Sans" }}
            />
          </div>
          <button
            onClick={confirmLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-all"
            style={{ fontFamily: "Sofia Sans" }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filterCards.map((card) => {
          const Icon = card.icon;
          const isActive = filter === card.value;
          return (
            <button
              key={card.value}
              onClick={() => {
                setFilter(card.value);
                setPage(1);
              }}
              className={`bg-white rounded-2xl p-4 border-2 transition-all cursor-pointer text-left ${isActive ? `${card.border} shadow-md scale-[1.02] ${card.activeBg}` : "border-gray-100 hover:shadow-md hover:scale-[1.01]"}`}
            >
              <div className={`flex items-center gap-2 mb-1 ${card.color}`}>
                <Icon size={18} />
                <span
                  className="text-xs font-semibold"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  {card.label}
                </span>
              </div>
              <p
                className="text-2xl font-bold text-gray-900"
                style={{ fontFamily: "Sofia Sans" }}
              >
                {card.count}
              </p>
            </button>
          );
        })}
      </div>

      {filter === "pending" &&
        communities.filter((c) => c.status === "pending").length > 1 && (
          <div className="flex justify-end">
            <button
              onClick={handleBulkApprove}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
              style={{ fontFamily: "Sofia Sans" }}
            >
              <CheckCircle size={16} /> Approve All (
              {communities.filter((c) => c.status === "pending").length})
            </button>
          </div>
        )}

      {showRejectInput && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowRejectInput(false);
            setRejectCommunityId(null);
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "Sofia Sans" }}
              >
                Rejection Reason
              </h2>
              <button
                onClick={() => {
                  setShowRejectInput(false);
                  setRejectCommunityId(null);
                }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <XCircle size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason..."
                rows={3}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                style={{ fontFamily: "Sofia Sans" }}
              />
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim()}
                className="mt-4 w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                style={{ fontFamily: "Sofia Sans" }}
              >
                Submit & Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-gray-200 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3" style={{ fontFamily: "Sofia Sans" }}>
            {error}
          </p>
          <button
            onClick={fetchCommunities}
            className="px-5 py-2 rounded-xl bg-purple-500 text-white font-semibold"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))",
          }}
        >
          {communities.map((item) => {
            const status = item.status || "pending";
            const snapshot = item.contentSnapshot || {};
            const isCommunity =
              snapshot.type === "community" || item.contentType === "community";
            const isPrivate = snapshot.privacy === "private";
            const submittedBy = item.submittedBy || {};
            const currentStatus = statusStyles[status] || statusStyles.pending;
            const hasAvatarError = imgErrors[item._id];
            const avatarUrl = submittedBy.profilePicture
              ? getFullImageUrl(submittedBy.profilePicture)
              : null;

            return (
              <div
                key={item._id}
                onClick={() =>
                  navigate(`/communities/${item.contentId || item._id}`)
                }
                className={`bg-white rounded-2xl border-2 ${currentStatus.border} overflow-hidden transition-all hover:shadow-lg cursor-pointer group`}
              >
                <div className="relative h-56">
                  {snapshot.coverImage ? (
                    <img
                      src={getFullImageUrl(snapshot.coverImage)}
                      alt={snapshot.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-200 to-blue-200 flex items-center justify-center">
                      {isCommunity ? (
                        <Users size={56} className="text-purple-400" />
                      ) : (
                        <School size={56} className="text-purple-400" />
                      )}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                  {/* View Details overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span
                      className="text-white text-sm font-semibold flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <Eye size={16} />
                      View Details
                    </span>
                  </div>

                  <span
                    className={`absolute top-3 right-3 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg ${currentStatus.badge}`}
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3
                      className="font-bold text-xl text-white mb-1 drop-shadow-lg"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      {snapshot.name || "Unnamed Community"}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 bg-white/25 text-white backdrop-blur-sm">
                        {isCommunity ? (
                          <Users size={11} />
                        ) : (
                          <School size={11} />
                        )}
                        {isCommunity ? "Community" : "Department"}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 bg-white/25 text-white backdrop-blur-sm">
                        {isPrivate ? <Lock size={11} /> : <Globe size={11} />}
                        {isPrivate ? "Private" : "Public"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                    {avatarUrl && !hasAvatarError ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border-2 border-purple-200 bg-purple-50 flex-shrink-0"
                        onError={() => handleImgError(item._id)}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center border-2 border-purple-200 flex-shrink-0">
                        <span className="text-sm font-bold text-purple-600">
                          {(submittedBy.name || "U").charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold text-gray-900 truncate"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        {submittedBy.name || "Unknown"}
                      </p>
                      <div
                        className="flex items-center gap-2 text-xs text-gray-400"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        <Mail size={11} />
                        {submittedBy.email || "No email"}
                        <span>•</span>
                        <Calendar size={11} />
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  </div>

                  <p
                    className="text-sm text-gray-600 mb-4 leading-relaxed"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {snapshot.description || "No description"}
                  </p>

                  {snapshot.tags && snapshot.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {snapshot.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 font-medium flex items-center gap-1"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          <Tag size={10} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {snapshot.rules && snapshot.rules.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen size={14} className="text-gray-500" />
                        <span
                          className="text-xs font-semibold text-gray-600"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          Community Rules
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {snapshot.rules.map((rule, i) => (
                          <div key={i} className="text-sm">
                            <p
                              className="font-semibold text-gray-800"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {i + 1}. {rule.title}
                            </p>
                            {rule.description && (
                              <p
                                className="text-xs text-gray-500 mt-0.5 ml-4"
                                style={{ fontFamily: "Sofia Sans" }}
                              >
                                {rule.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {status === "rejected" && item.rejectionReason && (
                    <div className="mb-4 p-3 bg-red-50 rounded-xl border border-red-100">
                      <p
                        className="text-xs font-semibold text-red-600 mb-1"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        Rejection Reason:
                      </p>
                      <p
                        className="text-sm text-red-700"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        {item.rejectionReason}
                      </p>
                    </div>
                  )}

                  {status === "pending" && (
                    <div
                      className="flex gap-2 pt-3 border-t border-gray-100"
                      onClick={(e) => e.stopPropagation()} // ✅ Prevent navigation when clicking buttons
                    >
                      <button
                        onClick={() =>
                          confirmApprove(item.contentId || item._id)
                        }
                        disabled={
                          actionLoading === (item.contentId || item._id)
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        <CheckCircle size={16} /> Approve
                      </button>
                      <button
                        onClick={() =>
                          confirmReject(item.contentId || item._id)
                        }
                        disabled={
                          actionLoading === (item.contentId || item._id)
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  )}

                  {/* View Details button for non-pending communities */}
                  {status !== "pending" && (
                    <div
                      className="flex gap-2 pt-3 border-t border-gray-100"
                      onClick={(e) => e.stopPropagation()} // ✅ Prevent navigation when clicking button
                    >
                      <button
                        onClick={() =>
                          navigate(`/communities/${item.contentId || item._id}`)
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        <Eye size={16} /> View Details
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {communities.length === 0 && !loading && (
            <div className="col-span-full text-center py-20">
              <Building2 size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500" style={{ fontFamily: "Sofia Sans" }}>
                No communities found
              </p>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pb-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-gray-50"
          >
            ‹
          </button>
          <span
            className="text-sm font-semibold text-gray-700"
            style={{ fontFamily: "Sofia Sans" }}
          >
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-gray-50"
          >
            ›
          </button>
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

export default Communities;
