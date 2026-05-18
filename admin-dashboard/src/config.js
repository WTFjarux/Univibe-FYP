const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export const getFullImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url}`;
};

export default API_BASE_URL;
