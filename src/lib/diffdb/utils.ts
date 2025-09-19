"use client";

import { authClient } from "@/lib/auth/client";
import { DiffDBUser } from "./manager";
import { isDiffDBEnabled } from "@/lib/repository-factory";

/**
 * Hook to get DiffDB user configuration from current session
 */
export function useDiffDBUser(): DiffDBUser | null {
  const { data: session } = authClient.useSession();

  // Check if DiffDB is enabled
  if (!isDiffDBEnabled()) {
    return null;
  }

  // Check if user is authenticated with GitHub
  if (!session?.user) {
    return null;
  }

  // Extract GitHub account information
  // For now, we'll use the user's name as GitHub username
  // TODO: Properly integrate with GitHub OAuth account data
  const githubUsername =
    session.user.name || session.user.email?.split("@")[0] || "unknown";

  // TODO: Get actual GitHub token from OAuth
  // For now, this will need to be handled by the GitHub OAuth flow
  const githubToken = process.env.GITHUB_CLIENT_SECRET || "";

  return {
    id: session.user.id,
    githubUsername,
    githubToken,
  };
}

/**
 * Check if DiffDB is available and properly configured for current user
 */
export function useDiffDBStatus() {
  const diffdbUser = useDiffDBUser();
  const isEnabled = isDiffDBEnabled();

  return {
    isAvailable: !!diffdbUser && isEnabled,
    user: diffdbUser,
    isEnabled,
    requiresGitHubAuth: isEnabled && !diffdbUser,
  };
}
