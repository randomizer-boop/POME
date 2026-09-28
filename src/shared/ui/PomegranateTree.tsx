import { memo, type CSSProperties } from 'react';

// Decorative pomegranate "tree of life" for the page background (brand motif),
// in a folk-painting style: twisted double trunk, a rounded crown of many
// narrow olive leaves, red fruits, grass and fallen fruit on the ground.
// Generated once at module load with a seeded random, so it is identical on
// every render and needs no image assets. The whole tree sways slightly —
// animated on the <svg> element so the browser can composite it cheaply
// (disabled for reduced motion via .tree-sway in index.css).

type Seg = { x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; w: number; depth: number };
type Leaf = { x: number; y: number; rot: number; s: number; c: number };
type Fruit = { x: number; y: number; r: number; dark: boolean; open?: boolean; rot?: number };
type Flower = { x: number; y: number; r: number; rot: number };

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
const rand = rng(7);
const rad = (deg: number) => (deg * Math.PI) / 180;

// defined before grow() runs — it is used while generating
const LEAF_COLORS = ['#7D8B55', '#98A36A', '#5F6E40', '#A9B27C', '#6B7A48', '#B9C28A', '#55643A'];

const MAX_DEPTH = 6;
const SEGMENTS: Seg[] = [];
const LEAVES: Leaf[] = [];
const FRUITS: Fruit[] = [];
const FLOWERS: Flower[] = [];

// Crown is kept roughly round, like in the paintings
const CROWN = { cx: 230, cy: 205, rx: 196, ry: 178 };
const insideCrown = (x: number, y: number) =>
  ((x - CROWN.cx) / CROWN.rx) ** 2 + ((y - CROWN.cy) / CROWN.ry) ** 2 <= 1;

function grow(x: number, y: number, angle: number, len: number, w: number, depth: number) {
  angle = Math.max(-172, Math.min(-8, angle)); // branches always reach upward/outward
  let x2 = x + Math.cos(rad(angle)) * len;
  let y2 = y + Math.sin(rad(angle)) * len;
  // prune at the crown edge so the silhouette stays round
  const outside = depth > 1 && !insideCrown(x2, y2);
  if (outside) {
    for (let k = 0; k < 8 && !insideCrown(x2, y2); k++) { x2 = (x + x2) / 2 + (x2 - x) * 0.25; y2 = (y + y2) / 2 + (y2 - y) * 0.25; }
  }
  const bend = (rand() - 0.5) * len * 0.35;
  const cx = (x + x2) / 2 + Math.cos(rad(angle + 90)) * bend;
  const cy = (y + y2) / 2 + Math.sin(rad(angle + 90)) * bend;
  SEGMENTS.push({ x1: x, y1: y, cx, cy, x2, y2, w, depth });

  // leaves along the outer branches
  if (depth >= 3) {
    const steps = Math.max(1, Math.floor(len / 5.5));
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      const u = 1 - t;
      const px = u * u * x + 2 * u * t * cx + t * t * x2;
      const py = u * u * y + 2 * u * t * cy + t * t * y2;
      if (!insideCrown(px, py)) continue;
      for (const side of [-1, 1]) {
        if (rand() < 0.12) continue;
        LEAVES.push({ x: px, y: py, rot: angle + side * (35 + rand() * 30), s: 0.55 + rand() * 0.42, c: Math.floor(rand() * LEAF_COLORS.length) });
      }
    }
  }

  if (depth >= MAX_DEPTH || outside) {
    // tip: a small fan of leaves, sometimes a fruit
    for (let k = -1; k <= 1; k++) LEAVES.push({ x: x2, y: y2, rot: angle + k * 22, s: 0.7 + rand() * 0.3, c: Math.floor(rand() * LEAF_COLORS.length) });
    const spaced = FRUITS.every(f => Math.hypot(f.x - x2, f.y - y2) > 26);
    if (spaced && rand() < 0.45 && insideCrown(x2, y2 + 14)) {
      FRUITS.push({ x: x2, y: y2 + 10, r: 7 + rand() * 3.5, dark: rand() < 0.4, open: rand() < 0.2 });
    } else if (rand() < 0.16 && FLOWERS.every(f => Math.hypot(f.x - x2, f.y - y2) > 30)) {
      FLOWERS.push({ x: x2, y: y2, r: 4.5 + rand() * 1.5, rot: angle + 90 });
    }
    return;
  }

  const kids = depth < 3 ? 3 : rand() < 0.3 ? 3 : 2;
  const spread = depth < 2 ? 30 : 22 + rand() * 10;
  for (let k = 0; k < kids; k++) {
    const offset = kids === 3 ? (k - 1) * spread : (k === 0 ? -1 : 1) * spread * 0.75;
    grow(x2, y2, angle + offset + (rand() - 0.5) * 12, len * (0.8 + rand() * 0.08), Math.max(1.1, w * 0.68), depth + 1);
  }
}

