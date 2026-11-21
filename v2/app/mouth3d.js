// 3D model of a child's speech system, from the nose and lips all the way down to the lungs.
// Stylised but anatomically ordered: nose and nasal cavity, mouth (20 baby teeth, tongue with its root, soft palate
// and uvula), throat, epiglottis, voice box with vocal folds, windpipe with cartilage rings, food pipe, bronchi,
// lungs and diaphragm. Air flows from the lungs and leaves through the mouth or the nose depending on the sound.
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { REST, SOUNDS, groupOf, wordInfo } from './data.js';
import { roofY, floorBase, lowerTeethTop, tongueSpine, sampleSpine, tongueThickness, tongueHalfWidth, lerpParams, smooth, TEETH_X, UPPER_TEETH_BOTTOM } from './geom.js';
import {
  W, Loft, buildSkin, buildNose, buildTracheaRings, buildBronchi, buildLung, buildDiaphragm,
  NASAL, PHARYNX, LARYNX_TUBE, TRACHEA, ESOPHAGUS, EPIGLOTTIS, GLOTTIS, ROUTE_LUNG, ROUTE_TRUNK, ROUTE_NOSE,
} from './anatomy3d.js';

const NX = 34, NA = 32;            // mouth cavity: rings x points around
const NR = 30, NM = 22;            // tongue
const NS = 10;                     // lip cross-section points
const ARCH_D = 112, ARCH_W = 64;   // dental arch depth and half-width (px)
const GUM_TOP = 158;               // roof level at the front, so upper teeth hang below it
const CAV_W = 70;                  // mouth cavity half-width (px)
const CAV_X0 = 150;                // mouth cavity runs back until it merges with the throat
const sp3 = (v) => Math.sign(v) * Math.pow(Math.abs(v), 2 / 3);   // rounded (n = 3) cross-section

// Where each stop sound closes the airway (px, along the mouth). Air builds up behind it, then pops.
const STOP_AT = { P: 470, B: 470, T: 436, D: 436, K: 262, G: 262, CH: 436, JH: 436 };

const cTop = (x, p) => Math.min(roofY(x, p.nasal) + 2, GUM_TOP + (x > 430 ? 0 : 60));
const cBot = (x, p) => {
  const base = floorBase(p.jaw) + 22, front = lowerTeethTop(p.jaw) + 26;
  return base + (front - base) * smooth(Math.min(1, Math.max(0, (x - 370) / 85)));
};
function wallY(x, z, upper, p) {
  const top = cTop(x, p), bot = cBot(x, p), c = (top + bot) / 2, hh = (bot - top) / 2;
  const v = Math.min(1, Math.abs(z) / CAV_W);
  const Y = Math.pow(1 - Math.pow(v, 3), 1 / 3);
  return upper ? c - hh * Y : c + hh * Y;
}
const archX = (th) => TEETH_X - ARCH_D * Math.pow(Math.abs(th), 2.5);
const archPoint = (th) => ({ x: archX(th), z: th * ARCH_W });

const LABELS = [
  ['nose', 'Nose', 528, 118, 0], ['nasal', 'Nasal cavity', 340, 48, 0], ['velum', 'Soft palate', 222, 116, 0],
  ['tongue', 'Tongue', 318, 236, 0], ['teeth', 'Teeth', 452, 202, 0], ['lips', 'Lips', 520, 228, 0],
  ['throat', 'Throat', 140, 262, 0], ['epi', 'Epiglottis', 194, 348, 0], ['voice', 'Voice box', 246, 440, 0],
  ['trachea', 'Windpipe', 226, 610, 0], ['food', 'Food pipe', 140, 680, 0], ['lungs', 'Lungs', 200, 960, -132],
  ['diaphragm', 'Diaphragm', 330, 1190, 0],
];

