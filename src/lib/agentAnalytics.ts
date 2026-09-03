import { supabase } from "@/integrations/supabase/client";

export type AgentId = "palesa" | "mpumi";
export type AgentEventType =
  | "greeting_shown"
  | "greeting_dismissed"
  | "chip_click"
  | "button_open"
  | "chat_open"
  | "send";

const SESSION_KEY = "agent_session_id";

const sessionId = (): string => {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
};

/** Fire-and-forget conversion tracking for the public agent bubbles. */
export const trackAgentEvent = (
  agent: AgentId,
  eventType: AgentEventType,
  label?: string,
  meta?: Record<string, unknown>,
) => {
  try {
    void supabase
      .from("agent_events")
      .insert({
        agent,
        event_type: eventType,
        label,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
        session_id: sessionId(),
        meta: (meta ?? {}) as never,
      })
      .then(undefined, () => {});
  } catch {
    /* analytics must never break the chat */
  }
};
