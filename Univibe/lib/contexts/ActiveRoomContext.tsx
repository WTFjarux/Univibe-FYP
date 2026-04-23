// contexts/ActiveRoomContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface ActiveRoomContextValue {
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
  clearActiveRoom: () => void;
}

const ActiveRoomContext = createContext<ActiveRoomContextValue | undefined>(
  undefined,
);

interface ActiveRoomProviderProps {
  children: ReactNode;
}

export const ActiveRoomProvider: React.FC<ActiveRoomProviderProps> = ({
  children,
}) => {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const clearActiveRoom = useCallback(() => {
    setActiveRoomId(null);
  }, []);

  return (
    <ActiveRoomContext.Provider
      value={{
        activeRoomId,
        setActiveRoomId,
        clearActiveRoom,
      }}
    >
      {children}
    </ActiveRoomContext.Provider>
  );
};

export const useActiveRoom = (): ActiveRoomContextValue => {
  const context = useContext(ActiveRoomContext);
  if (context === undefined) {
    throw new Error("useActiveRoom must be used within an ActiveRoomProvider");
  }
  return context;
};
