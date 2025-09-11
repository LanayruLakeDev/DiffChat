import { getSession } from "auth/server";
import { createChatRepository } from "lib/db/repository";

export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Create the appropriate chat repository based on configuration
  const chatRepository = await createChatRepository(session);
  const threads = await chatRepository.selectThreadsByUserId(session.user.id);
  return Response.json(threads);
}
