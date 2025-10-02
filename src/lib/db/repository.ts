// DiffDB-only repository system (no PostgreSQL fallback)
import { isDiffDBEnabled } from "../diffdb";
import { getGitHubAccessToken } from "../auth/github-helper";
import { getSession } from "../auth/server";
import { ChatRepository } from "app-types/chat";
import { createDiffDBChatRepository } from "../diffdb/repositories/chat-repository.diffdb";
import { createDiffDBArchiveRepository } from "../diffdb/repositories/archive-repository.diffdb";
import { createDiffDBUserRepository } from "../diffdb/repositories/user-repository.diffdb";
import { createDiffDBMcpRepository } from "../diffdb/repositories/mcp-repository.diffdb";
import { createDiffDBWorkflowRepository } from "../diffdb/repositories/workflow-repository.diffdb";
import { createDiffDBAgentRepository } from "../diffdb/repositories/agent-repository.diffdb";
import { DiffDBClient } from "../diffdb/client";

/**
 * Session-aware DiffDB repository system
 *
 * NO POSTGRESQL FALLBACK - GitHub repositories are the only storage backend.
 * All repositories perfectly simulate PostgreSQL behavior using GitHub storage.
 * Existing application code works identically without any changes.
 */

// Global repository cache per user session
const userRepositoryCache = new Map<
  string,
  {
    chatRepository: ChatRepository;
    archiveRepository: any;
    userRepository: any;
    mcpRepository: any;
    workflowRepository: any;
    agentRepository: any;
    lastAccessed: number;
  }
>();

/**
 * Get repositories for current user session
 * This creates all repository instances with proper GitHub authentication
 */
async function getUserRepositories() {
  if (!isDiffDBEnabled()) {
    throw new Error(
      "DiffDB is disabled. This app requires GitHub authentication and repository access.",
    );
  }

  try {
    // Get current session - handle case where no session exists (e.g. server startup)
    let session;
    try {
      session = await getSession();
    } catch (error) {
      // If we're outside a request context (server startup), return error
      if (error instanceof Error && error.message.includes("headers")) {
        throw new Error(
          "No active user session - repositories can only be accessed within request context",
        );
      }
      throw error;
    }

    if (!session?.user?.id) {
      throw new Error("User not authenticated. Please sign in with GitHub.");
    }

    const userId = session.user.id;
    const cacheKey = userId;

    // Check if we have cached repositories for this user (within 5 minutes)
    const cached = userRepositoryCache.get(cacheKey);
    if (cached && Date.now() - cached.lastAccessed < 5 * 60 * 1000) {
      cached.lastAccessed = Date.now();
      return cached;
    }

    // Get GitHub access token
    const accessToken = await getGitHubAccessToken(session);
    if (!accessToken) {
      throw new Error(
        "GitHub access token not found. Please re-authenticate with GitHub.",
      );
    }

    // Create DiffDB client and repositories
    const diffdbClient = new DiffDBClient(accessToken);
    await diffdbClient.initialize(); // Initialize with user info

    const repoName = process.env.DIFFDB_REPOSITORY_NAME || "luminar-ai-data";

    // Create all repository instances
    const repositories = {
      chatRepository: createDiffDBChatRepository(diffdbClient, repoName),
      archiveRepository: createDiffDBArchiveRepository(diffdbClient, repoName),
      userRepository: createDiffDBUserRepository(diffdbClient, repoName),
      mcpRepository: createDiffDBMcpRepository(diffdbClient, repoName),
      workflowRepository: createDiffDBWorkflowRepository(
        diffdbClient,
        repoName,
      ),
      agentRepository: createDiffDBAgentRepository(diffdbClient, repoName),
      lastAccessed: Date.now(),
    };

    // Cache the repositories
    userRepositoryCache.set(cacheKey, repositories);

    return repositories;
  } catch (error) {
    console.error("Failed to get user repositories:", error);
    throw new Error(
      `GitHub database access failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Create async repository proxy that resolves at runtime
 */
function createRepositoryProxy<T extends object>(
  getRepository: () => Promise<T>,
): T {
  return new Proxy<T>({} as T, {
    get(_target, prop) {
      return async (...args: any[]) => {
        const repo = await getRepository();
        const method = (repo as any)[prop];
        if (typeof method === "function") {
          return method.apply(repo, args);
        }
        return method;
      };
    },
  });
}

// Export all repositories as async proxies that resolve at runtime
export const chatRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.chatRepository;
});

export const archiveRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.archiveRepository;
});

export const userRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.userRepository;
});

export const mcpRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.mcpRepository;
});

export const workflowRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.workflowRepository;
});

export const agentRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.agentRepository;
});

// MCP customization repositories (Phase 2 - minimal implementation)
export const mcpMcpToolCustomizationRepository = {
  async findAll(): Promise<any[]> {
    return [];
  },
  async findById(_id: string): Promise<any> {
    return null;
  },
  async create(customization: any): Promise<any> {
    return customization;
  },
  async update(_id: string, customization: any): Promise<any> {
    return customization;
  },
  async delete(_id: string): Promise<void> {},
};

export const mcpServerCustomizationRepository = {
  async findAll(): Promise<any[]> {
    return [];
  },
  async findById(_id: string): Promise<any> {
    return null;
  },
  async create(customization: any): Promise<any> {
    return customization;
  },
  async update(_id: string, customization: any): Promise<any> {
    return customization;
  },
  async delete(_id: string): Promise<void> {},
};
