// src/components/posts/PostCard.jsx

import { Heart, MessageCircle, Flag, MapPin, Eye, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import UserAvatar from "../users/UserAvatar";
import API_BASE_URL from "../../config";

function PostCard({
  post,
  compact = false,
  showActions = false,
  showReportCount = false,
  onDelete,
  onRestore,
  actionLoading = false,
  fallbackUser = null,
}) {
  const navigate = useNavigate();
  const effectiveUser = post.user?.name ? post.user : fallbackUser;

  const formatTimeAgo = (date) => {
    if (!date) return "";
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const getVisibilityDisplayName = (visibility) => {
    const names = { campus: "Campus", connections: "Connections" };
    return names[visibility] || "Public";
  };

  const getVisibilityBadgeColor = (visibility) => {
    const colors = { campus: "#3b82f6", connections: "#8b5cf6" };
    return colors[visibility] || "#9ca3af";
  };

  const renderPostImages = (images, isDeleted = false) => {
    if (!images?.length) return null;
    const imageCount = images.length;
    const opacityClass = isDeleted ? "opacity-50" : "";

    if (imageCount === 1) {
      const imageUrl = getImageUrl(images[0].url);
      return (
        <div
          className={`relative w-full overflow-hidden rounded-xl ${opacityClass}`}
          style={{ backgroundColor: "#f0f2f5" }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-2xl scale-110 opacity-60"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ minHeight: compact ? "180px" : "200px" }}
          >
            <img
              src={imageUrl}
              alt="Post"
              className="w-auto h-auto max-w-full object-contain"
              style={{
                maxHeight: compact ? "350px" : "500px",
                minHeight: compact ? "180px" : "200px",
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  "https://via.placeholder.com/500x300?text=Image+failed+to+load";
              }}
            />
          </div>
        </div>
      );
    }

    if (imageCount === 2) {
      return (
        <div
          className={`grid grid-cols-2 gap-[3px] overflow-hidden rounded-xl ${opacityClass}`}
        >
          {images.map((img, idx) => {
            const imageUrl = getImageUrl(img.url);
            return (
              <div
                key={idx}
                className="relative bg-[#f0f2f5]"
                style={{ paddingBottom: "100%" }}
              >
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
                    e.target.src =
                      "https://via.placeholder.com/400x400?text=Error";
                  }}
                />
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className={`overflow-hidden rounded-xl ${opacityClass}`}>
        <div className="grid grid-cols-2 gap-[3px]">
          {images.slice(0, 4).map((img, idx) => {
            const imageUrl = getImageUrl(img.url);
            const isLastWithMore = idx === 3 && images.length > 4;
            return (
              <div
                key={idx}
                className="relative bg-[#f0f2f5]"
                style={{ paddingBottom: "100%" }}
              >
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
                    e.target.src =
                      "https://via.placeholder.com/400x400?text=Error";
                  }}
                />
                {isLastWithMore && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xl font-bold">
                      +{images.length - 4}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const isDeleted = post.isDeleted || false;
  const hasCommunity =
    post.community &&
    (post.community._id ||
      post.community.name ||
      typeof post.community === "string");
  const communityName =
    typeof post.community === "object" ? post.community?.name : "Community";
  const communityCoverImage =
    typeof post.community === "object" ? post.community?.coverImage : null;
  const communityId =
    typeof post.community === "object" ? post.community?._id : post.community;

  // For community posts, show community as the "author"
  const userName = post.isAnonymous
    ? "Anonymous"
    : hasCommunity
      ? communityName || "Community"
      : effectiveUser?.name || "Unknown User";

  const userUsername = post.isAnonymous
    ? "anonymous"
    : hasCommunity
      ? ""
      : effectiveUser?.username || "user";

  const handleUserClick = (e) => {
    e.stopPropagation();
    if (post.isAnonymous) return;
    if (hasCommunity && communityId) {
      navigate(`/communities/${communityId}`);
    } else if (effectiveUser?._id) {
      navigate(`/users/${effectiveUser._id}`);
    }
  };

  const getCommunityCoverUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${API_BASE_URL}/${url.replace(/^\/+/, "")}`;
  };

  return (
    <div
      className={`bg-white rounded-xl border transition-colors ${
        compact ? "p-4" : "p-5"
      } ${
        isDeleted
          ? "border-red-200 bg-red-50/30"
          : hasCommunity
            ? "border-purple-200 bg-purple-50/10"
            : "border-gray-100 hover:border-gray-200"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar / Community Cover */}
        <div
          onClick={handleUserClick}
          className={`${post.isAnonymous ? "" : "cursor-pointer"} flex-shrink-0`}
        >
          {post.isAnonymous ? (
            <div
              className={`${compact ? "w-9 h-9" : "w-10 h-10"} rounded-full bg-gray-100 flex items-center justify-center border border-dashed border-gray-300`}
            >
              <Eye size={compact ? 16 : 18} className="text-gray-400" />
            </div>
          ) : hasCommunity ? (
            // ✅ Community Cover Image or Icon
            communityCoverImage ? (
              <img
                src={getCommunityCoverUrl(communityCoverImage)}
                alt={communityName}
                className={`${compact ? "w-9 h-9" : "w-10 h-10"} rounded-full object-cover border-2 border-purple-300`}
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
            ) : null
          ) : (
            <UserAvatar
              user={effectiveUser}
              size={compact ? "md" : "sm"}
              gradient="from-purple-500 to-purple-600"
            />
          )}
          {/* Fallback for community when no cover image */}
          {hasCommunity && !communityCoverImage && (
            <div
              className={`${compact ? "w-9 h-9" : "w-10 h-10"} rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center border-2 border-purple-300`}
              style={{ display: communityCoverImage ? "none" : "flex" }}
            >
              <Users size={compact ? 16 : 18} className="text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              onClick={handleUserClick}
              className={`font-semibold text-gray-900 hover:text-purple-600 transition-colors ${compact ? "text-sm" : "text-sm"} ${post.isAnonymous ? "" : "cursor-pointer"}`}
              style={{ fontFamily: "Sofia Sans" }}
            >
              {userName}
            </span>
            {!post.isAnonymous && !hasCommunity && (
              <span
                onClick={handleUserClick}
                className={`text-gray-400 hover:text-purple-500 transition-colors cursor-pointer ${compact ? "text-xs" : "text-xs"}`}
                style={{ fontFamily: "Sofia Sans" }}
              >
                @{userUsername}
              </span>
            )}
            {/* Community badge */}
            {hasCommunity && (
              <span
                onClick={handleUserClick}
                className={`${compact ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full bg-purple-100 text-purple-600 font-medium flex items-center gap-1 cursor-pointer hover:bg-purple-200 transition-colors`}
                style={{ fontFamily: "Sofia Sans" }}
              >
                <Users size={compact ? 9 : 10} />
                Community Post
              </span>
            )}
            {post.visibility && (
              <span
                className={`${compact ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full flex items-center gap-1`}
                style={{
                  backgroundColor: `${getVisibilityBadgeColor(post.visibility)}15`,
                  color: getVisibilityBadgeColor(post.visibility),
                }}
              >
                <MapPin size={compact ? 9 : 10} />
                {getVisibilityDisplayName(post.visibility)}
              </span>
            )}
            {post.isAnonymous && (
              <span
                className={`${compact ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full bg-purple-100 text-purple-600 font-medium`}
              >
                Anonymous
              </span>
            )}
            {isDeleted && (
              <span
                className={`${compact ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full bg-red-100 text-red-600 font-medium`}
              >
                Deleted
              </span>
            )}
            {/* Show actual author for community posts */}
            {hasCommunity && !post.isAnonymous && effectiveUser?.name && (
              <span
                className={`text-gray-400 ${compact ? "text-[11px]" : "text-xs"}`}
                style={{ fontFamily: "Sofia Sans" }}
              >
                by {effectiveUser.name}
              </span>
            )}
          </div>

          <div
            className={`flex items-center gap-2 mb-2 text-gray-400 ${compact ? "text-[11px]" : "text-xs"}`}
            style={{ fontFamily: "Sofia Sans" }}
          >
            <span>{formatTimeAgo(post.createdAt)}</span>
            {post.isEdited && <span>• Edited</span>}
          </div>

          {/* Content */}
          {post.content && (
            <p
              className={`mb-3 whitespace-pre-wrap break-words ${compact ? "text-[13px]" : "text-sm"} ${isDeleted ? "text-gray-400 line-through" : "text-gray-700"}`}
              style={{ fontFamily: "Sofia Sans" }}
            >
              {post.content}
            </p>
          )}

          {/* Images */}
          {post.images?.length > 0 && (
            <div className={`${compact ? "mb-2" : "mb-3"}`}>
              {renderPostImages(post.images, isDeleted)}
            </div>
          )}

          {/* Stats */}
          <div
            className={`flex items-center gap-4 text-gray-400 border-t border-gray-100 pt-3 mt-2 ${compact ? "text-[11px]" : "text-xs"}`}
            style={{ fontFamily: "Sofia Sans" }}
          >
            <span className="flex items-center gap-1">
              <Heart
                size={compact ? 12 : 12}
                className={
                  post.likes?.length > 0 ? "text-red-500 fill-red-500" : ""
                }
              />
              {post.likes?.length || 0} likes
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={compact ? 12 : 12} />
              {post.commentCount || 0} comments
            </span>
            {showReportCount && (
              <span
                className={`flex items-center gap-1 ${post.reportCount > 0 ? "text-red-500 font-semibold" : ""}`}
              >
                <Flag size={compact ? 12 : 12} /> {post.reportCount || 0}{" "}
                reports
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDeleted ? (
              <button
                onClick={() => onRestore?.(post._id)}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-full bg-green-50 text-green-600 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
                style={{ fontFamily: "Sofia Sans" }}
              >
                Restore
              </button>
            ) : (
              <button
                onClick={() => onDelete?.(post._id)}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                style={{ fontFamily: "Sofia Sans" }}
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PostCard;