export function createMouth3D(container, { onPhoneme, onCount } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 1.5; controls.maxDistance = 34;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9b9c4, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 5); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe6ee, 0.7); fill.position.set(5, -2, -4); scene.add(fill);

  // ----- materials: "cut" ones are sliced by the cutaway, "shell" ones go see-through when the cutaway is off -----
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const cutMats = [], shellMats = [];
  let cutawayOn = true, labelsOn = true;
  const mat = (color, extra = {}, { cut = true, shell = false } = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, side: THREE.DoubleSide, ...extra });
    if (cut) { m.clippingPlanes = [clip]; cutMats.push(m); }
    if (shell) { m.userData.solidOpacity = m.opacity; shellMats.push(m); }
    return m;
  };
  const glass = (color, opacity, opts) => mat(color, { transparent: true, opacity, depthWrite: false }, opts);

  // ----- skin of head, neck and chest -----
  const skinMat = glass(0xffcfb4, 0.15, { cut: true });
  const skin = buildSkin(skinMat);
  const nose = buildNose(glass(0xffc3a6, 0.42), mat(0x6e3442));
  scene.add(skin.mesh, nose);

  // ----- mouth cavity: closed tube following roof, floor and cheeks; open at the back into the throat -----
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NX * NA * 3), 3));
  {
    const ccol = new Float32Array(NX * NA * 3);
    const top = new THREE.Color(0xf6a8ba), bot = new THREE.Color(0xe9849f), side = new THREE.Color(0xf09cb0);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NA; j++) {
      const cy = Math.cos((j / NA) * Math.PI * 2), c = cy > 0.35 ? top : cy < -0.35 ? bot : side;
      ccol.set([c.r, c.g, c.b], (i * NA + j) * 3);
    }
    cg.setAttribute('color', new THREE.BufferAttribute(ccol, 3));
    const idx = [];
    for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NA; j++) {
      const a = i * NA + j, b = i * NA + (j + 1) % NA, c = a + NA, d = b + NA;
      idx.push(a, c, b, b, c, d);
    }
    cg.setIndex(idx);
  }
  const cavity = new THREE.Mesh(cg, mat(0xffffff, { vertexColors: true }, { shell: true }));
  scene.add(cavity);

  // ----- airway tubes -----
  const airwayMat = glass(0xf4a3b6, 0.5, { shell: true });
  const nasal = new Loft(NASAL, { segs: 40, around: 22 });
  const pharynx = new Loft(PHARYNX, { segs: 30, around: 22 });
  const larynxTube = new Loft(LARYNX_TUBE, { segs: 8, around: 18 });
  const trachea = new Loft(TRACHEA, { segs: 24, around: 18 });
  const food = new Loft(ESOPHAGUS, { segs: 30, around: 16 });
  const epi = new Loft(EPIGLOTTIS, { segs: 12, around: 12, closeEnds: true });
  const cartilage = mat(0xf2e3c4, { roughness: 0.5 });
  scene.add(
    new THREE.Mesh(nasal.geo, airwayMat), new THREE.Mesh(pharynx.geo, airwayMat), new THREE.Mesh(larynxTube.geo, airwayMat),
    new THREE.Mesh(trachea.geo, glass(0xf3a9b8, 0.42, { shell: true })), new THREE.Mesh(food.geo, glass(0xe7b7a1, 0.32, { shell: true })),
    new THREE.Mesh(epi.geo, cartilage), buildTracheaRings(cartilage),
  );
  // voice box: cartilage shell and two vocal folds that open for breathing and close and buzz for voice
  const thyroid = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.26, 0.62, 28, 1, true), glass(0xf2e3c4, 0.28));
  thyroid.position.copy(W(212, 446)); thyroid.scale.set(0.85, 1, 1);
  const foldGeo = new THREE.CapsuleGeometry(0.028, 0.2, 4, 10); foldGeo.rotateZ(Math.PI / 2);
  // both folds stay whole in the cutaway: open or closed is the point of showing them
  const foldMat = mat(0xf7e4e8, { roughness: 0.35, emissive: new THREE.Color(0x000000) }, { cut: false });
  const foldL = new THREE.Mesh(foldGeo, foldMat), foldR = new THREE.Mesh(foldGeo, foldMat);
  scene.add(thyroid, foldL, foldR);

  // ----- soft palate (velum) and uvula: lifts to close the nose, drops for m, n, ng -----
  // Raised: lifts up and back and seals against the back wall of the throat, so no air reaches the nose.
  // Lowered (m, n, ng): hangs down towards the tongue and opens the way up into the nose.
  const VEL_UP = [[268, 101, 6, 34], [240, 102, 7, 32], [212, 106, 7, 28], [188, 114, 7, 22], [168, 121, 6, 16], [154, 124, 5, 10]];
  const VEL_DOWN = [[268, 104, 6, 34], [244, 114, 7, 32], [222, 130, 7, 28], [206, 150, 6, 20], [195, 170, 5, 10], [190, 186, 4, 5]];
  const velum = new Loft(velumPts(REST), { segs: 16, around: 14, closeEnds: true });
  const velumMesh = new THREE.Mesh(velum.geo, mat(0xe8768f, { roughness: 0.5 }));
  scene.add(velumMesh);
  function velumPts(p) {
    const t = Math.max(0, Math.min(1, p.nasal));
    return VEL_UP.map((u, i) => u.map((v, k) => v + (VEL_DOWN[i][k] - v) * t));
  }

  // ----- lungs, bronchi, diaphragm (not sliced by the cutaway, so both lungs stay visible) -----
  const lungMat = new THREE.MeshStandardMaterial({ color: 0xf28ea6, roughness: 0.8, transparent: true, opacity: 0.3, depthWrite: false });
  const lungR = buildLung(lungMat, 'right'), lungL = buildLung(lungMat, 'left');
  const bronchi = buildBronchi(new THREE.MeshStandardMaterial({ color: 0xf5d6dc, roughness: 0.5 }));
  const diaphragm = buildDiaphragm(new THREE.MeshStandardMaterial({ color: 0xe0907f, roughness: 0.8, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(lungR, lungL, bronchi, diaphragm);

  // ----- tongue (root in the throat, body, tip) -----
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NR * NM + 2) * 3), 3));
  {
    const idx = [];
    for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NM; j++) {
      const a = i * NM + j, b = i * NM + ((j + 1) % NM), c = a + NM, d = b + NM;
      idx.push(a, c, b, b, c, d);
    }
    const back = NR * NM, tip = NR * NM + 1;
    for (let j = 0; j < NM; j++) { idx.push(back, j, (j + 1) % NM); idx.push(tip, (NR - 1) * NM + ((j + 1) % NM), (NR - 1) * NM + j); }
    tg.setIndex(idx);
  }
  const tongueMat = mat(0x5b6b82, { roughness: 0.5 });
  tongueMat.emissive = new THREE.Color(0x5b6b82); tongueMat.emissiveIntensity = 0.28;
  scene.add(new THREE.Mesh(tg, tongueMat));

  // ----- teeth: 5 per side per jaw = 10 + 10 baby teeth -----
  function toothShape(kind) {
    const s = new THREE.Shape();
    const w = { inc1: .2, inc2: .17, can: .18, mol1: .26, mol2: .28 }[kind], h = { inc1: .34, inc2: .33, can: .36, mol1: .26, mol2: .26 }[kind];
    const a = w / 2, b = h / 2, r = 0.035;
    if (kind === 'can') {
      s.moveTo(-a, -b + .1); s.lineTo(0, -b - .01); s.lineTo(a, -b + .1); s.lineTo(a * .9, b); s.lineTo(-a * .9, b);
    } else if (kind.startsWith('mol')) {
      s.moveTo(-a, -b + .06); s.quadraticCurveTo(-a * .5, -b - .03, 0, -b + .035); s.quadraticCurveTo(a * .5, -b - .03, a, -b + .06);
      s.lineTo(a * .88, b); s.lineTo(-a * .88, b);
    } else {
      s.moveTo(-a, -b + r); s.quadraticCurveTo(-a, -b, -a + r, -b); s.lineTo(a - r, -b); s.quadraticCurveTo(a, -b, a, -b + r);
      s.lineTo(a * .88, b); s.lineTo(-a * .88, b);
    }
    s.closePath();
    const d = kind.startsWith('mol') ? .15 : .09;
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: .016, bevelThickness: .016, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -d / 2);
    return { geo: g, w: w * 100, h: h * 100 };
  }
  const KINDS = ['inc1', 'inc2', 'can', 'mol1', 'mol2'];
  const shapes = Object.fromEntries(KINDS.map((k) => [k, toothShape(k)]));
  const teeth = [];
  const lowerGroup = new THREE.Group(), upperGroup = new THREE.Group();
  scene.add(lowerGroup, upperGroup);
  for (const upper of [true, false]) for (const side of [1, -1]) {
    let th = 0, prevGap = 0;
    KINDS.forEach((kind, n) => {
      const { geo, w, h } = shapes[kind];
      const advance = (len) => { let acc = 0; while (acc < len && th < 1) { const p0 = archPoint(th), p1 = archPoint(th + 0.002); acc += Math.hypot(p1.x - p0.x, p1.z - p0.z); th += 0.002; } };
      advance(w / 2 + prevGap);
      const pt = archPoint(th), pt2 = archPoint(th + 0.01);
      advance(w / 2); prevGap = 1;
      const mesh = new THREE.Mesh(geo, mat(0xfffdf6, { roughness: 0.3, emissive: new THREE.Color(0x000000) }));
      const tx = pt2.x - pt.x, tz = pt2.z - pt.z;
      mesh.rotation.y = side > 0 ? Math.atan2(-tz, tx) : Math.atan2(tz, tx);
      mesh.userData = { x: pt.x, z: pt.z * side, h };
      if (!upper) mesh.scale.y = -1;
      (upper ? upperGroup : lowerGroup).add(mesh);
      teeth.push({ mesh, upper, side, n, kind });
    });
  }
  const NG = 19;
  const gumGeo = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NG * 2 * 3), 3));
    const idx = []; for (let i = 0; i < NG - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx); return g;
  };
  const gumMat = mat(0xec8aa2, { roughness: 0.6 }, { shell: true });
  const gumU = new THREE.Mesh(gumGeo(), gumMat), gumL = new THREE.Mesh(gumGeo(), gumMat);
  scene.add(gumU, gumL);
  const ridgeGeo = () => {
    const pts = []; for (let i = 0; i < NG; i++) { const th = (i / (NG - 1)) * 1.7 - 0.85; const a = archPoint(Math.sign(th) * Math.min(0.95, Math.abs(th))); pts.push(new THREE.Vector3((a.x - 300) / 100, 0, a.z / 100)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.045, 8, false);
  };
  const ridgeU = new THREE.Mesh(ridgeGeo(), gumMat), ridgeL = new THREE.Mesh(ridgeGeo(), gumMat);
  upperGroup.add(ridgeU); lowerGroup.add(ridgeL);

  // ----- lips (soft loop, pillow-shaped in cross-section) and cheeks (funnel back to the cavity) -----
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NA * NS * 3), 3));
  {
    const idx = [];
    for (let j = 0; j < NA; j++) for (let k = 0; k < NS; k++) {
      const a = j * NS + k, b = j * NS + (k + 1) % NS, c = ((j + 1) % NA) * NS + k, d = ((j + 1) % NA) * NS + (k + 1) % NS;
      idx.push(a, c, b, b, c, d);
    }
    lg.setIndex(idx);
  }
  const lips = new THREE.Mesh(lg, mat(0xf0627f, { roughness: 0.42 }));
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NA * 2 * 3), 3));
  {
    const idx = []; for (let j = 0; j < NA; j++) { const a = j * 2, b = ((j + 1) % NA) * 2; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    fg.setIndex(idx);
  }
  const funnel = new THREE.Mesh(fg, mat(0xf3a1b3, {}, { shell: true }));
  scene.add(lips, funnel);

  // ----- air particles -----
  const NP = 300;
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NP * 3).fill(1), 3));
  const pm = new THREE.PointsMaterial({ map: dot, size: 0.2, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(pg, pm); points.frustumCulled = false; points.renderOrder = 5; scene.add(points);
  const seeds = Array.from({ length: NP }, (_, i) => ({ jx: Math.sin(i * 12.9898) * 0.5, jy: Math.cos(i * 78.233) * 0.5, jz: Math.sin(i * 3.7) * 0.5, ph: (i * 0.6180339) % 1, sp: 0.8 + ((i * 0.37) % 1) * 0.45, side: i % 2 ? 'right' : 'left' }));
  const BG = new THREE.Color(0xf0f5ff), BREATH = new THREE.Color(0x6f9fc4);

  // ----- labels that follow the model -----
  const layer = document.createElement('div'); layer.className = 'lbl3d-layer';
  container.appendChild(layer);
  const labels = LABELS.map(([id, text, x, y, z]) => { const el = document.createElement('span'); el.className = 'lbl3d'; el.textContent = text; layer.appendChild(el); return { id, el, at: W(x, y, z) }; });

  // ----- animation state -----
  let cur = { ...REST }, from = { ...REST }, to = { ...REST }, tStart = 0, tDur = 1;
  let color = new THREE.Color(0x5b6b82);
  let seq = null, seqStart = 0, seqIdx = -1, speed = 1, loop = false;
  let curPid = null, phase = 0;                 // sound being shown and how far through it (0..1)
  let held = null, heldStart = 0;               // a single sound shown without a word
  let raf = 0, running = true, counting = false, lastT = performance.now();
  let lungFill = 0.5, breathClock = 0, lastEdgeOn = false, voiceState = 'breathing';

  function buildMouth(p) {
    // cavity
    const pos = cg.attributes.position;
    for (let i = 0; i < NX; i++) {
      const x = CAV_X0 + (i / (NX - 1)) * (TEETH_X - CAV_X0);
      const top = cTop(x, p), bot = cBot(x, p), c = (top + bot) / 2, hh = (bot - top) / 2;
      for (let j = 0; j < NA; j++) {
        const th = (j / NA) * Math.PI * 2;
        const v = W(x, c - hh * sp3(Math.cos(th)), CAV_W * sp3(Math.sin(th)));
        pos.setXYZ(i * NA + j, v.x, v.y, v.z);
      }
    }
    pos.needsUpdate = true; cg.computeVertexNormals();

    // tongue: root rises from the epiglottis, then the body runs forward to the tip
    const top = sampleSpine(tongueSpine(p), 26);
    const body = tongueSpine(p).slice(2);
    const spn = sampleSpine([[206, 374], [195, 334], [193, 292], ...body], NR);
    const tp = tg.attributes.position;
    let rootCentre = [200, 380];
    for (let i = 0; i < NR; i++) {
      const u = i / (NR - 1), [x, y] = spn[i];
      const [xa, ya] = spn[Math.max(0, i - 1)], [xb, yb] = spn[Math.min(NR - 1, i + 1)];
      let tx = xb - xa, ty = yb - ya; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      // root: a thick band rising from the epiglottis (grows forward); body: hangs straight down to the floor
      // of the mouth so the tongue is one solid mass; tip: thin
      const body = smooth((tx - 0.2) / 0.5);                   // 0 along the root, 1 along the body
      let nx = -ty * (1 - body), ny = tx * (1 - body) + body; const nn = Math.hypot(nx, ny) || 1; nx /= nn; ny /= nn;
      const rootT = 18 + 40 * smooth(Math.min(1, u / 0.3));
      const bodyT = Math.max(10, Math.min(cBot(x, p) + 2 - y, 14 + 150 * Math.pow(1 - u, 0.9)));
      const th = rootT + (bodyT - rootT) * body;
      const halfT = th / 2, cx = x + nx * halfT, cy = y + ny * halfT;
      const halfW = tongueHalfWidth(u) * 0.92 * (0.55 + 0.45 * smooth(Math.min(1, u / 0.3)));
      const front = smooth(Math.max(0, (u - 0.45) / 0.55));
      for (let j = 0; j < NM; j++) {
        const a = (j / NM) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        let d = -s * halfT;                                     // along the normal: negative = towards the surface
        if (s > 0) {
          d += p.groove * 9 * s * Math.pow(1 - Math.abs(c), 2) * front;
          d -= p.sides * 10 * Math.pow(Math.abs(c), 3) * (0.3 + s) * (0.4 + 0.6 * front);
        }
        const v = W(cx + nx * d, cy + ny * d, c * halfW); tp.setXYZ(i * NM + j, v.x, v.y, v.z);
      }
      if (i === 0) rootCentre = [cx, cy + 4];
    }
    const b0 = W(rootCentre[0], rootCentre[1], 0), t0 = W(spn[NR - 1][0] + 2, spn[NR - 1][1] + 3, 0);
    tp.setXYZ(NR * NM, b0.x, b0.y, b0.z); tp.setXYZ(NR * NM + 1, t0.x, t0.y, t0.z);
    tp.needsUpdate = true; tg.computeVertexNormals();

    // teeth and gums
    const lt = lowerTeethTop(p.jaw), lt0 = lowerTeethTop(0);
    for (const { mesh, upper } of teeth) {
      const u = mesh.userData;
      mesh.position.copy(W(u.x, upper ? UPPER_TEETH_BOTTOM - u.h / 2 : lt0 + u.h / 2, u.z));
    }
    lowerGroup.position.y = -(lt - lt0) / 100;
    ridgeU.position.y = (300 - (GUM_TOP + 6)) / 100;
    ridgeL.position.y = (300 - (lt0 + 28)) / 100;
    const gu = gumU.geometry.attributes.position, gl = gumL.geometry.attributes.position;
    for (let i = 0; i < NG; i++) {
      const th = (i / (NG - 1)) * 1.7 - 0.85, a = archPoint(Math.sign(th) * Math.min(0.95, Math.abs(th)));
      const wu = Math.min(wallY(a.x, a.z, true, p), GUM_TOP - 4), wl = Math.max(wallY(a.x, a.z, false, p), lt + 26);
      let v = W(a.x, wu, a.z); gu.setXYZ(i * 2, v.x, v.y, v.z);
      v = W(a.x, GUM_TOP + 6, a.z); gu.setXYZ(i * 2 + 1, v.x, v.y, v.z);
      v = W(a.x, lt + 28, a.z); gl.setXYZ(i * 2, v.x, v.y, v.z);
      v = W(a.x, wl, a.z); gl.setXYZ(i * 2 + 1, v.x, v.y, v.z);
    }
    gu.needsUpdate = gl.needsUpdate = true; gumU.geometry.computeVertexNormals(); gumL.geometry.computeVertexNormals();

    // lips
    const shut = Math.max(p.lipsShut, p.teethLip * 0.8);
    const rx = shut ? 40 : Math.max(18, 40 + p.spread * 16 - p.round * 22);
    const yTop = UPPER_TEETH_BOTTOM - 7;
    const yBot = shut ? yTop + 18 - p.teethLip * 4 : lt + 10 - p.round * 12;
    const cy = (yTop + yBot) / 2, ry = Math.max(3, (yBot - yTop) / 2);
    const xl = 478 + p.round * 16;
    const lp = lg.attributes.position, fp = fg.attributes.position;
    const rimTop = cTop(TEETH_X, p), rimBot = cBot(TEETH_X, p), rc = (rimTop + rimBot) / 2, rh = (rimBot - rimTop) / 2;
    for (let j = 0; j < NA; j++) {
      const a = (j / NA) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const z = rx * sa, y = cy - ry * ca;
      const x = xl + p.round * 8 * (1 - Math.abs(sa)) - 20 * Math.pow(Math.abs(sa), 3);
      let nz = sa / rx, ny = -ca / ry; const nl = Math.hypot(nz, ny) || 1; nz /= nl; ny /= nl;
      const r = 4.5 + 7 * Math.pow(Math.abs(ca), 1.2) * (ca > 0 ? 0.85 : 1);
      for (let k = 0; k < NS; k++) {
        const ph = (k / NS) * Math.PI * 2, cp = Math.cos(ph), sph = Math.sin(ph);
        const out = 0.55 * r + 1.45 * r * cp;                  // pillow: taller than deep, grows away from the opening
        const v = W(x + r * 0.95 * sph, y + ny * out, z + nz * out);
        lp.setXYZ(j * NS + k, v.x, v.y, v.z);
      }
      const rv = W(TEETH_X + 1, rc - rh * sp3(ca), CAV_W * 0.96 * sp3(sa)); fp.setXYZ(j * 2, rv.x, rv.y, rv.z);
      const lv = W(x - 3, y, z); fp.setXYZ(j * 2 + 1, lv.x, lv.y, lv.z);
    }
    lp.needsUpdate = fp.needsUpdate = true; lg.computeVertexNormals(); fg.computeVertexNormals();

    // soft palate and skin (with a hole for the mouth)
    velum.set(velumPts(p));
    skin.update(p.jaw * 74, [yTop - 16, yBot + 14, rx + 14]);
    tongueMat.color.copy(color); tongueMat.emissive.copy(color).multiplyScalar(0.28);
    return { lt, top };
  }

  // ----- air routes -----
  function routes(p, top, lt) {
    const yAt = (x) => { for (let i = 1; i < top.length; i++) if (top[i][0] >= x) { const [x0, y0] = top[i - 1], [x1, y1] = top[i]; return y0 + ((x - x0) / Math.max(1, x1 - x0)) * (y1 - y0); } return top[top.length - 1][1]; };
    const over = (x) => (yAt(x) + Math.min(roofY(x, p.nasal), GUM_TOP)) / 2 - 3;
    const gapY = (UPPER_TEETH_BOTTOM + lt) / 2;
    const tipX = top[top.length - 1][0], fx = Math.min(412, tipX - 8);
    const mouth = [[190, over(200) + 8], [222, over(222)], [285, over(285)], [350, over(350)], [fx, over(fx)], [TEETH_X + 4, gapY], [492, gapY - 1], [560, gapY - 4], [620, gapY - 8]];
    const make = (side, tail) => new THREE.CatmullRomCurve3([...ROUTE_LUNG[side], ...ROUTE_TRUNK, ...tail].map((q) => W(q[0], q[1], q[2] || 0)));
    return {
      mouth: { left: make('left', mouth), right: make('right', mouth) },
      nose: { left: make('left', ROUTE_NOSE), right: make('right', ROUTE_NOSE) },
    };
  }
  // Fraction along a route where it first reaches x (px) after leaving the throat.
  function uAtX(curve, x) {
    let lo = 0.45, hi = 1;
    for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (curve.getPointAt(m).x * 100 + 300 >= x) hi = m; else lo = m; }
    return hi;
  }

  function airMode() {
    if (!curPid) return { kind: 'breath' };
    const s = SOUNDS[curPid], p = s.params;
    if (p.nasal > 0.5) return { kind: 'nose', strength: 0.75 };
    if (STOP_AT[curPid]) return { kind: 'stop', closeX: STOP_AT[curPid], release: phase > 0.62, hiss: !!p.air };
    return { kind: 'mouth', strength: p.air ? 1 : 0.55, fast: !!p.air };
  }

  function updateAir(time, dt, p, top, lt) {
    const mode = airMode();
    const R = routes(p, top, lt);
    const col = pg.attributes.color, pos = pg.attributes.position;
    let inhale = false, set = R.mouth, active = 1, closeU = null, rate = 0.00026;
    if (mode.kind === 'breath') {
      breathClock += dt;
      inhale = Math.cos((breathClock / 4600) * Math.PI * 2) > 0;
      set = R.nose; active = 0.45; rate = 0.00018;
    } else if (mode.kind === 'nose') { set = R.nose; active = mode.strength; }
    else if (mode.kind === 'mouth') { active = mode.strength; rate = mode.fast ? 0.00034 : 0.00024; }
    else if (mode.kind === 'stop') {
      closeU = { left: uAtX(R.mouth.left, mode.closeX), right: uAtX(R.mouth.right, mode.closeX) };
      if (mode.release) { closeU = null; rate = 0.0005; }
    }
    const tint = mode.kind === 'breath' ? BREATH : color;
    for (let i = 0; i < NP; i++) {
      const s = seeds[i], curve = set[s.side];
      let u = ((time * rate * s.sp) + s.ph) % 1;
      if (inhale) u = 1 - u;
      const on = (i / NP) < active;
      if (closeU) { const c = closeU[s.side]; if (u > c - 0.004) u = c - 0.004 - (u - c + 0.004) * 0.06; }  // piles up behind the closure
      const v = curve.getPointAt(Math.max(0, Math.min(1, u)));
      const out = u > 0.86 ? (u - 0.86) * 6 : 0;               // fan out past the lips or nostrils
      const inLung = u < 0.14 ? (0.14 - u) * 6 : 0;            // spread through the lungs
      const spread = 0.025 + out * 0.35 + inLung * 0.9;
      pos.setXYZ(i, v.x + s.jx * spread, v.y + s.jy * spread, v.z + s.jz * spread * 1.4);
      const fade = on ? Math.min(1, u * 9, (1 - u) * 4) : 0;
      const c = tint.clone().lerp(BG, 1 - Math.max(0, fade));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = col.needsUpdate = true;
    pm.opacity = 1;

    // lungs: breathe in and out at rest, empty slowly while talking
    const speaking = mode.kind !== 'breath';
    const restFill = 0.5 + 0.5 * Math.sin((breathClock / 4600) * Math.PI * 2);
    lungFill = speaking ? (lungFill < 0.18 && held ? 0.85 : Math.max(0.15, lungFill - dt * 0.00009)) : lungFill + (restFill - lungFill) * Math.min(1, dt * 0.004);
    const k = 0.92 + lungFill * 0.14;
    for (const L of [lungR, lungL]) L.scale.copy(L.userData.base).multiplyScalar(k);
    diaphragm.position.y = diaphragm.userData.y - lungFill * 0.22;

    // vocal folds: apart for breathing and voiceless sounds, together and buzzing for voice
    const voiced = speaking && p.voiced > 0.5 && !(mode.kind === 'stop' && !mode.release && !p.voiced);
    const buzz = voiced ? 0.002 + 0.01 * (0.5 + 0.5 * Math.sin(time * 0.08)) : 0;
    const gap = voiced ? buzz : (speaking ? 0.06 : 0.08);
    const ang = voiced ? 0.02 : 0.3;
    const g = W(GLOTTIS.x, GLOTTIS.y);
    foldL.position.set(g.x, g.y, gap + 0.028); foldL.rotation.y = ang;
    foldR.position.set(g.x, g.y, -gap - 0.028); foldR.rotation.y = -ang;
    foldMat.emissive.copy(voiced ? color : new THREE.Color(0x000000)).multiplyScalar(voiced ? 0.35 : 0);
    voiceState = !speaking ? 'breathing' : voiced ? 'on' : 'off';
  }

  function updateLabels() {
    layer.style.display = labelsOn ? '' : 'none';
    if (!labelsOn) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const placed = [];
    for (const L of labels) {
      const v = L.at.clone().project(camera);
      const sx = ((v.x + 1) / 2) * w, sy = ((1 - v.y) / 2) * h;
      const bw = L.el.textContent.length * 6.6 + 18, bh = 20;
      let vis = v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02;
      if (vis && placed.some((q) => Math.abs(q.x - sx) < (q.w + bw) / 2 && Math.abs(q.y - sy) < bh)) vis = false;
      L.el.style.display = vis ? '' : 'none';
      if (!vis) continue;
      placed.push({ x: sx, y: sy, w: bw });
      L.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
      if (L.id === 'tongue') L.el.style.borderColor = '#' + color.getHexString();
      if (L.id === 'voice') {
        const t = voiceState === 'on' ? 'Voice box: buzzing' : voiceState === 'off' ? 'Voice box: quiet' : 'Voice box';
        if (L.el.textContent !== t) L.el.textContent = t;
        L.el.classList.toggle('on', voiceState === 'on');
        L.el.style.borderColor = voiceState === 'on' ? '#' + color.getHexString() : '';
      }
    }
  }

  function setTarget(p, ms) { from = { ...cur }; to = { ...p }; tStart = performance.now(); tDur = Math.max(1, ms); }

  function frame(time) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, time - lastT); lastT = time;
    if (!running) return;
    if (seq) {
      const per = 800 / speed, e = time - seqStart, i = Math.floor(e / per);
      if (i >= seq.length) {
        if (loop) { seqStart = time + 400; seqIdx = -1; }
        else { seq = null; curPid = null; color = new THREE.Color(0x5b6b82); setTarget(REST, 500); onPhoneme && onPhoneme(null, -1); }
      } else if (e >= 0) {
        phase = (e % per) / per;
        if (i !== seqIdx) {
          seqIdx = i; curPid = seq[i];
          color = new THREE.Color(groupOf(curPid).color);
          setTarget(SOUNDS[curPid].params, per * 0.45);
          onPhoneme && onPhoneme(curPid, i);
        }
      }
    } else if (held) { phase = ((time - heldStart) % 1400) / 1400; }
    const k = Math.min(1, (time - tStart) / tDur);
    cur = lerpParams(from, to, smooth(k));
    const { lt, top } = buildMouth(cur);
    updateAir(time, dt, cur, top, lt);
    clip.normal.z = camera.position.z >= 0 ? -1 : 1;   // always remove the half nearest the camera
    const dir = camera.position.clone().sub(controls.target).normalize();
    const edgeOn = Math.abs(dir.z) < 0.35;                // looking along the cut: show see-through instead
    if (edgeOn !== lastEdgeOn) { lastEdgeOn = edgeOn; applyCut(); }
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
  }

  function resize() {
    const r = container.getBoundingClientRect();
    const w = Math.max(200, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const MOUTH_T = [0.7, 0.8, 0];
  const AIR_T = [-0.9, -2.25, 0];
  const VIEWS = {
    side: [MOUTH_T, [0.7, 0.9, 7.4]], angle: [MOUTH_T, [5.0, 2.3, 4.9]], front: [MOUTH_T, [8.4, 1.0, 1.0]],
    other: [MOUTH_T, [0.7, 0.9, -7.4]], airway: [AIR_T, [10.5, 0.4, 17.6]], airwaySide: [AIR_T, [1.8, -1.5, 21.5]],
  };
  function view(name) { const [t, p] = VIEWS[name] || VIEWS.side; controls.target.set(...t); camera.position.set(...p); controls.update(); }
  function applyCut() {
    const cut = cutawayOn && !lastEdgeOn;
    cutMats.forEach((m) => { m.clippingPlanes = cut ? [clip] : []; m.needsUpdate = true; });
    for (const m of shellMats) {
      const base = m.userData.solidOpacity ?? 1;
      m.transparent = !cut || base < 1; m.opacity = cut ? base : Math.min(base, 0.28); m.depthWrite = cut && base >= 1; m.needsUpdate = true;
    }
  }
  view('side'); applyCut();
  raf = requestAnimationFrame(frame);

  return {
    setCutaway(on) { cutawayOn = !!on; applyCut(); },
    setLabels(on) { labelsOn = !!on; },
    showSound(pid) {
      seq = null; const s = SOUNDS[pid];
      if (!s) { held = null; curPid = null; color = new THREE.Color(0x5b6b82); setTarget(REST, 400); return; }
      held = pid; heldStart = performance.now(); curPid = pid;
      color = new THREE.Color(groupOf(pid).color); setTarget(s.params, 450);
    },
    playWord(word, opts = {}) {
      const ids = wordInfo(word).segs.flatMap((s) => s.p).filter((p) => SOUNDS[p]);
      if (!ids.length) return;
      held = null; loop = !!opts.loop; seq = ids; seqStart = performance.now(); seqIdx = -1;
    },
    stop() { seq = null; held = null; loop = false; curPid = null; onPhoneme && onPhoneme(null, -1); },
    countTeeth() {
      if (counting) return; counting = true;
      const row = (up) => teeth.filter((t) => t.upper === up).sort((x, y) => (y.side * (up ? 1 : -1) - x.side * (up ? 1 : -1)) || ((x.n - y.n) * x.side * (up ? 1 : -1)));
      const list = [...row(true), ...row(false)];
      list.forEach((t) => t.mesh.material.emissive.setHex(0x000000));
      list.forEach((t, i) => setTimeout(() => {
        t.mesh.material.emissive.setHex(0xffb000);
        onCount && onCount(i + 1, i < 10 ? 'top' : 'bottom');
        if (i === list.length - 1) setTimeout(() => { list.forEach((x) => x.mesh.material.emissive.setHex(0x000000)); counting = false; onCount && onCount(0, 'done'); }, 1200);
      }, i * 420));
    },
    setSpeed(s) { speed = s; },
    view, resize,
    pause(p) { running = p === undefined ? false : !p; },
    resume() { running = true; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); layer.remove(); },
    get domElement() { return renderer.domElement; },
    get toothCount() { return teeth.length; },
    // for headless tests
    _test: { camera, controls, renderer, state: () => ({ curPid, phase, lungFill, mode: airMode().kind, foldGap: foldL.position.z - foldR.position.z, voice: voiceState, velumTip: velumPts(cur).at(-1).slice(0, 2), labels: labels.filter((L) => L.el.style.display !== 'none').map((L) => L.id) }) },
  };
}
