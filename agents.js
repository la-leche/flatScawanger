// Agents are the selectable parsers.
// subagents stays empty until a site parser is plugged in.
export const agents = [
  {
    id: "immoscout",
    name: "Immoscout",
    blurb: "ImmobilienScout24",
    subagents: [],
  },
  {
    id: "kleinanzeigen",
    name: "Kleinanzeigen",
    blurb: "Kleinanzeigen",
    subagents: [],
  },
];

export function getAgent(id) {
  return agents.find((agent) => agent.id === id) || null;
}
