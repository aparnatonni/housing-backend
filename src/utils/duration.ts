const UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export const durationToMs = (duration: string, fallbackMs: number): number => {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return fallbackMs;
  return Number(match[1]) * (UNITS[match[2]] ?? fallbackMs);
};
