/** The closing-chapter checkpoint. Expected unavailability is quiet; every real failure stays visible. */
import {
  anchorPersonaLife,
  canonicalCast,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  type PersonaRequest,
  portablePassport,
  portableWriteBlockers,
} from '@adam0white/lab-client';
import { GARDEN_CAST, GARDEN_IDS, type GardenPerson } from '../sim/garden-cast.ts';
import type { GardenRun } from '../sim/garden4.ts';
import {
  captureGardenSource,
  GardenChapterUnavailable,
  requireGardenWrite,
} from '../sim/garden4-continuity.ts';
import type { RecordingBinding } from './garden-recording.ts';

export interface ClosingContext {
  run: GardenRun;
  /** False once the game, its generation or the file session has moved on. */
  current(): boolean;
  ownedHeads(): Record<string, PersonaEnvelope>;
  fileOrigin: boolean;
  fileKey: string | null;
  shelf: { request(request: PersonaRequest): Promise<unknown> };
  /** Writes the device journal. It reports its own failure to the player. */
  save(): Promise<boolean>;
  retain(run: GardenRun, source: PersonaEnvelope['source']): Promise<string>;
  stamps(): PersonaEnvelope['source'];
  bind(binding: RecordingBinding): Promise<void>;
  /** Replaces the recording binding the app keeps. */
  rebind(binding: RecordingBinding): void;
  capture?: typeof captureGardenSource;
}
export interface ClosingResult {
  /** One plain sentence group for this whole checkpoint. Empty when nothing needs saying. */
  notice: string;
  /** The device save failed. The player already has that notice. */
  deviceSaveFailed: boolean;
}
type Stage = 'prepare' | 'device' | 'changed' | 'shelf' | 'after';

function names(ids: GardenPerson[]): string {
  const list = ids.map((id) => GARDEN_CAST[id].name);
  return list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}
function noticeFor(failures: Record<Stage, GardenPerson[]>): string {
  const lines: string[] = [];
  if (failures.prepare.length)
    lines.push(`The chapter for ${names(failures.prepare)} could not be prepared for saving across games.`);
  if (failures.changed.length)
    lines.push(
      `The game changed while the chapter for ${names(failures.changed)} was being saved across games, so it was not saved.`,
    );
  if (failures.shelf.length)
    lines.push(
      `The chapter for ${names(failures.shelf)} could not be saved across games. Your garden was saved on this device first.`,
    );
  if (failures.after.length)
    lines.push(
      `The chapter for ${names(failures.after)} was saved across games, but this game could not update its recording of it.`,
    );
  return lines.join(' ');
}

export async function closeChapters(ctx: ClosingContext): Promise<ClosingResult> {
  const captured = ctx.run;
  const failures: Record<Stage, GardenPerson[]> = {
    prepare: [],
    device: [],
    changed: [],
    shelf: [],
    after: [],
  };
  let deviceSaveFailed = false;
  const capture = ctx.capture ?? captureGardenSource;
  for (const id of GARDEN_IDS) {
    const capturedMinute = captured.minute,
      capturedInputs = captured.inputs.length;
    const unchanged = () => captured.minute === capturedMinute && captured.inputs.length === capturedInputs;
    const cast = canonicalCast(GARDEN_CAST[id].castId),
      parent = ctx.ownedHeads()[cast.castId];
    if (parent?.terminal) continue;
    let stage: Stage = 'prepare';
    try {
      requireGardenWrite(captured, cast.castId);
      if (ctx.fileOrigin && !parent)
        throw new Error(
          'People from an imported file cannot replace a history saved in this browser. Keep this game file for your own record.',
        );
      const actor = captured.people[id];
      let next: PersonaEnvelope;
      if (parent && portablePassport(parent) && portableWriteBlockers(cast.castId, 'hearsay').length)
        throw new GardenChapterUnavailable(
          'This person cannot be saved across games yet. Keep this chapter.',
        );
      if (!actor.body.alive) {
        if (!parent)
          throw new Error(
            'There is no saved living history for this person to close. Their death is still saved in this game.',
          );
        next = await closePersonaBranch(parent, ctx.stamps(), Math.round(actor.now * 60_000));
      } else {
        const projected = await capture(captured, id);
        const sourceArchive = await ctx.retain(captured, ctx.stamps());
        const branchId = parent?.branchId ?? crypto.randomUUID();
        const life = parent?.transfer.life
          ? anchorPersonaLife(
              parent.transfer.life as Parameters<typeof anchorPersonaLife>[0],
              cast.castId,
              Date.now(),
            )
          : initialPersonaLife(cast.castId, branchId, Date.now());
        next = await createPersona({
          format: 'hf-persona/1',
          castId: cast.castId,
          castRevision: cast.revision,
          branchId,
          parentRevision: parent?.revision ?? null,
          source: ctx.stamps(),
          transfer: { ...projected.transfer, life, sourceArchive },
          limitations: projected.limitations,
        });
      }
      if (!ctx.current() || !unchanged()) {
        failures.changed.push(id);
        continue;
      }
      stage = 'device';
      if (!(await ctx.save())) {
        deviceSaveFailed = true;
        continue;
      }
      if (!ctx.current() || !unchanged()) {
        failures.changed.push(id);
        continue;
      }
      stage = 'shelf';
      await ctx.shelf.request({ action: 'put', envelope: next });
      if (!ctx.current()) return { notice: noticeFor(failures), deviceSaveFailed };
      stage = 'after';
      ctx.ownedHeads()[cast.castId] = next;
      const initial = captured.chapter?.claims ?? [];
      const heads = [
        ...initial,
        ...Object.values(ctx.ownedHeads()).filter((h) => !initial.some((p) => p.branchId === h.branchId)),
      ];
      const binding: RecordingBinding = {
        key: ctx.fileKey ? `garden-file:${ctx.fileKey}` : `garden-group:${crypto.randomUUID()}`,
        file: ctx.fileOrigin,
        heads,
      };
      ctx.rebind(binding);
      await ctx.bind(binding);
      if (!(await ctx.save())) deviceSaveFailed = true;
    } catch (error) {
      if (error instanceof GardenChapterUnavailable) continue;
      // A thrown save is a device failure, which the app reports itself.
      if (stage === 'device') deviceSaveFailed = true;
      else failures[stage].push(id);
    }
  }
  return { notice: noticeFor(failures), deviceSaveFailed };
}

/** What the app supplies to one daily checkpoint. */
export interface CheckpointHost {
  /** Holds the clock and returns this checkpoint's identity, or nothing when none may start. */
  begin(): { current(): boolean; end(): void } | undefined;
  /** Waits for the shared shelf to be ready and enabled. */
  ready(): Promise<void>;
  context(current: () => boolean): ClosingContext;
  /** Shows a notice now, whether or not the clock is running. */
  publish(notice: string): void;
}

/** Runs one checkpoint and shows its result once, only while it still describes the open game. */
export async function runCheckpoint(host: CheckpointHost): Promise<void> {
  const start = host.begin();
  if (!start) return;
  try {
    await host.ready();
    if (!start.current()) return;
    const result = await closeChapters(host.context(start.current));
    // The device save reports its own failure. Nothing here may replace that notice.
    if (result.notice && !result.deviceSaveFailed && start.current()) host.publish(result.notice);
  } finally {
    start.end();
  }
}
