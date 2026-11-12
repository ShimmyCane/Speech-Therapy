// 2D side-view mouth diagrams, drawn from the same geometry as the 3D model.
import { REST, GROUPS, SOUNDS, groupOf } from './data.js';
import { roofY, floorBase, lowerTeethTop, tongueSpine, sampleSpine, tongueThickness, TEETH_X, UPPER_TEETH_BOTTOM } from './geom.js';

const f = (n) => Math.round(n * 10) / 10;
const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])},${f(p[1])}`).join(' ');

// Where to highlight the contact/gap for each colour group.
function contactPoint(sound, p) {
  const g = sound?.group;
  const spine = tongueSpine(p);
  const tip = spine[spine.length - 1];
  switch (g) {
    case 'lips': return [474 + p.round * 8, 188];
    case 'teethlip': return [458, 192];
    case 'tth': return [tip[0] - 4, tip[1] - 4];
    case 'ridge': return [438, 133];
    case 'hiss': return [440, 140];
    case 'palate': return [385, 104];
    case 'back': return [262, 98];
    case 'throat': return [168, 330];
    default: return null;
  }
}

export function mouthSVG(p = REST, opts = {}) {
  const sound = opts.sound ? SOUNDS[opts.sound] : null;
  const col = sound ? groupOf(sound.id).color : '#5b6b82';
  const tint = sound ? groupOf(sound.id).tint : '#dde4ee';
  const jawDrop = p.jaw * 74;
  const nasal = p.nasal;

  // roof polyline
  const roofPts = [];
  for (let x = 150; x <= TEETH_X; x += 10) roofPts.push([x, roofY(x, nasal)]);
  roofPts.push([TEETH_X, UPPER_TEETH_BOTTOM]);
  const lt = lowerTeethTop(p.jaw);
  const fl = floorBase(p.jaw) + 30;
  const cavity = `${pathOf(roofPts)} L${TEETH_X},${f(lt)} L${TEETH_X - 6},${f(fl)} L150,${f(fl + 30)} L150,160 Z`;

  // tongue
  const spine = sampleSpine(tongueSpine(p), 26);
  const top = spine;
  const bot = spine.map(([x, y], i) => {
    const u = i / (spine.length - 1);
    return [x, Math.min(y + tongueThickness(u), floorBase(p.jaw) + 36)];
  }).reverse();
  const tongue = `${pathOf(top)} L${f(bot[0][0])},${f(bot[0][1])} ${pathOf(bot).replace('M', 'L')} Z`;
  // grooved tongue gets a stripe, sides get small bumps
  const stripe = p.groove > 0.3 ? `<path d="${pathOf(top.slice(12).map(([x, y]) => [x, y + 2]))}" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="1 5"/>` : '';

  // lips
  const r = p.round * 16, sp = p.spread * 8;
  const shut = Math.max(p.lipsShut, p.teethLip);
  const lipY = shut ? UPPER_TEETH_BOTTOM + (p.teethLip ? 6 : 8) : lt + 14;
  const upperLip = `M440,148 Q${f(492 + r)},146 ${f(494 + r)},${f(176 - 0)} Q${f(484 + r)},${f(196 - shut * 2)} 452,${UPPER_TEETH_BOTTOM + 1} Z`;
  const lowerLip = `<ellipse cx="${f(474 + r - sp * .3)}" cy="${f(lipY + 6)}" rx="${f(27 + sp)}" ry="${f(15 - p.round * 3)}" fill="#ff7f9d" stroke="#2b2d42" stroke-width="3"/>`;
  const contact = contactPoint(sound, p);

  // vocal folds
  const vf = `<g transform="translate(168 330)"><path d="M-22,0 q5,-12 11,0 t11,0 t11,0 t11,0" fill="none" stroke="${p.voiced ? col : '#9aa0a6'}" stroke-width="${p.voiced ? 5 : 3}" stroke-linecap="round" ${p.voiced ? '' : 'stroke-dasharray="2 7"'}/></g>`;
  const voiceLabel = `<text x="168" y="362" text-anchor="middle" font-size="15" fill="${p.voiced ? col : '#6b6f86'}" font-weight="800">${p.voiced ? 'voice ON' : 'voice off'}</text>`;

  const air = p.air ? `<path d="M190,330 C260,300 330,${f(lt + 5)} 520,${f(lt - 6)}" fill="none" stroke="${col}" stroke-width="4" stroke-dasharray="3 9" stroke-linecap="round" marker-end="url(#arr-${col.slice(1)})"/>` : '';
  const nose = nasal ? `<path d="M200,${f(roofY(200, nasal) - 14)} C260,40 420,30 520,92" fill="none" stroke="${col}" stroke-width="4" stroke-dasharray="3 9" stroke-linecap="round" marker-end="url(#arr-${col.slice(1)})"/>` : '';

  return `<svg viewBox="0 0 700 440" class="mouth-svg" role="img" aria-label="Side view of the mouth${sound ? ' making ' + sound.label : ''}">
  <defs><marker id="arr-${col.slice(1)}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${col}"/></marker></defs>
  <!-- head profile -->
  <path d="M120,30 H390 Q470,34 482,84 L506,124 Q512,138 490,142 L494,150 Q500,162 496,176 L498,190 Q504,200 494,${f(236 + jawDrop)} Q486,${f(292 + jawDrop)} 452,${f(300 + jawDrop)} L300,${f(400 + jawDrop * .2)} H120 Z" fill="#ffe3cf" stroke="#2b2d42" stroke-width="4" stroke-linejoin="round"/>
  <!-- cavity -->
  <path d="${cavity}" fill="${'#f9a3b6'}" stroke="#2b2d42" stroke-width="3" stroke-linejoin="round"/>
  <!-- tongue -->
  <path d="${tongue}" fill="${col}" fill-opacity=".92" stroke="#2b2d42" stroke-width="3" stroke-linejoin="round"/>
  ${stripe}
  <!-- teeth -->
  <rect x="${TEETH_X - 10}" y="146" width="14" height="${UPPER_TEETH_BOTTOM - 146}" rx="5" fill="#fff" stroke="#2b2d42" stroke-width="3"/>
  <rect x="${TEETH_X - 10}" y="${f(lt)}" width="14" height="38" rx="5" fill="#fff" stroke="#2b2d42" stroke-width="3"/>
  <!-- lips -->
  <path d="${upperLip}" fill="#ff7f9d" stroke="#2b2d42" stroke-width="3" stroke-linejoin="round"/>
  ${lowerLip}
  ${air}${nose}
  ${contact ? `<circle cx="${f(contact[0])}" cy="${f(contact[1])}" r="13" fill="none" stroke="#2b2d42" stroke-width="6"/><circle cx="${f(contact[0])}" cy="${f(contact[1])}" r="13" fill="none" stroke="${col}" stroke-width="3.5" class="pulse"/>` : ''}
  ${vf}${voiceLabel}
  ${sound ? `<text x="30" y="70" font-size="62" font-weight="800" fill="${col}" stroke="#2b2d42" stroke-width="1.5" paint-order="stroke" font-family="Orbitron, sans-serif">${sound.spell}</text><text x="30" y="98" font-size="17" font-weight="700" fill="#2b2d42">${GROUPS[sound.group].name}</text>` : ''}
  </svg>`;
}

// Labelled parts of the mouth. Each part names a group colour so the tabs match.
export const PARTS = [
  { id: 'lips',    name: 'Lips',            group: 'lips',     at: [488, 168], label: [560, 215], text: 'Lips press together (p, b, m), round (w, oo) or spread in a smile (ee, s).', sounds: ['P', 'B', 'M', 'W'] },
  { id: 'teeth',   name: 'Teeth',           group: 'teethlip', at: [452, 170], label: [560, 262], text: 'Top teeth touch the bottom lip for F and V. For S, the teeth sit close together. For TH, the tongue peeks between them.', sounds: ['F', 'V', 'TH', 'S'] },
  { id: 'ridge',   name: 'Bumpy ridge',     group: 'ridge',    at: [438, 130], label: [560, 105], text: 'The bumpy part just behind your top teeth. The tongue tip taps here for T, D, N and L, and sits just under it for S and Z.', sounds: ['T', 'D', 'N', 'L', 'S', 'Z'] },
  { id: 'palate',  name: 'Hard roof',       group: 'palate',   at: [370, 96],  label: [370, 40],  text: 'The hard bony roof. The tongue bunches up toward it for SH, CH, J, R and Y.', sounds: ['SH', 'CH', 'R', 'Y'] },
  { id: 'velum',   name: 'Soft roof',       group: 'back',     at: [255, 98],  label: [220, 40],  text: 'The soft, squishy back of the roof. The back of the tongue lifts to touch it for K and G.', sounds: ['K', 'G', 'NG'] },
  { id: 'tonguetip', name: 'Tongue tip',    group: 'ridge',    at: [430, 224], label: [330, 420], text: 'The tip is the busiest part. It points up, down, or out depending on the sound.', sounds: ['T', 'D', 'S', 'TH'] },
  { id: 'tongueback', name: 'Back of tongue', group: 'back',  at: [230, 236], label: [20, 250], text: 'The back of the tongue lifts for K, G and ng, and pulls back for R and oo.', sounds: ['K', 'G', 'R'] },
  { id: 'voice',   name: 'Voice box',       group: 'throat',   at: [168, 330], label: [20, 330], text: 'Your vocal folds buzz when your voice is ON (b, d, z, vowels) and stay still when it is OFF (p, t, s).', sounds: ['H', 'Z', 'S'] },
];

export function anatomySVG() {
  const base = mouthSVG(REST, {}).replace('</svg>', '');
  const marks = PARTS.map((p) => {
    const c = GROUPS[p.group].color;
    return `<g class="part" data-part="${p.id}" tabindex="0" role="button" aria-label="${p.name}">
      <line x1="${p.at[0]}" y1="${p.at[1]}" x2="${p.label[0]}" y2="${p.label[1]}" stroke="${c}" stroke-width="3"/>
      <circle cx="${p.at[0]}" cy="${p.at[1]}" r="9" fill="${c}" stroke="#2b2d42" stroke-width="3"/>
      <text x="${p.label[0]}" y="${p.label[1] + 5}" font-size="16" font-weight="800" fill="#2b2d42" stroke="#fff" stroke-width="4" paint-order="stroke" text-anchor="${p.label[0] > 450 || p.label[0] < 100 ? 'start' : 'middle'}">${p.name}</text></g>`;
  }).join('');
  return base + marks + '</svg>';
}
