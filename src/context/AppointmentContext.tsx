import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

interface AppointmentContextType {
  pendingCount: number;
  setPendingCount: (count: number) => void;
}

const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined);

interface AppointmentProviderProps {
  children: ReactNode;
}

export function AppointmentProvider({ children }: AppointmentProviderProps) {
  const [pendingCount, setPendingCount] = useState(0);

  const value = useMemo(
    () => ({ pendingCount, setPendingCount }),
    [pendingCount]
  );

  return (
    <AppointmentContext.Provider value={value}>
      {children}
    </AppointmentContext.Provider>
  );
}

export function useAppointmentContext() {
  const context = useContext(AppointmentContext);
  if (context === undefined) {
    throw new Error("useAppointmentContext must be used within an AppointmentProvider");
  }
  return context;
}