import { agentRepository } from "lib/db/repository";

export async function GET() {
  try {
    const publicAgents = await agentRepository.selectPublicAgents();
    return Response.json(publicAgents);
  } catch (error) {
    console.error("Failed to fetch public agents:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
