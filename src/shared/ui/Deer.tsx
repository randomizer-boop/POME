import { memo, type CSSProperties } from 'react';

// POME mascot — a noble deer (maral): wealth, dignity, calm. Drawn in the same folk-painting
// palette as the pomegranate tree (warm browns, cream spots, one pomegranate-red accent).
// Pure SVG, no assets. `pose`: 'stand' (full figure, profile), 'front' (facing us), 'head' (small profile badge).

const C = {
  body: '#A7744F',
  back: '#8C5E3F',
  belly: '#E3C7A4',
  leg: '#7E5439',
  hoof: '#3F2C22',
  antler: '#6E5242',
  spot: '#F6EAD8',
  eye: '#2E211A',
  accent: '#B23B37',
};

function Antlers() {
  return (
    <g stroke={C.antler} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* far antler */}
      <g strokeWidth={3} opacity={0.75}>
        <path d="M70 50 C76 36 86 26 100 20" />
        <path d="M80 36 C88 34 94 28 96 20" />
        <path d="M90 26 C96 20 104 16 110 16" />
      </g>
      {/* near antler */}
      <g strokeWidth={3.6}>
        <path d="M62 50 C56 36 60 20 72 8" />
        <path d="M60 38 C52 34 46 28 44 18" />
        <path d="M62 26 C68 22 74 20 80 20" />
        <path d="M67 15 C66 9 67 5 70 2" />
      </g>
    </g>
  );
}

function Head() {
  return (
    <g>
      {/* ear */}
      <path d="M70 58 C78 50 88 48 93 50 C89 57 80 63 73 65 Z" fill={C.back} />
      <path d="M74 59 C80 54 86 52 89 53 C86 57 80 61 76 62 Z" fill={C.belly} opacity={0.6} />
      {/* head */}
      <path d="M60 54 C69 50 78 55 78 65 C78 72 73 76 67 77 L42 82 C35 83 31 80 32 75 C33 71 37 69 43 67 C49 63 53 57 60 54 Z" fill={C.body} />
      <path d="M40 80 C46 79 56 77 66 76 C60 80 50 82 42 82 Z" fill={C.belly} opacity={0.8} />
      <circle cx="33.5" cy="75.5" r="2.4" fill={C.eye} />
      <ellipse cx="58.5" cy="64" rx="2.4" ry="2.2" fill={C.eye} />
      <circle cx="59.3" cy="63.2" r="0.7" fill="#fff" opacity={0.8} />
    </g>
  );
}

function Standing() {
  return (
    <g>
      {/* legs behind */}
      <g fill={C.leg} opacity={0.8}>
        <path d="M78 140 C80 158 81 172 81 186 L81 204 L86 204 L86 186 C87 170 90 156 92 142 Z" />
        <path d="M138 132 C152 142 156 156 148 170 C146 176 145 182 146 190 L146 204 L151 204 L151 190 C151 182 154 176 156 168 C162 152 160 138 150 130 Z" />
      </g>
      {/* tail */}
      <path d="M168 106 C177 103 182 110 177 118 C173 116 170 112 168 106 Z" fill={C.belly} />
      {/* neck */}
      <path d="M58 128 C52 110 54 90 60 72 L78 70 C78 90 84 106 92 118 Z" fill={C.body} />
      <path d="M60 126 C56 112 57 96 62 84 C64 100 68 114 74 124 Z" fill={C.belly} opacity={0.7} />
      {/* body */}
      <path d="M60 128 C58 108 78 98 100 100 C122 102 140 96 158 100 C173 104 177 121 171 135 C166 147 150 151 132 149 C112 147 92 151 78 147 C66 143 61 137 60 128 Z" fill={C.body} />
      {/* darker back, lighter belly */}
      <path d="M78 104 C96 99 120 103 138 99 C150 97 162 99 168 106 C156 104 140 106 124 108 C106 110 90 108 78 104 Z" fill={C.back} opacity={0.7} />
      <path d="M80 144 C96 147 116 144 132 146 C146 147 158 144 166 139 C158 149 142 152 128 151 C110 150 92 152 80 144 Z" fill={C.belly} opacity={0.85} />
      {/* spots */}
      <g fill={C.spot} opacity={0.9}>
        {[[98, 112], [110, 116], [122, 110], [134, 114], [146, 110], [116, 124], [130, 126], [104, 124], [156, 118]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.6 : 2.1} />
        ))}
      </g>
      {/* legs in front */}
      <g fill={C.leg}>
        <path d="M64 136 C66 156 68 172 69 186 L69 204 L75 204 L75 186 C76 170 80 154 82 138 Z" />
        <path d="M150 128 C166 138 170 154 160 170 C158 176 156 182 157 190 L157 204 L163 204 L163 190 C163 182 166 176 168 168 C176 150 172 132 160 124 Z" />
      </g>
      {/* haunch */}
      <path d="M142 116 C160 112 174 124 170 140 C166 150 156 152 150 146 C154 136 150 124 142 116 Z" fill={C.back} opacity={0.35} />
      <g fill={C.hoof}>
        <rect x="68.5" y="202" width="7" height="4.5" rx="1.5" />
        <rect x="80.5" y="202" width="6" height="4.5" rx="1.5" opacity={0.85} />
        <rect x="145.5" y="202" width="6" height="4.5" rx="1.5" opacity={0.85} />
        <rect x="156.5" y="202" width="7" height="4.5" rx="1.5" />
      </g>
      {/* folk accent: a tiny pomegranate-red collar bead */}
      <circle cx="66" cy="96" r="3" fill={C.accent} />
      <path d="M58 92 C64 96 70 98 78 96" stroke={C.accent} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.8} />
      <Head />
      <Antlers />
    </g>
  );
}

