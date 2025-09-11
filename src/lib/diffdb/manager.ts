import { GitHubApiClient } from "./github-api";
import { ChatThread, ChatMessage } from "app-types/chat";
import logger from "logger";
import { nanoid } from "nanoid";

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

    try {
      const date = new Date(message.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const filePath = `users/${this.githubUsername}/memories/timeline/${monthKey}.md`;
      console.log("  📁 Message timeline file path:", filePath);

      let existingFile = await this.githubClient.getFile(
        this.repoName,
        filePath,
      );
      if (!existingFile) {
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

      // Convert message parts to markdown
      const messageContent = message.parts
        .map((part) => {
          if (part.type === "text") {
            return part.text;
          } else if (part.type === "tool-invocation") {
            return `🔧 **Tool**: ${part.toolInvocation.toolName}\n\`\`\`json\n${JSON.stringify(part.toolInvocation.args, null, 2)}\n\`\`\``;
          }
          return JSON.stringify(part);
        })
        .join("\n\n");

      const messageEntry = `
##### ${message.role === "user" ? "👤 User" : "🤖 Assistant"} (${messageTimestamp})
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
      await this.githubClient.createOrUpdateFile(
        this.repoName,
        filePath,
        content,
        `Add message from ${message.role} in thread: ${threadTitle}`,
        existingFile?.sha,
      );
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

    try {
      const timelineFiles = await this.githubClient.listFiles(
        this.repoName,
        `users/${this.githubUsername}/memories/timeline`,
      );
      console.log(
        "📚 DIFFDB MANAGER: Found",
        timelineFiles.length,
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

        // Parse messages
        const messageMatches = threadContent.matchAll(
          /##### (👤 User|🤖 Assistant) \(([^)]+)\)\n([\s\S]*?)(?=\n---|$)/g,
        );

        for (const match of messageMatches) {
          const role = match[1].includes("User") ? "user" : "assistant";
          const timestamp = match[2];
          const messageContent = match[3].trim();

          // Convert markdown back to message parts
          const parts = this.parseMessageContent(messageContent);

          messages.push({
            id: nanoid(),
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
    // Simple parsing - can be enhanced
    if (content.includes("🔧 **Tool Call**:")) {
      // Tool call message
      const toolMatch = content.match(
        /🔧 \*\*Tool Call\*\*: (.+?)\n```json\n([\s\S]*?)\n```/,
      );
      if (toolMatch) {
        return [
          {
            type: "tool-call",
            toolCallId: nanoid(),
            toolName: toolMatch[1],
            args: JSON.parse(toolMatch[2]),
          },
        ];
      }
    } else if (content.includes("📊 **Tool Result**:")) {
      // Tool result message
      const resultMatch = content.match(
        /📊 \*\*Tool Result\*\*: (.+?)\n```\n([\s\S]*?)\n```/,
      );
      if (resultMatch) {
        return [
          {
            type: "tool-result",
            toolCallId: resultMatch[1],
            result: resultMatch[2],
          },
        ];
      }
    } else {
      // Regular text message
      return [
        {
          type: "text",
          text: content,
        },
      ];
    }

    return [
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
}
