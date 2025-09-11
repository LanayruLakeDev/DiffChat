import { pgChatRepository } from "lib/db/pg/repositories/chat-repository.pg";
import { createDiffDBChatRepository } from "../diffdb/chat-repository";
import { getSession } from "auth/server";
import logger from "logger";

export interface MigrationStats {
  threadsProcessed: number;
  messagesProcessed: number;
  errors: string[];
  success: boolean;
}

/**
 * Migrate user's chat data from PostgreSQL to DiffDB
 */
export async function migrateUserToDiffDB(userId: string): Promise<MigrationStats> {
  const stats: MigrationStats = {
    threadsProcessed: 0,
    messagesProcessed: 0,
    errors: [],
    success: false,
  };

  try {
    logger.info(`Starting migration for user: ${userId}`);

    // Get user session (needed for DiffDB)
    const session = await getSession();
    if (!session || session.user.id !== userId) {
      throw new Error("Invalid session or user mismatch");
    }

    // Create DiffDB repository
    const diffDBRepo = await createDiffDBChatRepository(session);
    if (!diffDBRepo) {
      throw new Error("Failed to create DiffDB repository");
    }

    // Get all user's threads from PostgreSQL
    const threads = await pgChatRepository.selectThreadsByUserId(userId);
    logger.info(`Found ${threads.length} threads to migrate`);

    for (const thread of threads) {
      try {
        // Create thread in DiffDB
        await diffDBRepo.insertThread({
          id: thread.id,
          title: thread.title,
          userId: thread.userId,
        });

        stats.threadsProcessed++;

        // Get all messages for this thread
        const messages = await pgChatRepository.selectMessagesByThreadId(thread.id);
        logger.info(`Migrating ${messages.length} messages for thread: ${thread.title}`);

        // Migrate messages in batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < messages.length; i += batchSize) {
          const batch = messages.slice(i, i + batchSize);
          
          for (const message of batch) {
            try {
              await diffDBRepo.upsertMessage({
                id: message.id,
                threadId: message.threadId,
                role: message.role,
                parts: message.parts,
                annotations: message.annotations,
                attachments: message.attachments,
                model: message.model,
              });
              
              stats.messagesProcessed++;
            } catch (error) {
              const errorMsg = `Failed to migrate message ${message.id}: ${error}`;
              stats.errors.push(errorMsg);
              logger.error(errorMsg);
            }
          }

          // Small delay between batches to respect rate limits
          if (i + batchSize < messages.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        logger.info(`Completed thread: ${thread.title} (${messages.length} messages)`);
        
      } catch (error) {
        const errorMsg = `Failed to migrate thread ${thread.id}: ${error}`;
        stats.errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    stats.success = stats.errors.length === 0;
    logger.info(`Migration completed. Threads: ${stats.threadsProcessed}, Messages: ${stats.messagesProcessed}, Errors: ${stats.errors.length}`);

    return stats;

  } catch (error) {
    const errorMsg = `Migration failed: ${error}`;
    stats.errors.push(errorMsg);
    logger.error(errorMsg);
    return stats;
  }
}

/**
 * Migrate specific threads to DiffDB
 */
export async function migrateSpecificThreads(userId: string, threadIds: string[]): Promise<MigrationStats> {
  const stats: MigrationStats = {
    threadsProcessed: 0,
    messagesProcessed: 0,
    errors: [],
    success: false,
  };

  try {
    logger.info(`Starting selective migration for user: ${userId}, threads: ${threadIds.join(", ")}`);

    const session = await getSession();
    if (!session || session.user.id !== userId) {
      throw new Error("Invalid session or user mismatch");
    }

    const diffDBRepo = await createDiffDBChatRepository(session);
    if (!diffDBRepo) {
      throw new Error("Failed to create DiffDB repository");
    }

    for (const threadId of threadIds) {
      try {
        // Get thread details
        const thread = await pgChatRepository.selectThread(threadId);
        if (!thread) {
          stats.errors.push(`Thread not found: ${threadId}`);
          continue;
        }

        if (thread.userId !== userId) {
          stats.errors.push(`Access denied for thread: ${threadId}`);
          continue;
        }

        // Create thread in DiffDB
        await diffDBRepo.insertThread({
          id: thread.id,
          title: thread.title,
          userId: thread.userId,
        });

        stats.threadsProcessed++;

        // Migrate messages
        const messages = await pgChatRepository.selectMessagesByThreadId(threadId);
        
        for (const message of messages) {
          try {
            await diffDBRepo.upsertMessage({
              id: message.id,
              threadId: message.threadId,
              role: message.role,
              parts: message.parts,
              annotations: message.annotations,
              attachments: message.attachments,
              model: message.model,
            });
            
            stats.messagesProcessed++;
          } catch (error) {
            stats.errors.push(`Failed to migrate message ${message.id}: ${error}`);
          }
        }

        logger.info(`Migrated thread: ${thread.title} (${messages.length} messages)`);
        
      } catch (error) {
        stats.errors.push(`Failed to migrate thread ${threadId}: ${error}`);
      }
    }

    stats.success = stats.errors.length === 0;
    return stats;

  } catch (error) {
    stats.errors.push(`Selective migration failed: ${error}`);
    return stats;
  }
}

/**
 * Preview what would be migrated without actually doing it
 */
export async function previewMigration(userId: string): Promise<{
  threadCount: number;
  messageCount: number;
  estimatedApiCalls: number;
  threads: Array<{ id: string; title: string; messageCount: number }>;
}> {
  const threads = await pgChatRepository.selectThreadsByUserId(userId);
  const threadsWithCounts: Array<{ id: string; title: string; messageCount: number }> = [];
  let totalMessages = 0;

  for (const thread of threads) {
    const messages = await pgChatRepository.selectMessagesByThreadId(thread.id);
    threadsWithCounts.push({
      id: thread.id,
      title: thread.title,
      messageCount: messages.length,
    });
    totalMessages += messages.length;
  }

  // Estimate API calls: thread creation + message creation + repo setup
  const estimatedApiCalls = threads.length + totalMessages + 10;

  return {
    threadCount: threads.length,
    messageCount: totalMessages,
    estimatedApiCalls,
    threads: threadsWithCounts,
  };
}
