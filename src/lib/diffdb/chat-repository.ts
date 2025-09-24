import { ChatMessage, ChatRepository, ChatThread } from "app-types/chat";
import { DiffDBManager, DiffDBUser } from "./manager";
import { GitHubApiClient } from "./github-api";
import { DiffDBCache } from "./cache";
import logger from "logger";

/**
/**
 * DiffDB implementation of ChatRepository
 * Replaces PostgreSQL with GitHub-based storage
 */
export class DiffDBChatRepository implements ChatRepository {
  private diffDBManager: DiffDBManager;
  private cache: DiffDBCache;

  constructor(user: DiffDBUser) {
    this.diffDBManager = new DiffDBManager(user);
    this.cache = DiffDBCache.getInstance();
  }

  async insertThread(
    thread: Omit<ChatThread, "createdAt">,
  ): Promise<ChatThread> {
    console.log("💾 DIFFDB THREAD INSERT: Creating new thread");
    console.log("  📄 Thread ID:", thread.id);
    console.log("  📄 Thread Title:", thread.title);
    console.log("  👤 User ID:", thread.userId);

    const fullThread: ChatThread = {
      ...thread,
      createdAt: new Date(),
    };

    try {
      // Add to cache optimistically (this will make it appear instantly in UI)
      this.cache.addThreadOptimistically(thread.userId, fullThread);

      // Save to GitHub in background
      await this.diffDBManager.saveThread(fullThread);
      console.log("✅ DIFFDB THREAD INSERT SUCCESS: Thread saved to GitHub");

      logger.info(`DiffDB: Inserted thread ${thread.id}`);
      return fullThread;
    } catch (error) {
      console.error("❌ DIFFDB THREAD INSERT ERROR:", error);
      // Remove optimistic thread from cache if save failed
      this.cache.invalidateUserThreads(thread.userId);
      throw error;
    }
  }

  async upsertThread(
    thread: Omit<ChatThread, "createdAt" | "userId">,
  ): Promise<ChatThread> {
    console.log("🔄 DIFFDB THREAD UPSERT: Upserting thread");
    console.log("  📄 Thread ID:", thread.id);
    console.log("  📄 Thread Title:", thread.title);

    // First, check if thread already exists
    const existingThread = await this.selectThread(thread.id);

    if (existingThread) {
      console.log("🔄 DIFFDB THREAD UPSERT: Thread exists, updating...");
      console.log("  📄 Old title:", existingThread.title);
      console.log("  📄 New title:", thread.title);

      // Update existing thread
      const updatedThread: ChatThread = {
        ...existingThread,
        ...thread,
        userId: existingThread.userId, // Keep original userId
        createdAt: existingThread.createdAt, // Keep original creation date
      };

      try {
        await this.diffDBManager.saveThread(updatedThread);
        console.log(
          "✅ DIFFDB THREAD UPSERT SUCCESS: Thread updated in GitHub",
        );
        logger.info(`DiffDB: Updated existing thread ${thread.id}`);
        return updatedThread;
      } catch (error) {
        console.error("❌ DIFFDB THREAD UPSERT ERROR:", error);
        throw error;
      }
    } else {
      console.log("🔄 DIFFDB THREAD UPSERT: Thread not found, creating new...");

      // Create new thread
      const fullThread: ChatThread = {
        ...thread,
        userId: this.diffDBManager["userId"],
        createdAt: new Date(),
      };

      try {
        await this.diffDBManager.saveThread(fullThread);
        console.log(
          "✅ DIFFDB THREAD UPSERT SUCCESS: New thread created in GitHub",
        );
        logger.info(`DiffDB: Created new thread ${thread.id}`);
        return fullThread;
      } catch (error) {
        console.error("❌ DIFFDB THREAD UPSERT ERROR:", error);
        throw error;
      }
    }
  }

