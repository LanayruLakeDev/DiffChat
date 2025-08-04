"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "lib/utils";
import { AgentBrowseCard } from "./agent-browse-card";
import { BrowseFilters } from "./browse-filters";
import { Skeleton } from "ui/skeleton";
import { AlertCircle, Users, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import { useAgents } from "@/hooks/queries/use-agents";

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

type MyAgent = {
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
};

export function BrowseAgentsList() {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "popular">("newest");
  const [activeTab, setActiveTab] = useState("my-agents");

  // Fetch user's own agents
  const { data: myAgents, isLoading: isLoadingMyAgents, error: myAgentsError } = useAgents();

  // Fetch public agents
  const { data: publicAgents, isLoading: isLoadingPublic, error: publicError } = useSWR<PublicAgent[]>(
    "/api/agent/public",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const filteredAndSortedMyAgents = useMemo(() => {
    if (!myAgents) return [];

    let filtered = myAgents;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = myAgents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.description?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "oldest":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "name":
          return a.name.localeCompare(b.name);
        case "popular":
          // For now, sort by newest for "popular" since we don't have usage stats
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [myAgents, searchQuery, sortBy]);

  const filteredAndSortedPublicAgents = useMemo(() => {
    if (!publicAgents) return [];

    let filtered = publicAgents;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = publicAgents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.description?.toLowerCase().includes(query) ||
          agent.creatorName.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "oldest":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "name":
          return a.name.localeCompare(b.name);
        case "popular":
          // For now, sort by newest for "popular" since we don't have usage stats
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [publicAgents, searchQuery, sortBy]);

  const isLoading = isLoadingMyAgents || isLoadingPublic;
  const error = myAgentsError || publicError;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="size-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t("Agent.failedToGetAgent")}</h3>
        <p className="text-muted-foreground">
          There was an error loading the agents. Please try again later.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BrowseFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my-agents" className="flex items-center gap-2">
            <User className="size-4" />
            {t("Agent.myAgents")}
          </TabsTrigger>
          <TabsTrigger value="public-agents" className="flex items-center gap-2">
            <Users className="size-4" />
            {t("Agent.publicAgents")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-agents" className="space-y-4">
          {filteredAndSortedMyAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery.trim() ? t("Agent.noAgentsFound") : "No agents yet"}
              </h3>
              <p className="text-muted-foreground max-w-md">
                {searchQuery.trim()
                  ? t("Agent.adjustSearchTerms")
                  : "Create your first agent to get started!"}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredAndSortedMyAgents.length} {filteredAndSortedMyAgents.length !== 1 ? t("Agent.agentsFound") : t("Agent.agentFound")}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAndSortedMyAgents.map((agent) => (
                  <AgentBrowseCard key={agent.id} agent={agent} isOwner={true} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="public-agents" className="space-y-4">
          {filteredAndSortedPublicAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery.trim() ? t("Agent.noAgentsFound") : t("Agent.noPublicAgents")}
              </h3>
              <p className="text-muted-foreground max-w-md">
                {searchQuery.trim()
                  ? t("Agent.adjustSearchTerms")
                  : t("Agent.beFirstToShare")}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredAndSortedPublicAgents.length} {filteredAndSortedPublicAgents.length !== 1 ? t("Agent.agentsFound") : t("Agent.agentFound")}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAndSortedPublicAgents.map((agent) => (
                  <AgentBrowseCard key={agent.id} agent={agent} isOwner={false} />
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
