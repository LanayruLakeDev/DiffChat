# 🚀 DiffDB System Specification

## 📋 **Overview**
DiffDB (Distributed Database) is a GitHub-powered chat storage system that provides local-first experiences with distributed synchronization. It replaces traditional PostgreSQL storage with Git-based persistence, enabling users to access their chats across devices while maintaining local performance.

## 🎯 **Core Principles**

### **Local-First Architecture**
- ✅ **Instant Responses**: All user interactions respond immediately using optimistic updates
- ✅ **Background Sync**: GitHub synchronization happens asynchronously without blocking UI
- ✅ **Intelligent Caching**: Smart memory cache with TTL and background refresh
- ✅ **Graceful Fallback**: Automatic PostgreSQL fallback if GitHub operations fail

### **Multi-Device Access**
- ✅ **Distributed Storage**: Chat data stored in user's GitHub repository
- ✅ **Cross-Device Sync**: Access same chats from any device with GitHub authentication
- ✅ **Conflict Resolution**: Last-write-wins with GitHub's natural versioning
- ✅ **Privacy First**: Data stored in user's private GitHub repository

## 🏗️ **System Architecture**

### **Component Layers**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                           │
│  - Chat UI Components                                       │
│  - Sidebar Thread List                                      │
│  - Message Components (Tool Invocations, Web Search, etc.) │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────┐
│                REPOSITORY FACTORY                          │
│  - Dynamic mode switching (postgres/diffdb)                │
│  - Session-based routing                                    │
│  - Environment configuration                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
      ┌───────────────┴────────────────┐
      │                                │
┌─────▼─────┐                 ┌────────▼──────┐
│ POSTGRES  │                 │    DIFFDB     │
│ REPOSITORY│                 │  REPOSITORY   │
│ (Fallback)│                 │  (Primary)    │
└───────────┘                 └───────┬───────┘
                                      │
                        ┌─────────────┴─────────────┐
                        │                           │
                ┌───────▼──────┐            ┌──────▼──────┐
                │  DIFFDB      │            │   DIFFDB    │
                │  MANAGER     │            │   CACHE     │
                │ - Timeline   │            │ - Memory    │
                │ - GitHub API │            │ - TTL       │
                │ - Parsing    │            │ - Refresh   │
                └──────┬───────┘            └─────────────┘
                       │
                ┌──────▼──────┐
                │  GITHUB     │
                │  CLIENT     │
                │ - REST API  │
                │ - Auth      │
                │ - Files     │
                └─────────────┘
```

### **Data Flow Patterns**

#### **Message Creation Flow**
```
User Types Message
       ↓
Optimistic Update (Instant UI Response)
       ↓
Background GitHub Save
       ↓
Cache Update with Real Data
       ↓
UI Refresh (No Visible Change - Already Showing)
```

#### **Thread Loading Flow**
```
Request Threads
       ↓
Check Cache (If Hit: Return Immediately)
       ↓
GitHub API Call (If Cache Miss)
       ↓
Parse Timeline Files
       ↓
Update Cache & Return Data
       ↓
