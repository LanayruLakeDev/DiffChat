-- Complete user cleanup script for Neon DB
-- This will delete all data for user: 2d41974e-2df2-42c5-8de8-35df6ab6fed6
-- Run these in order to avoid foreign key constraint violations

-- 1. Delete chat messages first (they reference chat_thread)
DELETE FROM "chat_message" 
WHERE "thread_id" IN (
  SELECT "id" FROM "chat_thread" 
  WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6'
);

-- 2. Delete chat threads (they reference user)
DELETE FROM "chat_thread" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 3. Delete agents (they reference user)
DELETE FROM "agent" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 4. Delete workflows (they reference user)
DELETE FROM "workflow" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 5. Delete MCP tool customizations (they reference user)
DELETE FROM "mcp_tool_customization" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 6. Delete MCP server customizations (they reference user)
DELETE FROM "mcp_server_customization" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 7. Delete sessions (they reference user)
DELETE FROM "session" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 8. Delete accounts (they reference user) - THIS IS THE IMPORTANT ONE!
DELETE FROM "account" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 9. Finally delete the user
DELETE FROM "user" 
WHERE "id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- Verification queries (run after deletion to confirm):
-- SELECT COUNT(*) as remaining_messages FROM "chat_message" WHERE "thread_id" IN (SELECT "id" FROM "chat_thread" WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6');
-- SELECT COUNT(*) as remaining_threads FROM "chat_thread" WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';
-- SELECT COUNT(*) as remaining_accounts FROM "account" WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';
-- SELECT COUNT(*) as remaining_users FROM "user" WHERE "id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';