  async insertMessage(
    message: Omit<ChatMessage, "createdAt">,
  ): Promise<ChatMessage> {
    console.log("💬 DIFFDB MESSAGE INSERT: Saving new message");
    console.log("  💬 Message ID:", message.id);
    console.log("  📄 Thread ID:", message.threadId);
    console.log("  👤 Role:", message.role);
    console.log("  📝 Parts count:", message.parts?.length || 0);
    console.log("  📎 Attachments:", message.attachments?.length || 0);

    const fullMessage: ChatMessage = {
      ...message,
      createdAt: new Date(),
    };

    try {
      // Get thread title for context
      console.log("🔍 DIFFDB: Looking up thread for context...");
      const thread = await this.selectThread(message.threadId);
      const threadTitle = thread?.title || "Unknown Thread";
      console.log("  📄 Thread title for context:", threadTitle);

      // Add to cache optimistically (this will make it appear instantly in UI)
      console.log("⚡ OPTIMISTIC: Adding message to cache immediately...");
      this.cache.addMessageOptimistically(message.threadId, fullMessage);
      console.log("⚡ OPTIMISTIC: Message added to cache, user sees it now!");

      // Save to GitHub in background
      console.log("🌐 GITHUB SYNC: Starting background save to GitHub...");
      const syncStartTime = Date.now();
      await this.diffDBManager.saveMessage(fullMessage, threadTitle);
      const syncTime = Date.now() - syncStartTime;
      console.log(`🌐 GITHUB SYNC: Message saved to GitHub in ${syncTime}ms`);

      // Update cache with the real message (replacing optimistic one)
      console.log("💾 CACHE SYNC: Updating cache with real GitHub data...");
      this.cache.updateMessage(message.threadId, fullMessage.id, fullMessage);
      console.log(
        "✅ DIFFDB MESSAGE INSERT SUCCESS: Complete sync cycle finished",
      );

      logger.info(
        `DiffDB: Inserted message ${message.id} into thread ${message.threadId}`,
      );
      return fullMessage;
    } catch (error) {
      console.error("❌ DIFFDB MESSAGE INSERT ERROR:", error);
      // Remove optimistic message from cache if save failed
      this.cache.invalidateThread(message.threadId);
      throw error;
    }
  }

  async deleteChatMessage(id: string): Promise<void> {
    console.log("🗑️ DIFFDB MESSAGE DELETE: Deleting message:", id);

    try {
      // Find which thread this message belongs to by checking cache first
      let foundThreadId: string | null = null;

      // Check all cached threads to find the message
      const allThreads = await this.diffDBManager.loadThreads();
      for (const thread of allThreads) {
        const messages = await this.diffDBManager.loadMessages(thread.id);
        const messageExists = messages.find((m) => m.id === id);
        if (messageExists) {
          foundThreadId = thread.id;
          break;
        }
      }

      if (!foundThreadId) {
        console.warn(
          `⚠️ DIFFDB MESSAGE DELETE: Message ${id} not found in any thread`,
        );
        return;
      }

      console.log(
        `🗑️ DIFFDB MESSAGE DELETE: Found message in thread ${foundThreadId}`,
      );

      // Delete from GitHub timeline
      await this.diffDBManager.deleteMessage(id, foundThreadId);

      // Update cache by removing the message
      this.cache.invalidateThread(foundThreadId);

      console.log(
        "✅ DIFFDB MESSAGE DELETE SUCCESS: Message deleted from GitHub",
      );
      logger.info(`DiffDB: Deleted message ${id} from thread ${foundThreadId}`);
    } catch (error) {
      console.error("❌ DIFFDB MESSAGE DELETE ERROR:", error);
      throw error;
    }
  }

  async selectThread(id: string): Promise<ChatThread | null> {
    console.log("📖 DIFFDB THREAD SELECT: Getting thread:", id);
    try {
      const threads = await this.diffDBManager.loadThreads(100);
      const thread = threads.find((t) => t.id === id) || null;
      console.log("📖 DIFFDB THREAD SELECT:", thread ? "FOUND" : "NOT FOUND");
      return thread;
    } catch (error) {
      console.error("❌ DIFFDB THREAD SELECT ERROR:", error);
      throw error;
    }
  }

  async selectThreadDetails(id: string) {
    const thread = await this.selectThread(id);
    if (!thread) return null;

    const messages = await this.diffDBManager.loadMessages(id);

    return {
      id: thread.id,
      title: thread.title,
      userId: thread.userId,
      createdAt: thread.createdAt,
      userPreferences: undefined, // TODO: Load from DiffDB user preferences
      messages,
    };
  }

