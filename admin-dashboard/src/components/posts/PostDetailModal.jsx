// src/components/posts/PostDetailModal.jsx

import { X, RotateCcw, Trash2 } from "lucide-react";
import PostCard from "./PostCard";

function PostDetailModal({
  post,
  isOpen = false,
  onClose,
  showActions = false,
  showMeta = false,
  onDelete,
  onRestore,
  actionLoading = false,
  fallbackUser = null,
}) {
  if (!isOpen || !post) return null;

  const isDeleted = post.isDeleted || false;

  const getVisibilityDisplayName = (visibility) => {
    const names = { campus: "Campus", connections: "Connections" };
    return names[visibility] || "Public";
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[780px] max-h-[90vh] overflow-auto"
      >
        {/* ============================================ */}
        {/* POST CARD + METADATA - Centered layout */}
        {/* ============================================ */}
        <div className="flex gap-3 items-center">
          {/* Post Card - Takes 65% of the space, centered */}
          <div className="flex-[6.5] min-w-0 flex justify-center">
            <div className="w-full max-w-[500px]">
              <PostCard
                post={post}
                compact={false}
                showActions={false}
                showReportCount={false}
                fallbackUser={fallbackUser}
              />
            </div>
          </div>

          {/* Metadata - Takes 35% of the space */}
          {showMeta && (
            <div className="flex-[3.5] bg-white rounded-2xl p-5 space-y-2 shadow-lg self-start">
              <h3
                className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3"
                style={{ fontFamily: "Sofia Sans" }}
              >
                Post Information
              </h3>
              {[
                ["Post ID", post._id],
                [
                  "Author",
                  post.isAnonymous
                    ? "Anonymous"
                    : post.user?.name || fallbackUser?.name || "Unknown",
                ],
                [
                  "Username",
                  post.isAnonymous
                    ? "-"
                    : `@${post.user?.username || fallbackUser?.username || "unknown"}`,
                ],
                [
                  "Email",
                  post.isAnonymous
                    ? "-"
                    : post.user?.email || fallbackUser?.email || "-",
                ],
                ["Visibility", getVisibilityDisplayName(post.visibility)],
                ["Status", isDeleted ? "Deleted" : "Active"],
                [
                  "Created At",
                  post.createdAt
                    ? new Date(post.createdAt).toLocaleString()
                    : "-",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between py-2 px-3 border-b border-gray-100 last:border-0"
                >
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="text-xs text-gray-900 font-medium text-right max-w-[60%] break-all">
                    {value || "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gap */}
        <div className="h-3" />

        {/* ============================================ */}
        {/* ACTIONS - Below */}
        {/* ============================================ */}
        <div className="flex gap-2">
          {showActions && (
            <>
              {isDeleted ? (
                <button
                  onClick={() => onRestore?.(post._id)}
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-2xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  <RotateCcw size={16} /> Restore Post
                </button>
              ) : (
                <button
                  onClick={() => onDelete?.(post._id)}
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg"
                  style={{ fontFamily: "Sofia Sans" }}
                >
                  <Trash2 size={16} /> Remove Post
                </button>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors shadow-lg"
            style={{ fontFamily: "Sofia Sans" }}
          >
            Close
          </button>
        </div>

        {/* Close X button */}
        <button
          onClick={onClose}
          className="fixed top-4 right-4 p-2 rounded-full bg-white hover:bg-gray-100 transition-colors shadow-lg"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>
    </div>
  );
}

export default PostDetailModal;
