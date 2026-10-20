// Shared by the booster screen and home; availability always comes from SQL.
export function packCountdown(
  nextPackAt: number | null | undefined,
  now: number
) {
  const seconds = nextPackAt
    ? Math.max(0, Math.ceil((nextPackAt - now) / 1000))
    : 0;
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
