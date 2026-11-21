// Builders for the parts of the speech system outside the mouth: head and torso skin, nose and nasal cavity,
// throat, voice box, windpipe, food pipe, bronchi, lungs and diaphragm.
// All shapes are laid out in the same side-view "px" space as geom.js (front of the face is +x, y grows downward,
// z is sideways). About 37 px is 1 cm for a six-year-old. Stylised, but in the right places and proportions.
import * as THREE from 'three';

export const W = (x, y, z = 0) => new THREE.Vector3((x - 300) / 100, (300 - y) / 100, z / 100);
const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// ---------- generic tube along a side-view centreline ----------
// pts: [[x, y, a, b, z?], ...] in px. a = half-size across the line (in the side view), b = half-width sideways.
export class Loft {
  constructor(pts, { segs = 40, around = 20, closeEnds = false } = {}) {
    this.segs = segs; this.around = around;
    const n = (segs + 1) * around + (closeEnds ? 2 : 0);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx = [];
    for (let i = 0; i < segs; i++) for (let j = 0; j < around; j++) {
      const a = i * around + j, b = i * around + (j + 1) % around, c = a + around, d = b + around;
      idx.push(a, c, b, b, c, d);
    }
    if (closeEnds) {
      const s = (segs + 1) * around, e = s + 1;
      for (let j = 0; j < around; j++) { idx.push(s, (j + 1) % around, j); idx.push(e, segs * around + j, segs * around + (j + 1) % around); }
    }
    this.closeEnds = closeEnds;
    this.geo.setIndex(idx);
    this.set(pts);
  }
  set(pts) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => W(p[0], p[1], p[4] || 0)));
    const pos = this.geo.attributes.position, L = new THREE.Vector3(0, 0, 1);
    const N = new THREE.Vector3(), T = new THREE.Vector3();
    const last = pts.length - 1;
    for (let i = 0; i <= this.segs; i++) {
      const t = i / this.segs;
      const P = curve.getPoint(t);
      T.copy(curve.getPoint(Math.min(1, t + 0.01))).sub(curve.getPoint(Math.max(0, t - 0.01))).normalize();
      N.crossVectors(T, L).normalize();
      const k = t * last, i0 = Math.min(last - 1, Math.floor(k)), f = k - i0;
      const a = lerp(pts[i0][2], pts[i0 + 1][2], f) / 100, b = lerp(pts[i0][3], pts[i0 + 1][3], f) / 100;
      for (let j = 0; j < this.around; j++) {
        const th = (j / this.around) * Math.PI * 2;
        const v = P.clone().addScaledVector(N, a * Math.cos(th)).addScaledVector(L, b * Math.sin(th));
        pos.setXYZ(i * this.around + j, v.x, v.y, v.z);
      }
      if (this.closeEnds && i === 0) pos.setXYZ((this.segs + 1) * this.around, P.x, P.y, P.z);
      if (this.closeEnds && i === this.segs) pos.setXYZ((this.segs + 1) * this.around + 1, P.x, P.y, P.z);
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

// ---------- head, neck and chest skin ----------
// Side-view profile: y, front x, back x, half-width (px). The nose and lips are separate meshes.
const BODY = [
  [-300, 210, 130, 40], [-280, 330, 10, 150], [-230, 420, -90, 220], [-150, 465, -150, 255], [-60, 482, -175, 268],
  [20, 486, -175, 265], [90, 484, -165, 255], [140, 486, -145, 245], [175, 488, -125, 232], [195, 486, -110, 222],
  [222, 482, -98, 212], [248, 486, -88, 200], [272, 474, -78, 186], [300, 486, -68, 170], [330, 452, -62, 146],
  [360, 380, -58, 118], [420, 345, -55, 106], [500, 338, -56, 108], [560, 348, -64, 122], [610, 395, -90, 270],
  [680, 432, -112, 335], [800, 455, -122, 352], [950, 462, -124, 352], [1100, 452, -116, 334], [1250, 432, -100, 304],
];
function bodyAt(y) {
  if (y <= BODY[0][0]) return BODY[0];
  for (let i = 1; i < BODY.length; i++) if (y <= BODY[i][0]) {
    const [y0, ...a] = BODY[i - 1], [y1, ...b] = BODY[i], t = smooth((y - y0) / (y1 - y0)) * 0.5 + ((y - y0) / (y1 - y0)) * 0.5;
    return [y, lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  return BODY[BODY.length - 1];
}
export function buildSkin(material) {
  const ys = [];
  for (let y = -300; y < 140; y += 22) ys.push(y);
  for (let y = 140; y < 360; y += 7) ys.push(y);       // dense around the mouth and jaw
  for (let y = 360; y <= 1250; y += 30) ys.push(y);
  const NY = ys.length, NA = 48;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NY * NA * 3), 3));
  const mesh = new THREE.Mesh(geo, material);
  const quads = [];
  for (let i = 0; i < NY - 1; i++) for (let j = 0; j < NA; j++) quads.push([i * NA + j, i * NA + (j + 1) % NA, (i + 1) * NA + j, (i + 1) * NA + (j + 1) % NA]);
  let lastKey = '';
  const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  function update(jawDrop, hole) {
    const pos = geo.attributes.position;
    for (let i = 0; i < NY; i++) {
      const [, xf, xb, hw] = bodyAt(ys[i]);
      const xc = (xf + xb) / 2, a = (xf - xb) / 2;
      for (let j = 0; j < NA; j++) {
        const th = (j / NA) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        let y = ys[i];
        // lower face follows the jaw
        if (y > 212 && y < 400) y += jawDrop * (1 - smooth((y - 300) / 90)) * smooth((c + 0.35) / 0.9);
        const v = W(xc + a * spow(c, 0.82), y, hw * spow(s, 0.82));
        pos.setXYZ(i * NA + j, v.x, v.y, v.z);
      }
    }
    pos.needsUpdate = true;
    // open a hole where the mouth is, so the lips and teeth are not behind a film of skin
    const key = hole.map((v) => Math.round(v)).join(',');
    if (key !== lastKey) {
      lastKey = key;
      const [yTop, yBot, half] = hole;
      const idx = [];
      const p = new THREE.Vector3();
      for (const q of quads) {
        p.set(0, 0, 0);
        for (const k of q) p.add(new THREE.Vector3().fromBufferAttribute(pos, k));
        p.multiplyScalar(0.25);
        const x = p.x * 100 + 300, y = 300 - p.y * 100, z = p.z * 100;
        if (x > 430 && y > yTop && y < yBot && Math.abs(z) < half) continue;
        idx.push(q[0], q[2], q[1], q[1], q[2], q[3]);
      }
      geo.setIndex(idx);
    }
    geo.computeVertexNormals();
  }
  return { mesh, update };
}

