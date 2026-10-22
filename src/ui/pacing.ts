/** Wall-clock presentation only; pending responses always hold time. */
export function automaticPace(pending: boolean, chosenSpeed: number): number {
  return pending ? 0 : chosenSpeed;
}
