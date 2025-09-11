import { ChatMessage, ChatRepository, ChatThread } from "app-types/chat";
import { DiffDBManager, DiffDBUser } from "./manager";
import { GitHubApiClient } from "./github-api";
import logger from "logger";

/**
 * DiffDB implementation of ChatRepository
 * Replaces PostgreSQL with GitHub-based storage
 */
export class DiffDBChatRepository implements ChatRepository {
  private diffDBManager: DiffDBManager;

  constructor(user: DiffDBUser) {
    this.diffDBManager = new DiffDBManager(user);
  }

  async insertThread(thread: Omit<ChatThread, "createdAt">): Promise<ChatThread> {
    console.log('💾 DIFFDB THREAD INSERT: Creating new thread');
    console.log('  📄 Thread ID:', thread.id);
    console.log('  📄 Thread Title:', thread.title);
    console.log('  👤 User ID:', thread.userId);

    const fullThread: ChatThread = {
      ...thread,
      createdAt: new Date(),
    };

    try {
      await this.diffDBManager.saveThread(fullThread);
      console.log('✅ DIFFDB THREAD INSERT SUCCESS: Thread saved to GitHub');
      logger.info(`DiffDB: Inserted thread ${thread.id}`);
      return fullThread;
    } catch (error) {
      console.error('❌ DIFFDB THREAD INSERT ERROR:', error);
      throw error;
    }
  }

  async upsertThread(thread: Omit<ChatThread, "createdAt" | "userId">): Promise<ChatThread> {
    console.log('🔄 DIFFDB THREAD UPSERT: Upserting thread');
    console.log('  📄 Thread ID:', thread.id);
    console.log('  📄 Thread Title:', thread.title);
    
    // First, check if thread already exists
    const existingThread = await this.selectThread(thread.id);
    
    if (existingThread) {
      console.log('🔄 DIFFDB THREAD UPSERT: Thread exists, updating...');
      console.log('  📄 Old title:', existingThread.title);
      console.log('  📄 New title:', thread.title);
      
      // Update existing thread
      const updatedThread: ChatThread = {
        ...existingThread,
        ...thread,
        userId: existingThread.userId, // Keep original userId
        createdAt: existingThread.createdAt, // Keep original creation date
      };
      
      try {
        await this.diffDBManager.saveThread(updatedThread);
        console.log('✅ DIFFDB THREAD UPSERT SUCCESS: Thread updated in GitHub');
        logger.info(`DiffDB: Updated existing thread ${thread.id}`);
        return updatedThread;
      } catch (error) {
        console.error('❌ DIFFDB THREAD UPSERT ERROR:', error);
        throw error;
      }
    } else {
      console.log('🔄 DIFFDB THREAD UPSERT: Thread not found, creating new...');
      
      // Create new thread
      const fullThread: ChatThread = {
        ...thread,
        userId: this.diffDBManager['userId'],
        createdAt: new Date(),
      };

      try {
        await this.diffDBManager.saveThread(fullThread);
        console.log('✅ DIFFDB THREAD UPSERT SUCCESS: New thread created in GitHub');
        logger.info(`DiffDB: Created new thread ${thread.id}`);
        return fullThread;
      } catch (error) {
        console.error('❌ DIFFDB THREAD UPSERT ERROR:', error);
        throw error;
      }
    }
  }

  async insertMessage(message: Omit<ChatMessage, "createdAt">): Promise<ChatMessage> {
    console.log('💬 DIFFDB MESSAGE INSERT: Saving new message');
    console.log('  💬 Message ID:', message.id);
    console.log('  📄 Thread ID:', message.threadId);
    console.log('  👤 Role:', message.role);
    console.log('  📝 Parts count:', message.parts?.length || 0);
    console.log('  📎 Attachments:', message.attachments?.length || 0);

    const fullMessage: ChatMessage = {
      ...message,
      createdAt: new Date(),
    };

    try {
      // Get thread title for context
      const thread = await this.selectThread(message.threadId);
      const threadTitle = thread?.title || "Unknown Thread";
      console.log('  📄 Thread title for context:', threadTitle);

      await this.diffDBManager.saveMessage(fullMessage, threadTitle);
      console.log('✅ DIFFDB MESSAGE INSERT SUCCESS: Message saved to GitHub');
      logger.info(`DiffDB: Inserted message ${message.id} into thread ${message.threadId}`);
      return fullMessage;
    } catch (error) {
      console.error('❌ DIFFDB MESSAGE INSERT ERROR:', error);
      throw error;
    }
  }

