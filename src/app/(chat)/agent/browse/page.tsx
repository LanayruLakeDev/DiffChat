import { BrowseAgentsList } from "@/components/browse-agents/browse-agents-list";
import { ScrollArea } from "ui/scroll-area";
import { Users, Share2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function BrowseAgentsPage() {
  const t = await getTranslations();

  return (
    <ScrollArea className="h-full w-full">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="size-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{t("Agent.browseTitle")}</h1>
              <p className="text-muted-foreground mt-1">
                {t("Agent.browseDescription")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border">
            <Share2 className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> {t("Agent.browseShareTip")}
            </p>
          </div>
        </div>

        {/* Browse List */}
        <BrowseAgentsList />
      </div>
    </ScrollArea>
  );
}