/** Facing us: head, antlers, neck and chest — for headers and empty states */
function Front() {
  const half = (
    <g>
      {/* antler */}
      <g stroke={C.antler} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth={3.4}>
        <path d="M52 34 C46 24 42 14 44 3" />
        <path d="M46 24 C39 22 33 17 31 9" />
        <path d="M44 14 C39 11 37 7 37 3" />
        <path d="M49 29 C43 30 37 29 32 25" strokeWidth={2.6} />
      </g>
      {/* ear */}
      <path d="M48 44 C38 36 24 34 16 38 C22 47 36 51 47 49 Z" fill={C.back} />
      <path d="M44 45 C36 40 27 39 21 40 C26 45 35 47 43 47 Z" fill={C.belly} opacity={0.65} />
      {/* eye */}
      <ellipse cx="50.5" cy="57" rx="3.2" ry="3.6" fill={C.eye} />
      <circle cx="51.6" cy="55.8" r="1" fill="#fff" opacity={0.85} />
    </g>
  );
  return (
    <g>
      {/* neck + chest */}
      <path d="M46 78 C45 92 41 102 32 112 C25 119 20 127 19 134 L101 134 C100 127 95 119 88 112 C79 102 75 92 74 78 Z" fill={C.body} />
      <path d="M50 100 C55 108 65 108 70 100 C73 113 68 126 60 133 C52 126 47 113 50 100 Z" fill={C.belly} opacity={0.9} />
      <g fill={C.spot} opacity={0.85}>
        <circle cx="36" cy="120" r="2.2" /><circle cx="43" cy="113" r="1.8" /><circle cx="30" cy="129" r="1.8" />
        <circle cx="84" cy="120" r="2.2" /><circle cx="77" cy="113" r="1.8" /><circle cx="90" cy="129" r="1.8" />
      </g>
      {/* collar with a pomegranate-red bead */}
      <path d="M46 100 C52 107 68 107 74 100" stroke={C.accent} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.85} />
      <circle cx="60" cy="106" r="3.2" fill={C.accent} />
      {/* head */}
      <path d="M60 30 C74 30 81 42 79 56 C77 70 71 84 65 92 C63 95.5 57 95.5 55 92 C49 84 43 70 41 56 C39 42 46 30 60 30 Z" fill={C.body} />
      <path d="M60 33 C64 42 64 58 60 72 C56 58 56 42 60 33 Z" fill={C.back} opacity={0.35} />
      <ellipse cx="60" cy="86" rx="9" ry="8" fill={C.belly} />
      <ellipse cx="60" cy="89.5" rx="5.2" ry="3.6" fill={C.eye} />
      {half}
      <g transform="translate(120 0) scale(-1 1)">{half}</g>
    </g>
  );
}

export const Deer = memo(function Deer({ size = 120, pose = 'stand', flip = false, style, className, title }: {
  size?: number; pose?: 'stand' | 'head' | 'front'; flip?: boolean; style?: CSSProperties; className?: string; title?: string;
}) {
  const vb = pose === 'front' ? '12 0 96 135' : pose === 'head' ? '26 0 90 96' : '26 0 160 208';
  const [, , w, h] = vb.split(' ').map(Number);
  return (
    <svg
      viewBox={vb} width={(size * w) / h} height={size} className={className}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      style={{ display: 'block', transform: flip ? 'scaleX(-1)' : undefined, overflow: 'visible', ...style }}
    >
      {pose === 'front' ? <Front /> : pose === 'head' ? (
        <g>
          <path d="M60 70 L78 68 C78 78 80 86 84 92 C74 95 64 95 56 93 C56 84 57 76 60 70 Z" fill={C.body} />
          <path d="M60 76 C62 84 64 90 66 93 C62 94 58 94 56 93 C56 86 58 80 60 76 Z" fill={C.belly} opacity={0.7} />
          <circle cx="66" cy="90" r="2.6" fill={C.accent} />
          <Head />
          <Antlers />
        </g>
      ) : <Standing />}
    </svg>
  );
});
