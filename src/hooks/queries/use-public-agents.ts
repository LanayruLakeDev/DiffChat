"use client";
import useSWR, { SWRConfiguration } from "swr";
import { handleErrorWithToast } from "ui/shared-toast";
import { fetcher } from "lib/utils";

type PublicAgent = {
  id: string;
  name: string;
  description?: string;
  icon?: {
    type: "emoji";
    value: string;
    style?: Record<string, string>;
  };
  userId: string;
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
  creatorName: string;
};

export function usePublicAgents(options?: SWRConfiguration) {
  return useSWR<PublicAgent[]>("/api/agent/public", fetcher, {
    errorRetryCount: 0,
    revalidateOnFocus: false,
    fallbackData: [],
    onError: handleErrorWithToast,
    ...options,
  });
}
