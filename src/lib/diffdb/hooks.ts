"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatMessage, ChatThread } from "app-types/chat";
import { DiffDBChatRepository } from "./chat-repository";
import { DiffDBUser } from "./manager";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { useDiffDBDebug } from "./debug-provider";

// Query Keys
export const diffdbKeys = {
  all: ["diffdb"] as const,
  threads: () => [...diffdbKeys.all, "threads"] as const,
  thread: (id: string) => [...diffdbKeys.all, "thread", id] as const,
  messages: (threadId: string) =>
    [...diffdbKeys.all, "messages", threadId] as const,
  threadDetails: (id: string) =>
    [...diffdbKeys.all, "threadDetails", id] as const,
};

interface DiffDBHooksProps {
  user: DiffDBUser;
}

export function useDiffDBThreads({ user }: DiffDBHooksProps) {
  const repository = new DiffDBChatRepository(user);
  const { debugToast, debugLog } = useDiffDBDebug();

  return useQuery({
    queryKey: diffdbKeys.threads(),
    queryFn: async () => {
      try {
        debugLog("Loading threads from DiffDB...");
        debugToast("Loading threads from GitHub...", "info");

        const threads = await repository.selectThreadsByUserId(user.id);

        debugLog(`Loaded ${threads.length} threads`, threads);
        debugToast(`Loaded ${threads.length} threads`, "success");

        return threads;
      } catch (error) {
        debugLog("Failed to load threads", error);
        debugToast("Failed to load threads", "error");
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Background refresh every 30s
  });
}

export function useDiffDBMessages({
  user,
  threadId,
}: DiffDBHooksProps & { threadId: string }) {
  const repository = new DiffDBChatRepository(user);
  const { debugToast, debugLog } = useDiffDBDebug();

  return useQuery({
    queryKey: diffdbKeys.messages(threadId),
    queryFn: async () => {
      try {
        debugLog(`Loading messages for thread ${threadId}...`);
        debugToast(`Loading messages for thread...`, "info");

        const messages = await repository.selectMessagesByThreadId(threadId);

        debugLog(`Loaded ${messages.length} messages`, messages);
        debugToast(`Loaded ${messages.length} messages`, "success");

        return messages;
      } catch (error) {
        debugLog("Failed to load messages", error);
        debugToast("Failed to load messages", "error");
        throw error;
      }
    },
    enabled: !!threadId,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 15 * 1000, // Refresh every 15s for active chats
  });
}

export function useDiffDBThreadDetails({
  user,
  threadId,
}: DiffDBHooksProps & { threadId: string }) {
  const repository = new DiffDBChatRepository(user);

  return useQuery({
    queryKey: diffdbKeys.threadDetails(threadId),
    queryFn: async () => {
      console.log(`🔄 CACHE: Loading thread details for ${threadId}...`);
      return await repository.selectThreadDetails(threadId);
    },
    enabled: !!threadId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useDiffDBSendMessage({ user }: DiffDBHooksProps) {
  const queryClient = useQueryClient();
  const repository = new DiffDBChatRepository(user);
  const { debugToast, debugLog } = useDiffDBDebug();

  return useMutation({
    mutationFn: async ({
      message,
    }: { message: Omit<ChatMessage, "createdAt">; threadTitle?: string }) => {
      debugLog("Sending message to DiffDB...", message);
      debugToast("Sending message to GitHub...", "info");
      return await repository.insertMessage(message);
    },
    onMutate: async ({ message }) => {
      // 🚀 OPTIMISTIC UPDATE: Show message immediately
      debugLog("Adding message optimistically to cache...", message);
      debugToast("Message added (syncing...)", "info");

      const messagesKey = diffdbKeys.messages(message.threadId);

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: messagesKey });

      // Get current messages
      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(messagesKey) || [];

      // Create optimistic message
      const optimisticMessage: ChatMessage = {
        ...message,
        id: message.id || nanoid(),
        createdAt: new Date(),
      };

      // Optimistically update cache
      queryClient.setQueryData<ChatMessage[]>(messagesKey, (old = []) => [
        ...old,
        optimisticMessage,
      ]);

      debugLog("Message added to cache optimistically");

      return { previousMessages, optimisticMessage };
    },
    onError: (error, variables, context) => {
      // 🔄 ROLLBACK: Remove optimistic update on error
      debugLog("Message sync failed, rolling back...", error);
      debugToast("Message sync failed, retrying...", "error");

      if (context?.previousMessages) {
        queryClient.setQueryData(
          diffdbKeys.messages(variables.message.threadId),
          context.previousMessages,
        );
      }

      toast.error("Failed to send message. Please try again.");
    },
    onSuccess: (data, variables) => {
      debugLog("Message synced to GitHub successfully!", data);
      debugToast("Message synced to GitHub!", "success");

      // Update cache with real data from GitHub
      queryClient.setQueryData<ChatMessage[]>(
        diffdbKeys.messages(variables.message.threadId),
        (old = []) => {
          // Replace optimistic message with real one
          return old.map((msg) => (msg.id === data.id ? data : msg));
        },
      );

      // Refresh threads list to update lastMessageAt
      queryClient.invalidateQueries({ queryKey: diffdbKeys.threads() });
    },
    onSettled: () => {
      debugLog("Message mutation settled");
    },
  });
}

export function useDiffDBCreateThread({ user }: DiffDBHooksProps) {
  const queryClient = useQueryClient();
  const repository = new DiffDBChatRepository(user);

  return useMutation({
    mutationFn: async (thread: Omit<ChatThread, "createdAt">) => {
      console.log("🆕 THREAD: Creating new thread in DiffDB...");
      return await repository.insertThread(thread);
    },
    onMutate: async (newThread) => {
      // 🚀 OPTIMISTIC UPDATE: Show thread immediately
      console.log("⚡ OPTIMISTIC: Adding thread to cache immediately...");

      const threadsKey = diffdbKeys.threads();

      await queryClient.cancelQueries({ queryKey: threadsKey });

      const previousThreads = queryClient.getQueryData(threadsKey);

      // Create optimistic thread
      const optimisticThread = {
        ...newThread,
        createdAt: new Date(),
        lastMessageAt: new Date().getTime(),
      };

      // Optimistically update cache
      queryClient.setQueryData(threadsKey, (old: any[] = []) => [
        optimisticThread,
        ...old,
      ]);

      return { previousThreads };
    },
    onError: (error, _variables, context) => {
      console.error("❌ THREAD CREATE FAILED: Rolling back...", error);

      if (context?.previousThreads) {
        queryClient.setQueryData(diffdbKeys.threads(), context.previousThreads);
      }

      toast.error("Failed to create thread. Please try again.");
    },
    onSuccess: (data) => {
      console.log("✅ THREAD CREATE SUCCESS: Thread saved to GitHub!");

      // Update with real data
      queryClient.setQueryData(diffdbKeys.threads(), (old: any[] = []) => {
        return old.map((thread) =>
          thread.id === data.id
            ? { ...data, lastMessageAt: data.createdAt.getTime() }
            : thread,
        );
      });
    },
  });
}

export function useDiffDBUpdateThread({ user }: DiffDBHooksProps) {
  const queryClient = useQueryClient();
  const repository = new DiffDBChatRepository(user);

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<ChatThread, "createdAt" | "id">>;
    }) => {
      console.log(`🔄 THREAD UPDATE: Updating thread ${id}...`);
      return await repository.updateThread(id, updates);
    },
    onMutate: async ({ id, updates }) => {
      // 🚀 OPTIMISTIC UPDATE: Show changes immediately
      console.log("⚡ OPTIMISTIC: Updating thread in cache...");

      const threadsKey = diffdbKeys.threads();
      const threadKey = diffdbKeys.thread(id);

      await queryClient.cancelQueries({ queryKey: threadsKey });
      await queryClient.cancelQueries({ queryKey: threadKey });

      const previousThreads = queryClient.getQueryData(threadsKey);
      const previousThread = queryClient.getQueryData(threadKey);

      // Optimistically update threads list
      queryClient.setQueryData(threadsKey, (old: any[] = []) =>
        old.map((thread) =>
          thread.id === id ? { ...thread, ...updates } : thread,
        ),
      );

      // Optimistically update individual thread
      queryClient.setQueryData(threadKey, (old: any) =>
        old ? { ...old, ...updates } : old,
      );

      return { previousThreads, previousThread };
    },
    onError: (error, variables, context) => {
      console.error("❌ THREAD UPDATE FAILED: Rolling back...", error);

      if (context?.previousThreads) {
        queryClient.setQueryData(diffdbKeys.threads(), context.previousThreads);
      }
      if (context?.previousThread) {
        queryClient.setQueryData(
          diffdbKeys.thread(variables.id),
          context.previousThread,
        );
      }

      toast.error("Failed to update thread. Please try again.");
    },
    onSuccess: (data, variables) => {
      console.log("✅ THREAD UPDATE SUCCESS: Updated in GitHub!");

      // Update with real data
      queryClient.setQueryData(diffdbKeys.threads(), (old: any[] = []) =>
        old.map((thread) =>
          thread.id === variables.id
            ? { ...data, lastMessageAt: data.createdAt.getTime() }
            : thread,
        ),
      );

      queryClient.setQueryData(diffdbKeys.thread(variables.id), data);
    },
  });
}

