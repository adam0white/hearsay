import type { State } from '../sim/types';
import { PEOPLE, PLACES } from '../sim/world';
import { personLabel } from './people';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface MapPerson extends Rect {
  id: string;
  location: string;
  selected?: boolean;
}
interface Witness {
  id: number;
  at: number;
  a: { x: number; y: number };
  b: { x: number; y: number };
}
const layouts = new WeakMap<HTMLCanvasElement, { people: MapPerson[]; state: State; signature: string }>();
// A main-panel render replaces its canvas. Keep observed talk with the run instead.
const witnessHistory = new WeakMap<State, { witnesses: Witness[]; seed: number; minute: number }>();
const overlaps = (a: Rect, b: Rect, gap = 2) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y;
const hash = (text: string) => {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
};

/** Coordinates are CSS pixels, matching pointer events even on Retina displays. */
export function mapPersonAt(canvas: HTMLCanvasElement, clientX: number, clientY: number): string | undefined {
  const bounds = canvas.getBoundingClientRect();
  const x = ((clientX - bounds.left) * canvas.clientWidth) / bounds.width;
  const y = ((clientY - bounds.top) * canvas.clientHeight) / bounds.height;
  return layouts
    .get(canvas)
    ?.people.filter((p) => p.id !== 'hatice' && ['garden', 'fountain'].includes(p.location))
    .map((p) => ({ id: p.id, distance: Math.hypot(x - p.x - p.width / 2, y - p.y - p.height / 2) }))
    .filter((p) => p.distance <= 12)
    .sort((a, b) => a.distance - b.distance)[0]?.id;
}
function closeUp(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  state: State,
  signature: string,
  selectedId?: string,
): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const nearby = PEOPLE.filter(
    (p) => p.id !== 'hatice' && ['garden', 'fountain'].includes(state.locations[p.id] ?? ''),
  );
  const selected = nearby.find((p) => p.id === selectedId);
  const hatice = PEOPLE.find((p) => p.id === 'hatice');
  if (!hatice) return;
  const shown = [hatice, ...(selected ? [selected] : nearby.slice(0, 3))];
  const people: MapPerson[] = [];
  const labels: (Rect & { id: string; text: string })[] = [];
  const benches: Rect[] = [];
  ctx.font = '13px Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const title = 'Tea garden';
  const titleWidth = ctx.measureText(title).width + 8;
  labels.push({ id: 'garden', text: title, x: 4, y: 1, width: titleWidth, height: 16 });
  ctx.fillStyle = '#364b45';
  ctx.fillText(title, titleWidth / 2 + 4, 9);
  const y = height < 90 ? 27 : height * 0.52;
  for (const [i, person] of shown.entries()) {
    const x = (width / shown.length) * (i + 0.5);
    const isSelected = person.id === selectedId;
    const box = {
      id: person.id,
      location: state.locations[person.id] ?? 'garden',
      x: x - 8,
      y: y - 9,
      width: 16,
      height: 20,
      selected: isSelected,
    };
    people.push(box);
    benches.push({ x: x - 23, y: y + 8, width: 46, height: 5 });
    ctx.strokeStyle = '#76684d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 23, y + 10);
    ctx.lineTo(x + 23, y + 10);
    ctx.stroke();
    if (isSelected) {
      ctx.strokeStyle = '#244f50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, 14, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = person.id === 'hatice' ? '#a45f4b' : '#335f60';
    ctx.beginPath();
    ctx.arc(x, y - 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 4, y - 1, 8, 10);
    const labelWidth = Math.ceil(ctx.measureText(person.name).width) + 6;
    const labelY = Math.min(height - 17, y + 15);
    labels.push({
      id: person.id,
      text: person.name,
      x: x - labelWidth / 2,
      y: labelY,
      width: labelWidth,
      height: 16,
    });
    ctx.fillStyle = '#364b45';
    ctx.fillText(person.name, x, labelY + 8);
  }
  canvas.setAttribute(
    'aria-label',
    `Tea garden. ${selected ? `Selected: ${personLabel(selected.id)}.` : `Nearby: ${shown.map((p) => p.name).join(', ')}.`}`,
  );
  layouts.set(canvas, { people, state, signature });
  canvas.dataset.mapLayout = JSON.stringify({
    mode: 'close-up',
    selectedId,
    labels,
    people,
    benches,
    witnessed: [],
  });
}

