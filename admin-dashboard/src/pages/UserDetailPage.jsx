// admin-frontend/src/pages/UserDetailPage.jsx

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Shield,
  AlertTriangle,
  Flag,
  FileText,
  MessageSquare,
  Globe,
  Clock,
  UserCheck,
  Ban,
  Hash,
  Loader,
  RefreshCw,
  LogOut,
} from "lucide-react";
import API_BASE_URL from "../config";
import useAuthStore from "../store/authStore";
import UserAvatar from "../components/users/UserAvatar";
import PostCard from "../components/posts/PostCard";
import PostDetailModal from "../components/posts/PostDetailModal";
import CommentCard from "../components/comments/CommentCard";
import ConfirmDialog from "../components/ui/ConfirmDialog";

function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedPost, setSelectedPost] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    variant: "danger",
    onConfirm: null,
    loading: false,
  });

  useEffect(() => {
    if (!isAuthenticated && !accessToken) navigate("/login", { replace: true });
  }, [isAuthenticated, accessToken, navigate]);

  const fetchUserDetails = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${userId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      if (response.status === 404) {
        setError("User not found");
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (data.success) setDetails(data.data);
      else setError(data.message || "Failed to load user details");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId, accessToken, logout, navigate]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  const confirmLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Logout",
      message: "Are you sure you want to logout from the admin panel?",
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

  const getStatusConfig = (status) => {
    const configs = {
      active: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        icon: UserCheck,
        label: "Active",
      },
      warned: {
        bg: "bg-yellow-50",
        text: "text-yellow-700",
        border: "border-yellow-200",
        icon: AlertTriangle,
        label: "Warned",
      },
      suspended: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        icon: Clock,
        label: "Suspended",
      },
      banned: {
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
        icon: Ban,
        label: "Banned",
      },
    };
    return configs[status] || configs.active;
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#f8fafc" }}
      >
        <div className="text-center">
          <Loader
            size={40}
            className="mx-auto text-purple-500 animate-spin mb-4"
          />
          <p className="text-gray-500" style={{ fontFamily: "Sofia Sans" }}>
            Loading user details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#f8fafc" }}
      >
        <div className="text-center bg-white rounded-2xl p-8 shadow-sm border border-gray-200 max-w-md">
          <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
          <p
            className="text-red-500 font-medium mb-4"
            style={{ fontFamily: "Sofia Sans" }}
          >
            {error}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate("/users")}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ fontFamily: "Sofia Sans" }}
            >
              Back to Users
            </button>
            <button
              onClick={fetchUserDetails}
              className="px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 flex items-center gap-2 transition-colors"
              style={{ fontFamily: "Sofia Sans" }}
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!details) return null;

  const {
    user: userDetails,
    warnings,
    reports,
    stats,
    posts = [],
    comments = [],
  } = details;
  const statusConfig = getStatusConfig(userDetails.status);
  const StatusIcon = statusConfig.icon;

  const sections = [
    { key: "overview", label: "Overview", icon: Globe },
    {
      key: "posts",
      label: "Posts",
      icon: FileText,
      count: stats?.postCount || 0,
    },
    {
      key: "comments",
      label: "Comments",
      icon: MessageSquare,
      count: stats?.commentCount || 0,
    },
    {
      key: "warnings",
      label: "Warnings",
      icon: AlertTriangle,
      count: warnings?.length || 0,
    },
    {
      key: "reports",
      label: "Reports",
      icon: Flag,
      count: reports?.length || 0,
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
      {/* TOP NAVIGATION BAR */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/users")}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              title="Back to Users"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <UserAvatar
                user={userDetails}
                size="sm"
                gradient="from-purple-400 to-purple-600"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1
                    className="text-base font-bold text-gray-900 truncate"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {userDetails.name}
                  </h1>
                  {userDetails.username && (
                    <span
                      className="text-xs text-gray-400"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      @{userDetails.username}
                    </span>
                  )}
                </div>
                <p
                  className="text-xs text-gray-500 truncate"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  {userDetails.email}
                </p>
              </div>
            </div>
            <span
              className={`text-xs px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
              style={{ fontFamily: "Sofia Sans" }}
            >
              <StatusIcon size={14} />
              {statusConfig.label}
            </span>
            <button
              onClick={confirmLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-all"
              style={{ fontFamily: "Sofia Sans" }}
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* SIDEBAR */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="text-center mb-4">
                <div className="flex justify-center mb-3">
                  <UserAvatar
                    user={userDetails}
                    size="2xl"
                    gradient="from-purple-400 to-purple-600"
                  />
                </div>
                <h2
                  className="text-lg font-bold text-gray-900"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  {userDetails.name}
                </h2>
                {userDetails.username && (
                  <p
                    className="text-sm text-gray-400"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    @{userDetails.username}
                  </p>
                )}
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    <StatusIcon size={12} />
                    {statusConfig.label}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                  <Mail size={15} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="text-gray-700 truncate"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {userDetails.email}
                  </span>
                </div>
                {userDetails.username && (
                  <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                    <Hash size={15} className="text-gray-400 flex-shrink-0" />
                    <span
                      className="text-gray-700"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      @{userDetails.username}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                  <Shield size={15} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="text-gray-700 capitalize"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {userDetails.role}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                  <Calendar size={15} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="text-gray-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Joined{" "}
                    {new Date(userDetails.createdAt).toLocaleDateString(
                      "en-US",
                      { month: "long", year: "numeric" },
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                  <Globe size={15} className="text-gray-400 flex-shrink-0" />
                  <span
                    className={
                      userDetails.isEmailVerified
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {userDetails.isEmailVerified
                      ? "Email verified"
                      : "Email not verified"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p
                    className="text-xl font-bold text-blue-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {stats.postCount}
                  </p>
                  <p
                    className="text-xs text-blue-500 font-medium"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Posts
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p
                    className="text-xl font-bold text-emerald-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {stats.commentCount}
                  </p>
                  <p
                    className="text-xs text-emerald-500 font-medium"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Comments
                  </p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p
                    className="text-xl font-bold text-yellow-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {stats.warningCount}
                  </p>
                  <p
                    className="text-xs text-yellow-500 font-medium"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Warnings
                  </p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p
                    className="text-xl font-bold text-red-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {stats.reportCount}
                  </p>
                  <p
                    className="text-xs text-red-500 font-medium"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Reports
                  </p>
                </div>
              </div>

              {userDetails.isBanned && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
                  <p
                    className="text-xs font-semibold text-red-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Ban Reason:
                  </p>
                  <p
                    className="text-xs text-red-600 mt-1"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {userDetails.banReason}
                  </p>
                </div>
              )}
              {userDetails.isSuspended && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p
                    className="text-xs font-semibold text-amber-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Suspension Reason:
                  </p>
                  <p
                    className="text-xs text-amber-600 mt-1"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {userDetails.suspendReason}
                  </p>
                  <p
                    className="text-xs text-amber-500 mt-1"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Until:{" "}
                    {new Date(userDetails.suspendedUntil).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 min-w-0">
            {/* Section Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
              <div className="flex overflow-x-auto">
                {sections.map((section) => {
                  const SectionIcon = section.icon;
                  return (
                    <button
                      key={section.key}
                      onClick={() => setActiveSection(section.key)}
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${activeSection === section.key ? "border-purple-500 text-purple-600 bg-purple-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <SectionIcon size={16} />
                      {section.label}
                      {section.count > 0 && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${activeSection === section.key ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"}`}
                        >
                          {section.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section Content */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              {/* Overview */}
              {activeSection === "overview" && (
                <div className="text-center py-12">
                  <UserCheck
                    size={48}
                    className="mx-auto text-emerald-400 mb-4"
                  />
                  <h3
                    className="text-lg font-bold text-gray-900"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {userDetails.isBanned
                      ? "Account Banned"
                      : userDetails.isSuspended
                        ? "Account Suspended"
                        : "Account Active"}
                  </h3>
                  <p
                    className="text-sm text-gray-500 mt-2 max-w-md mx-auto"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {userDetails.isBanned
                      ? "This user has been permanently banned and cannot access the platform."
                      : userDetails.isSuspended
                        ? `This user is temporarily suspended until ${new Date(userDetails.suspendedUntil).toLocaleString()}.`
                        : "This user account is in good standing with no active restrictions."}
                  </p>
                </div>
              )}

              {/* POSTS SECTION - Using PostCard */}
              {activeSection === "posts" && (
                <div>
                  {posts.length > 0 ? (
                    <div className="space-y-3">
                      {posts.map((post) => (
                        <div
                          key={post._id}
                          onClick={() => setSelectedPost(post)}
                          className="cursor-pointer"
                        >
                          <PostCard
                            post={post}
                            compact={true}
                            showActions={false}
                            showReportCount={false}
                            fallbackUser={userDetails}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText
                        size={48}
                        className="mx-auto text-gray-300 mb-4"
                      />
                      <p
                        className="text-gray-500 font-medium"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        No posts
                      </p>
                      <p
                        className="text-sm text-gray-400 mt-1"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        This user has not created any posts yet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* COMMENTS SECTION - Using CommentCard */}
              {activeSection === "comments" && (
                <div>
                  {comments.length > 0 ? (
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <CommentCard
                          key={comment._id}
                          comment={comment}
                          showActions={false}
                          showReportCount={false}
                          fallbackUser={userDetails}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MessageSquare
                        size={48}
                        className="mx-auto text-gray-300 mb-4"
                      />
                      <p
                        className="text-gray-500 font-medium"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        No comments
                      </p>
                      <p
                        className="text-sm text-gray-400 mt-1"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        This user has not made any comments yet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Warnings */}
              {activeSection === "warnings" && (
                <div>
                  {warnings && warnings.length > 0 ? (
                    <div className="space-y-3">
                      {warnings.map((warning) => (
                        <div
                          key={warning._id}
                          className={`border rounded-xl p-4 ${warning.isActive ? "border-yellow-200 bg-yellow-50/50" : "border-gray-200 bg-gray-50/50"}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${warning.isActive ? "bg-yellow-100 text-yellow-700" : "bg-gray-200 text-gray-500"}`}
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {warning.isActive ? "Active" : "Revoked"}
                            </span>
                            <span
                              className="text-xs text-gray-400"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {new Date(warning.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p
                            className="text-sm text-gray-700"
                            style={{ fontFamily: "Sofia Sans" }}
                          >
                            {warning.reason}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full capitalize ${warning.severity === "critical" ? "bg-red-100 text-red-700" : warning.severity === "high" ? "bg-orange-100 text-orange-700" : warning.severity === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {warning.severity}
                            </span>
                            <span
                              className="text-xs text-gray-400"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              by {warning.issuedBy?.name || "Admin"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <AlertTriangle
                        size={48}
                        className="mx-auto text-gray-300 mb-4"
                      />
                      <p
                        className="text-gray-500 font-medium"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        No warnings
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Reports */}
              {activeSection === "reports" && (
                <div>
                  {reports && reports.length > 0 ? (
                    <div className="space-y-3">
                      {reports.map((report) => (
                        <div
                          key={report._id}
                          className={`border rounded-xl p-4 ${report.status === "pending" ? "border-red-200 bg-red-50/30" : report.status === "resolved" ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200 bg-gray-50/50"}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${report.status === "pending" ? "bg-red-100 text-red-700" : report.status === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"}`}
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {report.status}
                            </span>
                            <span
                              className="text-xs text-gray-400"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p
                            className="text-sm text-gray-700 capitalize"
                            style={{ fontFamily: "Sofia Sans" }}
                          >
                            {report.reason?.replace(/_/g, " ")}
                          </p>
                          <p
                            className="text-xs text-gray-400 mt-1"
                            style={{ fontFamily: "Sofia Sans" }}
                          >
                            Reported by {report.reportedBy?.name || "Unknown"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Flag size={48} className="mx-auto text-gray-300 mb-4" />
                      <p
                        className="text-gray-500 font-medium"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        No reports
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Post Detail Modal */}
      <PostDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        showActions={false}
        showMeta={true}
        fallbackUser={userDetails}
      />

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

export default UserDetailPage;
