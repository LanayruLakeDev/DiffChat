"use client";

import { useEffect, useState } from "react";
import { Database, Github, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatStorageIndicatorProps {
  className?: string;
}

export function ChatStorageIndicator({ className }: ChatStorageIndicatorProps) {
  const [storageType, setStorageType] = useState<
    "loading" | "postgres" | "diffdb" | "unknown"
  >("loading");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if debug mode is enabled
    const debugEnabled =
      localStorage.getItem("diffdb-debug-enabled") === "true";
    setIsVisible(debugEnabled);

    // Detect storage type from environment or console logs
    const isDiffDBEnabled = process.env.NEXT_PUBLIC_DIFFDB_ENABLED === "true";

    // Simulate detection from actual API calls
    setTimeout(() => {
      if (isDiffDBEnabled) {
        setStorageType("diffdb");
      } else {
        setStorageType("postgres");
      }
    }, 1000);
  }, []);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (storageType) {
      case "loading":
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case "diffdb":
        return <Github className="h-3 w-3" />;
      case "postgres":
        return <Database className="h-3 w-3" />;
      default:
        return <Database className="h-3 w-3" />;
    }
  };

  const getLabel = () => {
    switch (storageType) {
      case "loading":
        return "Detecting...";
      case "diffdb":
        return "DiffDB (GitHub)";
      case "postgres":
        return "PostgreSQL";
      default:
        return "Unknown";
    }
  };

  const getColor = () => {
    switch (storageType) {
      case "loading":
        return "text-yellow-500";
      case "diffdb":
        return "text-green-500";
      case "postgres":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-40 bg-background/80 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-sm",
        "flex items-center gap-2 text-xs",
        getColor(),
        className,
      )}
    >
      {getIcon()}
      <span>{getLabel()}</span>
    </div>
  );
}