// two main limbs out of the twisted trunk
grow(224, 366, -118, 84, 13, 1);
grow(234, 366, -62, 84, 13, 1);
grow(229, 360, -90, 80, 11, 1);

// Branch tips sit on the outside of the crown, so the middle had no fruit.
// Fill it from leaf positions inside the crown (own random stream → tree shape unchanged).
{
  const fRand = rng(41);
  const inner = LEAVES.filter(l => ((l.x - CROWN.cx) / (CROWN.rx * 0.78)) ** 2 + ((l.y - CROWN.cy) / (CROWN.ry * 0.78)) ** 2 <= 1);
  for (let tries = 0, added = 0; tries < 400 && added < 22; tries++) {
    const l = inner[Math.floor(fRand() * inner.length)];
    if (!l || FRUITS.some(f => Math.hypot(f.x - l.x, f.y - l.y) < 26)) continue;
    FRUITS.push({ x: l.x, y: l.y, r: 6.5 + fRand() * 3.5, dark: fRand() < 0.4, open: fRand() < 0.18 });
    added++;
  }
  // every fruit hangs at its own angle: most point down-ish, some sideways, a few upwards
  for (const f of FRUITS) {
    const u = fRand();
    f.rot = u < 0.55 ? (fRand() - 0.5) * 70 : u < 0.85 ? (fRand() < 0.5 ? -1 : 1) * (60 + fRand() * 50) : 150 + fRand() * 60;
  }
}

const LEAF = 'M0 0 C4 -3 10 -3 15 0 C10 3 4 3 0 0 Z';

// What makes it read as a pomegranate, not an apple:
//  · a big flared crown (calyx) — on a hanging fruit it points down
//  · a slightly lumpy, faceted body with faint ridges
//  · some fruits split open, showing ruby seeds (arils)
const f1 = (n: number) => n.toFixed(1);

