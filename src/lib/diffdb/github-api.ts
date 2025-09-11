import { Octokit } from "@octokit/rest";
import { Base64 } from "js-base64";
import logger from "logger";

export interface GitHubFile {
  path: string;
  content: string;
  sha?: string;
}

export interface GitHubRepo {
  name: string;
  owner: string;
  private: boolean;
}

export class GitHubApiClient {
  private octokit: Octokit;
  private username: string;

  constructor(accessToken: string, username: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
    this.username = username;
  }

  /**
   * Create a GitHubApiClient with the correct username fetched from GitHub API
   */
  static async createWithAuthenticatedUser(accessToken: string): Promise<GitHubApiClient> {
    // Create a temporary client to get the username
    const tempOctokit = new Octokit({ auth: accessToken });
    try {
      const { data } = await tempOctokit.users.getAuthenticated();
      return new GitHubApiClient(accessToken, data.login);
    } catch (error) {
      logger.error('Failed to create GitHubApiClient with authenticated user:', error);
      throw error;
    }
  }

  /**
   * Get the authenticated user's GitHub username
   */
  async getAuthenticatedUser(): Promise<{ login: string; id: number }> {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return {
        login: data.login,
        id: data.id,
      };
    } catch (error) {
      logger.error('Failed to get authenticated user:', error);
      throw error;
    }
  }

  /**
   * Create a new private repository for DiffDB
   */
  async createDiffDBRepo(repoName: string = "luminar-ai-data"): Promise<GitHubRepo> {
    try {
      const { data } = await this.octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: true,
        description: "Personal AI memory and chat history powered by Luminar-AI",
        auto_init: true,
      });

      logger.info(`Created DiffDB repo: ${data.full_name}`);
      
      return {
        name: data.name,
        owner: data.owner.login,
        private: data.private,
      };
    } catch (error: any) {
      if (error.status === 422) {
        // Repository already exists
        logger.info(`DiffDB repo already exists: ${this.username}/${repoName}`);
        return {
          name: repoName,
          owner: this.username,
          private: true,
        };
      }
      throw error;
    }
  }

  /**
   * Ensure repository has proper initial state
   */
  async ensureRepoInitialized(repoName: string): Promise<void> {
    try {
      // Check if repository has any content
      await this.octokit.repos.getContent({
        owner: this.username,
        repo: repoName,
        path: "",
      });
      
      // If we can get content, repo is initialized
      logger.info(`Repository ${this.username}/${repoName} is properly initialized`);
    } catch (error: any) {
      if (error.status === 404) {
        // Repository exists but is empty, need to create initial content
        logger.info(`Repository ${this.username}/${repoName} exists but is empty, initializing...`);
        await this.createOrUpdateFile(
          repoName,
          "README.md",
          `# ${repoName}\n\nPersonal AI memory and chat history powered by Luminar-AI\n\nThis repository stores your conversation history and AI memory in a structured format.\n`,
          "Initial repository setup"
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Check if DiffDB repository exists
   */
  async diffDBRepoExists(repoName: string = "luminar-ai-data"): Promise<boolean> {
    try {
      await this.octokit.repos.get({
        owner: this.username,
        repo: repoName,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file content from repository
   */
  async getFile(repoName: string, filePath: string): Promise<GitHubFile | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.username,
        repo: repoName,
        path: filePath,
      });

      if (Array.isArray(data) || data.type !== "file") {
        return null;
      }

      return {
        path: filePath,
        content: Base64.decode(data.content),
        sha: data.sha,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create or update a file in repository
   */
  async createOrUpdateFile(
    repoName: string,
    filePath: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<void> {
    try {
      // If no SHA provided but we're updating, try to get current file SHA
      if (!sha) {
        const existingFile = await this.getFile(repoName, filePath);
        if (existingFile) {
          // Check if content is different before updating
          if (existingFile.content === content) {
            logger.info(`File ${filePath} already up to date, skipping`);
            return;
          }
          sha = existingFile.sha;
        }
      }

      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.username,
        repo: repoName,
        path: filePath,
        message,
        content: Base64.encode(content),
        sha,
      });

      logger.info(`Updated file: ${filePath} in ${this.username}/${repoName}`);
    } catch (error: any) {
      if (error.status === 404) {
        // Repository might not be properly initialized
        logger.warn(`Repository ${this.username}/${repoName} not found or not accessible when creating ${filePath}`);
        logger.warn(`Attempting to ensure repository is initialized...`);
        
        try {
          await this.ensureRepoInitialized(repoName);
          // Retry the file creation
          await this.octokit.repos.createOrUpdateFileContents({
            owner: this.username,
            repo: repoName,
            path: filePath,
            message,
            content: Base64.encode(content),
            sha,
          });
          logger.info(`Successfully created file after repo initialization: ${filePath}`);
        } catch (retryError) {
          logger.error(`Failed to create file ${filePath} even after repo initialization:`, retryError);
          throw retryError;
        }
      } else {
        logger.error(`Failed to update file ${filePath}:`, error);
        throw error;
      }
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(repoName: string, dirPath: string = ""): Promise<string[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.username,
        repo: repoName,
        path: dirPath,
      });

      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .filter((item) => item.type === "file")
        .map((item) => item.path);
    } catch (error: any) {
      if (error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete a file from repository
   */
  async deleteFile(
    repoName: string,
    filePath: string,
    message: string,
    sha: string
  ): Promise<void> {
    try {
      await this.octokit.repos.deleteFile({
        owner: this.username,
        repo: repoName,
        path: filePath,
        message,
        sha,
      });

      logger.info(`Deleted file: ${filePath} from ${this.username}/${repoName}`);
    } catch (error) {
      logger.error(`Failed to delete file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Initialize DiffDB repository structure
   */
  async initializeDiffDBStructure(repoName: string = "luminar-ai-data"): Promise<void> {
    const userId = this.username;
    
    // Check if structure already exists by looking for the main index file
    const indexExists = await this.getFile(repoName, `users/${userId}/index.md`);
    if (indexExists) {
      logger.info(`DiffDB structure already exists for user ${userId}, skipping initialization`);
      return;
    }
    
    // Create initial structure files
    const files = [
      {
        path: "README.md",
        content: `# ${userId}'s Luminar-AI Memory Repository

This repository contains your personal AI memory and chat history, managed by Luminar-AI using the DiffDB system.

## Structure

- \`users/${userId}/\` - Your personal memory space
  - \`memories/people/\` - Profiles and relationships
  - \`memories/contexts/\` - Thematic knowledge
  - \`memories/timeline/\` - Chronological events and chats
  - \`index.md\` - Memory index and quick lookup

## Privacy

This is your private repository. Your data belongs to you and stays under your control.
`,
      },
      {
        path: `users/${userId}/index.md`,
        content: `# ${userId} - Memory Index

## Quick Access

### Recent Conversations
[Links will be auto-generated]

### Key People
[Auto-populated as relationships develop]

### Important Topics  
[Auto-populated based on conversation themes]

---
*This index is automatically maintained by Luminar-AI*
`,
      },
      {
        path: `users/${userId}/memories/people/.gitkeep`,
        content: "# People profiles will be stored here",
      },
      {
        path: `users/${userId}/memories/contexts/.gitkeep`,
        content: "# Thematic contexts will be stored here", 
      },
      {
        path: `users/${userId}/memories/timeline/.gitkeep`,
        content: "# Timeline and chat history will be stored here",
      },
      {
        path: ".gitignore",
        content: `# Luminar-AI DiffDB
.DS_Store
*.log
temp/
`,
      },
    ];

    for (const file of files) {
      try {
        // Check if file already exists to get its SHA
        const existingFile = await this.getFile(repoName, file.path);
        const sha = existingFile?.sha;
        
        await this.createOrUpdateFile(
          repoName,
          file.path,
          file.content,
          `Initialize DiffDB structure: ${file.path}`,
          sha
        );
        
        logger.info(`Successfully initialized file: ${file.path}`);
      } catch (error) {
        logger.warn(`Failed to initialize file ${file.path}:`, error);
        // Continue with other files even if one fails
      }
    }

    logger.info(`Initialized DiffDB structure for user: ${userId}`);
  }
}
