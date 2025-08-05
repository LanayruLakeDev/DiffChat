"use client";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { Button } from "ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "ui/card";
import { Badge } from "ui/badge";
import { BACKGROUND_COLORS, EMOJI_DATA } from "lib/const";
import { Download, Clock, Edit, Globe, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { fetcher } from "lib/utils";
import { toast } from "sonner";
import { mutate } from "swr";
import Link from "next/link";
import { PublicAgent, BrowseAgent } from "./types";

interface AgentBrowseCardProps {
  agent: BrowseAgent;
  isOwner: boolean;
}

export function AgentBrowseCard({ agent, isOwner }: AgentBrowseCardProps) {
  const t = useTranslations();
  const [isGetting, setIsGetting] = useState(false);

  const handleGetAgent = async () => {
    setIsGetting(true);
    try {
      const response = await fetcher(`/api/agent/copy/${agent.id}`, {
        method: "POST",
      });
      
      if (response.success) {
        toast.success(t("Agent.agentAddedToCollection"));
        // Refresh the user's agent list
        mutate("/api/agent");
      } else {
        toast.error(t("Agent.failedToGetAgent"));
      }
    } catch (error) {
      console.error("Error getting agent:", error);
      toast.error(t("Agent.failedToGetAgent"));
    } finally {
      setIsGetting(false);
    }
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}${t("Agent.timeAgo.minutesAgo")}`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}${t("Agent.timeAgo.hoursAgo")}`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}${t("Agent.timeAgo.daysAgo")}`;
    }
  };

  const isPublicAgent = !isOwner && 'creatorName' in agent;

  return (
    <Card className="group hover:shadow-md transition-all duration-200 hover:border-ring">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg ring-2 ring-border"
              style={{
                backgroundColor: agent.icon?.style?.backgroundColor || BACKGROUND_COLORS[0],
              }}
            >
              <Avatar className="size-8">
                <AvatarImage
                  src={agent.icon?.value || EMOJI_DATA[0]}
                  className="scale-110"
                />
                <AvatarFallback className="bg-transparent text-lg">
                  {agent.name[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg font-semibold line-clamp-1">
                {agent.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {isOwner ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {agent.isPublic ? (
                        <div className="flex items-center gap-1">
                          <Globe className="size-3" />
                          Public
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Lock className="size-3" />
                          Private
                        </div>
                      )}
                    </Badge>
                  </div>
                ) : (
                  isPublicAgent && (
                    <Badge variant="secondary" className="text-xs">
                      by {(agent as PublicAgent).creatorName}
                    </Badge>
                  )
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {getRelativeTime(agent.updatedAt)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="line-clamp-3 mb-4 min-h-[3.75rem]">
          {agent.description || "No description provided."}
        </CardDescription>
        {isOwner ? (
          <Link href={`/agent/${agent.id}`}>
            <Button className="w-full group-hover:bg-primary/90 transition-colors" size="sm">
              <Edit className="size-4 mr-2" />
              {t("Common.edit")}
            </Button>
          </Link>
        ) : (
          <Button
            onClick={handleGetAgent}
            disabled={isGetting}
            className="w-full group-hover:bg-primary/90 transition-colors"
            size="sm"
          >
            <Download className="size-4 mr-2" />
            {isGetting ? t("Agent.gettingAgent") : t("Agent.getAgent")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
