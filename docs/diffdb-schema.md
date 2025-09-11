# DiffDB Schema Documentation

DiffDB is a GitHub-based memory system that stores user chat history and AI memories in structured markdown files within private GitHub repositories.

## 🏗️ Repository Structure

Each user gets their own private GitHub repository named `luminar-ai-data` with the following structure:

```
username/luminar-ai-data/
├── README.md                           # Repository description
├── .gitignore                          # Git ignore file
└── users/
    └── {github-username}/              # User's directory (uses GitHub username)
        ├── index.md                    # User profile and memory index
        └── memories/
            ├── people/                 # Relationship and contact memories
            │   └── .gitkeep           # Keeps directory in Git
            ├── contexts/               # Thematic knowledge and contexts
            │   └── .gitkeep           # Keeps directory in Git
            └── timeline/               # Chronological chat history
                ├── .gitkeep           # Keeps directory in Git
                ├── 2025-09.md         # Monthly chat timeline
                ├── 2025-10.md         # Next month's timeline
                └── ...                # Other monthly files
```

## 📝 File Formats

### 📅 Monthly Timeline Files (`timeline/YYYY-MM.md`)

Each month gets its own timeline file containing all chat threads for that period:

```markdown
# Timeline: 2025-09 (Chat History)

## Monthly Summary [MERGE_LOAD]
- Overview: [Auto-generated summary of conversations]

### Chat Threads

#### Thread: Project Planning Discussion (ac06abfe-4060-458d-9ada-6fbf0d4486f1)
- Created: 2025-09-11T04:10:00.717Z
- Status: Active
- Messages: [Count will be updated as messages are added]

##### 👤 User (2025-09-11 04:10:00)
Hello, can you help me with my project?

---

##### 🤖 Assistant (2025-09-11 04:10:15)
Of course! I'd be happy to help you with your project. What kind of project are you working on?

🔧 **Tool**: webSearch
```json
{
  "query": "project management best practices",
  "search_depth": "basic"
}
```

---

#### Thread: Code Review Session (def456...)
- Created: 2025-09-11T05:30:00.000Z
- Status: Active
- Messages: [Count will be updated as messages are added]

...
```

### 👤 User Profile (`index.md`)

```markdown
# {GitHub Username}'s Memory Profile

## Quick Stats
- **Created**: 2025-09-11
- **Last Active**: 2025-09-11
- **Total Conversations**: 42
- **Active Projects**: 3

## Memory Index

### Recent Conversations
- [Project Help Discussion](memories/timeline/2025-09.md#thread-ac06abfe)
- [Code Review Session](memories/timeline/2025-09.md#thread-def456)

### Key People
- [Development Team](memories/people/dev-team.md)
- [Project Stakeholders](memories/people/stakeholders.md)

### Important Contexts
- [Current Project](memories/contexts/current-project.md)
- [Technical Stack](memories/contexts/tech-stack.md)
```

## 🔑 Key Design Principles

### 1. **Data Integrity & Uniqueness**
- ✅ **Thread IDs are UNIQUE**: Each conversation has exactly ONE thread entry
- ✅ **No Duplicate Threads**: The system prevents duplicate thread IDs through proper upsert logic
- ✅ **Cross-Device Sync**: All conversations sync perfectly across devices via GitHub
- ✅ **GitHub Username Consistency**: Uses GitHub username for all file paths, never UUID

### 2. **Conversation Lifecycle**
1. **New Chat Created**: `insertThread()` creates ONE thread entry with empty title
2. **AI Title Generated**: `upsertThread()` UPDATES the existing thread (no new entry)
3. **Messages Added**: Appended to the same thread section
4. **Cross-Device Access**: All devices load the same data from GitHub

### 3. **Monthly Organization**
- Chat threads organized by month: `YYYY-MM.md`
- Prevents files from becoming too large
- Easy to browse chronologically

### 4. **Markdown Structure**
- Human-readable format
- Git-friendly (shows diffs clearly)
- Can be viewed directly on GitHub

### 5. **Hierarchical Memory**
- `timeline/` - Chronological conversations
- `people/` - Relationship memories
- `contexts/` - Thematic knowledge

## 🔧 System Implementation

### Path Resolution
The system uses **GitHub username consistently** for all file operations:

```typescript
// ✅ CORRECT - Uses GitHub username
const filePath = `users/${this.githubUsername}/memories/timeline/${monthKey}.md`;

// ❌ WRONG - Don't use internal UUID
const wrongPath = `users/${this.userId}/memories/timeline/${monthKey}.md`;
```

