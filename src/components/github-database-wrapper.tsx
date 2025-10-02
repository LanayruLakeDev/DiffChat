/**
 * GitHub Database Initialization Wrapper
 *
 * This wrapper component ensures users have their GitHub database
 * set up before they can use the app. It shows the onboarding modal
 * when hasGitKey=false.
 */

"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/hooks";
import { GitHubOnboardingModal } from "@/components/diffdb-setup-modal";
import {
  useShowOnboarding,
  useGitHubSetupStatus,
} from "@/lib/github-setup-status";
import { isDiffDBEnabled } from "@/lib/diffdb";
import { Loader2 } from "lucide-react";

interface GitHubDatabaseWrapperProps {
  children: React.ReactNode;
}

export function GitHubDatabaseWrapper({
  children,
}: GitHubDatabaseWrapperProps) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const { shouldShowOnboarding, isLoading: onboardingLoading } =
    useShowOnboarding(userId);
  const { status: setupStatus, refresh } = useGitHubSetupStatus(userId);

  const [appReady, setAppReady] = useState(false);
  const [error, setError] = useState<string>();

  /**
   * Handle onboarding completion
   */
  const handleOnboardingComplete = () => {
    refresh(); // Refresh setup status
    setAppReady(true); // Mark app as ready
  };

  /**
   * Handle onboarding errors
   */
  const handleOnboardingError = (error: string) => {
    setError(error);
    console.error("GitHub database setup failed:", error);
  };

  /**
   * Check if app should be ready
   */
  useEffect(() => {
    if (!isDiffDBEnabled()) {
      setError("DiffDB is not enabled. Please enable GitHub database storage.");
      return;
    }

    if (status === "loading" || onboardingLoading) {
      return; // Still loading
    }

    if (status === "unauthenticated") {
      setError("Please sign in with GitHub to use this app.");
      return;
    }

    if (!userId) {
      return; // No user ID yet
    }

    // If setup is complete, mark app as ready
    if (setupStatus.hasGitKey && setupStatus.setupCompleted) {
      setAppReady(true);
    }
  }, [status, userId, setupStatus, onboardingLoading]);

  /**
   * Loading state
   */
  if (status === "loading" || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-muted-foreground">
            Loading your GitHub database...
          </p>
        </div>
      </div>
    );
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <h2 className="text-xl font-semibold">Setup Required</h2>
          <p className="text-muted-foreground">{error}</p>
          {status === "unauthenticated" && (
            <a
              href="/sign-in"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Sign In with GitHub
            </a>
          )}
        </div>
      </div>
    );
  }

  /**
   * Show onboarding if needed
   */
  if (shouldShowOnboarding && userId) {
    return (
      <>
        <GitHubOnboardingModal
          userId={userId}
          onComplete={handleOnboardingComplete}
          onError={handleOnboardingError}
        />

        {/* Show a minimal loading state behind the modal */}
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
              <span className="text-blue-500 text-2xl">🚀</span>
            </div>
            <h1 className="text-2xl font-bold">Welcome to Luminar AI</h1>
            <p className="text-muted-foreground max-w-md">
              Setting up your personal GitHub database for secure data
              storage...
            </p>
          </div>
        </div>
      </>
    );
  }

  /**
   * App ready - show main content
   */
  if (appReady || (setupStatus.hasGitKey && setupStatus.setupCompleted)) {
    return <>{children}</>;
  }

  /**
   * Default loading state
   */
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
        <p className="text-muted-foreground">Preparing your database...</p>
      </div>
    </div>
  );
}