  async selectMessagesByThreadId(threadId: string): Promise<ChatMessage[]> {
    console.log(
      "💬 DIFFDB MESSAGES SELECT: Getting messages for thread:",
      threadId,
    );
    console.log("💬 CACHE CHECK: Checking cache first...");

    // Try cache first - OPTIMIZED for snappy experience
    const cachedMessages = this.cache.getMessages(threadId);
    if (cachedMessages) {
      console.log("⚡ CACHE SUCCESS: Returning cached messages");
      console.log("⚡ PERFORMANCE: Instant response from cache");
      return cachedMessages;
    }

    // Cache miss - fetch from GitHub with performance tracking
    console.log("💾 CACHE MISS: Loading messages from GitHub...");
    console.log("🌐 GITHUB API: Starting message fetch...");

    const startTime = Date.now();
    const messages = await this.diffDBManager.loadMessages(threadId);
    const loadTime = Date.now() - startTime;

    console.log(
      `🌐 GITHUB API: Loaded ${messages.length} messages in ${loadTime}ms`,
    );

    // Store in cache - EXTENDED TTL for better performance
    console.log("💾 CACHE UPDATE: Storing messages in cache...");
    this.cache.setMessages(threadId, messages);

    console.log(
      "✅ DIFFDB MESSAGES SELECT SUCCESS: Returning messages with cache update",
    );
    console.log(
      `📊 PERFORMANCE: GitHub load took ${loadTime}ms, now cached for 5+ minutes`,
    );
    return messages;
  }

  async selectThreadsByUserId(
    userId: string,
  ): Promise<(ChatThread & { lastMessageAt: number })[]> {
    console.log("📖 DIFFDB THREADS SELECT: Getting threads for user:", userId);
    console.log("📖 CACHE CHECK: Checking cache first...");

    // Try cache first
    const cachedThreads = this.cache.getThreads(userId);
    if (cachedThreads) {
      console.log("⚡ CACHE SUCCESS: Returning cached threads");
      return cachedThreads.map((thread) => ({
        ...thread,
        lastMessageAt: thread.createdAt.getTime(),
      }));
    }

    // Cache miss - fetch from GitHub
    console.log("💾 CACHE MISS: Loading threads from GitHub...");
    console.log("🌐 GITHUB API: Starting thread fetch...");

    const startTime = Date.now();
    const threads = await this.diffDBManager.loadThreads();
    const loadTime = Date.now() - startTime;

    console.log(
      `🌐 GITHUB API: Loaded ${threads.length} threads in ${loadTime}ms`,
    );

    // Store in cache
    console.log("💾 CACHE UPDATE: Storing threads in cache...");
    this.cache.setThreads(userId, threads);

    // Add lastMessageAt timestamp - for now use createdAt, can be enhanced
    const result = threads.map((thread) => ({
      ...thread,
      lastMessageAt: thread.createdAt.getTime(),
    }));

    console.log(
      "✅ DIFFDB THREADS SELECT SUCCESS: Returning threads with cache update",
    );
    return result;
  }

  async deleteThread(id: string): Promise<void> {
    await this.diffDBManager.deleteThread(id);
    logger.info(`DiffDB: Deleted thread ${id}`);
  }

  async deleteMessagesByChatIdAfterTimestamp(messageId: string): Promise<void> {
    console.log(
      `🗑️ DIFFDB SELECTIVE DELETE: Deleting messages after ${messageId}`,
    );

    try {
      // Find the thread and message timestamp
      let foundThreadId: string | null = null;
      let targetTimestamp: Date | null = null;

      const allThreads = await this.diffDBManager.loadThreads();
      for (const thread of allThreads) {
        const messages = await this.diffDBManager.loadMessages(thread.id);
        const targetMessage = messages.find((m) => m.id === messageId);
        if (targetMessage) {
          foundThreadId = thread.id;
          targetTimestamp = targetMessage.createdAt;
          break;
        }
      }

      if (!foundThreadId || !targetTimestamp) {
        console.warn(
          `⚠️ DIFFDB SELECTIVE DELETE: Message ${messageId} not found`,
        );
        return;
      }

      console.log(
        `🗑️ DIFFDB SELECTIVE DELETE: Found message in thread ${foundThreadId} at ${targetTimestamp}`,
      );

      // Get all messages in the thread
      const allMessages = await this.diffDBManager.loadMessages(foundThreadId);

      // Find messages after the target timestamp
      const messagesToDelete = allMessages.filter(
        (m) => m.createdAt.getTime() > targetTimestamp!.getTime(),
      );

      console.log(
        `🗑️ DIFFDB SELECTIVE DELETE: Found ${messagesToDelete.length} messages to delete`,
      );

      // Delete each message after the timestamp
      for (const message of messagesToDelete) {
        await this.diffDBManager.deleteMessage(message.id, foundThreadId);
      }

      // Clear cache for this thread
      this.cache.invalidateThread(foundThreadId);

      console.log(
        `✅ DIFFDB SELECTIVE DELETE SUCCESS: Deleted ${messagesToDelete.length} messages`,
      );
      logger.info(
        `DiffDB: Deleted ${messagesToDelete.length} messages after ${messageId}`,
      );
    } catch (error) {
      console.error("❌ DIFFDB SELECTIVE DELETE ERROR:", error);
      throw error;
    }
  }

