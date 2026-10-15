export function habitNameForPath(path: string, habits: { name: string }[]): string | null {
  const match = /^habits\.(\d+)(?:\.|$)/.exec(path);
  if (!match) return null;
  return habits[Number(match[1])]?.name ?? null;
}
