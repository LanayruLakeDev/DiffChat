import { ChatRepository } from "app-types/chat";
import { pgChatRepository } from "lib/db/pg/repositories/chat-repository.pg";
import { createDiffDBChatRepository } from "./diffdb/chat-repository";
import logger from "logger";

export type RepositoryMode = 'postgres' | 'diffdb';

/**
 * Factory function to create the appropriate chat repository based on configuration
 */
export async function createChatRepository(session?: any, mode?: RepositoryMode): Promise<ChatRepository> {
  const repositoryMode: RepositoryMode = mode || 
    (process.env.DIFFDB_ENABLED === 'true' ? 'diffdb' : 'postgres');

  console.log('🏭 REPOSITORY FACTORY - Creating chat repository');
  console.log('📊 Environment DIFFDB_ENABLED:', process.env.DIFFDB_ENABLED);
  console.log('🎯 Repository mode selected:', repositoryMode);
  console.log('👤 Session provided:', !!session);
  if (session) {
    console.log('👤 Session user ID:', session?.user?.id);
    console.log('👤 Session accounts:', session?.user?.accounts?.map((a: any) => a.providerId));
  }

  logger.info(`🏭 Creating chat repository in ${repositoryMode} mode`);

  switch (repositoryMode) {
    case 'diffdb':
      if (!session) {
        console.error('❌ DIFFDB ERROR: Session required for DiffDB mode but none provided');
        throw new Error('Session required for DiffDB mode');
      }
      
      console.log('🚀 DIFFDB: Attempting to create DiffDB repository...');
      const diffDBRepo = await createDiffDBChatRepository(session);
      if (!diffDBRepo) {
        console.warn('⚠️ DIFFDB WARNING: Failed to create DiffDB repository, falling back to PostgreSQL');
        logger.warn('Failed to create DiffDB repository, falling back to PostgreSQL');
        return pgChatRepository;
      }
      
      console.log('✅ DIFFDB SUCCESS: DiffDB repository created successfully');
      return diffDBRepo;
      
    case 'postgres':
    default:
      console.log('🗄️ POSTGRES: Using PostgreSQL repository');
      return pgChatRepository;
  }
}

/**
 * Get the current repository mode from environment
 */
export function getRepositoryMode(): RepositoryMode {
  return process.env.DIFFDB_ENABLED === 'true' ? 'diffdb' : 'postgres';
}

/**
 * Check if DiffDB is enabled and properly configured
 */
export function isDiffDBEnabled(): boolean {
  return process.env.DIFFDB_ENABLED === 'true' && 
         !!process.env.GITHUB_CLIENT_ID && 
         !!process.env.GITHUB_CLIENT_SECRET;
}