Background Refresh (Keep Cache Fresh)
```

## 📁 **GitHub Storage Structure**

### **Repository Organization**
```
📁 luminar-ai-data (User's Private Repo)
├── 📁 users/
│   └── 📁 {github-username}/
│       └── 📁 memories/
│           └── 📁 timeline/
│               ├── 2025-01.md (January 2025 chats)
│               ├── 2025-02.md (February 2025 chats)
│               └── ...
├── 📄 README.md (Repository description)
└── 📄 .gitignore (Standard ignores)
```

### **Timeline File Format**
```markdown
# Timeline: 2025-01 (Chat History)

## Monthly Summary [MERGE_LOAD]
- Overview: [Auto-generated summary of conversations]

### Chat Threads

#### Thread: My Important Chat (thread_abc123)
- Created: 2025-01-15T10:30:00.000Z
- Status: Active

##### 👤 User (2025-01-15T10:30:00.000Z)
What is the meaning of life?

---

##### 🤖 Assistant (2025-01-15T10:30:15.000Z)
The meaning of life is a profound philosophical question...

🔧 **Tool**: webSearch
```json
{
  "query": "meaning of life philosophy",
  "search_depth": "basic"
}
```

📊 **Tool Result**: webSearch
```json
{
  "results": [...]
}
```

---
```

## 🛠️ **Critical Issue Identification**

### **❌ Problem: Tool Invocations Not Working**

**Root Cause Analysis:**
1. **Incomplete Serialization**: Current code only saves tool name + args, loses state and results
2. **Parsing Mismatch**: Deserialization looks for different patterns than what's saved
3. **Missing Tool Results**: Tool results are not properly preserved in GitHub storage
4. **State Loss**: Tool invocation state (call/result) information lost during round-trip

**Evidence:**
```typescript
// CURRENT BROKEN SERIALIZATION (manager.ts:202-208)
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

// PARSING EXPECTS DIFFERENT FORMAT (manager.ts:514-519)
if (content.includes("🔧 **Tool Call**:")) {  // ❌ Looking for "Tool Call" but saving "Tool"
  const toolMatch = content.match(
    /🔧 \*\*Tool Call\*\*: (.+?)\n```json\n([\s\S]*?)\n```/,
  );
```

## 🔧 **Solution Architecture**

### **Enhanced Message Serialization**
```typescript
// FIXED APPROACH - Complete tool invocation preservation
const serializeMessagePart = (part: MessagePart): string => {
  switch (part.type) {
    case "text":
      return part.text;
    
    case "tool-invocation":
      return `🔧 **TOOL_INVOCATION_JSON**\n\`\`\`json\n${JSON.stringify({
        toolCallId: part.toolInvocation.toolCallId,
        toolName: part.toolInvocation.toolName,
        state: part.toolInvocation.state,
        args: part.toolInvocation.args,
        result: part.toolInvocation.result,
        timestamp: part.toolInvocation.timestamp || new Date().toISOString()
      }, null, 2)}\n\`\`\``;
    
    default:
      return `🔧 **PART_JSON**\n\`\`\`json\n${JSON.stringify(part, null, 2)}\n\`\`\``;
  }
};
```

### **Robust Deserialization**
```typescript
private parseMessageContent(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  
  // Handle tool invocations with complete state preservation
  const toolMatches = content.matchAll(/🔧 \*\*TOOL_INVOCATION_JSON\*\*\n```json\n([\s\S]*?)\n```/g);
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
          result: toolData.result,
          timestamp: toolData.timestamp
        }
      });
      // Remove from content to avoid duplicate parsing
      content = content.replace(match[0], "");
    } catch (error) {
      console.warn("Failed to parse tool invocation:", error);
    }
  }
  
  // Handle remaining text content
  const cleanContent = content.trim();
  if (cleanContent) {
    parts.push({
      type: "text",
      text: cleanContent
    });
  }
  
  return parts;
}
```

## 📊 **Performance & Caching Strategy**

### **Cache Configuration**
```typescript
interface CacheConfig {
  threads: {
    ttl: 2 * 60 * 1000;        // 2 minutes
    backgroundRefresh: 30000;   // 30 seconds
    maxSize: 1000;              // Max 1000 threads
  };
  messages: {
    ttl: 1 * 60 * 1000;        // 1 minute
    backgroundRefresh: 15000;   // 15 seconds
    maxSize: 10000;             // Max 10000 messages
  };
  persistence: {
    syncInterval: 5 * 60 * 1000; // Sync every 5 minutes
    retryAttempts: 3;            // Retry failed syncs
    offlineQueue: true;          // Queue operations when offline
  };
}
```

### **Optimistic Update Strategy**
1. **Immediate Response**: User sees changes instantly in UI
2. **Background Sync**: GitHub operations happen without blocking
3. **Conflict Resolution**: Cache updated with authoritative GitHub data
4. **Error Handling**: Graceful degradation with user notification

## 🎯 **Implementation Priorities**

### **Phase 1: Fix Tool Invocations (URGENT)**
- [ ] Fix message serialization to preserve complete tool invocation data
- [ ] Update parsing logic to match new serialization format
- [ ] Test web search, code execution, and MCP tools
- [ ] Verify tool results are properly displayed

### **Phase 2: Enhanced Reliability**
- [ ] Add offline operation queuing
- [ ] Implement retry mechanism for failed GitHub operations
- [ ] Add data validation and error recovery
- [ ] Create migration tools for existing data

### **Phase 3: Advanced Features**
- [ ] Add search across timeline files
- [ ] Implement export/import functionality
- [ ] Add chat analytics and insights
- [ ] Create collaborative features for shared repositories

## ⚡ **Debug & Monitoring**

### **Debug Toggle System**
- **Global Toggle**: `Ctrl+Shift+D` enables debug mode
- **Console Logging**: Comprehensive operation tracking
- **Toast Notifications**: Real-time sync status updates
- **Performance Metrics**: GitHub API timing, cache hit rates

### **Debugging Commands**
```typescript
// Enable debug mode
window.__DIFFDB_DEBUG__ = true;

// View cache state
console.log(DiffDBCache.getInstance().getStats());

// Force cache refresh
await diffDbManager.refreshCache();

// View GitHub API metrics
console.log(GitHubApiClient.getMetrics());
```

## 🚨 **Known Issues & Solutions**

### **Issue 1: Tool Calls Not Working ❌**
- **Status**: CRITICAL - IDENTIFIED
- **Cause**: Message serialization loses tool invocation data
- **Solution**: Implement comprehensive JSON-based serialization
- **Priority**: P0 - Fix immediately

### **Issue 2: Sidebar Title Sync ✅**
- **Status**: FIXED
- **Cause**: Inverted logic in thread existence check
- **Solution**: Fixed condition in use-generate-thread-title.ts
- **Priority**: RESOLVED

### **Issue 3: Cache Performance**
- **Status**: MONITORING
- **Solution**: Background refresh prevents cache misses
- **Metrics**: Target 85%+ cache hit rate

## 🎉 **Success Metrics**

### **Functionality Targets**
- ✅ **Message Creation**: Instant UI response, reliable GitHub sync
- ❌ **Tool Invocations**: Complete preservation of tool calls and results (NEEDS FIX)
- ✅ **Thread Management**: Title generation, updates, deletion working
- ✅ **Cache Performance**: 85%+ hit rate, sub-50ms response times
- ✅ **Cross-Device Sync**: Seamless access from multiple devices

### **User Experience Goals**
- **Instant Responsiveness**: No waiting for GitHub operations
- **Reliable Sync**: All data eventually consistent across devices
- **Transparent Operation**: Users unaware of underlying GitHub storage
- **Graceful Fallback**: PostgreSQL backup when GitHub unavailable

---

**🎯 NEXT ACTION: Fix tool invocation serialization/deserialization to restore web search, code execution, and MCP functionality.**