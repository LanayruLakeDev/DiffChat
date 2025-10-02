/**
 * Better Auth Session Helper
 *
 * Helper functions for working with Better Auth sessions,
 * particularly for extracting GitHub OAuth tokens for DiffDB.
 */

import { auth } from "./server";
import { pgDb } from "../db/pg/db.pg";
import { eq } from "drizzle-orm";
import { AccountSchema } from "../db/pg/schema.pg";

/**
 * Get GitHub access token for the current authenticated user
 */
export async function getGitHubAccessToken(
  session: any,
): Promise<string | null> {
  try {
    if (!session?.user?.id) {
      return null;
    }

    // Query the accounts table directly for GitHub account
    const githubAccount = await pgDb
      .select()
      .from(AccountSchema)
      .where(eq(AccountSchema.userId, session.user.id))
      .then((accounts) =>
        accounts.find((account) => account.providerId === "github"),
      );

    if (!githubAccount?.accessToken) {
      console.warn("No GitHub access token found for user:", session.user.id);
      return null;
    }

    return githubAccount.accessToken;
  } catch (error) {
    console.error("Error retrieving GitHub access token:", error);
    return null;
  }
}

/**
 * Check if user has GitHub authentication with required scopes
 */
export async function validateGitHubAuth(session: any): Promise<{
  hasAuth: boolean;
  hasRepoScope: boolean;
  accessToken: string | null;
  error?: string;
}> {
  try {
    const accessToken = await getGitHubAccessToken(session);

    if (!accessToken) {
      return {
        hasAuth: false,
        hasRepoScope: false,
        accessToken: null,
        error: "No GitHub access token found",
      };
    }

    // Get the account to check scope
    const githubAccount = await pgDb
      .select()
      .from(AccountSchema)
      .where(eq(AccountSchema.userId, session.user.id))
      .then((accounts) =>
        accounts.find((account) => account.providerId === "github"),
      );

    const scope = githubAccount?.scope || "";
    const hasRepoScope = scope.includes("repo");

    return {
      hasAuth: true,
      hasRepoScope,
      accessToken,
      error: hasRepoScope
        ? undefined
        : "GitHub account does not have repository permissions",
    };
  } catch (error) {
    return {
      hasAuth: false,
      hasRepoScope: false,
      accessToken: null,
      error: `Error validating GitHub auth: ${error}`,
    };
  }
}

/**
 * Get user session with GitHub validation
 */
export async function getSessionWithGitHub() {
  try {
    const session = await auth.api.getSession({
      headers: {} as any, // This will be provided by the calling context
    });

    if (!session) {
      return {
        session: null,
        github: {
          hasAuth: false,
          hasRepoScope: false,
          accessToken: null,
          error: "No session found",
        },
      };
    }

    const githubAuth = await validateGitHubAuth(session);

    return {
      session,
      github: githubAuth,
    };
  } catch (error) {
    return {
      session: null,
      github: {
        hasAuth: false,
        hasRepoScope: false,
        accessToken: null,
        error: `Session error: ${error}`,
      },
    };
  }
}
