// 3D model of a child's mouth (stylised, built from the same side-view geometry as the 2D diagrams).
// 20 baby teeth (10 top, 10 bottom), full lips, a closed cavity, a nose passage and flowing air.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { REST, SOUNDS, groupOf, wordInfo } from './data.js';
import { roofY, floorBase, lowerTeethTop, tongueSpine, sampleSpine, tongueThickness, tongueHalfWidth, lerpParams, smooth, TEETH_X, UPPER_TEETH_BOTTOM } from './geom.js';

const W = (x, y, z = 0) => new THREE.Vector3((x - 300) / 100, (300 - y) / 100, z / 100);
const NX = 36, NA = 32;            // cavity: rings along the mouth x points around
const NR = 26, NM = 22;            // tongue
const NS = 8;                      // lip cross-section points
const ARCH_D = 112, ARCH_W = 64;   // dental arch depth and half-width (px)
const GUM_TOP = 158;               // roof level at the front, so upper teeth hang below it
const hw = () => 72;               // cavity half-width (px)
const sgn = Math.sign;
const sp = (v) => sgn(v) * Math.sqrt(Math.abs(v));      // superellipse (n = 4) helper

const cTop = (x, p) => Math.min(roofY(x, p.nasal) + 2, GUM_TOP + (x > 430 ? 0 : 60));
const cBot = (x, p) => {
  const base = floorBase(p.jaw) + 22, front = lowerTeethTop(p.jaw) + 26;
  return base + (front - base) * smooth(Math.min(1, Math.max(0, (x - 370) / 85)));
};
// Where the cavity wall is at sideways offset z (px), top or bottom.
function wallY(x, z, upper, p) {
  const top = cTop(x, p), bot = cBot(x, p), c = (top + bot) / 2, hh = (bot - top) / 2;
  const v = Math.min(1, Math.abs(z) / hw());
  const Y = Math.pow(1 - Math.pow(v, 4), 0.25);
  return upper ? c - hh * Y : c + hh * Y;
}
const archX = (th) => TEETH_X - ARCH_D * Math.pow(Math.abs(th), 2.5);
const archPoint = (th) => ({ x: archX(th), z: th * ARCH_W });

