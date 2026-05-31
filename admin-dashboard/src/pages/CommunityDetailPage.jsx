// admin-frontend/src/pages/CommunityDetailPage.jsx

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Calendar,
  Shield,
  AlertTriangle,
  Flag,
  Globe,
  Lock,
  Users,
  Building2,
  BookOpen,
  Hash,
  Tag,
  Loader,
  RefreshCw,
  LogOut,
  UserCheck,
  Clock,
  Ban,
  FileText,
  MessageSquare,
  Star,
  Crown,
} from "lucide-react";
import API_BASE_URL from "../config";
import useAuthStore from "../store/authStore";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PostCard from "../components/posts/PostCard";

function CommunityDetailPage() {
  const { communityId } = useParams();
  const navigate = useNavigate();

  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [imgErrors, setImgErrors] = useState({});

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

  const fetchCommunityDetails = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `${API_BASE_URL}/api/admin/communities/${communityId}`,
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
        setError("Community not found");
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (data.success) setDetails(data.data);
      else setError(data.message || "Failed to load community details");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [communityId, accessToken, logout, navigate]);

  useEffect(() => {
    fetchCommunityDetails();
  }, [fetchCommunityDetails]);

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

  const handleImgError = (key) =>
    setImgErrors((prev) => ({ ...prev, [key]: true }));

  const getFullImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE_URL}/${url.replace(/^\/+/, "")}`;
  };

  const getStatusConfig = (status) => {
    const configs = {
      approved: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        icon: UserCheck,
        label: "Approved",
      },
      pending: {
        bg: "bg-yellow-50",
        text: "text-yellow-700",
        border: "border-yellow-200",
        icon: Clock,
        label: "Pending",
      },
      rejected: {
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
        icon: Ban,
        label: "Rejected",
      },
    };
    return configs[status] || configs.pending;
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
            Loading community details...
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
              onClick={() => navigate("/communities")}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ fontFamily: "Sofia Sans" }}
            >
              Back to Communities
            </button>
            <button
              onClick={fetchCommunityDetails}
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

  const { community, approval, posts = [], reports = [], stats = {} } = details;
  const statusConfig = getStatusConfig(
    community?.approvalStatus || approval?.status || "pending",
  );
  const StatusIcon = statusConfig.icon;
  const isDepartment = community?.type === "department";

  // Get admin IDs for quick lookup
  const adminIds = new Set(
    (community?.admins || []).map((a) => (a._id || a).toString()),
  );

  // Get moderator user IDs from members array
  const moderatorUserIds = new Set(
    (community?.members || [])
      .filter((m) => m.role === "moderator")
      .map((m) => (m.user?._id || m.user).toString()),
  );

  // Combine all members with their roles
  const allMembersWithRoles = (community?.members || []).map((member) => {
    const userId = (member.user?._id || member.user).toString();
    const isAdmin = adminIds.has(userId);
    const isModerator =
      moderatorUserIds.has(userId) || member.role === "moderator";

    return {
      ...member,
      userId,
      isAdmin,
      isModerator,
      role: isAdmin ? "admin" : isModerator ? "moderator" : "member",
    };
  });

  // Sort: admins first, then moderators, then members
  allMembersWithRoles.sort((a, b) => {
    const roleOrder = { admin: 0, moderator: 1, member: 2 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  const sections = [
    { key: "overview", label: "Overview", icon: Globe },
    {
      key: "members",
      label: "Members",
      icon: Users,
      count: community?.memberCount || 0,
    },
    {
      key: "posts",
      label: "Posts",
      icon: FileText,
      count: stats.postCount || posts.length || 0,
    },
    { key: "events", label: "Events", icon: Calendar },
    {
      key: "reports",
      label: "Reports",
      icon: Flag,
      count: stats.reportCount || reports.length || 0,
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
      {/* TOP NAVIGATION BAR */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/communities")}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              title="Back to Communities"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {community?.coverImage && !imgErrors["cover"] ? (
                <img
                  src={getFullImageUrl(community.coverImage)}
                  alt={community.name}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  onError={() => handleImgError("cover")}
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                  {isDepartment ? (
                    <Building2 size={20} className="text-white" />
                  ) : (
                    <Users size={20} className="text-white" />
                  )}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1
                    className="text-base font-bold text-gray-900 truncate"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {community?.name || "Unnamed Community"}
                  </h1>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                      community?.privacy === "private"
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                    }`}
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {community?.privacy === "private" ? (
                      <Lock size={10} />
                    ) : (
                      <Globe size={10} />
                    )}
                    {community?.privacy || "public"}
                  </span>
                </div>
                <p
                  className="text-xs text-gray-500 truncate"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  {isDepartment ? "Department" : "Community"} •{" "}
                  {community?.memberCount || 0} members
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
              {/* Cover Image */}
              <div className="relative h-40 rounded-xl overflow-hidden mb-4">
                {community?.coverImage && !imgErrors["coverSidebar"] ? (
                  <img
                    src={getFullImageUrl(community.coverImage)}
                    alt="Cover"
                    className="w-full h-full object-cover"
                    onError={() => handleImgError("coverSidebar")}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                    {isDepartment ? (
                      <Building2 size={48} className="text-white opacity-50" />
                    ) : (
                      <Users size={48} className="text-white opacity-50" />
                    )}
                  </div>
                )}
                <div className="absolute bottom-3 left-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold border backdrop-blur-sm ${statusConfig.bg} ${statusConfig.text}`}
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    <StatusIcon size={12} className="inline mr-1" />
                    {statusConfig.label}
                  </span>
                </div>
              </div>

              {/* Community Name & Type */}
              <div className="text-center mb-4">
                <h2
                  className="text-lg font-bold text-gray-900"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  {community?.name}
                </h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 capitalize font-medium flex items-center gap-1"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {isDepartment ? (
                      <Building2 size={10} />
                    ) : (
                      <Users size={10} />
                    )}
                    {community?.type || "community"}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                      community?.privacy === "private"
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                    }`}
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {community?.privacy === "private" ? (
                      <Lock size={10} />
                    ) : (
                      <Globe size={10} />
                    )}
                    {community?.privacy || "public"}
                  </span>
                </div>
              </div>

              {/* Info Items */}
              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                  <Users size={15} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="text-gray-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {community?.memberCount || 0} members
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                  <Shield size={15} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="text-gray-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {community?.admins?.length || 0} admin
                    {(community?.admins?.length || 0) !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                  <UserCheck
                    size={15}
                    className="text-gray-400 flex-shrink-0"
                  />
                  <span
                    className="text-gray-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {moderatorUserIds.size} moderator
                    {moderatorUserIds.size !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                  <Calendar size={15} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="text-gray-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Created{" "}
                    {community?.createdAt
                      ? new Date(community.createdAt).toLocaleDateString(
                          "en-US",
                          { month: "long", year: "numeric" },
                        )
                      : "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-gray-50">
                  <Globe size={15} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="text-gray-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {community?.university || "N/A"}
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p
                    className="text-xl font-bold text-purple-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {stats.memberCount || community?.memberCount || 0}
                  </p>
                  <p
                    className="text-xs text-purple-500 font-medium"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Members
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p
                    className="text-xl font-bold text-blue-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {stats.postCount || posts.length || 0}
                  </p>
                  <p
                    className="text-xs text-blue-500 font-medium"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Posts
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p
                    className="text-xl font-bold text-green-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {community?.rules?.length || 0}
                  </p>
                  <p
                    className="text-xs text-green-500 font-medium"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Rules
                  </p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p
                    className="text-xl font-bold text-red-700"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    {stats.reportCount || reports.length || 0}
                  </p>
                  <p
                    className="text-xs text-red-500 font-medium"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Reports
                  </p>
                </div>
              </div>

              {/* Rejection Reason */}
              {community?.approvalStatus === "rejected" &&
                community?.rejectionReason && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
                    <p
                      className="text-xs font-semibold text-red-700"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      Rejection Reason:
                    </p>
                    <p
                      className="text-xs text-red-600 mt-1"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      {community.rejectionReason}
                    </p>
                  </div>
                )}

              {/* Approval Info */}
              {approval && (
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p
                    className="text-xs font-semibold text-gray-600 mb-1"
                    style={{ fontFamily: "Sofia Sans" }}
                  >
                    Submitted By:
                  </p>
                  <div className="flex items-center gap-2">
                    {approval.submittedBy?.profilePicture &&
                    !imgErrors["submitter"] ? (
                      <img
                        src={getFullImageUrl(
                          approval.submittedBy.profilePicture,
                        )}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover"
                        onError={() => handleImgError("submitter")}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-600">
                          {approval.submittedBy?.name?.charAt(0) || "U"}
                        </span>
                      </div>
                    )}
                    <span
                      className="text-sm text-gray-700"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      {approval.submittedBy?.name || "Unknown"}
                    </span>
                  </div>
                  {approval.submittedBy?.email && (
                    <p
                      className="text-xs text-gray-400 mt-1 flex items-center gap-1"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <Mail size={10} />
                      {approval.submittedBy.email}
                    </p>
                  )}
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
                      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                        activeSection === section.key
                          ? "border-purple-500 text-purple-600 bg-purple-50/50"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      }`}
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      <SectionIcon size={16} />
                      {section.label}
                      {section.count > 0 && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeSection === section.key
                              ? "bg-purple-100 text-purple-600"
                              : "bg-gray-100 text-gray-500"
                          }`}
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
              {/* Overview - with Rules included */}
              {activeSection === "overview" && (
                <div className="space-y-6">
                  {/* Description */}
                  <div>
                    <h3
                      className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      Description
                    </h3>
                    <p
                      className="text-sm text-gray-700 leading-relaxed"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      {community?.description || "No description provided."}
                    </p>
                  </div>

                  {/* Tags */}
                  {community?.tags && community.tags.length > 0 && (
                    <div>
                      <h3
                        className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {community.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 font-medium flex items-center gap-1"
                            style={{ fontFamily: "Sofia Sans" }}
                          >
                            <Hash size={10} />#{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rules in Overview */}
                  <div>
                    <h3
                      className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      Community Rules
                    </h3>
                    {community?.rules && community.rules.length > 0 ? (
                      <div className="space-y-2">
                        {community.rules.map((rule, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                          >
                            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-purple-600">
                                {idx + 1}
                              </span>
                            </div>
                            <div>
                              <p
                                className="text-sm font-semibold text-gray-800"
                                style={{ fontFamily: "Sofia Sans" }}
                              >
                                {rule.title}
                              </p>
                              {rule.description && (
                                <p
                                  className="text-xs text-gray-500 mt-0.5"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  {rule.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-xl">
                        <BookOpen
                          size={32}
                          className="mx-auto text-gray-300 mb-2"
                        />
                        <p
                          className="text-sm text-gray-400"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          No rules have been set for this community.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status Info */}
                  <div className="p-4 rounded-xl border bg-gray-50">
                    <h3
                      className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      Status Information
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p
                          className="text-xs text-gray-400"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          Approval Status
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-medium mt-0.5 ${statusConfig.text}`}
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          <StatusIcon size={14} />
                          {statusConfig.label}
                        </span>
                      </div>
                      <div>
                        <p
                          className="text-xs text-gray-400"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          Type
                        </p>
                        <p
                          className="text-sm font-medium text-gray-700 capitalize mt-0.5"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          {community?.type || "community"}
                        </p>
                      </div>
                      <div>
                        <p
                          className="text-xs text-gray-400"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          Privacy
                        </p>
                        <p
                          className="text-sm font-medium text-gray-700 capitalize mt-0.5 flex items-center gap-1"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          {community?.privacy === "private" ? (
                            <Lock size={12} />
                          ) : (
                            <Globe size={12} />
                          )}
                          {community?.privacy || "public"}
                        </p>
                      </div>
                      <div>
                        <p
                          className="text-xs text-gray-400"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          University
                        </p>
                        <p
                          className="text-sm font-medium text-gray-700 mt-0.5"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          {community?.university || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Members Section - Combined: Admins + Moderators + Members */}
              {activeSection === "members" && (
                <div>
                  {allMembersWithRoles.length > 0 ? (
                    <div className="space-y-1">
                      {allMembersWithRoles.some((m) => m.isAdmin) && (
                        <div className="flex items-center gap-2 px-2 py-2 mb-1">
                          <Crown size={14} className="text-purple-500" />
                          <span
                            className="text-xs font-semibold text-purple-600 uppercase tracking-wider"
                            style={{ fontFamily: "Sofia Sans" }}
                          >
                            Admins
                          </span>
                        </div>
                      )}
                      {allMembersWithRoles
                        .filter((m) => m.isAdmin)
                        .map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center gap-4 p-3 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 transition-colors"
                          >
                            {member.user?.profilePicture &&
                            !imgErrors[`member-${member.userId}`] ? (
                              <img
                                src={getFullImageUrl(
                                  member.user.profilePicture,
                                )}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover border-2 border-purple-300 flex-shrink-0"
                                onError={() =>
                                  handleImgError(`member-${member.userId}`)
                                }
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center border-2 border-purple-300 flex-shrink-0">
                                <span className="text-white text-sm font-bold">
                                  {(member.user?.name || "A")
                                    .charAt(0)
                                    .toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p
                                  className="text-sm font-semibold text-gray-900"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  {member.user?.name || "Unknown"}
                                </p>
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-700 font-medium flex items-center gap-1"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  <Crown size={10} />
                                  Admin
                                </span>
                              </div>
                              {member.user?.email && (
                                <p
                                  className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  <Mail size={10} />
                                  {member.user.email}
                                </p>
                              )}
                            </div>
                            <span
                              className="text-xs text-gray-400"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              Joined{" "}
                              {member.joinedAt
                                ? new Date(member.joinedAt).toLocaleDateString()
                                : "N/A"}
                            </span>
                          </div>
                        ))}

                      {allMembersWithRoles.some(
                        (m) => m.isModerator && !m.isAdmin,
                      ) && (
                        <div className="flex items-center gap-2 px-2 py-2 mb-1 mt-3">
                          <Star size={14} className="text-blue-500" />
                          <span
                            className="text-xs font-semibold text-blue-600 uppercase tracking-wider"
                            style={{ fontFamily: "Sofia Sans" }}
                          >
                            Moderators
                          </span>
                        </div>
                      )}
                      {allMembersWithRoles
                        .filter((m) => m.isModerator && !m.isAdmin)
                        .map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center gap-4 p-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors"
                          >
                            {member.user?.profilePicture &&
                            !imgErrors[`member-${member.userId}`] ? (
                              <img
                                src={getFullImageUrl(
                                  member.user.profilePicture,
                                )}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover border-2 border-blue-300 flex-shrink-0"
                                onError={() =>
                                  handleImgError(`member-${member.userId}`)
                                }
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center border-2 border-blue-300 flex-shrink-0">
                                <span className="text-white text-sm font-bold">
                                  {(member.user?.name || "M")
                                    .charAt(0)
                                    .toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p
                                  className="text-sm font-semibold text-gray-900"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  {member.user?.name || "Unknown"}
                                </p>
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-700 font-medium flex items-center gap-1"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  <Star size={10} />
                                  Moderator
                                </span>
                              </div>
                              {member.user?.email && (
                                <p
                                  className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  <Mail size={10} />
                                  {member.user.email}
                                </p>
                              )}
                            </div>
                            <span
                              className="text-xs text-gray-400"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              Joined{" "}
                              {member.joinedAt
                                ? new Date(member.joinedAt).toLocaleDateString()
                                : "N/A"}
                            </span>
                          </div>
                        ))}

                      {allMembersWithRoles.some(
                        (m) => !m.isAdmin && !m.isModerator,
                      ) && (
                        <div className="flex items-center gap-2 px-2 py-2 mb-1 mt-3">
                          <Users size={14} className="text-gray-500" />
                          <span
                            className="text-xs font-semibold text-gray-500 uppercase tracking-wider"
                            style={{ fontFamily: "Sofia Sans" }}
                          >
                            Members
                          </span>
                        </div>
                      )}
                      {allMembersWithRoles
                        .filter((m) => !m.isAdmin && !m.isModerator)
                        .slice(0, 100)
                        .map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            {member.user?.profilePicture &&
                            !imgErrors[`member-${member.userId}`] ? (
                              <img
                                src={getFullImageUrl(
                                  member.user.profilePicture,
                                )}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                                onError={() =>
                                  handleImgError(`member-${member.userId}`)
                                }
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
                                <span className="text-sm font-bold text-gray-500">
                                  {(member.user?.name || "M")
                                    .charAt(0)
                                    .toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium text-gray-700"
                                style={{ fontFamily: "Sofia Sans" }}
                              >
                                {member.user?.name || "Unknown"}
                              </p>
                              {member.user?.email && (
                                <p
                                  className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  <Mail size={10} />
                                  {member.user.email}
                                </p>
                              )}
                            </div>
                            <span
                              className="text-xs text-gray-400"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              Joined{" "}
                              {member.joinedAt
                                ? new Date(member.joinedAt).toLocaleDateString()
                                : "N/A"}
                            </span>
                          </div>
                        ))}
                      {allMembersWithRoles.filter(
                        (m) => !m.isAdmin && !m.isModerator,
                      ).length > 100 && (
                        <p
                          className="text-center text-sm text-gray-400 mt-4"
                          style={{ fontFamily: "Sofia Sans" }}
                        >
                          +
                          {allMembersWithRoles.filter(
                            (m) => !m.isAdmin && !m.isModerator,
                          ).length - 100}{" "}
                          more members
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users size={48} className="mx-auto text-gray-300 mb-4" />
                      <p
                        className="text-gray-500 font-medium"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        No members
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Posts Section - Using PostCard */}
              {activeSection === "posts" && (
                <div>
                  {posts && posts.length > 0 ? (
                    <div className="space-y-3">
                      {posts.map((post) => (
                        <PostCard
                          key={post._id}
                          post={post}
                          compact={true}
                          showActions={false}
                          showReportCount={false}
                        />
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
                        No posts yet
                      </p>
                      <p
                        className="text-sm text-gray-400 mt-1"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        This community has no posts.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Events Section */}
              {activeSection === "events" && (
                <div>
                  <div className="text-center py-12">
                    <Calendar
                      size={48}
                      className="mx-auto text-gray-300 mb-4"
                    />
                    <p
                      className="text-gray-500 font-medium"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      Events
                    </p>
                    <p
                      className="text-sm text-gray-400 mt-1"
                      style={{ fontFamily: "Sofia Sans" }}
                    >
                      Community events will be displayed here.
                    </p>
                  </div>
                </div>
              )}

              {/* Reports Section */}
              {activeSection === "reports" && (
                <div>
                  {reports && reports.length > 0 ? (
                    <div className="space-y-3">
                      {reports.map((report) => (
                        <div
                          key={report._id}
                          className={`border rounded-xl p-4 ${
                            report.status === "pending"
                              ? "border-red-200 bg-red-50/30"
                              : report.status === "resolved"
                                ? "border-emerald-200 bg-emerald-50/30"
                                : "border-gray-200 bg-gray-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                report.status === "pending"
                                  ? "bg-red-100 text-red-700"
                                  : report.status === "resolved"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : report.status === "dismissed"
                                      ? "bg-gray-200 text-gray-500"
                                      : "bg-blue-100 text-blue-700"
                              }`}
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {report.status || "unknown"}
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
                            Reason:{" "}
                            {report.reason?.replace(/_/g, " ") || "Unknown"}
                          </p>
                          {report.description && (
                            <p
                              className="text-xs text-gray-500 mt-1"
                              style={{ fontFamily: "Sofia Sans" }}
                            >
                              {report.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {report.reportedBy && (
                              <div className="flex items-center gap-1.5">
                                {report.reportedBy.profilePicture ? (
                                  <img
                                    src={getFullImageUrl(
                                      report.reportedBy.profilePicture,
                                    )}
                                    alt=""
                                    className="w-5 h-5 rounded-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                                    <span className="text-xs font-bold text-gray-500">
                                      {(report.reportedBy.name || "U")
                                        .charAt(0)
                                        .toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <span
                                  className="text-xs text-gray-500"
                                  style={{ fontFamily: "Sofia Sans" }}
                                >
                                  Reported by{" "}
                                  {report.reportedBy.name || "Unknown"}
                                </span>
                              </div>
                            )}
                          </div>
                          {report.resolutionNote && (
                            <div className="mt-2 p-2 bg-gray-100 rounded-lg">
                              <p
                                className="text-xs text-gray-600"
                                style={{ fontFamily: "Sofia Sans" }}
                              >
                                <span className="font-semibold">
                                  Resolution:
                                </span>{" "}
                                {report.resolutionNote}
                              </p>
                            </div>
                          )}
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
                      <p
                        className="text-sm text-gray-400 mt-1"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        This community has no reports.
                      </p>
                      <button
                        onClick={() => navigate("/reports")}
                        className="mt-4 px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
                        style={{ fontFamily: "Sofia Sans" }}
                      >
                        View All Reports
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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

export default CommunityDetailPage;
