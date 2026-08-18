import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import AgentBubble from "@/components/agents/AgentBubble";
import { PALESA } from "@/components/agents/agentConfig";

/** PALESA — public front desk host. Hidden for the founder (SYDNEY takes over). */
const PalesaAssistant = () => {
  const { isFounder, loading } = useUserRole();
  const { pathname } = useLocation();

  if (loading || isFounder) return null;
  // MPUMI hosts the Fan Zone — PALESA stays quiet there.
  if (pathname.startsWith("/fan-zone")) return null;

  return <AgentBubble agent={PALESA} autoGreet />;
};

export default PalesaAssistant;