export function createMouth3D(container, { onPhoneme, onCount } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 2.5; controls.maxDistance = 9;
  controls.target.set(0.8, 0.4, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9b9c4, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(2, 4, 5); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe6ee, 0.7); fill.position.set(5, 0, -3); scene.add(fill);

  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const mats = [];
  let cutawayOn = true;
  const mat = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0, side: THREE.DoubleSide, clippingPlanes: [clip], ...extra });
    mats.push(m); return m;
  };

  // ----- cavity: a closed tube following roof, floor and cheeks -----
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NX * NA * 3), 3));
  const ccol = new Float32Array(NX * NA * 3);
  {
    const top = new THREE.Color(0xf6a8ba), bot = new THREE.Color(0xe9849f), side = new THREE.Color(0xf09cb0);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NA; j++) {
      const th = (j / NA) * Math.PI * 2, cy = Math.cos(th);
      const c = cy > 0.35 ? top : cy < -0.35 ? bot : side;
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
  const cavity = new THREE.Mesh(cg, mat(0xffffff, { vertexColors: true }));
  scene.add(cavity);

  // ----- tongue -----
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
  const tongueMat = mat(0x5b6b82, { roughness: 0.5, emissiveIntensity: 0.28 });
  tongueMat.emissive = new THREE.Color(0x5b6b82);
  const tongue = new THREE.Mesh(tg, tongueMat);
  scene.add(tongue);

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
  const teeth = [];                       // { mesh, upper, side, order }
  const lowerGroup = new THREE.Group(), upperGroup = new THREE.Group();
  scene.add(lowerGroup, upperGroup);
  const archSamples = [];                 // for gums
  for (const upper of [true, false]) {
    for (const side of [1, -1]) {
      let th = 0.0, prevGap = 0;
      KINDS.forEach((kind, n) => {
        const { geo, w, h } = shapes[kind];
        // walk along the arch until half a tooth width has been covered
        const advance = (len) => { let acc = 0; while (acc < len && th < 1) { const p0 = archPoint(th), p1 = archPoint(th + 0.002); acc += Math.hypot(p1.x - p0.x, (p1.z - p0.z)); th += 0.002; } };
        advance(w / 2 + prevGap);
        const t0 = th, pt = archPoint(t0), pt2 = archPoint(t0 + 0.01);
        advance(w / 2); prevGap = 1;
        const mesh = new THREE.Mesh(geo, mat(0xfffdf6, { roughness: 0.3, emissive: new THREE.Color(0x000000) }));
        // face the arch tangent
        const tx = pt2.x - pt.x, tz = pt2.z - pt.z;
        mesh.rotation.y = Math.atan2(-tz, tx);
        mesh.userData = { x: pt.x, z: pt.z * side, upper, h, rotSide: side };
        if (side < 0) mesh.rotation.y = Math.atan2(tz, tx);
        if (!upper) mesh.scale.y = -1;
        (upper ? upperGroup : lowerGroup).add(mesh);
        teeth.push({ mesh, upper, side, n, kind });
      });
    }
  }
  // gum sheets joining the teeth to the cavity wall (rebuilt each frame; cheap)
  const NG = 19;
  const gumGeo = (rows) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NG * 2 * 3), 3));
    const idx = []; for (let i = 0; i < NG - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx); return g;
  };
  const gumMatU = mat(0xe56f8e, { roughness: 0.6 }), gumMatL = mat(0xe56f8e, { roughness: 0.6 });
  const gumU = new THREE.Mesh(gumGeo(), gumMatU), gumL = new THREE.Mesh(gumGeo(), gumMatL);
  scene.add(gumU, gumL);
  // gum ridge tubes (round the teeth roots)
  const ridgeGeo = (upper) => {
    const pts = []; for (let i = 0; i < NG; i++) { const th = (i / (NG - 1)) * 1.7 - 0.85; const a = archPoint(Math.sign(th) * Math.min(0.95, Math.abs(th))); pts.push(new THREE.Vector3((a.x - 300) / 100, 0, a.z / 100)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.045, 8, false);
  };
  const ridgeU = new THREE.Mesh(ridgeGeo(true), gumMatU), ridgeL = new THREE.Mesh(ridgeGeo(false), gumMatL);
  upperGroup.add(ridgeU); lowerGroup.add(ridgeL);

  // ----- back wall + voice box -----
  const wall = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat(0xb5546e));
  wall.rotation.y = Math.PI / 2;
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 12, 30), mat(0x9aa0a6, { emissive: new THREE.Color(0x000000) }));
  glow.rotation.y = Math.PI / 2; glow.position.copy(W(160, 335));
  scene.add(wall, glow);

  // ----- lips: a full soft loop around the opening, plus the cheeks funnel back to the cavity -----
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
  const lipMat = mat(0xff5f8a, { roughness: 0.42 });
  const lips = new THREE.Mesh(lg, lipMat);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NA * 2 * 3), 3));
  {
    const idx = []; for (let j = 0; j < NA; j++) { const a = j * 2, b = ((j + 1) % NA) * 2; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    fg.setIndex(idx);
  }
  const funnel = new THREE.Mesh(fg, mat(0xf3a1b3));
  scene.add(lips, funnel);

  // ----- nose passage (translucent), so "nasal" sounds have somewhere to go -----
  const nosePts = [W(188, 112), W(215, 82), W(300, 66), W(400, 62), W(462, 74), W(488, 96), W(498, 116)];
  const noseCurve = new THREE.CatmullRomCurve3(nosePts);
  const nose = new THREE.Mesh(new THREE.TubeGeometry(noseCurve, 40, 0.07, 10, false), mat(0xf6b8c6, { transparent: true, opacity: 0.38, depthWrite: false }));
  scene.add(nose);

  // ----- air: soft round particles, flowing through the real gaps, fanning out past the lips -----
  const NP = 110;
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NP * 3).fill(1), 3));
  const pm = new THREE.PointsMaterial({ map: dot, size: 0.26, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, clippingPlanes: [clip] });
  mats.push(pm);
  const points = new THREE.Points(pg, pm); points.frustumCulled = false; scene.add(points);
  const jitter = Array.from({ length: NP }, (_, i) => [Math.sin(i * 12.9898) * 0.5, Math.cos(i * 78.233) * 0.5, (i * 0.6180339) % 1]);
  const BG = new THREE.Color(0xeef4ff);

  // ----- state -----
  let cur = { ...REST }, from = { ...REST }, to = { ...REST }, tStart = 0, tDur = 1;
  let color = new THREE.Color(0x5b6b82);
  let seq = null, seqStart = 0, seqIdx = -1, speed = 1, loop = false;
  let raf = 0, running = true, counting = false;

  function build(p) {
    // cavity
    const pos = cg.attributes.position;
    for (let i = 0; i < NX; i++) {
      const x = 150 + (i / (NX - 1)) * (TEETH_X - 150);
      const top = cTop(x, p), bot = cBot(x, p), c = (top + bot) / 2, hh = (bot - top) / 2;
      for (let j = 0; j < NA; j++) {
        const th = (j / NA) * Math.PI * 2;
        const v = W(x, c - hh * sp(Math.cos(th)), hw() * sp(Math.sin(th)));
        pos.setXYZ(i * NA + j, v.x, v.y, v.z);
      }
    }
    pos.needsUpdate = true; cg.computeVertexNormals();
    const top0 = cTop(150, p), bot0 = cBot(150, p);
    wall.position.copy(W(149, (top0 + bot0) / 2)); wall.scale.set(hw() / 100, (bot0 - top0) / 200, 1);
    // tongue
    const spn = sampleSpine(tongueSpine(p), NR);
    const tp = tg.attributes.position;
    for (let i = 0; i < NR; i++) {
      const u = i / (NR - 1), [x, y] = spn[i];
      let th = tongueThickness(u);
      th = Math.max(10, Math.min(th, cBot(x, p) + 6 - y));
      const halfT = th / 2, cy = y + halfT, halfW = tongueHalfWidth(u) * 0.92;
      const front = smooth(Math.max(0, (u - 0.35) / 0.65));
      for (let j = 0; j < NM; j++) {
        const a = (j / NM) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        let yy = cy - s * halfT;
        if (s > 0) {
          yy += p.groove * 9 * s * Math.pow(1 - Math.abs(c), 2) * front;
          yy -= p.sides * 10 * Math.pow(Math.abs(c), 3) * (0.3 + s) * (0.4 + 0.6 * front);
        }
        const v = W(x, yy, c * halfW); tp.setXYZ(i * NM + j, v.x, v.y, v.z);
      }
    }
    const b = W(spn[0][0] - 2, spn[0][1] + 20, 0), t = W(spn[NR - 1][0] + 2, spn[NR - 1][1] + 3, 0);
    tp.setXYZ(NR * NM, b.x, b.y, b.z); tp.setXYZ(NR * NM + 1, t.x, t.y, t.z);
    tp.needsUpdate = true; tg.computeVertexNormals();

    // teeth: upper hang from the gum line, lower stand up from it (and follow the jaw)
    const lt = lowerTeethTop(p.jaw), lt0 = lowerTeethTop(0);
    for (const { mesh, upper } of teeth) {
      const u = mesh.userData;
      const y = upper ? UPPER_TEETH_BOTTOM - u.h / 2 : lt0 + u.h / 2;
      mesh.position.copy(W(u.x, y, u.z));
    }
    lowerGroup.position.y = -(lt - lt0) / 100;
    ridgeU.position.y = (300 - (GUM_TOP + 6)) / 100;
    ridgeL.position.y = (300 - (lt0 + 28)) / 100;
    // gum sheets
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
    const yBot = shut ? yTop + 20 - p.teethLip * 4 : lt + 10 - p.round * 12;
    const cy = (yTop + yBot) / 2, ry = Math.max(3, (yBot - yTop) / 2);
    const xl = 478 + p.round * 16;
    const lp = lg.attributes.position, fp = fg.attributes.position;
    for (let j = 0; j < NA; j++) {
      const a = (j / NA) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const z = rx * sa, y = cy - ry * ca;
      const x = xl + (p.round * 8) * (1 - Math.abs(sa)) - 20 * Math.pow(Math.abs(sa), 3);
      // outward normal in the (z, y) plane
      let nz = sa / rx, ny = -ca / ry; const nl = Math.hypot(nz, ny) || 1; nz /= nl; ny /= nl;
      const r = 5 + 8 * Math.pow(Math.abs(ca), 1.2) * (ca > 0 ? 0.85 : 1);   // fuller at the middle; lower lip a bit fuller
      for (let k = 0; k < NS; k++) {
        const ph = (k / NS) * Math.PI * 2, cp = Math.cos(ph), sph = Math.sin(ph);
        const v = W(x + r * sph * 0.9, y + ny * r * cp, z + nz * r * cp);
        lp.setXYZ(j * NS + k, v.x, v.y, v.z);
      }
      // funnel: cavity rim -> lip loop (inner edge)
      const rimTop = cTop(TEETH_X, p), rimBot = cBot(TEETH_X, p), rc = (rimTop + rimBot) / 2, rh = (rimBot - rimTop) / 2;
      const rv = W(TEETH_X + 1, rc - rh * sp(ca), hw() * 0.96 * sp(sa)); fp.setXYZ(j * 2, rv.x, rv.y, rv.z);
      const lv = W(x - 3, y, z); fp.setXYZ(j * 2 + 1, lv.x, lv.y, lv.z);
    }
    lp.needsUpdate = fp.needsUpdate = true; lg.computeVertexNormals(); fg.computeVertexNormals();
    // voice
    const pulse = p.voiced ? 0.55 + 0.45 * Math.sin(performance.now() / 70) : 0;
    glow.material.color.copy(p.voiced ? color : new THREE.Color(0x9aa0a6));
    glow.material.emissive.copy(color).multiplyScalar(pulse);
    glow.scale.setScalar(1 + (p.voiced ? 0.08 * Math.sin(performance.now() / 70) : 0));
    tongueMat.color.copy(color); tongueMat.emissive.copy(color).multiplyScalar(0.28);
    return { lt, spn };
  }

  // Air follows the real channel: throat -> over the tongue -> through the gap -> out past the lips.
  function airPath(p, spn, lt) {
    const yAt = (x) => { for (let i = 1; i < spn.length; i++) if (spn[i][0] >= x) { const [x0, y0] = spn[i - 1], [x1, y1] = spn[i]; return y0 + ((x - x0) / Math.max(1, x1 - x0)) * (y1 - y0); } return spn[spn.length - 1][1]; };
    const over = (x) => { const ty = yAt(x), rf = Math.min(roofY(x, p.nasal), GUM_TOP); return (ty + rf) / 2 - 4; };
    const gapY = (UPPER_TEETH_BOTTOM + lt) / 2;
    const tipX = spn[spn.length - 1][0];
    const pts = [W(162, 335), W(185, 290), W(215, over(215)), W(280, over(280)), W(350, over(350)), W(Math.min(412, tipX - 8), over(Math.min(412, tipX - 8))), W(TEETH_X + 4, gapY), W(500, gapY - 2), W(580, gapY - 6)];
    return { curve: new THREE.CatmullRomCurve3(pts), gapU: 6 / 8 };
  }
  function updateAir(time, p, spn, lt) {
    const nasalFlow = p.nasal > 0.5, oral = p.air > 0.5;
    if (!nasalFlow && !oral) { pm.opacity = 0; return; }
    pm.opacity = 1;
    const { curve, gapU } = airPath(p, spn, lt);
    const path = nasalFlow ? noseCurve : curve;
    const col = pg.attributes.color, pos = pg.attributes.position;
    for (let i = 0; i < NP; i++) {
      const [jx, jy, ph] = jitter[i];
      const u = ((time * 0.00032 * (0.8 + ph * 0.5)) + ph + i / NP) % 1;
      const v = path.getPoint(u);
      const spread = nasalFlow ? 0.05 : u < gapU ? 0.04 : 0.04 + (u - gapU) * 1.1;
      const fade = nasalFlow ? Math.min(1, u * 6, (1 - u) * 5) : Math.min(1, u * 8, (1 - u) * 2);
      pos.setXYZ(i, v.x + jx * spread * 0.5, v.y + jy * spread, v.z + jx * spread * 1.6);
      const c = color.clone().lerp(BG, 1 - Math.max(0, fade));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = col.needsUpdate = true;
  }

  function setTarget(p, ms) { from = { ...cur }; to = { ...p }; tStart = performance.now(); tDur = Math.max(1, ms); }

  function frame(time) {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    if (seq) {
      const per = 800 / speed, e = time - seqStart, i = Math.floor(e / per);
      if (i >= seq.length) { if (loop) { seqStart = time + 400; seqIdx = -1; } else { seq = null; onPhoneme && onPhoneme(null, -1); } }
      else if (i !== seqIdx && e >= 0) {
        seqIdx = i; const pid = seq[i];
        color = new THREE.Color(groupOf(pid).color);
        setTarget(SOUNDS[pid].params, per * 0.45);
        onPhoneme && onPhoneme(pid, i);
      }
    }
    const k = Math.min(1, (time - tStart) / tDur);
    cur = lerpParams(from, to, smooth(k));
    const { lt, spn } = build(cur);
    updateAir(time, cur, spn, lt);
    clip.normal.z = camera.position.z >= 0 ? -1 : 1;   // always remove the half nearest the camera
    controls.update();
    renderer.render(scene, camera);
  }

  function resize() {
    const r = container.getBoundingClientRect();
    const w = Math.max(200, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const VIEWS = { side: [0.8, 0.45, 6.4], angle: [4.4, 1.9, 4.2], front: [8, 0.6, 1.2], other: [0.8, 0.45, -6.4] };
  function view(name) { const v = VIEWS[name] || VIEWS.side; camera.position.set(...v); controls.update(); }
  function applyCut() {
    mats.forEach((m) => { m.clippingPlanes = cutawayOn ? [clip] : []; m.needsUpdate = true; });
    // without the cut, make the outer skin see-through so the tongue, teeth and air stay visible
    for (const m of [cavity.material, funnel.material, wall.material, gumMatU, gumMatL]) {
      m.transparent = !cutawayOn; m.opacity = cutawayOn ? 1 : 0.3; m.depthWrite = cutawayOn; m.needsUpdate = true;
    }
  }
  view('side'); applyCut();
  raf = requestAnimationFrame(frame);

  return {
    setCutaway(on) { cutawayOn = !!on; applyCut(); },
    showSound(pid) {
      seq = null; const s = SOUNDS[pid];
      if (!s) { color = new THREE.Color(0x5b6b82); setTarget(REST, 400); return; }
      color = new THREE.Color(groupOf(pid).color); setTarget(s.params, 450);
    },
    playWord(word, opts = {}) {
      const ids = wordInfo(word).segs.flatMap((s) => s.p).filter((p) => SOUNDS[p]);
      if (!ids.length) return;
      loop = !!opts.loop; seq = ids; seqStart = performance.now(); seqIdx = -1;
    },
    stop() { seq = null; loop = false; onPhoneme && onPhoneme(null, -1); },
    // Light up the baby teeth one at a time: top right to left, then bottom.
    countTeeth() {
      if (counting) return; counting = true;
      // right to left across the top, then left to right along the bottom
      const row = (up) => teeth.filter((t) => t.upper === up).sort((x, y) => (y.side * (up ? 1 : -1) - x.side * (up ? 1 : -1)) || ((x.n - y.n) * x.side * (up ? 1 : -1)));
      const top = row(true), bottom = row(false);
      const list = [...top, ...bottom];
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
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); },
    get domElement() { return renderer.domElement; },
    get toothCount() { return teeth.length; },
    _dbg: { funnel, lips, cavity, gumU, gumL, nose, wall },
  };
}
