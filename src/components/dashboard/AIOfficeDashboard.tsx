import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Bot, Megaphone, FileText, Workflow, Sparkles } from "lucide-react";

const panels = [
  {
    key: "founder",
    title: "Founder Assistant",
    description: "Executive context, approvals, and high-value founder guidance.",
    icon: Bot,
    accent: "text-primary",
  },
  {
    key: "marketing",
    title: "Marketing Assistant",
    description: "Campaign ideas, launches, brand narrative, and audience growth.",
    icon: Megaphone,
    accent: "text-amber-400",
  },
  {
    key: "content",
    title: "Content Assistant",
    description: "News, socials, storytelling, and editorial workflow support.",
    icon: FileText,
    accent: "text-emerald-400",
  },
  {
    key: "operations",
    title: "Operations Assistant",
    description: "Tasks, reminders, schedules, and operational coordination.",
    icon: Workflow,
    accent: "text-sky-400",
  },
];

const AIOfficeDashboard = () => {
  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
            <Brain size={14} className="text-primary" /> AI Office v1
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            A visual operating system for the founder team, combining specialist assistant workflows, knowledge memory, and command execution in one place.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Founder Knowledge</Badge>
            <Badge variant="secondary">AI Command Centre</Badge>
            <Badge variant="secondary">Specialist Workflows</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {panels.map((panel) => {
          const Icon = panel.icon;
          return (
            <Card key={panel.key} className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon size={14} className={panel.accent} /> {panel.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{panel.description}</p>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <Sparkles size={12} className="text-primary" /> Shared assistant infrastructure
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AIOfficeDashboard;
