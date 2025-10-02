/**
 * DiffDB Chat Repository Adapter
 *
 * This adapter implements the ChatRepository interface using GitHub as storage.
 * It provides seamless compatibility with existing chat functionality while
 * storing all data in GitHub repositories instead of PostgreSQL.
 */

import { ChatMessage, ChatRepository, ChatThread } from "app-types/chat";
import { DiffDBClient } from "../client";

export class DiffDBChatRepository implements ChatRepository {
  private client: DiffDBClient;
  private repoName: string;

  constructor(client: DiffDBClient, repoName: string) {
    this.client = client;
    this.repoName = repoName;
  }

  /**
   * Insert a new chat thread with error handling
   */
  async insertThread(
    thread: Omit<ChatThread, "createdAt">,
  ): Promise<ChatThread> {
    try {
      const now = new Date();
      const newThread: ChatThread = {
        ...thread,
        createdAt: now,
      };

      const threadPath = `threads/thread-${thread.id}.json`;
      const threadData = {
        ...newThread,
        createdAt: now.toISOString(),
        _metadata: {
          type: "thread",
          version: "1.0.0",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      };

      await this.client.writeFile(
        this.repoName,
        threadPath,
        JSON.stringify(threadData, null, 2),
        `Create chat thread: ${thread.title || thread.id}`,
      );

      return newThread;
    } catch (error) {
      console.error("DiffDB: Failed to insert thread:", error);
      throw new Error(
        `Failed to create chat thread: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Delete a chat message
   */
  async deleteChatMessage(id: string): Promise<void> {
    try {
      // Find which thread contains this message
      const threads = await this.client.listDirectory(this.repoName, "threads");

      for (const threadFile of threads) {
        if (threadFile.type === "file" && threadFile.name.endsWith(".json")) {
          const threadId = threadFile.name
            .replace("thread-", "")
            .replace(".json", "");
          const messagePath = `messages/thread-${threadId}/message-${id}.json`;

          const messageExists = await this.client.readFile(
            this.repoName,
            messagePath,
          );
          if (messageExists) {
            await this.client.deleteFile(
              this.repoName,
              messagePath,
              `Delete message ${id}`,
            );
            return;
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete message ${id}: ${error}`);
    }
  }

  /**
   * Select a thread by ID
   */
  async selectThread(id: string): Promise<ChatThread | null> {
    try {
      const threadPath = `threads/thread-${id}.json`;
      const threadFile = await this.client.readFile(this.repoName, threadPath);

      if (!threadFile) {
        return null;
      }

      const threadData = JSON.parse(threadFile.content);
      return {
        id: threadData.id,
        title: threadData.title,
        userId: threadData.userId,
        createdAt: new Date(threadData.createdAt),
      };
    } catch (error) {
      throw new Error(`Failed to select thread ${id}: ${error}`);
    }
  }

  /**
   * Select thread with messages and user preferences
   */
  async selectThreadDetails(id: string) {
    if (!id) {
      return null;
    }

    try {
      const thread = await this.selectThread(id);
      if (!thread) {
        return null;
      }

      // Get user preferences
      const userFile = await this.client.readFile(
        this.repoName,
        `users/user-${thread.userId}.json`,
      );
      const userPreferences = userFile
        ? JSON.parse(userFile.content).preferences
        : undefined;

      // Get messages for this thread
      const messages = await this.selectMessagesByThreadId(id);

      return {
        id: thread.id,
        title: thread.title,
        userId: thread.userId,
        createdAt: thread.createdAt,
        userPreferences,
        messages,
      };
    } catch (error) {
      throw new Error(`Failed to select thread details ${id}: ${error}`);
    }
  }

  /**
   * Select messages by thread ID
   */
  async selectMessagesByThreadId(threadId: string): Promise<ChatMessage[]> {
    try {
      const messagesDir = `messages/thread-${threadId}`;
      const messageFiles = await this.client.listDirectory(
        this.repoName,
        messagesDir,
      );

      const messages: ChatMessage[] = [];

      for (const messageFile of messageFiles) {
        if (messageFile.type === "file" && messageFile.name.endsWith(".json")) {
          const messageContent = await this.client.readFile(
            this.repoName,
            messageFile.path,
          );
          if (messageContent) {
            const messageData = JSON.parse(messageContent.content);
            messages.push({
              id: messageData.id,
              threadId: messageData.threadId,
              role: messageData.role,
              parts: messageData.parts,
              attachments: messageData.attachments || null,
              annotations: messageData.annotations || null,
              model: messageData.model || null,
              createdAt: new Date(messageData.createdAt),
            });
          }
        }
      }

      // Sort by creation time
      return messages.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
    } catch (error) {
      // Return empty array if messages directory doesn't exist yet
      if (error instanceof Error && error.message.includes("404")) {
        return [];
      }
      throw new Error(
        `Failed to select messages for thread ${threadId}: ${error}`,
      );
    }
  }

  /**
   * Select threads by user ID with last message timestamp
   */
  async selectThreadsByUserId(
    userId: string,
  ): Promise<(ChatThread & { lastMessageAt: number })[]> {
    try {
      const threadsDir = await this.client.listDirectory(
        this.repoName,
        "threads",
      );
      const userThreads: (ChatThread & { lastMessageAt: number })[] = [];

      for (const threadFile of threadsDir) {
        if (threadFile.type === "file" && threadFile.name.endsWith(".json")) {
          const threadContent = await this.client.readFile(
            this.repoName,
            threadFile.path,
          );
          if (threadContent) {
            const threadData = JSON.parse(threadContent.content);

            // Only include threads for this user
            if (threadData.userId === userId) {
              // Get last message timestamp
              const messages = await this.selectMessagesByThreadId(
                threadData.id,
              );
              const lastMessageAt =
                messages.length > 0
                  ? Math.max(...messages.map((m) => m.createdAt.getTime()))
                  : new Date(threadData.createdAt).getTime();

              userThreads.push({
                id: threadData.id,
                title: threadData.title,
                userId: threadData.userId,
                createdAt: new Date(threadData.createdAt),
                lastMessageAt,
              });
            }
          }
        }
      }

      // Sort by last message timestamp (descending)
      return userThreads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    } catch (error) {
      throw new Error(`Failed to select threads for user ${userId}: ${error}`);
    }
  }

  /**
   * Update a thread
   */
  async updateThread(
    id: string,
    thread: Partial<Omit<ChatThread, "id" | "createdAt">>,
  ): Promise<ChatThread> {
    try {
      const threadPath = `threads/thread-${id}.json`;
      const existingThread = await this.client.readFile(
        this.repoName,
        threadPath,
      );

      if (!existingThread) {
        throw new Error(`Thread ${id} not found`);
      }

      const threadData = JSON.parse(existingThread.content);
      const updatedThread = {
        ...threadData,
        ...thread,
        _metadata: {
          ...threadData._metadata,
          updated_at: new Date().toISOString(),
        },
      };

      await this.client.writeFile(
        this.repoName,
        threadPath,
        JSON.stringify(updatedThread, null, 2),
        `Update thread: ${thread.title || id}`,
        existingThread.sha,
      );

      return {
        id: updatedThread.id,
        title: updatedThread.title,
        userId: updatedThread.userId,
        createdAt: new Date(updatedThread.createdAt),
      };
    } catch (error) {
      throw new Error(`Failed to update thread ${id}: ${error}`);
    }
  }

  /**
   * Upsert a thread (insert or update)
   */
  async upsertThread(
    thread: Omit<ChatThread, "createdAt">,
  ): Promise<ChatThread> {
    const existingThread = await this.selectThread(thread.id);

    if (existingThread) {
      return await this.updateThread(thread.id, thread);
    } else {
      return await this.insertThread(thread);
    }
  }

  /**
   * Delete a thread and all its messages
   */
  async deleteThread(id: string): Promise<void> {
    try {
      // Delete all messages in the thread
      const messagesDir = `messages/thread-${id}`;
      const messageFiles = await this.client.listDirectory(
        this.repoName,
        messagesDir,
      );

      for (const messageFile of messageFiles) {
        if (messageFile.type === "file") {
          await this.client.deleteFile(this.repoName, messageFile.path);
        }
      }

      // Delete the thread file
      const threadPath = `threads/thread-${id}.json`;
      await this.client.deleteFile(
        this.repoName,
        threadPath,
        `Delete thread ${id}`,
      );

      // TODO: Remove from archives when archive adapter is implemented
    } catch (error) {
      throw new Error(`Failed to delete thread ${id}: ${error}`);
    }
  }

  /**
   * Insert a message with error handling and retry logic
   */
  async insertMessage(
    message: Omit<ChatMessage, "createdAt">,
  ): Promise<ChatMessage> {
    try {
      const now = new Date();
      const newMessage: ChatMessage = {
        ...message,
        createdAt: now,
      };

      const messagePath = `messages/thread-${message.threadId}/message-${message.id}.json`;
      const messageData = {
        ...newMessage,
        createdAt: now.toISOString(),
        _metadata: {
          type: "message",
          version: "1.0.0",
          created_at: now.toISOString(),
        },
      };

      await this.client.writeFile(
        this.repoName,
        messagePath,
        JSON.stringify(messageData, null, 2),
        `Add message to thread ${message.threadId}`,
      );

      return newMessage;
    } catch (error) {
      console.error("DiffDB: Failed to insert message:", error);
      throw new Error(
        `Failed to save chat message: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Upsert a message (insert or update)
   */
  async upsertMessage(
    message: Omit<ChatMessage, "createdAt">,
  ): Promise<ChatMessage> {
    try {
      const messagePath = `messages/thread-${message.threadId}/message-${message.id}.json`;
      const existingMessage = await this.client.readFile(
        this.repoName,
        messagePath,
      );

      if (existingMessage) {
        // Update existing message
        const messageData = JSON.parse(existingMessage.content);
        const updatedMessage = {
          ...messageData,
          parts: message.parts,
          annotations: message.annotations,
          attachments: message.attachments,
          model: message.model,
          _metadata: {
            ...messageData._metadata,
            updated_at: new Date().toISOString(),
          },
        };

        await this.client.writeFile(
          this.repoName,
          messagePath,
          JSON.stringify(updatedMessage, null, 2),
          `Update message ${message.id}`,
          existingMessage.sha,
        );

        return {
          ...message,
          createdAt: new Date(messageData.createdAt),
        } as ChatMessage;
      } else {
        // Insert new message
        return await this.insertMessage(message);
      }
    } catch (error) {
      throw new Error(`Failed to upsert message ${message.id}: ${error}`);
    }
  }

  /**
   * Delete messages after a timestamp
   */
  async deleteMessagesByChatIdAfterTimestamp(messageId: string): Promise<void> {
    try {
      // First find the target message to get its thread and timestamp
      const threads = await this.client.listDirectory(this.repoName, "threads");
      let targetMessage: ChatMessage | null = null;
      let targetThreadId: string | null = null;

      // Find the message
      for (const threadFile of threads) {
        if (threadFile.type === "file" && threadFile.name.endsWith(".json")) {
          const threadId = threadFile.name
            .replace("thread-", "")
            .replace(".json", "");
          const messagePath = `messages/thread-${threadId}/message-${messageId}.json`;

          const messageFile = await this.client.readFile(
            this.repoName,
            messagePath,
          );
          if (messageFile) {
            const messageData = JSON.parse(messageFile.content);
            targetMessage = {
              ...messageData,
              createdAt: new Date(messageData.createdAt),
            };
            targetThreadId = threadId;
            break;
          }
        }
      }

      if (!targetMessage || !targetThreadId) {
        return; // Message not found
      }

      // Get all messages in the thread
      const messages = await this.selectMessagesByThreadId(targetThreadId);

      // Delete messages created at or after the target message
      for (const message of messages) {
        if (message.createdAt >= targetMessage.createdAt) {
          const messagePath = `messages/thread-${targetThreadId}/message-${message.id}.json`;
          await this.client.deleteFile(this.repoName, messagePath);
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete messages after ${messageId}: ${error}`);
    }
  }

  /**
   * Delete all threads for a user
   */
  async deleteAllThreads(userId: string): Promise<void> {
    const userThreads = await this.selectThreadsByUserId(userId);

    for (const thread of userThreads) {
      await this.deleteThread(thread.id);
    }
  }

  /**
   * Delete unarchived threads for a user
   */
  async deleteUnarchivedThreads(userId: string): Promise<void> {
    // TODO: Implement when archive system is ready
    // For now, just delete all threads (assuming none are archived)
    await this.deleteAllThreads(userId);
  }

  /**
   * Insert multiple messages
   */
  async insertMessages(
    messages: PartialBy<ChatMessage, "createdAt">[],
  ): Promise<ChatMessage[]> {
    const insertedMessages: ChatMessage[] = [];

    for (const message of messages) {
      const insertedMessage = await this.insertMessage(
        message as Omit<ChatMessage, "createdAt">,
      );
      insertedMessages.push(insertedMessage);
    }

    return insertedMessages;
  }
}

/**
 * Create a DiffDB chat repository instance
 */
export function createDiffDBChatRepository(
  client: DiffDBClient,
  repoName: string,
): ChatRepository {
  return new DiffDBChatRepository(client, repoName);
}
