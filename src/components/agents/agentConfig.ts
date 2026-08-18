export type AgentChip = { label: string; prompt: string };

export type AgentConfig = {
  /** Stable key — used for localStorage namespacing and the backend persona switch. */
  id: "palesa" | "mpumi";
  name: string;
  role: string;
  /** Side the floating button and greeting bubble anchor to. */
  side: "left" | "right";
  /** Tailwind font family class for the agent's name lockup. */
  nameFont: string;
  /** Extra tracking/casing for the name lockup. */
  nameClass: string;
  /** Gradient/ring treatment for the floating button. */
  ringClass: string;
  greeting: string;
  chips: AgentChip[];
  placeholder: string;
};

export const MAX_WORDS = 100;

export const PALESA: AgentConfig = {
  id: "palesa",
  name: "PALESA",
  role: "Front Desk Host",
  side: "left",
  nameFont: "font-palesa",
  nameClass: "tracking-[0.25em] italic",
  ringClass: "from-gold-light via-primary to-gold-dark",
  greeting:
    "Eita! Welcome to s2kDOTza. I'm PALESA — your front desk host. Who am I talking to today?",
  chips: [
    {
      label: "I'm an artist",
      prompt: "I'm an independent artist looking for development or studio time.",
    },
    {
      label: "I'm a brand / corporate",
      prompt: "I'm a brand manager, film producer or corporate representative seeking partnership.",
    },
    {
      label: "I'm a fan / media",
      prompt: "I'm a fan and I want to know about your artists, music, events and news.",
    },
  ],
  placeholder: "Ask about our artists, music or shows...",
};

export const MPUMI: AgentConfig = {
  id: "mpumi",
  name: "MPUMI",
  role: "Fan Zone Host",
  side: "right",
  nameFont: "font-mpumi",
  nameClass: "tracking-[0.18em] uppercase",
  ringClass: "from-primary via-gold-light to-primary",
  greeting:
    "Eita! Welcome to the Movement 🔥 I'm MPUMI — the face and voice of this house. This is where we turn noise into legacy. Phando's simple: the culture lives right here. Stay locked in.",
  chips: [
    { label: "Drop a question / shoutout", prompt: "I want to drop a question and a shoutout." },
    { label: "See the latest drops", prompt: "Show me the latest drops from the house." },
    { label: "Talk to MPUMI & the crew", prompt: "I want to talk to MPUMI and the crew." },
  ],
  placeholder: "Talk to MPUMI — questions, shoutouts, fanmail...",
};

export const countWords = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;
