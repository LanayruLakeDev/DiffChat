"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function Loading() {
  const [loadingMessage, setLoadingMessage] = useState("Loading chat...");

  useEffect(() => {
    // Show DiffDB-specific loading messages if enabled
    const isDiffDBEnabled = process.env.NEXT_PUBLIC_DIFFDB_ENABLED === "true";

    if (isDiffDBEnabled) {
      const messages = [
        "Loading chat from GitHub...",
        "Fetching conversation history...",
        "Syncing with DiffDB...",
        "Loading chat...",
      ];

      let index = 0;
      const interval = setInterval(() => {
        setLoadingMessage(messages[index]);
        index = (index + 1) % messages.length;
      }, 1500);

      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div
      className="flex items-center justify-center min-h-[200px]"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{loadingMessage}</p>
      </div>
    </div>
  );
}
