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
  const { status: setupStatus, markAsCompleted } = useGitHubSetupStatus(userId);

  const [appReady, setAppReady] = useState(false);
  const [error, setError] = useState<string>();
  const [silentCheckDone, setSilentCheckDone] = useState(false);

  /**
   * Handle onboarding completion - immediately mark app as ready
   */
  const handleOnboardingComplete = () => {
    setAppReady(true); // Mark app as ready immediately - no waiting for refresh
  };

  /**
   * Handle onboarding errors
   */
  const handleOnboardingError = (error: string) => {
    setError(error);
    console.error("GitHub database setup failed:", error);
  };

  /**
   * Silent background check - verify repo exists before showing UI
   */
  useEffect(() => {
    if (!userId || silentCheckDone || status !== "authenticated") {
      return;
    }

    // If already marked as complete, skip check
    if (setupStatus.hasGitKey && setupStatus.setupCompleted) {
      setSilentCheckDone(true);
      setAppReady(true);
      return;
    }

    // Do silent background check
    const checkRepo = async () => {
      try {
        const { validateGitHubRepoAction } = await import(
          "@/lib/diffdb/actions"
        );
        const result = await validateGitHubRepoAction();

        if (result.success && result.data?.repositoryExists) {
          // Repo exists! Mark as complete and skip onboarding
          const repoName = result.data.repositoryName || "luminar-ai-data";
          markAsCompleted(repoName);
          setAppReady(true); // Set BEFORE marking done to ensure app loads
          setSilentCheckDone(true);
          return;
        }
      } catch (error) {
        console.log("Silent repo check failed, will show onboarding:", error);
      }

      // Only mark as done if we didn't find the repo
      setSilentCheckDone(true);
    };

    checkRepo();
  }, [userId, status, silentCheckDone, setupStatus, markAsCompleted]);

  /**
   * Check if app should be ready
   */
  useEffect(() => {
    if (!isDiffDBEnabled()) {
      setError("DiffDB is not enabled. Please enable GitHub database storage.");
      return;
    }

    if (status === "loading" || onboardingLoading || !silentCheckDone) {
      return; // Still loading or checking
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
  }, [status, userId, setupStatus, onboardingLoading, silentCheckDone]);

  /**
   * Loading state - only during actual authentication, not for checks
   */
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-muted-foreground">Authenticating...</p>
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
   * App ready - show main content immediately
   */
  if (appReady || (setupStatus.hasGitKey && setupStatus.setupCompleted)) {
    return <>{children}</>;
  }

  /**
   * Show onboarding if needed (only after silent check completes)
   */
  if (shouldShowOnboarding && userId && silentCheckDone) {
    return (
      <GitHubOnboardingModal
        userId={userId}
        onComplete={handleOnboardingComplete}
        onError={handleOnboardingError}
      />
    );
  }

  /**
   * Silent check in progress - don't show loading, will resolve quickly
   */
  if (!silentCheckDone) {
    // Return nothing - the check is fast (<1s), no need to flash loading screen
    return null;
  }

  /**
   * Fallback - should not normally reach here
   */
  console.warn("GitHubDatabaseWrapper: Unexpected state", {
    appReady,
    silentCheckDone,
    shouldShowOnboarding,
    userId,
    setupStatus,
  });

  return <>{children}</>; // Show app as fallback instead of infinite loading
}
