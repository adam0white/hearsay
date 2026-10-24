/** Recording linkage is independent of continuity. This guard uses only the
 * already-released exact-envelope/opaque-epoch association protocol. No life API.
 * It gates every lab channel through Lab's single persona-recording gate.
 */
import type { PersonaEnvelope } from '@adam0white/lab-client';
export interface RecordingBinding {
  key: string | null;
  file: boolean;
  heads: PersonaEnvelope[];
}
interface RecordingLab {
  setPersonaRecording(key: string | null): void;
  allowPersonaRecording(value: boolean): void;
  readonly personaRecordingAllowed: boolean;
}
interface RecordingShelf {
  ready: Promise<boolean>;
  request: (request: never) => Promise<unknown>;
}
interface Reply {
  sameEpoch?: boolean;
  revisions?: string[];
  recordingEpoch?: string | null;
}
const pin = (b: RecordingBinding) =>
  JSON.stringify([b.key, b.file, b.heads.map((h) => [h.castId, h.branchId, h.revision])]);
const echoes = (r: Reply, heads: PersonaEnvelope[]) =>
  r.revisions?.join('/') === heads.map((h) => h.revision).join('/');
export class GardenRecordingGuard {
  private generation = 0;
  private binding?: RecordingBinding;
  private denied: RecordingBinding | undefined;
  private choices: Promise<void> = Promise.resolve();
  constructor(
    private lab: RecordingLab,
    private shelf: RecordingShelf,
  ) {}
  invalidate(): void {
    ++this.generation;
    this.lab.setPersonaRecording('pending-history');
    this.lab.allowPersonaRecording(false);
  }
  private owns(generation: number, b: RecordingBinding, selected: string): boolean {
    return generation === this.generation && this.binding === b && pin(b) === selected;
  }
  async bind(b: RecordingBinding, openedFile = false): Promise<void> {
    this.invalidate();
    if (this.binding !== b) this.denied = undefined;
    this.binding = b;
    const generation = this.generation,
      selected = pin(b);
    this.lab.setPersonaRecording(b.key);
    const priorLocal = this.lab.personaRecordingAllowed;
    if (b.key) this.lab.allowPersonaRecording(false);
    await this.shelf.ready;
    if (!this.owns(generation, b, selected)) return;
    // Truly fresh original runs have no imported history to associate.
    if (!b.key && !b.file && !b.heads.length) {
      this.lab.setPersonaRecording(null);
      return;
    }
    // Imported raw history cannot be uploaded before its first accepted head.
    if (!b.heads.length || openedFile || this.denied === b || (b.file && !priorLocal)) return;
    try {
      const reply = (await this.shelf.request({
        action: 'recordingBatch',
        envelopes: b.heads,
      } as never)) as Reply;
      if (
        this.owns(generation, b, selected) &&
        this.denied !== b &&
        reply.sameEpoch &&
        echoes(reply, b.heads)
      )
        this.lab.allowPersonaRecording(true);
    } catch {
      /* Failed checks remain local-only. */
    }
  }
  choose(value: boolean): Promise<void> {
    const b = this.binding;
    this.invalidate();
    this.denied = value ? undefined : b;
    if (!b) return Promise.resolve();
    this.lab.setPersonaRecording(b.key ?? 'pending-history');
    this.lab.allowPersonaRecording(false);
    const generation = this.generation,
      selected = pin(b);
    const valid = () => this.owns(generation, b, selected);
    const task = this.choices
      .catch(() => {})
      .then(async () => {
        await this.shelf.ready;
        if (!valid() || !b.heads.length) return;
        const epoch = (await this.shelf.request({
          action: 'recordingBatch',
          envelopes: b.heads,
        } as never)) as Reply;
        if (!valid()) return;
        if (!echoes(epoch, b.heads) || !('recordingEpoch' in epoch))
          throw new Error('Could not verify the complete history.');
        const reply = (await this.shelf.request({
          action: 'recordingBatch',
          envelopes: b.heads,
          allowRecording: value,
          recordingEpoch: epoch.recordingEpoch ?? undefined,
        } as never)) as Reply;
        if (!valid()) return;
        if (!echoes(reply, b.heads) || reply.sameEpoch !== value)
          throw new Error('Recording identity changed. Choose again.');
        if (valid() && (!value || this.denied !== b)) this.lab.allowPersonaRecording(value);
      });
    this.choices = task.catch(() => {});
    return task;
  }
  /** A source put must capture this generation before requesting an epoch. */
  capture(): number {
    return this.generation;
  }
  unchanged(generation: number): boolean {
    return generation === this.generation;
  }
}
