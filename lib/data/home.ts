import type { Card, PackStatus } from "@/lib/data/cards";
import type { PlayerCosmetics } from "@/components/styled-player-name";

export type HomeCard = Card & { instanceId: string; obtainedAt: string; shiny: boolean };
export type BigPull = { instanceId: string; obtainedAt: string; card: Card & { shiny: boolean }; playerId: string; playerName: string; profileStyle?: PlayerCosmetics };
export type HomePackStatus = PackStatus & { serverNow: number };