// ---------- nose (outside) ----------
export function buildNose(skinMat, nostrilMat) {
  const g = new THREE.Group();
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), skinMat);
  tip.scale.set(0.4, 0.15, 0.17); tip.position.copy(W(506, 133)); tip.rotation.z = -0.78;
  const bridge = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skinMat);
  bridge.scale.set(0.3, 0.1, 0.12); bridge.position.copy(W(489, 104)); bridge.rotation.z = -1.0;
  g.add(tip, bridge);
  for (const z of [-17, 17]) {
    const ala = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), skinMat);
    ala.scale.set(0.15, 0.11, 0.1); ala.position.copy(W(496, 162, z)); g.add(ala);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 18), nostrilMat);
    hole.scale.set(0.075, 0.05, 1); hole.rotation.x = Math.PI / 2; hole.position.copy(W(503, 175, z * 0.55)); g.add(hole);
  }
  return g;
}

// ---------- airway tubes ----------
// Nasal cavity: nostrils -> up over the hard palate -> back to the throat (nasopharynx).
export const NASAL = [[502, 174, 5, 16], [495, 152, 11, 14], [474, 120, 19, 14], [440, 86, 26, 15], [380, 66, 29, 15],
  [310, 62, 29, 16], [252, 72, 25, 17], [214, 96, 19, 19], [186, 124, 17, 22], [168, 152, 16, 25]];
// Throat (pharynx): from behind the nose down behind the tongue to the voice box.
export const PHARYNX = [[168, 140, 16, 26], [160, 182, 18, 28], [157, 232, 20, 30], [159, 290, 20, 30], [165, 345, 18, 26],
  [176, 392, 16, 22], [190, 424, 13, 18]];
export const LARYNX_TUBE = [[190, 424, 13, 18], [198, 442, 14, 16], [203, 472, 16, 16]];
export const TRACHEA = [[203, 470, 17, 17], [202, 560, 17, 17], [201, 660, 17, 17], [200, 748, 17, 17]];
export const ESOPHAGUS = [[178, 402, 9, 14], [162, 470, 8, 16], [156, 600, 8, 16], [160, 760, 8, 16], [170, 920, 8, 16], [188, 1090, 9, 18]];
export const EPIGLOTTIS = [[212, 380, 3, 10], [199, 354, 3, 17], [189, 336, 3, 16], [186, 326, 2, 7]];
export const GLOTTIS = { x: 202, y: 433 };
export const CARINA = { x: 200, y: 752 };

