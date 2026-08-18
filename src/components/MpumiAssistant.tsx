import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import AgentBubble from "@/components/agents/AgentBubble";
import { MPUMI } from "@/components/agents/agentConfig";

/** MPUMI — Fan Zone host. Follows visitors site-wide, greets automatically in the Fan Zone. */
const MpumiAssistant = () => {
  const { isFounder, loading } = useUserRole();
  const { pathname } = useLocation();

  if (loading || isFounder) return null;

  return <AgentBubble agent={MPUMI} autoGreet={pathname.startsWith("/fan-zone")} />;
};

export default MpumiAssistant;