### Thread Storage Process
1. **Create Thread**: `insertThread()` saves to `users/{github-username}/memories/timeline/YYYY-MM.md`
2. **Update Title**: `upsertThread()` finds and replaces existing thread entry (no duplicates)
3. **Add Messages**: Append to same monthly file under the thread
4. **Load Threads**: Parse all `.md` files, deduplicate by ID, return unique threads
5. **Load Messages**: Extract from monthly files by thread ID

### Data Integrity Safeguards

#### Thread Deduplication
```typescript
// When saving threads, remove any existing entries with same ID first
const threadRegex = new RegExp(`#### Thread: [^\\(]*\\(${thread.id}\\)[\\s\\S]*?(?=#### Thread:|$)`, 'g');
content = content.replace(threadRegex, ''); // Remove old entries
content += newThreadEntry; // Add updated entry
```

#### Loading Deduplication
```typescript
// When loading, deduplicate by ID keeping most recent version
const threadMap = new Map<string, ChatThread>();
for (const thread of threads) {
  const existing = threadMap.get(thread.id);
  if (!existing || thread.createdAt > existing.createdAt) {
    threadMap.set(thread.id, thread); // Keep newer version
  }
}
```

### File Operations
- **Save**: `createOrUpdateFile()` with proper GitHub API calls
- **Load**: `getFile()` and `listFiles()` from GitHub API
- **Parse**: Regex patterns to extract threads and messages from markdown
- **Update**: Find and replace existing entries to prevent duplicates

## 🚀 User Onboarding Flow

1. **User Signs In**: GitHub OAuth authentication
2. **Repository Creation**: Auto-create `{username}/luminar-ai-data` repository
3. **Structure Initialization**: Create directory structure and initial files
4. **Ready to Chat**: System saves all conversations to GitHub

## 🔍 Expected Behavior

### New Conversation Flow
1. ✅ **User clicks "New Chat"**: Creates ONE thread with temporary title
2. ✅ **User sends message**: Message saved to thread
3. ✅ **AI generates title**: UPDATES existing thread entry (replaces old title)
4. ✅ **Result**: ONE conversation in history with AI-generated title

### Cross-Device Sync
1. ✅ **Device A**: User creates conversation, saves to GitHub
2. ✅ **Device B**: User opens app, loads same conversation from GitHub
3. ✅ **Result**: Identical conversation history across all devices

### Data Consistency
- ✅ **No Duplicate Threads**: Each conversation appears exactly once
- ✅ **Unique Thread IDs**: Every conversation has a unique identifier
- ✅ **Preserved Message History**: All messages saved and loaded correctly
- ✅ **Title Updates**: AI-generated titles replace temporary ones without creating duplicates

## 🔍 Debugging & Logs

The system includes comprehensive logging to ensure data integrity:

```
� DIFFDB THREAD UPSERT: Thread exists, updating...
  📄 Old title: New Chat
  📄 New title: Project Planning Discussion
�️ Removing old thread entries: 1 entries
✅ DIFFDB THREAD UPSERT SUCCESS: Thread updated in GitHub

📚 DIFFDB MANAGER: Deduplicating threads by ID...
📄 DIFFDB: Keeping thread version: { id: 'abc-123', title: 'Project Planning Discussion' }
📄 DIFFDB: Skipping older thread version: { id: 'abc-123', title: 'New Chat' }
✅ Final unique threads count: 1
```

## 🔒 Privacy & Security

- **Private Repositories**: All user data stored in private GitHub repos
- **User Ownership**: Users own their data, stored under their GitHub account
- **Access Control**: Only the user and authorized apps can access the repository
- **Encryption**: GitHub provides encryption at rest and in transit
- **Backup**: Users can clone/backup their own repositories anytime

## 🎯 Data Integrity Guarantees

After the critical bug fixes, the system guarantees:

1. ✅ **ONE conversation = ONE thread**: No duplicate thread entries
2. ✅ **Consistent Thread IDs**: Each conversation has a unique, permanent ID
3. ✅ **Cross-device sync**: Perfect synchronization across all devices
4. ✅ **No data loss**: All messages and conversations preserved
5. ✅ **Title updates**: AI-generated titles update existing threads, never create new ones
6. ✅ **Reliable loading**: All conversations load correctly from any device

The chat should work flawlessly with zero duplicate conversations! 🚀
