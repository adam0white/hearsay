import { expect, it } from 'vitest';
import { captureGardenSource } from '../src/sim/garden4-continuity.ts';
import { freshEmptyShelfGarden } from './helpers/garden-empty-opening.ts';

it('keeps a living person in their agreed garden visit before its ending', () => {
  const garden = freshEmptyShelfGarden(17);
  expect(() => captureGardenSource(garden, 'riza')).toThrow('agreed ending');
  expect(() => captureGardenSource(garden, 'hatice')).toThrow('duties here');
  expect(() => captureGardenSource(garden, 'derya')).toThrow('relief night');
});
