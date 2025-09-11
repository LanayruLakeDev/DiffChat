-- Check if user 2d41974e-2df2-42c5-8de8-35df6ab6fed6 still exists in the database

-- 1. Check if user exists
SELECT 'USER EXISTS' as status, * FROM "user" 
WHERE "id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 2. Check if any accounts exist for this user
SELECT 'ACCOUNTS EXIST' as status, * FROM "account" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 3. Check if any sessions exist for this user
SELECT 'SESSIONS EXIST' as status, * FROM "session" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 4. Check if any chat threads exist for this user
SELECT 'CHAT THREADS EXIST' as status, COUNT(*) as count FROM "chat_thread" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 5. Check if any agents exist for this user
SELECT 'AGENTS EXIST' as status, COUNT(*) as count FROM "agent" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- 6. Check if any workflows exist for this user
SELECT 'WORKFLOWS EXIST' as status, COUNT(*) as count FROM "workflow" 
WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6';

-- Summary: Count all references to this user ID across all tables
SELECT 
  'SUMMARY' as status,
  (SELECT COUNT(*) FROM "user" WHERE "id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6') as user_count,
  (SELECT COUNT(*) FROM "account" WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6') as account_count,
  (SELECT COUNT(*) FROM "session" WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6') as session_count,
  (SELECT COUNT(*) FROM "chat_thread" WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6') as thread_count,
  (SELECT COUNT(*) FROM "agent" WHERE "user_id" = '2d41974e-2df2-42c5-8de8-35df6ab6fed6') as agent_count;