  async updateThread(
    id: string,
    thread: Partial<Omit<ChatThread, "createdAt" | "id">>,
  ): Promise<ChatThread> {
    console.log(`🔄 DIFFDB THREAD UPDATE: Updating thread ${id}`, thread);

    try {
      // Get the existing thread
      const existingThread = await this.selectThread(id);
      if (!existingThread) {
        throw new Error(`Thread ${id} not found`);
      }

      // Create updated thread
      const updatedThread: ChatThread = {
        ...existingThread,
        ...thread,
        id, // Keep original ID
        createdAt: existingThread.createdAt, // Keep original creation date
      };

      console.log(
        `🔄 DIFFDB THREAD UPDATE: Old title: "${existingThread.title}"`,
      );
      console.log(
        `🔄 DIFFDB THREAD UPDATE: New title: "${updatedThread.title}"`,
      );

      // Update in GitHub timeline files
      await this.diffDBManager.updateThreadInTimeline(id, updatedThread);

      // Update cache
      this.cache.updateThread(updatedThread.userId, id, thread);

      console.log("✅ DIFFDB THREAD UPDATE SUCCESS: Thread updated in GitHub");
      logger.info(`DiffDB: Updated thread ${id}`);

      return updatedThread;
    } catch (error) {
      console.error("❌ DIFFDB THREAD UPDATE ERROR:", error);
      throw error;
    }
  }

  async deleteAllThreads(userId: string): Promise<void> {
    console.log(
      `🗑️ DIFFDB BULK DELETE: Deleting all threads for user ${userId}`,
    );

    try {
      // Get all threads for this user
      const threads = await this.diffDBManager.loadThreads();
      console.log(
        `🗑️ DIFFDB BULK DELETE: Found ${threads.length} threads to delete`,
      );

      // Delete each thread
      for (const thread of threads) {
        console.log(
          `🗑️ DIFFDB BULK DELETE: Deleting thread ${thread.id}: "${thread.title}"`,
        );
        await this.diffDBManager.deleteThread(thread.id);
      }

      // Clear all cache for this user
      this.cache.invalidateUserThreads(userId);
      this.cache.clearAll(); // Clear everything to be safe

      console.log(
        `✅ DIFFDB BULK DELETE SUCCESS: Deleted ${threads.length} threads`,
      );
      logger.info(
        `DiffDB: Bulk deleted ${threads.length} threads for user ${userId}`,
      );
    } catch (error) {
      console.error("❌ DIFFDB BULK DELETE ERROR:", error);
      throw error;
    }
  }

  async deleteUnarchivedThreads(userId: string): Promise<void> {
    // TODO: Implement unarchived thread deletion
    logger.warn(
      `DiffDB: Unarchived thread deletion not implemented for user ${userId}`,
    );
  }

  async insertMessages(
    messages: Array<Omit<ChatMessage, "createdAt">>,
  ): Promise<ChatMessage[]> {
    const fullMessages: ChatMessage[] = [];

    for (const message of messages) {
      const fullMessage: ChatMessage = {
        ...message,
        createdAt: new Date(),
      };

      // Get thread title for context
      const thread = await this.selectThread(message.threadId);
      const threadTitle = thread?.title || "Unknown Thread";

      await this.diffDBManager.saveMessage(fullMessage, threadTitle);
      fullMessages.push(fullMessage);
    }

    logger.info(`DiffDB: Inserted ${fullMessages.length} messages`);
    return fullMessages;
  }

  async upsertMessage(
    message: Omit<ChatMessage, "createdAt">,
  ): Promise<ChatMessage> {
    const fullMessage: ChatMessage = {
      ...message,
      createdAt: new Date(),
    };

    console.log(
      "💬 DIFFDB UPSERT MESSAGE: Optimistic cache update for instant UI",
    );

    // OPTIMISTIC CACHE UPDATE - Add to cache immediately for instant UI response
    const existingMessages = this.cache.getMessages(message.threadId) || [];
    const updatedMessages = [...existingMessages, fullMessage];
    this.cache.setMessages(message.threadId, updatedMessages);

    console.log(
      "⚡ OPTIMISTIC: Message added to cache instantly for snappy UI",
    );

    // Background save to GitHub (don't await to keep UI snappy)
    const thread = await this.selectThread(message.threadId);
    const threadTitle = thread?.title || "Unknown Thread";

    // Save to GitHub in background
    this.diffDBManager.saveMessage(fullMessage, threadTitle).catch((error) => {
      console.error("❌ BACKGROUND SAVE ERROR:", error);
      // TODO: Could implement retry logic or offline queue here
    });

    console.log("🚀 PERFORMANCE: Message saved with optimistic update pattern");
    logger.info(`DiffDB: Upserted message ${message.id} (optimistic)`);

    return fullMessage;
  }
}

