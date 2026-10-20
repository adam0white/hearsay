import type { State } from '../sim/types';
import { PLACES } from '../sim/world';

const positions = new Map<string, { x: number; y: number }>();
export function drawMap(canvas: HTMLCanvasElement, state: State, elapsed: number): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;
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
    if (!place.id.startsWith('home')) {
      ctx.font = '8px Georgia';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#364b45';
      const labels: Record<string, [string, number, number]> = {
        garden: ['Tea garden', 0, 39],
        fountain: ['Fountain', 20, -12],
        bakery: ['Bakery', 8, 25],
        grocer: ['Grocer', -8, 25],
        courtyard: ['Courtyard', 0, -19],
        coffee: ['Coffee house', 0, -18],
        tailor: ['Tailor', 0, -18],
        barber: ['Barber', 14, 25],
        doorsteps: ['Doorsteps', -10, 24],
      };
      const label = labels[place.id] ?? [place.name, 0, 24];
      ctx.fillText(label[0], p.x + label[1], p.y + label[2]);
    }
  }
  const garden = PLACES.find((p) => p.id === 'garden');
  if (garden) {
    const p = point(garden.x, garden.y);
    const occupied = { empty: 0, quiet: 1, lively: 3, full: 4 }[state.garden];
    for (let i = 0; i < 4; i++) {
      const x = p.x - 21 + (i % 2) * 28,
        y = p.y + 10 + Math.floor(i / 2) * 10;
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
  for (const [id, location] of Object.entries(state.locations)) {
    if (id === 'hatice') continue;
    const place = places.find((p) => p.id === location);
    if (!place) continue;
    const n = Object.keys(state.locations).indexOf(id);
    const target = point(place.x, place.y);
    target.x += Math.sin(n * 2.4) * 14;
    target.y += Math.cos(n * 2.4) * 10;
    const previous = positions.get(id) ?? target;
    const f = Math.min(1, elapsed / 180);
    const p = { x: previous.x + (target.x - previous.x) * f, y: previous.y + (target.y - previous.y) * f };
    positions.set(id, p);
    ctx.fillStyle = ['#335f60', '#a45f4b', '#6e7551', '#9a854f'][n % 4] ?? '#335f60';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 2, p.y, 4, 6);
  }
  const visible = state.routes.filter(
    (r) =>
      r.at >= state.minute - 15 &&
      state.log.some((l) => l.at === r.at && l.speaker === r.from && l.kind === 'conversation') &&
      ['garden', 'fountain'].includes(state.locations[r.from] ?? '') &&
      ['garden', 'fountain'].includes(state.locations[r.to] ?? ''),
  );
  ctx.strokeStyle = '#b38365';
  ctx.lineWidth = 0.7;
  for (const route of visible) {
    const a = positions.get(route.from),
      b = positions.get(route.to);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}
