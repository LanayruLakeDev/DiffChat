import { GitHubApiClient } from "./github-api";
import { ChatThread, ChatMessage } from "app-types/chat";
import logger from "logger";

export interface DiffDBUser {
  id: string;
  githubUsername: string;
  githubToken: string;
}

export class DiffDBManager {
  private githubClient: GitHubApiClient;
  private repoName: string;
  private userId: string;
  private githubUsername: string;

  constructor(user: DiffDBUser, repoName: string = "luminar-ai-data") {
    this.githubClient = new GitHubApiClient(
      user.githubToken,
      user.githubUsername,
    );
    this.repoName = repoName;
    this.userId = user.id;
    this.githubUsername = user.githubUsername;

    console.log("🔧 DIFFDB MANAGER: Initialized with:");
    console.log("  👤 User ID (UUID):", this.userId);
    console.log("  🐙 GitHub Username:", this.githubUsername);
    console.log("  📦 Repository Name:", this.repoName);
  }

  /**
   * Initialize user's DiffDB repository
   */
  async initializeUserRepo(): Promise<void> {
    console.log(
      "🏗️ DIFFDB MANAGER: Initializing repository for user:",
      this.userId,
    );
    console.log("🏗️ DIFFDB MANAGER: Repository name:", this.repoName);

    try {
      const exists = await this.githubClient.diffDBRepoExists(this.repoName);
      console.log("🏗️ DIFFDB MANAGER: Repository exists:", exists);

      if (!exists) {
        console.log("🏗️ DIFFDB MANAGER: Creating new repository...");
        await this.githubClient.createDiffDBRepo(this.repoName);
        console.log("✅ DIFFDB MANAGER: Repository created successfully");

        // Small delay to allow GitHub to fully initialize the repository
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Ensure repository is properly initialized before trying to add files
      console.log(
        "🔍 DIFFDB MANAGER: Ensuring repository is properly initialized...",
      );
      await this.githubClient.ensureRepoInitialized(this.repoName);
      console.log("✅ DIFFDB MANAGER: Repository initialization verified");

      console.log("🏗️ DIFFDB MANAGER: Initializing repository structure...");
      await this.githubClient.initializeDiffDBStructure(this.repoName);
      console.log("✅ DIFFDB MANAGER: Repository structure initialized");

      logger.info(`DiffDB initialized for user: ${this.userId}`);
    } catch (error) {
      console.error("❌ DIFFDB MANAGER INIT ERROR:", error);
      throw error;
    }
  }

  /**
   * Save a chat thread to the timeline
   */
  async saveThread(thread: ChatThread): Promise<void> {
    console.log("💾 DIFFDB MANAGER: Saving thread to timeline");
    console.log("  📄 Thread ID:", thread.id);
    console.log("  📄 Thread Title:", thread.title);
    console.log("  📅 Created At:", thread.createdAt);
    console.log("  🐙 Using GitHub username:", this.githubUsername);

    try {
      const date = new Date(thread.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const filePath = `users/${this.githubUsername}/memories/timeline/${monthKey}.md`;

      console.log("  📁 Timeline file path:", filePath);
      console.log("  📁 Full path breakdown:");
      console.log("    - Base: users/");
      console.log("    - Username:", this.githubUsername);
      console.log("    - Path: /memories/timeline/");
      console.log("    - File:", `${monthKey}.md`);

      // Get existing timeline file or create new
      const existingFile = await this.githubClient.getFile(
        this.repoName,
        filePath,
      );
      let content = "";

      if (existingFile) {
        console.log(
          "  📄 Existing timeline file found, checking for duplicate thread...",
        );
        content = existingFile.content;

        // Check if thread already exists and remove old entry
        const threadRegex = new RegExp(
          `#### Thread: [^\\(]*\\(${thread.id}\\)[\\s\\S]*?(?=#### Thread:|$)`,
          "g",
        );
        const existingThreadMatch = content.match(threadRegex);

        if (existingThreadMatch && existingThreadMatch.length > 0) {
          console.log(
            "  🔄 Found existing thread entry, updating instead of duplicating...",
          );
          console.log(
            "  🗑️ Removing old thread entries:",
            existingThreadMatch.length,
            "entries",
          );

          // Remove all existing entries for this thread ID
          content = content.replace(threadRegex, "");

          // Clean up any extra newlines
          content = content.replace(/\n{3,}/g, "\n\n");
        } else {
          console.log("  ✨ New thread, will append to file");
        }
      } else {
        console.log("  📄 Creating new timeline file...");
        content = `# Timeline: ${monthKey} (Chat History)\n\n## Monthly Summary [MERGE_LOAD]\n- Overview: [Auto-generated summary of conversations]\n\n### Chat Threads\n\n`;
      }

      // Ensure we have a meaningful title
      const threadTitle = thread.title?.trim() || "New Chat";

      // Add thread entry
      const threadEntry = `#### Thread: ${threadTitle} (${thread.id})\n- Created: ${thread.createdAt.toISOString()}\n- Status: Active\n- Messages: [Count will be updated as messages are added]\n\n`;

      content += threadEntry;

      console.log("  💾 Saving updated thread to GitHub...");
      console.log("  📝 Thread entry being saved:");
      console.log("    ", threadEntry.replace(/\n/g, "\\n"));
      await this.githubClient.createOrUpdateFile(
        this.repoName,
        filePath,
        content,
        `Update chat thread: ${threadTitle}`,
        existingFile?.sha,
      );
      console.log("✅ DIFFDB MANAGER: Thread saved successfully to GitHub");
    } catch (error) {
      console.error("❌ DIFFDB MANAGER SAVE THREAD ERROR:", error);
      throw error;
    }
  }

  /**
   * Save a chat message to the appropriate timeline
   */
  async saveMessage(message: ChatMessage, threadTitle: string): Promise<void> {
    console.log("💬 DIFFDB MANAGER: Saving message to timeline");
    console.log("  💬 Message ID:", message.id);
    console.log("  📄 Thread ID:", message.threadId);
    console.log("  👤 Role:", message.role);
    console.log("  📝 Parts count:", message.parts?.length || 0);

    try {
      const date = new Date(message.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const filePath = `users/${this.githubUsername}/memories/timeline/${monthKey}.md`;
      console.log("  📁 Message timeline file path:", filePath);
      console.log("  📅 Timeline month:", monthKey);

      console.log("🔍 GITHUB API: Checking for existing timeline file...");
      let existingFile = await this.githubClient.getFile(
        this.repoName,
        filePath,
      );
      if (!existingFile) {
        console.log("📄 TIMELINE: Creating new monthly timeline file");
        // Create monthly file if it doesn't exist
        existingFile = {
          path: filePath,
          content: `# Timeline: ${monthKey} (Chat History)\n\n## Monthly Summary [MERGE_LOAD]\n- Overview: [Auto-generated summary of conversations]\n\n### Chat Threads\n\n`,
        };
      }

      let content = existingFile.content;

      // Find the thread section or create it
      const threadMarker = `#### Thread: ${threadTitle} (${message.threadId})`;
      const messageTimestamp = date.toISOString();

      // Convert message parts to markdown with complete data preservation
      const messageContent = message.parts
        .map((part) => {
          if (part.type === "text") {
            return part.text;
          } else if (part.type === "tool-invocation") {
            // Preserve complete tool invocation data for proper reconstruction
            // Use safe property access to handle different ToolInvocation states
            const toolData = {
              toolCallId: part.toolInvocation.toolCallId,
              toolName: part.toolInvocation.toolName,
              state: part.toolInvocation.state,
              args: part.toolInvocation.args,
              // Handle result property safely - it might not exist in all states
              result: (part.toolInvocation as any).result,
              // Add timestamp for debugging
              _timestamp: new Date().toISOString(),
              // Include step info if available
              step: (part.toolInvocation as any).step,
            };
            return `🔧 **TOOL_INVOCATION_JSON**\n\`\`\`json\n${JSON.stringify(toolData, null, 2)}\n\`\`\``;
          } else {
            // Handle any other part types with complete JSON preservation
            return `🔧 **PART_JSON**\n\`\`\`json\n${JSON.stringify(part, null, 2)}\n\`\`\``;
          }
        })
        .join("\n\n");

      const messageEntry = `
##### ${message.role === "user" ? "👤 User" : "🤖 Assistant"} (${messageTimestamp}) [${message.id}]
${messageContent}

---
`;

      // Insert message into the thread section
      if (content.includes(threadMarker)) {
        console.log("  📝 Found existing thread section, appending message...");
        // Find the thread section and append the message
        const threadSectionEnd = content.indexOf(
          "\n#### Thread:",
          content.indexOf(threadMarker) + 1,
        );
        const insertPoint =
          threadSectionEnd === -1 ? content.length : threadSectionEnd;
        content =
          content.slice(0, insertPoint) +
          messageEntry +
          content.slice(insertPoint);
      } else {
        console.log("  📝 Creating new thread section with message...");
        // Add new thread section with the message
        const newThreadSection = `${threadMarker}\n- Created: ${messageTimestamp}\n- Status: Active\n\n${messageEntry}\n`;
        content += newThreadSection;
      }

      console.log("  💾 Saving message to GitHub...");
      console.log("🌐 GITHUB API: Creating/updating timeline file...");
      const githubStartTime = Date.now();
      await this.githubClient.createOrUpdateFile(
        this.repoName,
        filePath,
        content,
        `Add message from ${message.role} in thread: ${threadTitle}`,
        existingFile?.sha,
      );
      const githubTime = Date.now() - githubStartTime;
      console.log(`🌐 GITHUB API: Timeline file updated in ${githubTime}ms`);
      console.log("✅ DIFFDB MANAGER: Message saved successfully to GitHub");
    } catch (error) {
      console.error("❌ DIFFDB MANAGER SAVE MESSAGE ERROR:", error);
      throw error;
    }
  }

  /**
   * Load chat threads for a user
   */
  async loadThreads(limit: number = 50): Promise<ChatThread[]> {
    console.log("📚 DIFFDB MANAGER: Loading threads for user:", this.userId);
    console.log("📚 DIFFDB MANAGER: GitHub username:", this.githubUsername);
    console.log("📚 DIFFDB MANAGER: Thread limit:", limit);

    try {
      console.log("🔍 GITHUB API: Listing timeline files...");
      const listStartTime = Date.now();
      const timelineFiles = await this.githubClient.listFiles(
        this.repoName,
        `users/${this.githubUsername}/memories/timeline`,
      );
      const listTime = Date.now() - listStartTime;
      console.log(
        `📚 DIFFDB MANAGER: Found ${timelineFiles.length} timeline files in ${listTime}ms`,
        "timeline files",
      );
      console.log("📚 DIFFDB MANAGER: Timeline files:", timelineFiles);

      const threads: ChatThread[] = [];

      // Sort files by date (newest first)
      const sortedFiles = timelineFiles
        .filter((f) => f.endsWith(".md") && !f.endsWith(".gitkeep"))
        .sort((a, b) => b.localeCompare(a));

      console.log("📚 DIFFDB MANAGER: Sorted files to process:", sortedFiles);

      for (const filePath of sortedFiles.slice(0, 10)) {
        // Limit to recent files
        console.log("📚 DIFFDB MANAGER: Processing file:", filePath);
        const file = await this.githubClient.getFile(this.repoName, filePath);
        if (!file) {
          console.log("📚 DIFFDB MANAGER: File not found:", filePath);
          continue;
        }

        console.log(
          "📚 DIFFDB MANAGER: File content length:",
          file.content.length,
        );
        console.log(
          "📚 DIFFDB MANAGER: File content preview (first 500 chars):",
          file.content.substring(0, 500),
        );

        // Parse threads from the markdown content
        const content = file.content;

        console.log("📚 DIFFDB MANAGER: Parsing content for threads...");

        // More robust regex that handles any title format including empty ones
        const threadMatches = Array.from(
          content.matchAll(/#### Thread: ([^(]*?)\s*\(([^)]+)\)/g),
        );

        console.log(
          "📚 DIFFDB MANAGER: Found",
          threadMatches.length,
          "thread matches",
        );

        for (const match of threadMatches) {
          const title = (match[1] || "").trim() || "New Chat"; // Handle empty titles
          const id = (match[2] || "").trim();

          console.log("📚 DIFFDB MANAGER: Processing thread match:", {
            title,
            id,
            match: match[0],
          });

          // Skip if id is empty or invalid
          if (!id || id.length < 10) {
            console.log("📚 DIFFDB MANAGER: Skipping invalid thread ID:", id);
            continue;
          }

          // Extract creation date from the section after this thread
          let createdAt = new Date();

          // Look for the "Created:" line that follows this thread
          const threadSection = content.substring(match.index || 0);
          const createdMatch = threadSection.match(/- Created: ([^\n]+)/);

          if (createdMatch) {
            try {
              createdAt = new Date(createdMatch[1].trim());
              console.log("📚 DIFFDB MANAGER: Parsed date:", createdAt);
            } catch (_e) {
              console.warn("⚠️ DIFFDB: Failed to parse date:", createdMatch[1]);
              createdAt = new Date();
            }
          }

          const thread: ChatThread = {
            id,
            title,
            userId: this.userId,
            createdAt,
          };

          threads.push(thread);
          console.log("📄 DIFFDB: Successfully parsed thread:", {
            id,
            title,
            userId: this.userId,
            createdAt,
          });

          if (threads.length >= limit) break;
        }

        if (threads.length >= limit) break;
      }

      console.log("📚 DIFFDB MANAGER: Deduplicating threads by ID...");

      // Deduplicate threads by ID, keeping the most recent version (latest createdAt)
      const threadMap = new Map<string, ChatThread>();

      for (const thread of threads) {
        const existingThread = threadMap.get(thread.id);
        if (!existingThread || thread.createdAt > existingThread.createdAt) {
          threadMap.set(thread.id, thread);
          console.log("📄 DIFFDB: Keeping thread version:", {
            id: thread.id,
            title: thread.title,
            createdAt: thread.createdAt,
          });
        } else {
          console.log("📄 DIFFDB: Skipping older thread version:", {
            id: thread.id,
            title: thread.title,
            createdAt: thread.createdAt,
          });
        }
      }

      const uniqueThreads = Array.from(threadMap.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Sort by newest first
        .slice(0, limit);

      console.log(
        "✅ DIFFDB MANAGER: Final unique threads count:",
        uniqueThreads.length,
      );
      console.log(
        "✅ DIFFDB MANAGER: Loaded unique threads:",
        uniqueThreads.map((t) => ({ id: t.id, title: t.title })),
      );
      console.log("📊 LOAD PERFORMANCE: Total load time for threads complete");

      return uniqueThreads;
    } catch (error) {
      console.error("❌ DIFFDB MANAGER LOAD THREADS ERROR:", error);
      throw error;
    }
  }

  /**
   * Load messages for a specific thread
   */
  async loadMessages(threadId: string): Promise<ChatMessage[]> {
    console.log("💬 DIFFDB MANAGER: Loading messages for thread:", threadId);

    try {
      const timelineFiles = await this.githubClient.listFiles(
        this.repoName,
        `users/${this.githubUsername}/memories/timeline`,
      );
      console.log(
        "💬 DIFFDB MANAGER: Scanning",
        timelineFiles.length,
        "timeline files for messages",
      );

      const messages: ChatMessage[] = [];

      for (const filePath of timelineFiles) {
        if (!filePath.endsWith(".md") || filePath.endsWith(".gitkeep"))
          continue;

        const file = await this.githubClient.getFile(this.repoName, filePath);
        if (!file) continue;

        const content = file.content;

        // Find the thread section
        const threadMarker = `(${threadId})`;
        if (!content.includes(threadMarker)) continue;

        // Extract messages from the thread section
        const threadStart = content.indexOf(threadMarker);
        const nextThreadStart = content.indexOf(
          "\n#### Thread:",
          threadStart + 1,
        );
        const threadContent =
          nextThreadStart === -1
            ? content.slice(threadStart)
            : content.slice(threadStart, nextThreadStart);

        // Parse messages - NEW FORMAT with message IDs
        const messageMatches = threadContent.matchAll(
          /##### (👤 User|🤖 Assistant) \(([^)]+)\) \[([^\]]+)\]\n([\s\S]*?)(?=\n---|$)/g,
        );

        for (const match of messageMatches) {
          const role = match[1].includes("User") ? "user" : "assistant";
          const timestamp = match[2];
          const messageId = match[3]; // Extract the original message ID
          const messageContent = match[4].trim();

          // Convert markdown back to message parts
          const parts = this.parseMessageContent(messageContent);

          messages.push({
            id: messageId, // Use the original message ID for perfect continuity
            threadId,
            role,
            parts,
            createdAt: new Date(timestamp),
            model: role === "assistant" ? "unknown" : null,
          });
        }
      }

      console.log(
        "✅ DIFFDB MANAGER: Loaded",
        messages.length,
        "messages for thread",
      );
      // Sort by creation date
      return messages.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
    } catch (error) {
      console.error("❌ DIFFDB MANAGER LOAD MESSAGES ERROR:", error);
      throw error;
    }
  }

  /**
   * Parse markdown message content back to message parts
   */
  private parseMessageContent(content: string): any[] {
    const parts: any[] = [];
    let remainingContent = content;

    // Handle tool invocations with complete state preservation
    const toolMatches = [
      ...remainingContent.matchAll(
        /🔧 \*\*TOOL_INVOCATION_JSON\*\*\n```json\n([\s\S]*?)\n```/g,
      ),
    ];

    for (const match of toolMatches) {
      try {
        const toolData = JSON.parse(match[1]);
        parts.push({
          type: "tool-invocation",
          toolInvocation: {
            toolCallId: toolData.toolCallId,
            toolName: toolData.toolName,
            state: toolData.state || "call",
            args: toolData.args || {},
            // Only include result if it exists
            ...(toolData.result !== undefined && { result: toolData.result }),
            // Only include step if it exists
            ...(toolData.step !== undefined && { step: toolData.step }),
          },
        });
        // Remove from content to avoid duplicate parsing
        remainingContent = remainingContent.replace(match[0], "");
      } catch (error) {
        console.warn("Failed to parse tool invocation JSON:", error);
      }
    }

    // Handle other part types
    const partMatches = [
      ...remainingContent.matchAll(
        /� \*\*PART_JSON\*\*\n```json\n([\s\S]*?)\n```/g,
      ),
    ];

    for (const match of partMatches) {
      try {
        const partData = JSON.parse(match[1]);
        parts.push(partData);
        remainingContent = remainingContent.replace(match[0], "");
      } catch (error) {
        console.warn("Failed to parse part JSON:", error);
      }
    }

    // Handle remaining text content (clean up any remaining markdown artifacts)
    const cleanContent = remainingContent
      .replace(/🔧 \*\*Tool\*\*:.*?```json[\s\S]*?```/g, "") // Remove old format
      .replace(/📊 \*\*Tool Result\*\*:.*?```[\s\S]*?```/g, "") // Remove old format
      .trim();

    if (cleanContent) {
      parts.push({
        type: "text",
        text: cleanContent,
      });
    }

    // If no parts were parsed, return a basic text part
    return parts.length > 0
      ? parts
      : [
          {
            type: "text",
            text: content,
          },
        ];
  }

  /**
   * Delete a thread and its messages
   */
  async deleteThread(threadId: string): Promise<void> {
    // For now, we'll mark as deleted rather than actually deleting
    // This preserves the Git history
    const timelineFiles = await this.githubClient.listFiles(
      this.repoName,
      `users/${this.githubUsername}/memories/timeline`,
    );
    for (const filePath of timelineFiles) {
      if (!filePath.endsWith(".md")) continue;

      const file = await this.githubClient.getFile(this.repoName, filePath);
      if (!file || !file.content.includes(`(${threadId})`)) continue;

      // Mark thread as deleted
      const updatedContent = file.content.replace(
        new RegExp(
          `(#### Thread: .+ \\(${threadId}\\)[\\s\\S]*?)- Status: Active`,
          "g",
        ),
        "$1- Status: Deleted",
      );

      await this.githubClient.createOrUpdateFile(
        this.repoName,
        filePath,
        updatedContent,
        `Delete thread: ${threadId}`,
        file.sha,
      );
    }
  }

  /**
   * Delete a specific message from timeline files
   */
  async deleteMessage(messageId: string, threadId: string): Promise<void> {
    console.log(
      `🗑️ DIFFDB MANAGER: Deleting message ${messageId} from thread ${threadId}`,
    );

    try {
      const timelineFiles = await this.githubClient.listFiles(
        this.repoName,
        `users/${this.githubUsername}/memories/timeline`,
      );

      console.log(
        `🗑️ DIFFDB MANAGER: Scanning ${timelineFiles.length} timeline files for message`,
      );

      for (const filePath of timelineFiles) {
        if (!filePath.endsWith(".md") || filePath.endsWith(".gitkeep"))
          continue;

        const file = await this.githubClient.getFile(this.repoName, filePath);
        if (!file) continue;

        const content = file.content;
        const threadMarker = `(${threadId})`;

        // Check if this file contains the thread
        if (!content.includes(threadMarker)) continue;

        console.log(
          `🗑️ DIFFDB MANAGER: Found thread in file ${filePath}, searching for message...`,
        );

        // Find the thread section
        const threadStart = content.indexOf(threadMarker);
        const nextThreadStart = content.indexOf(
          "\n#### Thread:",
          threadStart + 1,
        );
        const threadContent =
          nextThreadStart === -1
            ? content.slice(threadStart)
            : content.slice(threadStart, nextThreadStart);

        // Look for the message in this thread section
        // We'll identify messages by their timestamp or content since messageId might not be in the file
        const messageMatches = Array.from(
          threadContent.matchAll(
            /##### (👤 User|🤖 Assistant) \(([^)]+)\)\n([\s\S]*?)(?=\n---|$)/g,
          ),
        );

        let messageFound = false;
        let updatedContent = content;

        for (let i = 0; i < messageMatches.length; i++) {
          const match = messageMatches[i];
          const messageText = match[3].trim();

          // Try to identify the message by checking if it contains the messageId or unique content
          // In a more robust implementation, we'd store messageId in the timeline file
          if (
            messageText.includes(messageId) ||
            this.isMessageMatch(messageText, messageId)
          ) {
            console.log(
              `🗑️ DIFFDB MANAGER: Found message to delete at index ${i}`,
            );

            const fullMatch = match[0];
            updatedContent = updatedContent.replace(fullMatch + "\n---\n", "");
            messageFound = true;
            break;
          }
        }

        if (messageFound) {
          console.log(
            `🗑️ DIFFDB MANAGER: Message found and removed, updating file...`,
          );

          await this.githubClient.createOrUpdateFile(
            this.repoName,
            filePath,
            updatedContent,
            `Delete message ${messageId} from thread ${threadId}`,
            file.sha,
          );

          console.log(
            `✅ DIFFDB MANAGER: Message ${messageId} deleted successfully`,
          );
          return;
        }
      }

      console.warn(
        `⚠️ DIFFDB MANAGER: Message ${messageId} not found in any timeline file`,
      );
    } catch (error) {
      console.error(`❌ DIFFDB MANAGER DELETE MESSAGE ERROR:`, error);
      throw error;
    }
  }

  /**
   * Helper method to identify if a message matches the given messageId
   * This is a simple implementation - in production, we'd store messageId in the timeline
   */
  private isMessageMatch(messageContent: string, messageId: string): boolean {
    // Simple heuristic: check if message content contains parts of the messageId
    // or if it's a unique pattern we can identify
    return (
      messageContent.length > 10 &&
      messageId.length > 10 &&
      messageContent.includes(messageId.slice(0, 8))
    );
  }

  /**
   * Update a specific message in timeline files
   */
  async updateMessage(
    messageId: string,
    threadId: string,
    newContent: string,
  ): Promise<void> {
    console.log(
      `🔄 DIFFDB MANAGER: Updating message ${messageId} in thread ${threadId}`,
    );

    try {
      const timelineFiles = await this.githubClient.listFiles(
        this.repoName,
        `users/${this.githubUsername}/memories/timeline`,
      );

      for (const filePath of timelineFiles) {
        if (!filePath.endsWith(".md") || filePath.endsWith(".gitkeep"))
          continue;

        const file = await this.githubClient.getFile(this.repoName, filePath);
        if (!file) continue;

        const content = file.content;
        const threadMarker = `(${threadId})`;

        if (!content.includes(threadMarker)) continue;

        const threadStart = content.indexOf(threadMarker);
        const nextThreadStart = content.indexOf(
          "\n#### Thread:",
          threadStart + 1,
        );
        const threadContent =
          nextThreadStart === -1
            ? content.slice(threadStart)
            : content.slice(threadStart, nextThreadStart);

        const messageMatches = Array.from(
          threadContent.matchAll(
            /##### (👤 User|🤖 Assistant) \(([^)]+)\)\n([\s\S]*?)(?=\n---|$)/g,
          ),
        );

        for (const match of messageMatches) {
          const messageText = match[3].trim();

          if (
            messageText.includes(messageId) ||
            this.isMessageMatch(messageText, messageId)
          ) {
            console.log(`🔄 DIFFDB MANAGER: Found message to update`);

            const oldMatch = match[0];
            const role = match[1];
            const timestamp = match[2];
            const newMatch = `##### ${role} (${timestamp})\n${newContent}\n\n---`;

            const updatedContent = content.replace(oldMatch, newMatch);

            await this.githubClient.createOrUpdateFile(
              this.repoName,
              filePath,
              updatedContent,
              `Update message ${messageId} in thread ${threadId}`,
              file.sha,
            );

            console.log(
              `✅ DIFFDB MANAGER: Message ${messageId} updated successfully`,
            );
            return;
          }
        }
      }

      console.warn(
        `⚠️ DIFFDB MANAGER: Message ${messageId} not found for update`,
      );
    } catch (error) {
      console.error(`❌ DIFFDB MANAGER UPDATE MESSAGE ERROR:`, error);
      throw error;
    }
  }

  /**
   * Update thread metadata in timeline files
   */
  async updateThreadInTimeline(
    threadId: string,
    updatedThread: ChatThread,
  ): Promise<void> {
    console.log(
      `🔄 DIFFDB MANAGER: Updating thread ${threadId} in timeline files`,
    );

    try {
      const timelineFiles = await this.githubClient.listFiles(
        this.repoName,
        `users/${this.githubUsername}/memories/timeline`,
      );

      for (const filePath of timelineFiles) {
        if (!filePath.endsWith(".md") || filePath.endsWith(".gitkeep"))
          continue;

        const file = await this.githubClient.getFile(this.repoName, filePath);
        if (!file) continue;

        const content = file.content;

        // Check if this file contains the thread
        if (!content.includes(`(${threadId})`)) continue;

        console.log(
          `🔄 DIFFDB MANAGER: Found thread in file ${filePath}, updating...`,
        );

        // Find and replace the thread header
        const threadHeaderRegex = new RegExp(
          `#### Thread: ([^(]*?)\\s*\\(${threadId}\\)`,
          "g",
        );
        const updatedContent = content.replace(
          threadHeaderRegex,
          `#### Thread: ${updatedThread.title} (${threadId})`,
        );

        // If content changed, update the file
        if (updatedContent !== content) {
          await this.githubClient.createOrUpdateFile(
            this.repoName,
            filePath,
            updatedContent,
            `Update thread "${updatedThread.title}" (${threadId})`,
            file.sha,
          );

          console.log(
            `✅ DIFFDB MANAGER: Thread ${threadId} updated in ${filePath}`,
          );
        }
      }

      console.log(`✅ DIFFDB MANAGER: Thread ${threadId} update complete`);
    } catch (error) {
      console.error(`❌ DIFFDB MANAGER UPDATE THREAD ERROR:`, error);
      throw error;
    }
  }
}
