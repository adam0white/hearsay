import { replay } from '@adam0white/human-framework';
import { canonicalPersona } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { advanceGarden, chooseGarden, freshGarden } from '../src/sim/garden4.ts';
import { exportGarden, importGarden } from '../src/sim/garden4-export.ts';
import { hash } from '../src/sim/hash.ts';

it('replays a JSON export after automatic testimony without losing fingerprint fidelity', () => {
  const garden = freshGarden(17);
  expect(chooseGarden(garden, { type: 'listen', person: 'riza', approach: 'invite' })).toBe(true);
  advanceGarden(garden, 450);
  expect(garden.routes.some((route) => route.parent === undefined)).toBe(true);
  const exported = exportGarden(garden);
  if (!exported.state.engine) throw new Error('Missing engine archive');
  const archive = exported.state.engine.archive;
  const proof = replay(archive);
  expect(proof.ok && proof.value.verified && proof.value.fullHash === archive.hashes.full).toBe(true);
  const text = JSON.stringify(exported);
  const parsed = JSON.parse(text);
  expect(hash(canonicalPersona(parsed.state)).toString(16)).toBe(exported.fingerprint);
  expect(JSON.stringify(exportGarden(importGarden(text)))).toBe(text);
});

it('keeps actual parent and root references when a claim is relayed', () => {
  const garden = freshGarden(17);
  expect(chooseGarden(garden, { type: 'listen', person: 'riza', approach: 'invite' })).toBe(true);
  advanceGarden(garden, 2478);
  const relayed = garden.routes.find((route) => route.parent !== undefined);
  expect(relayed).toBeDefined();
  const parent = garden.routes.find((route) => route.id === relayed?.parent);
  expect(parent).toBeDefined();
  expect(relayed?.root).toBe(parent?.root ?? parent?.id);
  expect(relayed?.prop).toBe(parent?.prop);
  expect(relayed?.value).toBe(parent?.value);
});
