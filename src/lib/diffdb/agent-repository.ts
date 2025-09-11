import { Agent, AgentRepository } from "app-types/agent";
import { DiffDBManager, DiffDBUser } from "./manager";
import logger from "logger";

/**
 * DiffDB implementation of AgentRepository
 * Stores agent configurations in GitHub repository
 */
export class DiffDBAgentRepository implements AgentRepository {
  private diffDBManager: DiffDBManager;

  constructor(user: DiffDBUser) {
    this.diffDBManager = new DiffDBManager(user);
  }

  async insertAgent(agent: Omit<Agent, "id" | "createdAt" | "updatedAt">): Promise<Agent> {
    const fullAgent: Agent = {
      ...agent,
      id: `agent_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const filePath = `users/${this.diffDBManager['userId']}/agents/${fullAgent.id}.json`;
    await this.diffDBManager['githubClient'].createOrUpdateFile(
      this.diffDBManager['repoName'],
      filePath,
      JSON.stringify(fullAgent, null, 2),
      `Create agent: ${fullAgent.name}`
    );

    logger.info(`DiffDB: Created agent ${fullAgent.id}`);
    return fullAgent;
  }

  async selectAgentById(id: string, userId: string): Promise<Agent | null> {
    const filePath = `users/${userId}/agents/${id}.json`;
    const file = await this.diffDBManager['githubClient'].getFile(
      this.diffDBManager['repoName'],
      filePath
    );

    if (!file) return null;

    try {
      return JSON.parse(file.content) as Agent;
    } catch (error) {
      logger.error(`Failed to parse agent ${id}:`, error);
      return null;
    }
  }

  async selectAgentsByUserId(userId: string): Promise<Omit<Agent, "instructions">[]> {
    const agentFiles = await this.diffDBManager['githubClient'].listFiles(
      this.diffDBManager['repoName'],
      `users/${userId}/agents`
    );

    const agents: Omit<Agent, "instructions">[] = [];
    for (const filePath of agentFiles) {
      if (!filePath.endsWith('.json')) continue;
      
      const file = await this.diffDBManager['githubClient'].getFile(
        this.diffDBManager['repoName'],
        filePath
      );

      if (file) {
        try {
          const agent = JSON.parse(file.content) as Agent;
          const { instructions, ...agentWithoutInstructions } = agent;
          agents.push(agentWithoutInstructions);
        } catch (error) {
          logger.error(`Failed to parse agent file ${filePath}:`, error);
        }
      }
    }

    return agents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateAgent(
    id: string, 
    userId: string, 
    agent: Partial<Pick<Agent, "name" | "description" | "icon" | "instructions" | "isPublic">>
  ): Promise<Agent> {
    const existing = await this.selectAgentById(id, userId);
    if (!existing) {
      throw new Error(`Agent ${id} not found`);
    }

    const updatedAgent: Agent = {
      ...existing,
      ...agent,
      updatedAt: new Date(),
    };

    const filePath = `users/${userId}/agents/${id}.json`;
    const existingFile = await this.diffDBManager['githubClient'].getFile(
      this.diffDBManager['repoName'],
      filePath
    );

    await this.diffDBManager['githubClient'].createOrUpdateFile(
      this.diffDBManager['repoName'],
      filePath,
      JSON.stringify(updatedAgent, null, 2),
      `Update agent: ${updatedAgent.name}`,
      existingFile?.sha
    );

    logger.info(`DiffDB: Updated agent ${id}`);
    return updatedAgent;
  }

  async upsertAgent(agent: Omit<Agent, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Agent> {
    const id = agent.id || `agent_${Date.now()}`;
    const existing = agent.id ? await this.selectAgentById(id, agent.userId) : null;

    const fullAgent: Agent = {
      ...agent,
      id,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    const filePath = `users/${agent.userId}/agents/${id}.json`;
    const existingFile = await this.diffDBManager['githubClient'].getFile(
      this.diffDBManager['repoName'],
      filePath
    );

    await this.diffDBManager['githubClient'].createOrUpdateFile(
      this.diffDBManager['repoName'],
      filePath,
      JSON.stringify(fullAgent, null, 2),
      existing ? `Update agent: ${fullAgent.name}` : `Create agent: ${fullAgent.name}`,
      existingFile?.sha
    );

    logger.info(`DiffDB: ${existing ? 'Updated' : 'Created'} agent ${id}`);
    return fullAgent;
  }

  async deleteAgent(id: string, userId: string): Promise<void> {
    const filePath = `users/${userId}/agents/${id}.json`;
    const existingFile = await this.diffDBManager['githubClient'].getFile(
      this.diffDBManager['repoName'],
      filePath
    );

    if (existingFile?.sha) {
      await this.diffDBManager['githubClient'].deleteFile(
        this.diffDBManager['repoName'],
        filePath,
        `Delete agent: ${id}`,
        existingFile.sha
      );
      logger.info(`DiffDB: Deleted agent ${id}`);
    }
  }

  async selectPublicAgents(): Promise<(Omit<Agent, "instructions"> & { creatorName: string })[]> {
    // TODO: Implement public agents - need to scan across all users
    logger.warn('DiffDB: Public agents not implemented yet');
    return [];
  }

  async selectPublicAgentById(id: string): Promise<Agent | null> {
    // TODO: Implement public agent lookup
    logger.warn('DiffDB: Public agent lookup not implemented yet');
    return null;
  }
}
