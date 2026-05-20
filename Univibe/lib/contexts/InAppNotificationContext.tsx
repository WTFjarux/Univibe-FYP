// ============================================
// IN-APP NOTIFICATION CONTEXT
// Provides toast state and actions to entire app
// Wraps the NotificationQueue for React integration
// ============================================

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import {
  InAppNotification,
  InAppNotificationContextType,
} from "../types/inAppNotification";
import { notificationQueue } from "../utils/notificationQueue";

// ============================================
// CONTEXT
// ============================================

const InAppNotificationContext = createContext<
  InAppNotificationContextType | undefined
>(undefined);

// ============================================
// PROVIDER
// ============================================

interface InAppNotificationProviderProps {
  children: ReactNode;
}

export const InAppNotificationProvider: React.FC<
  InAppNotificationProviderProps
> = ({ children }) => {
  const [currentToast, setCurrentToast] = useState<InAppNotification | null>(
    null,
  );
  const [isVisible, setIsVisible] = useState(false);

  // ==========================================
  // CALLBACKS (called by queue manager)
  // ==========================================

  const handleShow = useCallback((notification: InAppNotification) => {
    // Set both atomically in the same render cycle
    setCurrentToast(notification);
    setIsVisible(true);
  }, []);

  const handleHide = useCallback(() => {
    setIsVisible(false);
  }, []);

  // ==========================================
  // REGISTER WITH QUEUE ON MOUNT
  // ==========================================

  useEffect(() => {
    notificationQueue.registerCallbacks(handleShow, handleHide);
    return () => {
      notificationQueue.destroy();
    };
  }, [handleShow, handleHide]);

  // ==========================================
  // PUBLIC API
  // ==========================================

  const showToast = useCallback((notification: InAppNotification) => {
    notificationQueue.enqueue(notification);
  }, []);

  const hideToast = useCallback(() => {
    notificationQueue.clear();
    setCurrentToast(null);
    setIsVisible(false);
  }, []);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <InAppNotificationContext.Provider
      value={{
        currentToast,
        isVisible,
        showToast,
        hideToast,
      }}
    >
      {children}
    </InAppNotificationContext.Provider>
  );
};

// ============================================
// HOOK
// ============================================

export const useInAppNotification = (): InAppNotificationContextType => {
  const context = useContext(InAppNotificationContext);
  if (context === undefined) {
    throw new Error(
      "useInAppNotification must be used within an InAppNotificationProvider",
    );
  }
  return context;
};

export default InAppNotificationContext;
