// src/components/comments/CommentCard.jsx

import { Trash2, Flag } from "lucide-react";
import UserAvatar from "../users/UserAvatar";

function CommentCard({
  comment,
  showActions = false,
  showReportCount = false,
  onDelete,
  actionLoading = false,
  fallbackUser = null,
}) {
  // Check if comment.user is a populated object with a name, not just an ObjectId string
  const effectiveUser =
    comment.user && typeof comment.user === "object" && comment.user.name
      ? comment.user
      : fallbackUser;

  const isDeleted = comment.isDeleted || false;
  const userName = effectiveUser?.name || "Unknown";
  const userUsername = effectiveUser?.username || "user";

  return (
    <div
      className={`bg-white rounded-xl border p-5 transition-colors ${
        isDeleted
          ? "border-red-200 bg-red-50/30"
          : "border-gray-100 hover:border-gray-200"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <UserAvatar
          user={effectiveUser}
          size="sm"
          gradient="from-blue-400 to-blue-600"
        />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="font-semibold text-sm text-gray-900"
              style={{ fontFamily: "Sofia Sans" }}
            >
              {userName}
            </span>
            <span
              className="text-xs text-gray-400"
              style={{ fontFamily: "Sofia Sans" }}
            >
              @{userUsername}
            </span>
            {isDeleted && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                Deleted
              </span>
            )}
          </div>

          {/* Content */}
          <p
            className={`text-sm mb-2 whitespace-pre-wrap break-words ${
              isDeleted ? "text-gray-400 line-through" : "text-gray-700"
            }`}
            style={{ fontFamily: "Sofia Sans" }}
          >
            {comment.content}
          </p>

          {/* Post reference */}
          <div
            className="flex items-center gap-4 text-xs text-gray-400"
            style={{ fontFamily: "Sofia Sans" }}
          >
            <span className="truncate max-w-[200px]">
              Post: {comment.post?.content?.substring(0, 40) || "..."}
            </span>
            <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showReportCount && (
            <span
              className={`flex items-center gap-1 text-sm font-semibold ${
                comment.reportCount > 0 ? "text-red-500" : "text-gray-300"
              }`}
              style={{ fontFamily: "Sofia Sans" }}
            >
              <Flag size={14} /> {comment.reportCount || 0}
            </span>
          )}
          {showActions && !isDeleted && (
            <button
              onClick={() => onDelete?.(comment._id)}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
              style={{ fontFamily: "Sofia Sans" }}
            >
              <Trash2 size={14} className="inline mr-1" />
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CommentCard;