function Crown({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  // neck + 6 flaring sepals, drawn pointing down from the bottom of the fruit
  const top = y + r * 0.75, base = y + r * 1.02, tip = y + r * 1.72;
  const pts = [
    [-0.36, top], [-0.32, base], [-0.78, tip - r * 0.12], [-0.22, base + r * 0.2], [-0.24, tip],
    [0, base + r * 0.26], [0.24, tip], [0.22, base + r * 0.2], [0.78, tip - r * 0.12], [0.32, base], [0.36, top],
  ].map(([dx, yy]) => `${f1(x + dx * r)} ${f1(yy)}`);
  return (
    <g>
      <path d={`M${pts.join(' L')} Z`} fill={fill} strokeLinejoin="round" />
      <ellipse cx={x} cy={base + r * 0.06} rx={r * 0.16} ry={r * 0.08} fill="#3E1113" opacity={0.7} />
    </g>
  );
}

function FruitShape({ x, y, r, dark, open, rot }: Fruit) {
  const body = dark ? '#8E2A2D' : '#B23B37';
  const crown = dark ? '#6A1D20' : '#7F2628';
  // slightly faceted outline (8 soft corners) instead of a perfect circle
  const outline = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 ? 0.97 : 1.04;
    return [x + Math.cos(a) * r * k * 1.03, y + Math.sin(a) * r * k * 0.97];
  });
  const d = outline.map(([px, py], i) => {
    const [nx, ny] = outline[(i + 1) % 8];
    return `${i === 0 ? `M${f1((px + nx) / 2)} ${f1((py + ny) / 2)}` : ''} Q${f1(nx)} ${f1(ny)} ${f1((nx + outline[(i + 2) % 8][0]) / 2)} ${f1((ny + outline[(i + 2) % 8][1]) / 2)}`;
  }).join(' ') + ' Z';
  const tilt = rot ?? Math.sin(x * 0.7) * 14;

  return (
    <g transform={`rotate(${tilt.toFixed(0)} ${f1(x)} ${f1(y)})`}>
      {/* stem to the branch */}
      <path d={`M${f1(x)} ${f1(y - r * 0.9)} q${f1(r * 0.1)} ${f1(-r * 0.35)} ${f1(-r * 0.05)} ${f1(-r * 0.6)}`} stroke="#5E4535" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Crown x={x} y={y} r={r} fill={crown} />
      <path d={d} fill={body} />
      {/* faint ridges */}
      <path d={`M${f1(x - r * 0.45)} ${f1(y - r * 0.8)} Q${f1(x - r * 0.7)} ${f1(y)} ${f1(x - r * 0.3)} ${f1(y + r * 0.82)} M${f1(x + r * 0.45)} ${f1(y - r * 0.8)} Q${f1(x + r * 0.7)} ${f1(y)} ${f1(x + r * 0.3)} ${f1(y + r * 0.82)}`}
        stroke="#5A1618" strokeWidth={0.8} fill="none" opacity={0.35} />
      {open ? (
        <g>
          {/* split: pale pith + a cluster of ruby arils */}
          <path d={`M${f1(x - r * 0.05)} ${f1(y - r * 0.75)} C${f1(x + r * 0.85)} ${f1(y - r * 0.5)} ${f1(x + r * 0.85)} ${f1(y + r * 0.5)} ${f1(x - r * 0.05)} ${f1(y + r * 0.72)} C${f1(x + r * 0.2)} ${f1(y + r * 0.25)} ${f1(x + r * 0.2)} ${f1(y - r * 0.25)} ${f1(x - r * 0.05)} ${f1(y - r * 0.75)} Z`} fill="#F3DCC8" />
          {[[0.22, -0.42], [0.42, -0.25], [0.28, -0.1], [0.5, 0.02], [0.3, 0.16], [0.46, 0.3], [0.24, 0.42], [0.58, -0.12], [0.56, 0.2]].map(([dx, dy], i) => (
            <g key={i}>
              <circle cx={f1(x + r * dx)} cy={f1(y + r * dy)} r={f1(r * 0.12)} fill="#C8262E" />
              <circle cx={f1(x + r * dx - r * 0.04)} cy={f1(y + r * dy - r * 0.04)} r={f1(r * 0.035)} fill="#fff" opacity={0.7} />
            </g>
          ))}
        </g>
      ) : (
        <ellipse cx={f1(x - r * 0.38)} cy={f1(y - r * 0.32)} rx={f1(r * 0.2)} ry={f1(r * 0.32)} fill="#E08A7E" opacity={0.5} transform={`rotate(20 ${f1(x - r * 0.38)} ${f1(y - r * 0.32)})`} />
      )}
    </g>
  );
}

function FlowerShape({ x, y, r, rot }: Flower) {
  // pomegranate blossom: fleshy red calyx tube with crinkled orange petals spilling out of it
  const X = (dx: number) => f1(x + dx * r), Y = (dy: number) => f1(y + dy * r);
  return (
    <g transform={`rotate(${rot.toFixed(0)} ${f1(x)} ${f1(y)})`}>
      {[-0.55, 0, 0.55].map((dx, i) => (
        <circle key={i} cx={X(dx)} cy={Y(-1.05 - (i === 1 ? 0.25 : 0))} r={f1(r * 0.62)} fill={i === 1 ? '#EA6A45' : '#DE5A3A'} />
      ))}
      <path d={`M${X(-0.6)} ${Y(-0.75)} L${X(-0.35)} ${Y(0.55)} Q${X(0)} ${Y(0.8)} ${X(0.35)} ${Y(0.55)} L${X(0.6)} ${Y(-0.75)} L${X(0.3)} ${Y(-0.45)} L${X(0)} ${Y(-0.85)} L${X(-0.3)} ${Y(-0.45)} Z`} fill="#A8322F" />
    </g>
  );
}

const FALLEN: [number, number, number, number][] = [
  [120, 553, 20, 5], [150, 556, -35, 0], [268, 555, 60, 3], [300, 552, -10, 5], [345, 556, 40, 0], [88, 556, -60, 3], [380, 554, 15, 5],
];