export function drawMap(
  canvas: HTMLCanvasElement,
  state: State,
  _elapsed: number,
  selectedId?: string,
): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.dataset.camera = height < 180 ? 'table' : 'village';
  const ratio = window.devicePixelRatio || 1;
  const signature = JSON.stringify([
    width,
    height,
    ratio,
    selectedId,
    state.seed,
    state.minute,
    state.garden,
    state.locations,
    state.custom,
    state.routes.length,
    state.log.length,
  ]);
  const cached = layouts.get(canvas);
  if (cached?.state === state && cached.signature === signature) return;
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#e5e8d7';
  ctx.fillRect(0, 0, width, height);
  if (height < 180) {
    closeUp(canvas, ctx, state, signature, selectedId);
    return;
  }
  canvas.setAttribute(
    'aria-label',
    `The neighbourhood.${selectedId ? ` Selected: ${personLabel(selectedId)}.` : ' People near the tea garden or fountain can be called over.'}`,
  );
  const point = (x: number, y: number) => ({ x: 18 + x * (width - 36), y: 12 + y * (height - 32) });
  ctx.strokeStyle = '#f6f0df';
  ctx.lineWidth = 17;
  ctx.lineCap = 'round';
  for (const y of [0.24, 0.52, 0.81]) {
    ctx.beginPath();
    ctx.moveTo(0, height * y);
    ctx.bezierCurveTo(
      width * 0.3,
      height * (y - 0.19),
      width * 0.65,
      height * (y + 0.18),
      width,
      height * (y - 0.12),
    );
    ctx.stroke();
  }
  const homes = Array.from({ length: 12 }, (_, i) => ({
    id: `home-${i}`,
    name: '',
    x: 0.09 + (i % 4) * 0.27,
    y: 0.12 + Math.floor(i / 4) * 0.3,
  }));
  const places = [...PLACES, ...homes];
  for (const place of places) {
    const p = point(place.x, place.y);
    if (place.id === 'fountain' || place.id === 'garden') {
      ctx.fillStyle = place.id === 'fountain' ? '#7daba9' : '#8b9c70';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      if (place.id === 'fountain') {
        ctx.strokeStyle = '#eaf6ef';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#d9c4a4';
      ctx.fillRect(p.x - 11, p.y - 6, 22, 17);
      ctx.fillStyle = '#b46a51';
      ctx.beginPath();
      ctx.moveTo(p.x - 15, p.y - 5);
      ctx.lineTo(p.x, p.y - 15);
      ctx.lineTo(p.x + 15, p.y - 5);
      ctx.fill();
      ctx.fillStyle = '#576a60';
      ctx.fillRect(p.x - 2, p.y + 2, 5, 9);
    }
  }
  // Reserve readable labels first. People use the remaining space around each place.
  const labels: (Rect & { id: string; text: string })[] = [];
  ctx.font = '9px Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const names: Record<string, string> = {
    garden: 'Tea garden',
    fountain: 'Fountain',
    bakery: 'Bakery',
    grocer: 'Grocer',
    courtyard: 'Courtyard',
    coffee: 'Coffee house',
    tailor: 'Tailor',
    barber: 'Barber',
    doorsteps: 'Doorsteps',
  };
  for (const place of PLACES) {
    const p = point(place.x, place.y);
    const text = names[place.id] ?? place.name;
    const w = Math.ceil(ctx.measureText(text).width) + 6;
    const preferredY = place.id === 'garden' ? 40 : -22;
    const candidates = [preferredY, -22, 25, 40, -36, 52].flatMap((dy) =>
      [0, -22, 22, -44, 44].map((dx) => ({
        x: Math.max(3, Math.min(width - w - 3, p.x + dx - w / 2)),
        y: Math.max(7, Math.min(height - 28, p.y + dy - 6)),
        width: w,
        height: 12,
      })),
    );
    const box =
      candidates.find((candidate) => !labels.some((label) => overlaps(candidate, label, 3))) ?? candidates[0];
    if (!box) continue;
    labels.push({ ...box, id: place.id, text });
    ctx.fillStyle = '#e5e8d7';
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = '#364b45';
    ctx.fillText(text, box.x + box.width / 2, box.y + box.height / 2);
  }
  const benches: Rect[] = [];
  const garden = PLACES.find((p) => p.id === 'garden');
  if (garden) {
    const p = point(garden.x, garden.y);
    const occupied = { empty: 0, quiet: 1, lively: 3, full: 4 }[state.garden];
    for (let i = 0; i < 4; i++) {
      const x = p.x - 21 + (i % 2) * 28,
        y = p.y + 10 + Math.floor(i / 2) * 10;
      benches.push({ x: x - 1, y: y - 8, width: 16, height: 10 });
      ctx.strokeStyle = '#76684d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14, y);
      ctx.stroke();
      if (i < occupied) {
        ctx.fillStyle = '#a46550';
        ctx.beginPath();
        ctx.arc(x + 7, y - 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  for (const id of ['kemal', 'riza']) {
    if ((state.custom[id] ?? 1) >= 0.8) continue;
    const shop = PLACES.find((p) => p.id === (id === 'kemal' ? 'grocer' : 'bakery'));
    if (shop) {
      const p = point(shop.x, shop.y);
      ctx.fillStyle = '#665f4a';
      ctx.fillRect(p.x - 8, p.y, 16, 8);
    }
  }
  const people: MapPerson[] = [];
  // A fixed grid guarantees that neighbours never cover labels or each other.
  // Rank slots by distance to a seeded offset at each person's place.
  const slots: { x: number; y: number }[] = [];
  for (let y = 14; y < height - 25; y += 12) {
    for (let x = 9; x < width - 8; x += 11) slots.push({ x, y });
  }
  for (const [id, location] of Object.entries(state.locations).sort(([a], [b]) => a.localeCompare(b))) {
    if (id === 'hatice') continue;
    const place = places.find((p) => p.id === location);
    if (!place) continue;
    const target = point(place.x, place.y);
    const phase = (hash(`${state.seed}:${id}`) / 0xffffffff) * Math.PI * 2;
    target.x += Math.cos(phase) * 15;
    target.y += Math.sin(phase) * 12;
    const available = slots.filter((slot) => {
      const box = { x: slot.x - 4, y: slot.y - 5, width: 8, height: 11 };
      return ![...labels, ...benches, ...people].some((other) => overlaps(box, other, 1));
    });
    available.sort(
      (a, b) => (a.x - target.x) ** 2 + (a.y - target.y) ** 2 - (b.x - target.x) ** 2 - (b.y - target.y) ** 2,
    );
    const p = available[0];
    if (p)
      people.push({
        id,
        location,
        x: p.x - 4,
        y: p.y - 5,
        width: 8,
        height: 11,
        selected: id === selectedId,
      });
  }
  const previous = witnessHistory.get(state);
  const witnesses =
    previous && previous.seed === state.seed && previous.minute <= state.minute
      ? previous.witnesses.filter((w) => state.minute - w.at < 15)
      : [];
  // Capture only a conversation witnessed now. Never infer old locations from routes.
  for (let i = state.routes.length - 1; i >= 0; i--) {
    const route = state.routes[i];
    if (!route || route.at < state.minute) break;
    if (route.at !== state.minute || witnesses.some((w) => w.id === route.id)) continue;
    if (
      !state.log.some(
        (line) =>
          line.at === route.at &&
          line.speaker === route.from &&
          line.target === route.target &&
          line.kind === 'conversation',
      )
    )
      continue;
    const a = people.find((p) => p.id === route.from);
    const b = people.find((p) => p.id === route.to);
    if (!a || !b || a.location !== b.location || !['garden', 'fountain'].includes(a.location)) continue;
    witnesses.push({
      id: route.id,
      at: route.at,
      a: { x: a.x + 4, y: a.y + 5 },
      b: { x: b.x + 4, y: b.y + 5 },
    });
  }
  const fadedWitnesses = witnesses.map((witness) => ({
    ...witness,
    alpha: 0.65 * (1 - (state.minute - witness.at) / 15),
  }));
  ctx.lineWidth = 0.7;
  for (const witness of fadedWitnesses) {
    ctx.strokeStyle = `rgba(156, 111, 79, ${witness.alpha})`;
    ctx.beginPath();
    ctx.moveTo(witness.a.x, witness.a.y);
    ctx.lineTo(witness.b.x, witness.b.y);
    ctx.stroke();
  }
  for (const p of people) {
    if (p.selected) {
      ctx.strokeStyle = '#244f50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x + 4, p.y + 5, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = ['#335f60', '#a45f4b', '#6e7551', '#9a854f'][hash(p.id) % 4] ?? '#335f60';
    ctx.beginPath();
    ctx.arc(p.x + 4, p.y + 2.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x + 2, p.y + 5, 4, 6);
  }
  layouts.set(canvas, { people, state, signature });
  witnessHistory.set(state, { witnesses, seed: state.seed, minute: state.minute });
  // Browser checks can inspect the exact CSS-pixel bounds used by the drawing.
  const debug = JSON.stringify({
    mode: 'village',
    selectedId,
    labels,
    people,
    benches,
    witnessed: fadedWitnesses,
  });
  if (canvas.dataset.mapLayout !== debug) canvas.dataset.mapLayout = debug;
}
