// admin-frontend/src/pages/Comments.jsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LogOut } from "lucide-react";
import useAuthStore from "../store/authStore";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import CommentCard from "../components/comments/CommentCard";

function Comments() {
  const navigate = useNavigate();

  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
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

  const fetchComments = useCallback(() => {
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
      `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/admin/comments?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
      .then((response) => {
        if (response.status === 401) {
          logout();
          navigate("/login", { replace: true });
          throw new Error("Session expired");
        }
        if (response.status === 403)
          throw new Error("You do not have permission to view comments");
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          setComments(data.data.comments);
          setTotalPages(data.data.pagination.pages);
        } else setError(data.message || "Failed to fetch comments");
        setLoading(false);
      })
      .catch((err) => {
        if (err.message !== "Session expired")
          setError(err.message || "Network error");
        setLoading(false);
      });
  }, [page, filter, search, accessToken, logout, navigate]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSearch = () => {
    setPage(1);
    fetchComments();
  };

  const handleDelete = async (id) => {
    if (!accessToken) return;
    setActionLoading(id);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/admin/comments/${id}`,
        {
          method: "DELETE",
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
        setComments((prev) =>
          prev.map((c) =>
            c._id === id
              ? { ...c, isDeleted: true, content: "[removed by moderator]" }
              : c,
          ),
        );
      } else alert(data.message || "Failed to delete comment");
    } catch (err) {
      alert("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove Comment",
      message:
        "Are you sure you want to remove this comment? This action cannot be undone.",
      variant: "danger",
      loading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        await handleDelete(id);
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
    { value: "all", label: "All" },
    { value: "reported", label: "Reported" },
    { value: "deleted", label: "Deleted" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Comments Moderation
          </h1>
          <p
            className="text-sm text-gray-500 mt-1"
            style={{ fontFamily: "Sofia Sans" }}
          >
            {comments.length} comments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-5 py-3 rounded-full border border-gray-200 bg-white shadow-sm">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search comments..."
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

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${filter === f.value ? "bg-purple-500 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
            style={{ fontFamily: "Sofia Sans" }}
          >
            {f.label}
          </button>
        ))}
      </div>

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
            onClick={fetchComments}
            className="px-5 py-2 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 transition-colors"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard
              key={comment._id}
              comment={comment}
              showActions={true}
              showReportCount={true}
              onDelete={confirmDelete}
              actionLoading={actionLoading === comment._id}
            />
          ))}
          {comments.length === 0 && !loading && (
            <div className="text-center py-20">
              <p className="text-gray-500" style={{ fontFamily: "Sofia Sans" }}>
                No comments found
              </p>
            </div>
          )}
        </div>
      )}

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
