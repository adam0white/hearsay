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
/** This generation tracks loaded-run ownership only. Recording linkage is automatic. */
export class GardenRecordingGuard {
  private generation = 0;
  constructor(
    private lab: RecordingLab,
    _shelf?: RecordingShelf,
  ) {}
  invalidate(): void {
    ++this.generation;
  }
  async bind(b: RecordingBinding, _openedFile = false): Promise<void> {
    this.invalidate();
    this.lab.setPersonaRecording(b.key);
  }
  async choose(_value: boolean): Promise<void> {}
  capture(): number {
    return this.generation;
  }
  unchanged(generation: number): boolean {
    return generation === this.generation;
  }
}
