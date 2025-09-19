"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";

interface DiffDBDebugContext {
  isDebugEnabled: boolean;
  toggleDebug: () => void;
  debugToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  debugLog: (message: string, data?: any) => void;
}

const DebugContext = createContext<DiffDBDebugContext | null>(null);

export function DiffDBDebugProvider({
  children,
}: { children: React.ReactNode }) {
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);

  // Load debug state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("diffdb-debug-enabled");
    if (stored === "true") {
      setIsDebugEnabled(true);
    }
  }, []);

  // Save debug state to localStorage
  useEffect(() => {
    localStorage.setItem("diffdb-debug-enabled", isDebugEnabled.toString());
  }, [isDebugEnabled]);

  const toggleDebug = () => {
    setIsDebugEnabled((prev) => {
      const newState = !prev;
      toast.info(`DiffDB Debug ${newState ? "Enabled" : "Disabled"}`, {
        duration: 2000,
        position: "bottom-right",
      });
      return newState;
    });
  };

  const debugToast = (
    message: string,
    type: "info" | "success" | "warning" | "error" = "info",
  ) => {
    if (!isDebugEnabled) return;

    const toastMessage = `🔧 DiffDB: ${message}`;

    switch (type) {
      case "success":
        toast.success(toastMessage, {
          duration: 3000,
          position: "bottom-right",
        });
        break;
      case "warning":
        toast.warning(toastMessage, {
          duration: 4000,
          position: "bottom-right",
        });
        break;
      case "error":
        toast.error(toastMessage, { duration: 5000, position: "bottom-right" });
        break;
      default:
        toast.info(toastMessage, { duration: 2000, position: "bottom-right" });
    }
  };

  const debugLog = (message: string, data?: any) => {
    if (!isDebugEnabled) return;

    console.log(`🔧 DiffDB Debug: ${message}`, data || "");
  };

  // Add keyboard shortcut for debug toggle (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        event.preventDefault();
        toggleDebug();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <DebugContext.Provider
      value={{
        isDebugEnabled,
        toggleDebug,
        debugToast,
        debugLog,
      }}
    >
      {children}
      {/* Debug indicator in corner */}
      {isDebugEnabled && (
        <div
          className="fixed bottom-4 left-4 z-50 bg-orange-500 text-white text-xs px-2 py-1 rounded cursor-pointer opacity-75 hover:opacity-100"
          onClick={toggleDebug}
          title="DiffDB Debug Mode Active (Ctrl+Shift+D to toggle)"
        >
          🔧 DEBUG
        </div>
      )}
    </DebugContext.Provider>
  );
}

export function useDiffDBDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error("useDiffDBDebug must be used within DiffDBDebugProvider");
  }
  return context;
}
