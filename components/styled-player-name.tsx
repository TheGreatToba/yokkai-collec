"use client";

import type { CSSProperties } from "react";
import { useLocalPlayerStyle } from "@/components/use-local-player-style";
import { CosmeticBadges } from "@/components/local-profile-style-preview";
import {
  LocalProBadgePreview,
  LocalProProfileBadge
} from "@/components/local-pro-badge-preview";
import { localNameVariables } from "@/lib/ui/local-profile-style";
import "@/styles/profile-style.css";

export function StyledPlayerName({
  userId,
  name,
  fallbackLabel = name
}: {
  userId: string;
  name: string;
  fallbackLabel?: string;
}) {
  const style = useLocalPlayerStyle(userId);
  if (!style) return <>{fallbackLabel}</>;
  return (
    <span className="yk-styled-player-name" data-styled-player={userId}>
      <span
        className="yk-style-name"
        data-name-effect={style.effect}
        style={localNameVariables(style) as CSSProperties}
      >
        {name}
      </span>
      <LocalProBadgePreview>
        <LocalProProfileBadge isMe={true} />
      </LocalProBadgePreview>
      {style.badges.length > 0 && (
        <CosmeticBadges badges={style.badges} inline />
      )}
    </span>
  );
}