function Grass({ x, flip = 1, s = 1 }: { x: number; flip?: number; s?: number }) {
  return (
    <path
      d={`M${x} 548 q${3 * flip * s} ${-14 * s} ${1 * flip * s} ${-24 * s} M${x + 4 * s} 548 q${-2 * flip * s} ${-12 * s} ${-7 * flip * s} ${-18 * s} M${x + 8 * s} 548 q${4 * flip * s} ${-10 * s} ${9 * flip * s} ${-15 * s} M${x + 2 * s} 548 q0 ${-18 * s} ${-2 * flip * s} ${-28 * s}`}
      stroke="#6B7A48" strokeWidth="1.6" strokeLinecap="round" fill="none"
    />
  );
}

// Ground that continues beyond the tree (so the picture doesn't look cut off).
// Own random stream → the tree itself stays exactly the same.
const MAX_EXT = 1600;
const gRand = rng(23);
const FAR_GRASS = Array.from({ length: 70 }, () => ({
  side: gRand() < 0.5 ? -1 : 1, d: 60 + gRand() * (MAX_EXT - 60), flip: gRand() < 0.5 ? -1 : 1, s: 0.6 + gRand() * 0.5,
}));
const FAR_LEAVES = Array.from({ length: 24 }, () => ({
  side: gRand() < 0.5 ? -1 : 1, d: 40 + gRand() * (MAX_EXT - 40), y: 551 + gRand() * 6, rot: gRand() * 180 - 90, c: Math.floor(gRand() * LEAF_COLORS.length),
}));
const FAR_STONES = Array.from({ length: 14 }, () => ({
  side: gRand() < 0.5 ? -1 : 1, d: 60 + gRand() * (MAX_EXT - 60), y: 555 + gRand() * 3, r: 2.5 + gRand() * 3,
}));

interface TreeProps {
  style?: CSSProperties;
  className?: string;
  /** How far the ground continues to the left / right of the tree (in drawing units, 460 = tree width).
   *  Default: far to the left, for the tree in the right corner of the app. */
  groundLeft?: number;
  groundRight?: number;
}

