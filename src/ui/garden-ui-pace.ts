/** Presentation only: reading slows a running garden; menus and an explicit Pause hold it.
 * This changes no simulation clock, inputs, deadlines, actor state or replay rules.
 */
export function gardenPace(preference: number | null, reading: boolean): number {
  const chosen = preference ?? 4;
  return reading ? Math.min(chosen, 1) : chosen;
}
