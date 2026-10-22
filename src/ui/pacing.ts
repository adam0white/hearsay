/** Wall-clock presentation only; pending responses always hold time. */
export function automaticPace(pending: boolean, chosenSpeed = 5, skipping = false): number {
  return pending ? 0 : skipping ? 80 : chosenSpeed;
}