  async deleteChatMessage(id: string): Promise<void> {
    console.log('🗑️ DIFFDB MESSAGE DELETE: Attempting to delete message:', id);
    // For now, we'll implement soft delete by marking in the timeline
    // Full implementation would require parsing and updating specific messages
    logger.warn(`DiffDB: Message deletion not fully implemented for ${id}`);
    // TODO: Implement message deletion in timeline files
  }

  async selectThread(id: string): Promise<ChatThread | null> {
    console.log('📖 DIFFDB THREAD SELECT: Getting thread:', id);
    try {
      const threads = await this.diffDBManager.loadThreads(100);
      const thread = threads.find(t => t.id === id) || null;
      console.log('📖 DIFFDB THREAD SELECT:', thread ? 'FOUND' : 'NOT FOUND');
      return thread;
    } catch (error) {
      console.error('❌ DIFFDB THREAD SELECT ERROR:', error);
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
    return await this.diffDBManager.loadMessages(threadId);
  }

  async selectThreadsByUserId(userId: string): Promise<(ChatThread & { lastMessageAt: number })[]> {
    const threads = await this.diffDBManager.loadThreads();
    
    // Add lastMessageAt timestamp - for now use createdAt, can be enhanced
    return threads.map(thread => ({
      ...thread,
      lastMessageAt: thread.createdAt.getTime(),
    }));
  }

  async deleteThread(id: string): Promise<void> {
    await this.diffDBManager.deleteThread(id);
    logger.info(`DiffDB: Deleted thread ${id}`);
  }

  async deleteMessagesByChatIdAfterTimestamp(messageId: string): Promise<void> {
    // TODO: Implement selective message deletion
    logger.warn(`DiffDB: Selective message deletion not implemented for ${messageId}`);
  }

  async updateThread(
    id: string,
    thread: Partial<Omit<ChatThread, "createdAt" | "id">>
  ): Promise<ChatThread> {
    // TODO: Implement thread updates in timeline files
    logger.warn(`DiffDB: Thread updates not fully implemented for ${id}`);
    
    // For now, return the existing thread
    const existing = await this.selectThread(id);
    if (!existing) {
      throw new Error(`Thread ${id} not found`);
    }
    return existing;
  }

  async deleteAllThreads(userId: string): Promise<void> {
    // TODO: Implement bulk deletion
    logger.warn(`DiffDB: Bulk thread deletion not implemented for user ${userId}`);
  }

  async deleteUnarchivedThreads(userId: string): Promise<void> {
    // TODO: Implement unarchived thread deletion
    logger.warn(`DiffDB: Unarchived thread deletion not implemented for user ${userId}`);
  }

  async insertMessages(
    messages: Array<Omit<ChatMessage, "createdAt">>
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

  async upsertMessage(message: Omit<ChatMessage, "createdAt">): Promise<ChatMessage> {
    const fullMessage: ChatMessage = {
      ...message,
      createdAt: new Date(),
    };

    // Get thread title for context
    const thread = await this.selectThread(message.threadId);
    const threadTitle = thread?.title || "Unknown Thread";

    await this.diffDBManager.saveMessage(fullMessage, threadTitle);
    logger.info(`DiffDB: Upserted message ${message.id}`);
    
    return fullMessage;
  }
}

/**
 * Factory function to create DiffDB chat repository from session
 */
export async function createDiffDBChatRepository(session: any): Promise<DiffDBChatRepository | null> {
  try {
    console.log('🔧 DIFFDB CREATION: Starting DiffDB chat repository creation');
    console.log('👤 Session user:', session?.user?.id);
    
    // The session doesn't include accounts, so let's fetch GitHub account from database
    console.log('🔍 SESSION ISSUE: Accounts array is undefined in session');
    console.log('� WORKAROUND: Fetching GitHub account directly from database...');
    
    // Import database and fetch GitHub account
    const { pgDb } = await import("lib/db/pg/db.pg");
    const { AccountSchema } = await import("lib/db/pg/schema.pg");
    const { eq, and } = await import("drizzle-orm");
    
    try {
      console.log('� Querying database for GitHub account...');
      const githubAccounts = await pgDb
        .select()
        .from(AccountSchema)
        .where(
          and(
            eq(AccountSchema.userId, session.user.id),
            eq(AccountSchema.providerId, 'github')
          )
        );
      
      console.log('🔍 Found GitHub accounts:', githubAccounts.length);
      
      if (githubAccounts.length === 0) {
        console.error('❌ DIFFDB ERROR: No GitHub account found in database for user');
        console.log('� SUGGESTION: User may have signed up with GitHub but account linking failed');
        logger.error('No GitHub account found in database');
        return null;
      }
      
      const githubAccount = githubAccounts[0];
      console.log('🔑 GitHub account found in database:', {
        providerId: githubAccount.providerId,
        accountId: githubAccount.accountId,
        hasAccessToken: !!githubAccount.accessToken,
        tokenPreview: githubAccount.accessToken ? `${githubAccount.accessToken.substring(0, 10)}...` : 'none'
      });
      
      if (!githubAccount.accessToken) {
        console.error('❌ DIFFDB ERROR: GitHub account found but no access token stored');
        console.log('💡 SUGGESTION: OAuth token may have expired or was not saved properly');
        logger.error('GitHub account found but no access token');
        return null;
      }
      
      // Get GitHub username using the API client to fetch the actual username
      let githubUsername: string;
      try {
        const githubClient = await GitHubApiClient.createWithAuthenticatedUser(githubAccount.accessToken);
        const userInfo = await githubClient.getAuthenticatedUser();
        githubUsername = userInfo.login;
        console.log('🐙 GitHub username fetched from API:', githubUsername);
      } catch (error) {
        console.error('❌ Failed to fetch GitHub username from API:', error);
        // Fallback to account data
        githubUsername = session.user.name || session.user.email?.split('@')[0] || 'unknown';
        console.log('⚠️ Using fallback username:', githubUsername);
      }
      
      const diffDBUser: DiffDBUser = {
        id: session.user.id,
        githubUsername,
        githubToken: githubAccount.accessToken,
      };
      
      console.log('👤 DiffDB User created:', {
        id: diffDBUser.id,
        githubUsername: diffDBUser.githubUsername,
        hasToken: !!diffDBUser.githubToken
      });
      
      const repository = new DiffDBChatRepository(diffDBUser);
      console.log('✅ DIFFDB SUCCESS: DiffDB chat repository created successfully');
      
      // Initialize the user's repository structure
      try {
        console.log('🏗️ DIFFDB INIT: Initializing user repository structure...');
        await repository['diffDBManager'].initializeUserRepo();
        console.log('🏗️ DIFFDB INIT SUCCESS: Repository structure initialized');
      } catch (error) {
        console.error('❌ DIFFDB INIT ERROR: Failed to initialize repository structure:', error);
        logger.error('Failed to initialize DiffDB repository:', error);
        return null;
      }
      
      return repository;
      
    } catch (dbError) {
      console.error('❌ DATABASE ERROR: Failed to fetch GitHub account from database:', dbError);
      logger.error('Failed to fetch GitHub account from database:', dbError);
      return null;
    }
    
  } catch (error) {
    console.error('❌ DIFFDB CREATION ERROR:', error);
    logger.error('Failed to create DiffDB chat repository:', error);
    return null;
  }
}
