# DiffDB: GitHub-Based AI Memory System

DiffDB is a revolutionary approach to AI memory storage that uses GitHub repositories as a database. Instead of traditional databases, your AI conversations and memory are stored in your own private GitHub repository, giving you complete control over your data.

## 🌟 Features

### **BYOG (Bring Your Own GitHub)**
- **Your Data, Your Control**: All conversations stored in YOUR private GitHub repository
- **No Vendor Lock-in**: Export your data anytime - it's just Markdown files
- **Privacy First**: Data never leaves your GitHub account
- **Transparent Storage**: Human-readable format you can inspect anytime

### **Git-Powered Memory**
- **Version History**: Full conversation evolution tracking via Git history
- **Branching**: Different conversation topics can literally be Git branches
- **Backup Built-in**: GitHub handles redundancy and availability
- **Collaboration Ready**: Share specific conversations via repository access

### **DiffMem Integration**
- **Structured Memory**: Organized in people, contexts, and timeline folders
- **AI Memory Evolution**: Track how relationships and knowledge develop over time
- **Smart Indexing**: Automatic memory organization and cross-referencing
- **Long-term Memory**: Build persistent relationships with AI across sessions

## 🏗️ Architecture

```
Users GitHub Repository: "luminar-ai-data"
├── README.md                 # Repository overview
├── users/
│   └── {username}/
│       ├── index.md          # Memory index and quick access
│       └── memories/
│           ├── people/       # Relationship profiles
│           ├── contexts/     # Thematic knowledge
│           └── timeline/     # Chronological conversations
└── .gitignore
```

## 🚀 Setup Guide

### 1. Environment Configuration

Add to your `.env` file:

```bash
# GitHub OAuth (Required)
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret

# Enable DiffDB
DIFFDB_ENABLED=true
```

### 2. GitHub OAuth App Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App with these settings:
   - **Application name**: `Luminar-AI DiffDB`
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
   - **Scopes needed**: `repo`, `user:email`, `read:user`

3. Copy the Client ID and Client Secret to your `.env` file

### 3. User Flow

1. **Sign in with GitHub**: Users authenticate with their GitHub account
2. **Repository Creation**: App creates a private `luminar-ai-data` repository
3. **Structure Initialization**: Sets up the DiffMem-compatible folder structure
4. **Start Chatting**: All conversations are automatically saved to the user's repo

## 📊 Data Flow

```
User Message → DiffDB Manager → GitHub API → User's Repository
                     ↓
            Timeline Markdown File
                     ↓
               Git Commit History
```

### Example Timeline Entry

```markdown
# Timeline: 2025-01 (Chat History)

## Monthly Summary [MERGE_LOAD]
- Overview: Discussed AI memory systems and GitHub integration

### Chat Threads

#### Thread: DiffDB Implementation Discussion (abc123)
- Created: 2025-01-15T10:30:00Z
- Status: Active

##### 👤 User (2025-01-15T10:30:00Z)
Can you explain how DiffDB works?

##### 🤖 Assistant (2025-01-15T10:30:15Z)
DiffDB is a revolutionary approach to AI memory storage...

---
```

## 🔧 Technical Implementation

### Core Components

1. **GitHubApiClient**: Low-level GitHub API wrapper
2. **DiffDBManager**: High-level repository and memory management
3. **DiffDBChatRepository**: ChatRepository implementation for GitHub storage
4. **Repository Factory**: Dynamic switching between PostgreSQL and DiffDB

### Rate Limiting

- **Per User**: 5,000 GitHub API calls/hour per user
- **Typical Usage**: ~50-200 calls/hour for active chatting
- **Optimization**: Local caching and batch operations reduce API usage

## 🔐 Security & Privacy

### Data Ownership
- **Private Repositories**: All data stored in user's private GitHub repos
- **User Control**: Users can revoke access, delete repos, or export data anytime
- **No Central Storage**: Luminar-AI never stores user conversation data

### Authentication
- **GitHub OAuth**: Secure token-based authentication
- **Scoped Permissions**: Only requests necessary repository permissions
- **Token Management**: Secure storage and refresh token handling

## 🎯 Benefits Over Traditional Databases

| Feature | Traditional DB | DiffDB |
|---------|---------------|---------|
| **Data Ownership** | Platform owned | User owned |
| **Vendor Lock-in** | High | None |
| **Version History** | None/Basic | Full Git history |
| **Backup** | Platform dependent | GitHub redundancy |
| **Transparency** | Opaque | Human-readable |
| **Portability** | Export tools needed | Git clone |
| **Collaboration** | Platform specific | Git native |

## 🚧 Current Limitations

- **GitHub Dependency**: Requires GitHub account and API availability
- **Rate Limits**: 5,000 API calls/hour per user (typically sufficient)
- **Network Latency**: Slightly slower than local database (200-500ms vs 1-10ms)
- **Binary Files**: Large files need external storage (images stored as URLs)

## 🔮 Future Enhancements

- **Multi-Platform**: Support for GitLab, Bitbucket, and other Git providers
- **Offline Mode**: Local Git repositories with periodic sync
- **Advanced Memory**: AI-powered memory consolidation and insights
- **Collaboration**: Shared memory repositories for teams
- **Analytics**: Personal AI interaction analytics and insights

## 🧪 Development & Testing

### Running with DiffDB

```bash
# Install dependencies
npm install @octokit/rest js-base64

# Enable DiffDB in environment
echo "DIFFDB_ENABLED=true" >> .env

# Add GitHub OAuth credentials
echo "GITHUB_CLIENT_ID=your_client_id" >> .env
echo "GITHUB_CLIENT_SECRET=your_client_secret" >> .env

# Start development server
npm run dev
```

### Testing Repository Creation

1. Sign in with GitHub (make sure OAuth app is configured)
2. Start a new conversation
3. Check your GitHub account for the new `luminar-ai-data` repository
4. Explore the generated folder structure and timeline files

## 📚 Related Documentation

- [DiffMem Project](https://github.com/Growth-Kinetics/DiffMem) - The inspiration for DiffDB
- [GitHub API Documentation](https://docs.github.com/en/rest) - API reference
- [Better Auth GitHub Provider](https://www.better-auth.com/docs/authentication/social) - OAuth setup

---

**DiffDB represents the future of AI memory**: user-controlled, transparent, and built on the world's most trusted version control system. Your AI conversations deserve the same level of care and control as your code.
