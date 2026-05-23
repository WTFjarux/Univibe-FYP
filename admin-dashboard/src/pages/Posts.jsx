// admin-frontend/src/pages/Posts.jsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LogOut } from "lucide-react";
import useAuthStore from "../store/authStore";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PostCard from "../components/posts/PostCard";
import PostDetailModal from "../components/posts/PostDetailModal";

function Posts() {
  const navigate = useNavigate();

  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

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

  const fetchPosts = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page,
      limit: 20,
      status: filter,
      search,
    });
    fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/admin/posts?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    )
      .then((response) => {
        if (response.status === 401) {
          logout();
          navigate("/login", { replace: true });
          throw new Error("Session expired");
        }
        if (response.status === 403)
          throw new Error("You do not have permission to view posts");
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          setPosts(data.data.posts);
          setTotalPages(data.data.pagination.pages);
        } else setError(data.message || "Failed to fetch posts");
        setLoading(false);
      })
      .catch((err) => {
        if (err.message !== "Session expired")
          setError(err.message || "Network error");
        setLoading(false);
      });
  }, [page, filter, search, accessToken, logout, navigate]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSearch = () => {
    setPage(1);
    fetchPosts();
  };

  const handleDelete = async (postId) => {
    if (!accessToken) return;
    setActionLoading(postId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/admin/posts/${postId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Moderator action" }),
        },
      );
      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      const data = await response.json();
      if (data.success) {
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, isDeleted: true } : p)),
        );
        setSelectedPost(null);
      } else alert(data.message || "Failed to delete post");
    } catch (err) {
      alert("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (postId) => {
    if (!accessToken) return;
    setActionLoading(postId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/admin/posts/${postId}/restore`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      const data = await response.json();
      if (data.success) {
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, isDeleted: false } : p)),
        );
        setSelectedPost(null);
      } else alert(data.message || "Failed to restore post");
    } catch (err) {
      alert("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = (postId) => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove Post",
      message:
        "Are you sure you want to remove this post? The user will be notified and the post will be hidden from view.",
      variant: "danger",
      loading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        await handleDelete(postId);
        setConfirmDialog((prev) => ({
          ...prev,
          isOpen: false,
          loading: false,
        }));
      },
    });
  };

  const confirmRestore = (postId) => {
    setConfirmDialog({
      isOpen: true,
      title: "Restore Post",
      message:
        "Are you sure you want to restore this post? It will become visible to users again.",
      variant: "info",
      loading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        await handleRestore(postId);
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

  const filters = [
    { value: "all", label: "All Posts" },
    { value: "reported", label: "Reported" },
    { value: "anonymous", label: "Anonymous" },
    { value: "deleted", label: "Deleted" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Posts Moderation
          </h1>
          <p
            className="text-sm text-gray-500 mt-1"
            style={{ fontFamily: "Sofia Sans" }}
          >
            {posts.length} posts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-5 py-3 rounded-full border border-gray-200 bg-white shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search posts..."
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

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
              filter === f.value
                ? "bg-purple-500 text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
            style={{ fontFamily: "Sofia Sans" }}
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
          <p className="text-red-500 mb-3" style={{ fontFamily: "Sofia Sans" }}>
            {error}
          </p>
          <button
            onClick={fetchPosts}
            className="px-5 py-2 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 transition-colors"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post._id}
              onClick={() => setSelectedPost(post)}
              className="cursor-pointer"
            >
              <PostCard
                post={post}
                showActions={false}
                showReportCount={true}
              />
            </div>
          ))}

          {posts.length === 0 && !loading && (
            <div className="text-center py-20">
              <p className="text-gray-500" style={{ fontFamily: "Sofia Sans" }}>
                No posts found
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium disabled:opacity-30 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Previous
          </button>
          <span
            className="py-2 text-sm font-semibold text-gray-700"
            style={{ fontFamily: "Sofia Sans" }}
          >
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium disabled:opacity-30 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Next
          </button>
        </div>
      )}

      {/* Post Detail Modal */}
      <PostDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        showActions={true}
        showMeta={true}
        showReportCount={true}
        onDelete={confirmDelete}
        onRestore={confirmRestore}
        actionLoading={actionLoading === selectedPost?._id}
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

export default Posts;
