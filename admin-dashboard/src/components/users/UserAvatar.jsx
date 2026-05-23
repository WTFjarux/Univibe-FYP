// admin-frontend/src/components/users/UserAvatar.jsx

import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

function UserAvatar({
  user,
  size = "md",
  gradient = "from-purple-400 to-purple-600",
}) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-xl",
    "2xl": "w-24 h-24 text-3xl", // 100px ≈ w-24 (96px) close enough
  };

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const imageUrl = getImageUrl(user?.profilePicture);

  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={user?.name || "User"}
        className={`${sizeClasses[size]} rounded-full object-cover`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold`}
      style={{ fontFamily: "Sofia Sans" }}
    >
      {user?.name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

export default UserAvatar;