// Hook to prefetch thread data for better performance
export function useDiffDBPrefetch({ user }: DiffDBHooksProps) {
  const queryClient = useQueryClient();

  const prefetchThread = (threadId: string) => {
    console.log(`🔮 PREFETCH: Pre-loading thread ${threadId}...`);

    queryClient.prefetchQuery({
      queryKey: diffdbKeys.messages(threadId),
      queryFn: async () => {
        const repository = new DiffDBChatRepository(user);
        return await repository.selectMessagesByThreadId(threadId);
      },
      staleTime: 1 * 60 * 1000,
    });
  };

  return { prefetchThread };
}

// Hook to manually invalidate cache (for debugging or force refresh)
export function useDiffDBCache() {
  const queryClient = useQueryClient();

  const clearCache = () => {
    console.log("🧹 CACHE: Clearing all DiffDB cache...");
    queryClient.removeQueries({ queryKey: diffdbKeys.all });
  };

  const refreshAll = () => {
    console.log("🔄 CACHE: Refreshing all DiffDB data...");
    queryClient.invalidateQueries({ queryKey: diffdbKeys.all });
  };

  return { clearCache, refreshAll };
}

export function useDiffDBDeleteMessage({ user }: DiffDBHooksProps) {
  const queryClient = useQueryClient();
  const repository = new DiffDBChatRepository(user);
  const { debugToast, debugLog } = useDiffDBDebug();

  return useMutation({
    mutationFn: async ({
      messageId,
      threadId,
    }: { messageId: string; threadId: string }) => {
      debugLog(`Deleting message ${messageId} from thread ${threadId}`);
      debugToast(`Deleting message...`, "info");
      return await repository.deleteChatMessage(messageId);
    },
    onMutate: async ({ messageId, threadId }) => {
      // Optimistically remove message from cache
      debugLog("Removing message from cache optimistically...");

      const messagesKey = diffdbKeys.messages(threadId);
      await queryClient.cancelQueries({ queryKey: messagesKey });

      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(messagesKey) || [];

      // Remove message optimistically
      queryClient.setQueryData<ChatMessage[]>(messagesKey, (old = []) =>
        old.filter((msg) => msg.id !== messageId),
      );

      return { previousMessages };
    },
    onError: (error, variables, context) => {
      debugLog("Message deletion failed, rolling back...", error);
      debugToast("Failed to delete message", "error");

      if (context?.previousMessages) {
        queryClient.setQueryData(
          diffdbKeys.messages(variables.threadId),
          context.previousMessages,
        );
      }
    },
    onSuccess: (_data, variables) => {
      debugLog("Message deleted successfully!");
      debugToast("Message deleted from GitHub!", "success");

      // Refresh to ensure consistency
      queryClient.invalidateQueries({
        queryKey: diffdbKeys.messages(variables.threadId),
      });
      queryClient.invalidateQueries({ queryKey: diffdbKeys.threads() });
    },
  });
}

export function useDiffDBBulkDelete({ user }: DiffDBHooksProps) {
  const queryClient = useQueryClient();
  const repository = new DiffDBChatRepository(user);
  const { debugToast, debugLog } = useDiffDBDebug();

  return useMutation({
    mutationFn: async () => {
      debugLog("Performing bulk delete of all threads...");
      debugToast("Deleting all threads...", "warning");
      return await repository.deleteAllThreads(user.id);
    },
    onMutate: async () => {
      // Clear all data optimistically
      debugLog("Clearing all cached data...");

      await queryClient.cancelQueries({ queryKey: diffdbKeys.all });
      const previousData = queryClient.getQueryData(diffdbKeys.threads());

      queryClient.setQueryData(diffdbKeys.threads(), []);

      return { previousData };
    },
    onError: (error, _variables, context) => {
      debugLog("Bulk delete failed, rolling back...", error);
      debugToast("Failed to delete all threads", "error");

      if (context?.previousData) {
        queryClient.setQueryData(diffdbKeys.threads(), context.previousData);
      }
    },
    onSuccess: () => {
      debugLog("Bulk delete completed successfully!");
      debugToast("All threads deleted from GitHub!", "success");

      // Clear everything and refresh
      queryClient.clear();
    },
  });
}
