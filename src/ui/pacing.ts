/** Wall-clock presentation only; the simulation still advances one minute at a time. */
export function automaticPace(pending: boolean, company: boolean): number {
  return pending ? 0 : company ? 5 : 20;
}
