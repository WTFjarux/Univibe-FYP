// src/pages/Reports.jsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Flag,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  Shield,
  FileText,
  MessageSquare,
  User,
  Calendar,
  AlertTriangle,
  MapPin,
  X,
} from "lucide-react";
import {
  getReports,
  getReportStats,
  resolveReport,
  dismissReport,
  reviewReport,
} from "../api/reportService";
import useAuthStore from "../store/authStore";
import UserAvatar from "../components/users/UserAvatar";
import PostCard from "../components/posts/PostCard";
import CommentCard from "../components/comments/CommentCard";
import ResolutionModal from "../components/reports/ResolutionModal";
import WarnUserModal from "../components/users/WarnUserModal";
import SuspendUserModal from "../components/users/SuspendUserModal";
import BanUserModal from "../components/users/BanUserModal";
import API_BASE_URL from "../config";

function Reports() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("pending");
  const [targetFilter, setTargetFilter] = useState("all");
  const [stats, setStats] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [resolutionModal, setResolutionModal] = useState(null);
  const [warnModal, setWarnModal] = useState(null);
  const [suspendModal, setSuspendModal] = useState(null);
  const [banModal, setBanModal] = useState(null);

  // Warning history state
  const [userWarnings, setUserWarnings] = useState([]);
  const [loadingWarnings, setLoadingWarnings] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !accessToken) navigate("/login", { replace: true });
  }, [isAuthenticated, accessToken, navigate]);

  const fetchReports = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await getReports({
        page,
        limit: 15,
        status: filter,
        targetType: targetFilter,
      });
      if (data.success) {
        setReports(data.data.reports);
        setTotalPages(data.data.pagination.pages);
      } else setError(data.message || "Failed to fetch reports");
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate("/login", { replace: true });
      } else setError(err.response?.data?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [page, filter, targetFilter, accessToken, logout, navigate]);

  const fetchStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await getReportStats();
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [fetchReports, fetchStats]);

  // Fetch user warnings when warn modal opens
  useEffect(() => {
    if (warnModal?._id) {
      fetchUserWarnings(warnModal._id);
    } else {
      setUserWarnings([]);
    }
  }, [warnModal]);

  // Function to fetch user warnings
  const fetchUserWarnings = async (userId) => {
    if (!accessToken || !userId) return;
    setLoadingWarnings(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${userId}/warnings`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }

      const data = await response.json();
      if (data.success) {
        setUserWarnings(data.data.warnings || []);
      } else {
        setUserWarnings([]);
      }
    } catch (err) {
      console.error("Failed to fetch warnings:", err);
      setUserWarnings([]);
    } finally {
      setLoadingWarnings(false);
    }
  };

  // Handle revoke warning
  const handleRevokeWarning = async (warningId, reason) => {
    if (!warnModal?._id || !accessToken) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${warnModal._id}/warnings/${warningId}/revoke`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        },
      );

      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true });
        throw new Error("Session expired");
      }

      const data = await response.json();
      if (data.success) {
        // Refresh warnings
        await fetchUserWarnings(warnModal._id);
        // Refresh reports and stats
        fetchReports();
        fetchStats();
        return data;
      } else {
        throw new Error(data.message || "Failed to revoke warning");
      }
    } catch (err) {
      console.error("Revoke warning error:", err);
      throw err;
    }
  };

  const handleReview = async (id) => {
    try {
      await reviewReport(id);
      setReports((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: "reviewing" } : r)),
      );
      if (selectedReport?._id === id)
        setSelectedReport((prev) => ({ ...prev, status: "reviewing" }));
      fetchStats();
    } catch (err) {
      console.error("Review error:", err);
    }
  };

  const handleResolve = async (id, resolution, note) => {
    setActionLoading(id);
    try {
      const data = await resolveReport(id, {
        resolution,
        resolutionNote: note,
      });
      if (data.success) {
        setReports((prev) =>
          prev.map((r) => (r._id === id ? { ...r, ...data.report } : r)),
        );
        fetchStats();
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Resolve error:", err);
    } finally {
      setActionLoading(null);
      setResolutionModal(null);
      setWarnModal(null);
      setSuspendModal(null);
      setBanModal(null);
      setUserWarnings([]);
    }
  };

  const handleDismiss = async (id, reason) => {
    setActionLoading(id);
    try {
      const data = await dismissReport(id, reason);
      if (data.success) {
        setReports((prev) => prev.filter((r) => r._id !== id));
        fetchStats();
        setSelectedReport(null);
      } else {
        alert(data.message || "Failed to dismiss report");
      }
    } catch (err) {
      console.error("Dismiss error:", err);
      alert("Network error. Please try again.");
    } finally {
      setActionLoading(null);
      setResolutionModal(null);
    }
  };

  const getTargetUserInfo = (report) => {
    if (report.targetType === "User" && report.target) {
      return {
        _id: report.target._id || report.targetId,
        name: report.target.name || "User",
        username: report.target.username || "",
        email: report.target.email || "",
        profilePicture: report.target.profilePicture || null,
        warningCount: report.target.warningCount || 0,
      };
    }
    if (report.target?.user) {
      return {
        _id: report.target.user._id,
        name: report.target.user.name || "User",
        username: report.target.user.username || "",
        email: report.target.user.email || "",
        profilePicture: report.target.user.profilePicture || null,
        warningCount: report.target.user.warningCount || 0,
      };
    }
    return {
      _id: report.targetId,
      name: "User",
      username: "",
      email: "",
      profilePicture: null,
      warningCount: 0,
    };
  };

  const handleResolutionAction = (reportId, resolution, note) => {
    const report = reports.find((r) => r._id === reportId);
    if (!report) return;
    setResolutionModal(null);
    const targetUser = getTargetUserInfo(report);
    if (resolution === "user_warned")
      setWarnModal({ ...targetUser, reportId, note });
    else if (resolution === "user_suspended")
      setSuspendModal({ ...targetUser, reportId, note });
    else if (resolution === "user_banned")
      setBanModal({ ...targetUser, reportId, note });
    else handleResolve(reportId, resolution, note);
  };

  const handleWarnSubmit = (reason, severity) => {
    const { reportId, note } = warnModal;
    const fullNote = severity
      ? `${reason} (Severity: ${severity})${note ? ` - ${note}` : ""}`
      : `${reason}${note ? ` - ${note}` : ""}`;
    setWarnModal(null);
    setUserWarnings([]);
    handleResolve(reportId, "user_warned", fullNote);
  };

  const handleSuspendSubmit = (reason, duration) => {
    const { reportId } = suspendModal;
    setSuspendModal(null);
    handleResolve(reportId, "user_suspended", `${reason} (${duration}h)`);
  };

  const handleBanSubmit = (reason) => {
    const { reportId } = banModal;
    setBanModal(null);
    handleResolve(reportId, "user_banned", reason);
  };

  const handleCloseWarnModal = () => {
    setWarnModal(null);
    setUserWarnings([]);
  };

  const confirmDismiss = (id) => setResolutionModal({ id, type: "dismiss" });

  const getStatusBadge = (status) => {
    const badges = {
      pending: {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        icon: Clock,
        label: "Pending",
      },
      reviewing: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        icon: Eye,
        label: "Reviewing",
      },
      resolved: {
        bg: "bg-green-100",
        text: "text-green-700",
        icon: CheckCircle,
        label: "Resolved",
      },
      dismissed: {
        bg: "bg-gray-100",
        text: "text-gray-700",
        icon: XCircle,
        label: "Dismissed",
      },
    };
    return badges[status] || badges.pending;
  };

  const getReasonLabel = (reason) => {
    const labels = {
      spam: "Spam",
      harassment: "Harassment",
      hate_speech: "Hate Speech",
      inappropriate_content: "Inappropriate Content",
      violence: "Violence",
      self_harm: "Self Harm",
      misinformation: "Misinformation",
      impersonation: "Impersonation",
      copyright: "Copyright",
      other: "Other",
    };
    return labels[reason] || reason?.replace(/_/g, " ") || "Unknown";
  };

  const getTargetIcon = (type) => {
    const icons = {
      Post: FileText,
      Comment: MessageSquare,
      User: User,
      Event: Calendar,
    };
    const IconComponent = icons[type] || Flag;
    return <IconComponent size={16} />;
  };

  const getReasonColor = (reason) => {
    const colors = {
      spam: "bg-red-50 text-red-600",
      harassment: "bg-orange-50 text-orange-600",
      hate_speech: "bg-red-50 text-red-600",
      inappropriate_content: "bg-pink-50 text-pink-600",
      violence: "bg-red-50 text-red-600",
      self_harm: "bg-purple-50 text-purple-600",
      misinformation: "bg-amber-50 text-amber-600",
      impersonation: "bg-blue-50 text-blue-600",
      copyright: "bg-indigo-50 text-indigo-600",
      other: "bg-gray-100 text-gray-600",
    };
    return colors[reason] || "bg-gray-100 text-gray-600";
  };

  const statCards = [
    {
      key: "pending",
      label: "Pending",
      icon: Clock,
      color: "text-yellow-600",
      bgHover: "hover:bg-yellow-50",
      border: "border-yellow-200",
      activeBg: "bg-yellow-50",
    },
    {
      key: "reviewing",
      label: "Reviewing",
      icon: Eye,
      color: "text-blue-600",
      bgHover: "hover:bg-blue-50",
      border: "border-blue-200",
      activeBg: "bg-blue-50",
    },
    {
      key: "resolved",
      label: "Resolved",
      icon: CheckCircle,
      color: "text-green-600",
      bgHover: "hover:bg-green-50",
      border: "border-green-200",
      activeBg: "bg-green-50",
    },
    {
      key: "dismissed",
      label: "Dismissed",
      icon: XCircle,
      color: "text-gray-600",
      bgHover: "hover:bg-gray-50",
      border: "border-gray-200",
      activeBg: "bg-gray-50",
    },
  ];

  const targetFilters = [
    { value: "all", label: "All" },
    { value: "Post", label: "Posts" },
    { value: "Comment", label: "Comments" },
    { value: "User", label: "Users" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Reports Management
          </h1>
          <p
            className="text-sm text-gray-500 mt-1"
            style={{ fontFamily: "Sofia Sans" }}
          >
            {reports.length} reports • {filter} filter
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            const isActive = filter === card.key;
            return (
              <button
                key={card.key}
                onClick={() => {
                  setFilter(card.key);
                  setPage(1);
                }}
                className={`bg-white rounded-2xl p-4 border-2 transition-all cursor-pointer text-left ${isActive ? `${card.border} shadow-md scale-[1.02] ${card.activeBg}` : "border-gray-100 hover:shadow-md hover:scale-[1.01]"} ${card.bgHover}`}
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
                  {stats.summary[card.key] || 0}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {targetFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setTargetFilter(f.value);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${targetFilter === f.value ? "bg-blue-500 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
            style={{ fontFamily: "Sofia Sans" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-[3px] border-gray-200 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <AlertTriangle size={48} className="text-red-300 mx-auto mb-3" />
          <p className="text-red-500 mb-3" style={{ fontFamily: "Sofia Sans" }}>
            {error}
          </p>
          <button
            onClick={fetchReports}
            className="px-5 py-2 rounded-xl bg-purple-500 text-white font-semibold"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const statusBadge = getStatusBadge(report.status);
            const StatusIcon = statusBadge.icon;
            return (
              <div
                key={report._id}
                onClick={() => setSelectedReport(report)}
                className={`bg-white rounded-xl border p-5 transition-colors cursor-pointer hover:border-gray-300 ${report.status === "pending" ? "border-yellow-200 hover:bg-yellow-50/30" : report.status === "reviewing" ? "border-blue-200 hover:bg-blue-50/30" : "border-gray-200 hover:bg-gray-50/50"}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${report.status === "pending" ? "bg-yellow-100 text-yellow-600" : report.status === "reviewing" ? "bg-blue-100 text-blue-600" : report.status === "resolved" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"}`}
                  >
                    <StatusIcon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="text-sm font-semibold text-gray-900"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        {report.reportedBy?.name || "Unknown User"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        <StatusIcon size={12} className="inline mr-1" />
                        {statusBadge.label}
                      </span>
                      {report.isDuplicate && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          Duplicate
                        </span>
                      )}
                    </div>
                    <div
                      className="flex items-center gap-2 text-xs text-gray-500 mb-2"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <span className="flex items-center gap-1">
                        {getTargetIcon(report.targetType)}
                        {report.targetType}
                      </span>
                      <span>•</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getReasonColor(report.reason)}`}
                      >
                        {getReasonLabel(report.reason)}
                      </span>
                    </div>
                    {report.description && (
                      <p
                        className="text-sm text-gray-600 line-clamp-2"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        {report.description}
                      </p>
                    )}
                    <div
                      className="flex items-center gap-3 mt-2 text-xs text-gray-400"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <span>
                        Reported: {new Date(report.createdAt).toLocaleString()}
                      </span>
                      {report.resolvedAt && (
                        <>
                          <span>•</span>
                          <span>
                            Resolved:{" "}
                            {new Date(report.resolvedAt).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {report.status === "pending" && (
                      <button
                        onClick={() => handleReview(report._id)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        Review
                      </button>
                    )}
                    {(report.status === "pending" ||
                      report.status === "reviewing") && (
                      <>
                        <button
                          onClick={() =>
                            setResolutionModal({
                              id: report._id,
                              type: "resolve",
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-green-50 text-green-600 text-xs font-semibold hover:bg-green-100 transition-colors"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => confirmDismiss(report._id)}
                          className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {reports.length === 0 && !loading && (
            <div className="text-center py-20">
              <Shield size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500" style={{ fontFamily: "Sofia Sans" }}>
                No reports found
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
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition-colors"
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
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            ›
          </button>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-[550px] max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Flag size={18} className="text-red-500" />
                <h2
                  className="text-lg font-bold text-gray-900"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  Report Details
                </h2>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {selectedReport.targetType === "Post" && (
                <div>
                  <p
                    className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    REPORTED POST
                  </p>
                  {!selectedReport.target || !selectedReport.target.exists ? (
                    <p
                      className="text-sm text-gray-400 italic"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      This post has been permanently deleted.
                    </p>
                  ) : (
                    <PostCard
                      post={selectedReport.target}
                      compact={false}
                      showActions={false}
                      showReportCount={false}
                    />
                  )}
                </div>
              )}
              {selectedReport.targetType === "Comment" && (
                <div>
                  <p
                    className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    REPORTED COMMENT
                  </p>
                  {!selectedReport.target || !selectedReport.target.exists ? (
                    <p
                      className="text-sm text-gray-400 italic"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      This comment has been permanently deleted.
                    </p>
                  ) : (
                    <CommentCard
                      comment={selectedReport.target}
                      showActions={false}
                      showReportCount={false}
                    />
                  )}
                </div>
              )}
              {selectedReport.targetType === "User" &&
                selectedReport.target && (
                  <div>
                    <p
                      className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      REPORTED USER
                    </p>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-4">
                        <UserAvatar
                          user={selectedReport.target}
                          size="lg"
                          gradient="from-indigo-400 to-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className="text-base font-bold text-gray-900"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {selectedReport.target.name}
                            </p>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {selectedReport.target.role}
                            </span>
                          </div>
                          <p
                            className="text-sm text-gray-400"
                            style={{ fontFamily: "Sofia Sans" }}
                          >
                            @{selectedReport.target.username}
                          </p>
                          <p
                            className="text-sm text-gray-400"
                            style={{ fontFamily: "Sofia Sans" }}
                          >
                            {selectedReport.target.email}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {selectedReport.target.isBanned && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-600 font-semibold">
                              Banned
                            </span>
                          )}
                          {selectedReport.target.isSuspended && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-600 font-semibold">
                              Suspended
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              {selectedReport.description && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <p
                    className="text-xs font-semibold text-red-600 mb-1"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    REPORT REASON:
                  </p>
                  <p
                    className="text-sm text-gray-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {selectedReport.description}
                  </p>
                </div>
              )}
              {selectedReport.status === "resolved" ||
              selectedReport.status === "dismissed" ? (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p
                    className="text-sm text-gray-600"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    <span className="font-semibold">Resolution:</span>{" "}
                    {selectedReport.resolution?.replace(/_/g, " ") || "N/A"}
                  </p>
                  {selectedReport.resolutionNote && (
                    <p
                      className="text-sm text-gray-600 mt-1"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <span className="font-semibold">Note:</span>{" "}
                      {selectedReport.resolutionNote}
                    </p>
                  )}
                  {selectedReport.resolvedBy && (
                    <p
                      className="text-sm text-gray-600 mt-1"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <span className="font-semibold">Resolved by:</span>{" "}
                      {selectedReport.resolvedBy.name}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedReport.status === "pending" && (
                    <button
                      onClick={() => handleReview(selectedReport._id)}
                      className="w-full py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <Eye size={16} /> Mark as Reviewing
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedReport(null);
                        setResolutionModal({
                          id: selectedReport._id,
                          type: "resolve",
                        });
                      }}
                      disabled={actionLoading === selectedReport._id}
                      className="flex-1 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <CheckCircle size={14} /> Resolve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReport(null);
                        confirmDismiss(selectedReport._id);
                      }}
                      disabled={actionLoading === selectedReport._id}
                      className="flex-1 py-2 rounded-xl bg-gray-500 text-white text-sm font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <XCircle size={14} /> Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 rounded-b-2xl">
              <button
                onClick={() => setSelectedReport(null)}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                style={{ fontFamily: "Sofia Sans" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {resolutionModal && (
        <ResolutionModal
          type={resolutionModal.type}
          onClose={() => setResolutionModal(null)}
          onSubmit={(data) => {
            if (resolutionModal.type === "resolve")
              handleResolutionAction(
                resolutionModal.id,
                data.resolution,
                data.note,
              );
            else handleDismiss(resolutionModal.id, data.note);
          }}
        />
      )}

      {/* Updated WarnUserModal with warnings and revoke support */}
      {warnModal && (
        <WarnUserModal
          user={{
            _id: warnModal._id,
            name: warnModal.name,
            username: warnModal.username,
            email: warnModal.email,
            profilePicture: warnModal.profilePicture,
            warningCount: warnModal.warningCount,
          }}
          warnings={userWarnings}
          onClose={handleCloseWarnModal}
          onSubmit={handleWarnSubmit}
          onRevokeWarning={handleRevokeWarning}
          loading={actionLoading === warnModal.reportId}
        />
      )}

      {suspendModal && (
        <SuspendUserModal
          user={{
            _id: suspendModal._id,
            name: suspendModal.name,
            username: suspendModal.username,
            email: suspendModal.email,
            profilePicture: suspendModal.profilePicture,
          }}
          onClose={() => setSuspendModal(null)}
          onSubmit={handleSuspendSubmit}
          loading={actionLoading === suspendModal.reportId}
        />
      )}

      {banModal && (
        <BanUserModal
          user={{
            _id: banModal._id,
            name: banModal.name,
            username: banModal.username,
            email: banModal.email,
            profilePicture: banModal.profilePicture,
          }}
          onClose={() => setBanModal(null)}
          onSubmit={handleBanSubmit}
          loading={actionLoading === banModal.reportId}
        />
      )}
    </div>
  );
}

export default Reports;