export function buildTracheaRings(material) {
  const g = new THREE.Group();
  const geo = new THREE.TorusGeometry(0.19, 0.028, 6, 22, 5.2);
  geo.rotateX(Math.PI / 2); geo.rotateY(2.6);       // open side of the "C" faces the food pipe at the back
  for (let y = 484; y <= 738; y += 19) {
    const m = new THREE.Mesh(geo, material);
    m.position.copy(W(lerp(203, 200, (y - 470) / 280), y));
    g.add(m);
  }
  return g;
}

// ---------- bronchi: a small branching tree into each lung ----------
export function buildBronchi(material) {
  const g = new THREE.Group();
  const add = (a, b, r) => {
    const pa = W(a[0], a[1], a[2]), pb = W(b[0], b[1], b[2]);
    const len = pa.distanceTo(pb);
    const geo = new THREE.CylinderGeometry(r * 0.8 / 100, r / 100, len, 10, 1, true);
    const m = new THREE.Mesh(geo, material);
    m.position.copy(pa).add(pb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.clone().sub(pa).normalize());
    g.add(m);
    const j = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8 / 100, 10, 8), material); j.position.copy(pb); g.add(j);
  };
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const grow = (from, dir, len, r, depth, side) => {
    const to = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len];
    add(from, to, r);
    if (depth >= 3) return;
    const kids = depth === 0 ? (side > 0 ? 3 : 2) : 2;
    for (let k = 0; k < kids; k++) {
      let d;
      if (depth === 0) {
        // lobes: upper goes up and out, (middle goes forward and out), lower goes down
        const lobes = side > 0 ? [[0.15, -0.55, 0.8], [0.6, 0.35, 0.7], [-0.15, 0.95, 0.35]] : [[0.15, -0.5, -0.85], [-0.1, 0.95, -0.35]];
        d = lobes[k];
      } else {
        d = [dir[0] + (rnd() - 0.5) * 1.1, dir[1] + (rnd() - 0.3) * 0.9, dir[2] + side * (rnd() * 0.6) + (k ? 0.35 : -0.35) * side];
      }
      const n = Math.hypot(...d); d = d.map((v) => v / n);
      grow(to, d, len * (depth === 0 ? 0.75 : 0.68), r * 0.68, depth + 1, side);
    }
  };
  // right main bronchus (+z side): shorter, wider and steeper; left: longer and flatter
  const c = [CARINA.x, CARINA.y, 0];
  grow(c, normalize3([0, 0.85, 0.55]), 72, 12, 0, 1);
  grow(c, normalize3([0, 0.62, -0.8]), 96, 10.5, 0, -1);
  return g;
}
const normalize3 = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };

// ---------- lungs ----------
export const LUNGS = { right: { c: [200, 945, 138], r: [118, 228, 100] }, left: { c: [200, 955, -132], r: [112, 218, 90] } };
export function buildLung(material, side) {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const pos = geo.attributes.position, med = side === 'right' ? -1 : 1;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > 0) { const s = 1 - 0.5 * y * y; x *= s; z *= s; }                         // narrow, rounded top (apex)
    if (y < -0.35) y += 0.42 * (1 - Math.min(1, x * x + z * z)) * smooth((-y - 0.35) / 0.65); // sits on the dome of the diaphragm
    if (z * med > 0) z *= 0.42;                                                         // flat inner side, room for the heart
    if (side === 'left' && x > 0.15 && z > 0 && y < 0.15 && y > -0.8) { x *= 0.72; z *= 0.7; } // cardiac notch
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const L = LUNGS[side];
  const m = new THREE.Mesh(geo, material);
  m.scale.set(L.r[0] / 100, L.r[1] / 100, L.r[2] / 100);
  m.position.copy(W(L.c[0], L.c[1], L.c[2]));
  m.userData.base = m.scale.clone();
  return m;
}
export function buildDiaphragm(material) {
  const geo = new THREE.SphereGeometry(1, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2.3);
  const m = new THREE.Mesh(geo, material);
  m.scale.set(2.9, 0.75, 3.1); m.position.copy(W(190, 1185));
  m.userData.y = m.position.y;
  return m;
}

// ---------- air routes (px points) ----------
export const ROUTE_LUNG = {
  right: [[212, 990, 125], [208, 900, 95], [204, 815, 40]],
  left: [[206, 1000, -118], [204, 905, -88], [202, 818, -40]],
};
export const ROUTE_TRUNK = [[200, 752], [202, 650], [203, 545], [204, 472], [201, 434], [186, 402], [171, 352], [165, 292], [168, 250]];
export const ROUTE_NOSE = [[166, 205], [172, 152], [194, 114], [230, 88], [300, 62], [400, 68], [462, 102], [489, 140], [500, 168], [505, 186], [512, 208]];