// Static artwork: memo so app re-renders (currency, language…) never touch its thousands of nodes
export const PomegranateTree = memo(function PomegranateTree({ style, className, groundLeft = MAX_EXT, groundRight = 0 }: TreeProps) {
  const x0 = -groundLeft, x1 = 460 + groundRight;
  // position of a far element: distance from the tree's edge, only on sides that exist
  const fx = (side: number, d: number) => (side < 0 ? (d <= groundLeft ? -d : null) : (d <= groundRight ? 460 + d : null));
  return (
    <svg className={className} viewBox={`${x0} 0 ${x1 - x0} 580`} aria-hidden="true" focusable="false" style={{ pointerEvents: 'none', width: 'auto', aspectRatio: `${x1 - x0} / 580`, ...style }}>
      <defs>
        <radialGradient id="pome-glow" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#F3E2BF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F3E2BF" stopOpacity="0" />
        </radialGradient>
        {/* ground fades out at the far ends */}
        <linearGradient id="pome-soil" gradientUnits="userSpaceOnUse" x1={x0} x2={x1} y1="0" y2="0">
          <stop offset="0" stopColor="#8A7461" stopOpacity="0" />
          <stop offset={groundLeft ? Math.min(0.45, 320 / (x1 - x0)) : 0} stopColor="#8A7461" stopOpacity="0.35" />
          <stop offset={groundRight ? 1 - Math.min(0.45, 320 / (x1 - x0)) : 1} stopColor="#8A7461" stopOpacity="0.35" />
          <stop offset="1" stopColor="#8A7461" stopOpacity={groundRight ? 0 : 0.35} />
        </linearGradient>
      </defs>

      {/* ground: one long soil line + grass, fallen leaves and pebbles along it */}
      <path d={`M${x0} 553 C${x0 + (x1 - x0) * 0.3} 548 ${x0 + (x1 - x0) * 0.6} 546 ${x1} 551 L${x1} 562 L${x0} 562 Z`} fill="url(#pome-soil)" />
      {FAR_GRASS.map((g, i) => { const x = fx(g.side, g.d); return x === null ? null : <Grass key={i} x={x} flip={g.flip} s={g.s} />; })}
      {FAR_LEAVES.map((l, i) => { const x = fx(l.side, l.d); return x === null ? null : (
        <path key={i} d={LEAF} fill={LEAF_COLORS[l.c]} opacity={0.7} transform={`translate(${x.toFixed(0)} ${l.y.toFixed(1)}) rotate(${l.rot.toFixed(0)}) scale(0.75)`} />
      ); })}
      {FAR_STONES.map((st, i) => { const x = fx(st.side, st.d); return x === null ? null : <ellipse key={i} cx={x} cy={st.y} rx={st.r} ry={st.r * 0.6} fill="#B8A999" />; })}

      <Grass x={150} /><Grass x={172} flip={-1} /><Grass x={290} /><Grass x={312} flip={-1} /><Grass x={96} flip={-1} /><Grass x={360} />
      <Grass x={60} /><Grass x={128} flip={-1} /><Grass x={338} /><Grass x={392} flip={-1} />
      {FALLEN.map(([x, y, rot, c], i) => (
        <path key={i} d={LEAF} fill={LEAF_COLORS[c]} opacity={0.8} transform={`translate(${x} ${y}) rotate(${rot}) scale(0.8)`} />
      ))}
      <ellipse cx="258" cy="556" rx="5" ry="3" fill="#B8A999" /><ellipse cx="110" cy="557" rx="4" ry="2.5" fill="#B8A999" />
      <FruitShape x={196} y={543} r={8} dark={false} open />
      <FruitShape x={212} y={546} r={7} dark />
      <FruitShape x={322} y={544} r={8} dark={false} />

      {/* the tree sways from its roots; the ground stays still */}
      <g className="tree-sway">
      {/* warm parchment glow behind the crown */}
      <ellipse cx="230" cy="250" rx="230" ry="260" fill="url(#pome-glow)" />

      {/* roots */}
      <path d="M212 548 C200 548 186 552 170 556 M246 548 C258 548 272 552 290 556 M222 550 C216 556 210 558 202 560 M240 550 C246 556 252 558 262 560" stroke="#5E4535" strokeWidth="5" strokeLinecap="round" fill="none" />

      {/* twisted double trunk */}
      <path d="M206 550 C200 500 214 470 208 430 C202 396 214 376 222 356 L236 358 C232 380 222 400 226 432 C232 472 220 506 228 550 Z" fill="#5E4535" />
      <path d="M232 550 C240 505 226 470 234 432 C240 398 230 378 226 358 L240 356 C246 378 254 400 250 432 C246 470 258 505 254 550 Z" fill="#6E5242" />
      <path d="M214 520 C222 500 236 488 244 470 M212 470 C222 452 236 440 244 420 M216 420 C224 404 232 392 238 380" stroke="#4A362A" strokeWidth="2" strokeLinecap="round" fill="none" opacity={0.7} />
      <path d="M212 540 C210 528 214 516 212 504 M244 540 C246 526 242 512 246 500 M220 450 C218 440 222 430 220 420 M242 452 C244 442 240 432 243 424 M226 404 L228 392" stroke="#8C6B55" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={0.55} />
      {/* a knot */}
      <ellipse cx="220" cy="486" rx="4" ry="6" fill="#4A362A" opacity={0.6} />

      <g>
        {/* branches first, then leaves over them, fruits on top */}
        {SEGMENTS.map((s, i) => (
          <path key={i} d={`M${s.x1} ${s.y1} Q${s.cx} ${s.cy} ${s.x2} ${s.y2}`} stroke={s.depth <= 2 ? '#5E4535' : '#6E5242'} strokeWidth={s.w} strokeLinecap="round" fill="none" />
        ))}
        {LEAVES.map((l, i) => (
          <path key={i} d={LEAF} fill={LEAF_COLORS[l.c]} transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.rot.toFixed(0)}) scale(${l.s.toFixed(2)})`} />
        ))}
        {FLOWERS.map((f, i) => <FlowerShape key={i} {...f} />)}
        {FRUITS.map((f, i) => <FruitShape key={i} {...f} />)}
      </g>
      </g>
    </svg>
  );
});
