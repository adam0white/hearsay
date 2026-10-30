import { GARDEN_CAST, GARDEN_IDS } from './garden-cast.ts';

const ids = new Set<string>(GARDEN_IDS.map((id) => GARDEN_CAST[id].castId));
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function refusal(): never {
  throw new Error(
    'This garden has invalid saved-history details. Keep the original file or saved garden. Start fresh.',
  );
}

/** Validate metadata before any run, cursor, ownership or recording activation. Never repair it. */
export function validateGardenChapter(chapter: unknown, owned: unknown = {}): void {
  if (!plain(owned)) refusal();
  const ownedIds = new Set<string>();
  for (const [id, receipt] of Object.entries(owned as Record<string, unknown>)) {
    if (!ids.has(id) || !plain(receipt) || receipt.castId !== id) refusal();
    ownedIds.add(id);
  }
  if (chapter === undefined) return;
  if (!plain(chapter)) refusal();
  if (
    Object.keys(chapter).some((key) => !['version', 'claims', 'skipped'].includes(key)) ||
    chapter.version !== 'hearsay-hf4-batch/1' ||
    !Array.isArray(chapter.claims) ||
    chapter.claims.length > ids.size
  )
    refusal();
  const claims = new Set<string>();
  for (const claim of chapter.claims) {
    if (
      !plain(claim) ||
      typeof claim.castId !== 'string' ||
      !ids.has(claim.castId) ||
      claims.has(claim.castId)
    )
      refusal();
    claims.add(claim.castId);
  }
  // Compatible current-engine historical files can be read unchanged. Without this
  // field, requireGardenWrite refuses every outgoing write; no skipped IDs are invented.
  if (!Object.hasOwn(chapter, 'skipped')) return;
  if (!Array.isArray(chapter.skipped) || chapter.skipped.length > ids.size) refusal();
  const skipped = new Set<string>();
  for (const entry of chapter.skipped) {
    if (
      !plain(entry) ||
      Object.keys(entry).some((key) => !['castId', 'reason', 'revision'].includes(key)) ||
      typeof entry.castId !== 'string' ||
      !ids.has(entry.castId) ||
      skipped.has(entry.castId) ||
      claims.has(entry.castId) ||
      ownedIds.has(entry.castId) ||
      typeof entry.reason !== 'string' ||
      !entry.reason.trim() ||
      entry.reason.length > 500 ||
      (Object.hasOwn(entry, 'revision') &&
        (typeof entry.revision !== 'string' || !/^[a-f0-9]{64}$/.test(entry.revision)))
    )
      refusal();
    skipped.add(entry.castId);
  }
}