/**
 * Factory function to create DiffDB chat repository from session
 */
export async function createDiffDBChatRepository(
  session: any,
): Promise<DiffDBChatRepository | null> {
  try {
    console.log("🔧 DIFFDB CREATION: Starting DiffDB chat repository creation");
    console.log("👤 Session user:", session?.user?.id);

    // The session doesn't include accounts, so let's fetch GitHub account from database
    console.log("🔍 SESSION ISSUE: Accounts array is undefined in session");
    console.log(
      "� WORKAROUND: Fetching GitHub account directly from database...",
    );

    // Import database and fetch GitHub account
    const { pgDb } = await import("lib/db/pg/db.pg");
    const { AccountSchema } = await import("lib/db/pg/schema.pg");
    const { eq, and } = await import("drizzle-orm");

    try {
      console.log("� Querying database for GitHub account...");
      const githubAccounts = await pgDb
        .select()
        .from(AccountSchema)
        .where(
          and(
            eq(AccountSchema.userId, session.user.id),
            eq(AccountSchema.providerId, "github"),
          ),
        );

      console.log("🔍 Found GitHub accounts:", githubAccounts.length);

      if (githubAccounts.length === 0) {
        console.error(
          "❌ DIFFDB ERROR: No GitHub account found in database for user",
        );
        console.log(
          "� SUGGESTION: User may have signed up with GitHub but account linking failed",
        );
        logger.error("No GitHub account found in database");
        return null;
      }

      const githubAccount = githubAccounts[0];
      console.log("🔑 GitHub account found in database:", {
        providerId: githubAccount.providerId,
        accountId: githubAccount.accountId,
        hasAccessToken: !!githubAccount.accessToken,
        tokenPreview: githubAccount.accessToken
          ? `${githubAccount.accessToken.substring(0, 10)}...`
          : "none",
      });

      if (!githubAccount.accessToken) {
        console.error(
          "❌ DIFFDB ERROR: GitHub account found but no access token stored",
        );
        console.log(
          "💡 SUGGESTION: OAuth token may have expired or was not saved properly",
        );
        logger.error("GitHub account found but no access token");
        return null;
      }

      // Get GitHub username using the API client to fetch the actual username
      let githubUsername: string;
      try {
        const githubClient = await GitHubApiClient.createWithAuthenticatedUser(
          githubAccount.accessToken,
        );
        const userInfo = await githubClient.getAuthenticatedUser();
        githubUsername = userInfo.login;
        console.log("🐙 GitHub username fetched from API:", githubUsername);
      } catch (error) {
        console.error("❌ Failed to fetch GitHub username from API:", error);
        // Fallback to account data
        githubUsername =
          session.user.name || session.user.email?.split("@")[0] || "unknown";
        console.log("⚠️ Using fallback username:", githubUsername);
      }

      const diffDBUser: DiffDBUser = {
        id: session.user.id,
        githubUsername,
        githubToken: githubAccount.accessToken,
      };

      console.log("👤 DiffDB User created:", {
        id: diffDBUser.id,
        githubUsername: diffDBUser.githubUsername,
        hasToken: !!diffDBUser.githubToken,
      });

      const repository = new DiffDBChatRepository(diffDBUser);
      console.log(
        "✅ DIFFDB SUCCESS: DiffDB chat repository created successfully",
      );

      // Initialize the user's repository structure
      try {
        console.log("🏗️ DIFFDB INIT: Initializing user repository structure...");
        await repository["diffDBManager"].initializeUserRepo();
        console.log("🏗️ DIFFDB INIT SUCCESS: Repository structure initialized");
      } catch (error) {
        console.error(
          "❌ DIFFDB INIT ERROR: Failed to initialize repository structure:",
          error,
        );
        logger.error("Failed to initialize DiffDB repository:", error);
        return null;
      }

      return repository;
    } catch (dbError) {
      console.error(
        "❌ DATABASE ERROR: Failed to fetch GitHub account from database:",
        dbError,
      );
      logger.error("Failed to fetch GitHub account from database:", dbError);
      return null;
    }
  } catch (error) {
    console.error("❌ DIFFDB CREATION ERROR:", error);
    logger.error("Failed to create DiffDB chat repository:", error);
    return null;
  }
}
