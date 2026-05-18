// frontend/src/store/authStore.js

import { create } from "zustand";
import { persist } from "zustand/middleware";

const useAuthStore = create(
  persist(
    (set, get) => ({
      admin: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      sessionExpiresAt: null,
      isLoading: false,
      isRefreshing: false,

      login: (adminData, accessToken, refreshToken, expiresIn) => {
        const expiresAt = expiresIn
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

        // 🔥 Save accessToken to localStorage so it survives reloads
        localStorage.setItem("adminToken", accessToken);
        localStorage.setItem("adminRefreshToken", refreshToken);
        localStorage.setItem("adminSessionExpires", expiresAt);

        set({
          admin: {
            id: adminData.id,
            name: adminData.name,
            role: adminData.role,
            permissions: adminData.permissions,
          },
          accessToken,
          refreshToken,
          isAuthenticated: true,
          sessionExpiresAt: expiresAt,
        });
      },

      /**
       * 🔥 NEW: Restore token from localStorage on app start
       */
      restoreSession: () => {
        const storedToken = localStorage.getItem("adminToken");
        const storedRefreshToken = localStorage.getItem("adminRefreshToken");
        const storedExpires = localStorage.getItem("adminSessionExpires");

        if (storedToken && storedExpires) {
          // Check if token is still valid
          if (new Date(storedExpires) > new Date()) {
            set({
              accessToken: storedToken,
              refreshToken: storedRefreshToken,
              isAuthenticated: true,
              sessionExpiresAt: storedExpires,
            });
            return true;
          } else {
            // Token expired, try refresh
            get().refreshSession();
            return false;
          }
        }
        return false;
      },

      /**
       * 🔥 NEW: Try to refresh the session using refresh token
       */
      refreshSession: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/admin/auth/refresh`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            },
          );

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const {
                accessToken,
                refreshToken: newRefreshToken,
                expiresIn,
              } = data.data;
              const expiresAt = new Date(
                Date.now() + expiresIn * 1000,
              ).toISOString();

              localStorage.setItem("adminToken", accessToken);
              localStorage.setItem("adminRefreshToken", newRefreshToken);
              localStorage.setItem("adminSessionExpires", expiresAt);

              set({
                accessToken,
                refreshToken: newRefreshToken,
                isAuthenticated: true,
                sessionExpiresAt: expiresAt,
              });
              return true;
            }
          }
        } catch (err) {
          console.error("Session refresh failed:", err);
        }

        // Refresh failed, clear everything
        get().logout();
        return false;
      },

      setAccessToken: (accessToken, expiresIn) => {
        const expiresAt = expiresIn
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : get().sessionExpiresAt;

        localStorage.setItem("adminToken", accessToken);
        localStorage.setItem("adminSessionExpires", expiresAt);

        set({ accessToken, sessionExpiresAt: expiresAt });
      },

      setRefreshing: (isRefreshing) => set({ isRefreshing }),

      isSessionExpired: () => {
        const { sessionExpiresAt } = get();
        if (!sessionExpiresAt) return true;
        return new Date(sessionExpiresAt) < new Date();
      },

      logout: () => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminRefreshToken");
        localStorage.removeItem("adminSessionExpires");
        localStorage.removeItem("adminData");

        set({
          admin: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          sessionExpiresAt: null,
          isLoading: false,
          isRefreshing: false,
        });
      },

      hasPermission: (permission) => {
        const { admin } = get();
        if (!admin) return false;
        if (admin.role === "super_admin") return true;
        return admin.permissions?.[permission] === true;
      },
    }),
    {
      name: "univibe-admin-auth",
      partialize: (state) => ({
        admin: state.admin,
        refreshToken: state.refreshToken,
        sessionExpiresAt: state.sessionExpiresAt,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) console.error("Failed to rehydrate auth store:", error);
          // 🔥 FIX: Restore access token from localStorage instead of setting to null
          if (state) {
            const storedToken = localStorage.getItem("adminToken");
            const storedExpires = localStorage.getItem("adminSessionExpires");

            if (
              storedToken &&
              storedExpires &&
              new Date(storedExpires) > new Date()
            ) {
              state.accessToken = storedToken;
              state.isAuthenticated = true;
            }
          }
        };
      },
    },
  ),
);

export default useAuthStore;
