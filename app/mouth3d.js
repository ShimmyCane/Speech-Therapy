// 3D model of a mouth (stylised, built from the same side-view geometry as the 2D diagrams).
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { REST, SOUNDS, groupOf, wordInfo } from './data.js';
import { roofY, floorBase, lowerTeethTop, tongueSpine, sampleSpine, tongueThickness, tongueHalfWidth, lerpParams, smooth, TEETH_X, UPPER_TEETH_BOTTOM } from './geom.js';

const W = (x, y, z = 0) => new THREE.Vector3((x - 300) / 100, (300 - y) / 100, z / 100);
const NX = 30, NT = 17;            // roof/floor grid
const NR = 26, NM = 22;            // tongue rings x points per ring
const hw = (x) => 62 - 14 * smooth(Math.min(1, Math.max(0, (x - 300) / 155)));

export function createMouth3D(container, { onPhoneme } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 2.5; controls.maxDistance = 9;
  controls.target.set(0.55, 0.45, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcdb7c0, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(2, 4, 5); scene.add(sun);

  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const clipOn = [clip];
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, clippingPlanes: clipOn, clipShadows: true, ...extra });

  // ----- roof & floor grids -----
  function gridMesh(color) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NX * NT * 3), 3));
    const idx = [];
    for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NT - 1; j++) {
      const a = i * NT + j, b = a + 1, c = a + NT, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    return new THREE.Mesh(g, mat(color));
  }
  const roof = gridMesh(0xf4a0b4), floor = gridMesh(0xf08aa3);
  scene.add(roof, floor);

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
  const tongueMat = mat(0x5b6b82, { roughness: 0.55 });
  const tongue = new THREE.Mesh(tg, tongueMat);
  scene.add(tongue);

  // ----- teeth -----
  const toothGeo = new THREE.BoxGeometry(0.1, 0.3, 0.13);
  const toothMat = mat(0xffffff, { roughness: 0.35 });
  const upper = [], lower = [];
  for (let k = -6; k <= 6; k++) {
    const th = k / 6;
    for (const arr of [upper, lower]) {
      const m = new THREE.Mesh(toothGeo, toothMat);
      m.userData = { x: TEETH_X - 112 * th * th, z: th * 64 };
      m.rotation.y = Math.atan2(-224 * th, 64);   // follow the curve of the arch
      arr.push(m); scene.add(m);
    }
  }

  // ----- back wall + voice box -----
  const wall = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat(0xb5546e));
  wall.scale.set(0.7, 1.15, 1); wall.rotation.y = Math.PI / 2; wall.position.copy(W(148, 280));
  scene.add(wall);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 12, 30), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, emissive: 0x000000, clippingPlanes: clipOn }));
  glow.rotation.y = Math.PI / 2; glow.position.copy(W(158, 330)); scene.add(glow);

  // ----- lips -----
  const lipGeo = new THREE.TorusGeometry(1, 0.1, 12, 28, Math.PI);
  lipGeo.rotateY(Math.PI / 2);
  const lipMat = mat(0xff6f93, { roughness: 0.5 });
  const upperLip = new THREE.Mesh(lipGeo, lipMat);
  const lowerLip = new THREE.Mesh(lipGeo.clone().rotateX(Math.PI), lipMat);
  scene.add(upperLip, lowerLip);

  // ----- air particles -----
  const NP = 40;
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const pm = new THREE.PointsMaterial({ color: 0x00a3a8, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(pg, pm); points.frustumCulled = false; scene.add(points);

  // ----- state -----
  let cur = { ...REST }, from = { ...REST }, to = { ...REST }, tStart = 0, tDur = 1;
  let colorHex = 0x5b6b82;
  let seq = null, seqStart = 0, seqIdx = -1, speed = 1, loop = false;
  let raf = 0, running = true, w = 0, h = 0;

  function build(p) {
    // roof + floor
    for (const [mesh, isRoof] of [[roof, true], [floor, false]]) {
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < NX; i++) {
        const x = 150 + (i / (NX - 1)) * (TEETH_X - 150);
        for (let j = 0; j < NT; j++) {
          const t = (j / (NT - 1)) * 2 - 1;
          let y, z = t * hw(x);
          if (isRoof) y = roofY(x, p.nasal) + 46 * t * t * (0.6 + 0.4 * smooth((x - 150) / 300));
          else y = floorBase(p.jaw) + 22 - 70 * t * t * 0.9 + 32 * (1 - t * t) * 0;
          const v = W(x, y, z); pos.setXYZ(i * NT + j, v.x, v.y, v.z);
        }
      }
      pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
    }
    // tongue
    const sp = sampleSpine(tongueSpine(p), NR);
    const pos = tg.attributes.position;
    for (let i = 0; i < NR; i++) {
      const u = i / (NR - 1);
      const [x, y] = sp[i];
      const th = tongueThickness(u), halfT = th / 2, cy = y + halfT;
      const halfW = tongueHalfWidth(u);
      const front = smooth(Math.max(0, (u - 0.35) / 0.65));
      for (let j = 0; j < NM; j++) {
        const a = (j / NM) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        let yy = cy - s * halfT;
        if (s > 0) {
          yy += p.groove * 9 * s * Math.pow(1 - Math.abs(c), 2) * front;           // groove down the middle
          yy -= p.sides * 10 * Math.pow(Math.abs(c), 3) * (0.3 + s) * (0.4 + 0.6 * front); // raised or lowered edges
        }
        const v = W(x, yy, c * halfW);
        pos.setXYZ(i * NM + j, v.x, v.y, v.z);
      }
    }
    const b = W(sp[0][0] - 2, sp[0][1] + tongueThickness(0) / 2, 0), t = W(sp[NR - 1][0] + 2, sp[NR - 1][1] + 3, 0);
    pos.setXYZ(NR * NM, b.x, b.y, b.z); pos.setXYZ(NR * NM + 1, t.x, t.y, t.z);
    pos.needsUpdate = true; tg.computeVertexNormals();
    // teeth
    const lt = lowerTeethTop(p.jaw);
    upper.forEach((m) => { const p3 = W(m.userData.x, UPPER_TEETH_BOTTOM - 15, m.userData.z); m.position.copy(p3); });
    lower.forEach((m) => { const p3 = W(m.userData.x, lt + 15, m.userData.z); m.position.copy(p3); });
    // lips
    const rf = p.round * 16, sp2 = p.spread * 8;
    const shut = Math.max(p.lipsShut, p.teethLip);
    const rx = Math.max(16, 36 + sp2 - p.round * 16);
    const lipTop = shut ? UPPER_TEETH_BOTTOM + 3 : lt + 6;
    const xl = 488 + rf - 14;
    upperLip.position.copy(W(xl, UPPER_TEETH_BOTTOM - 4)); upperLip.scale.set(0.9, 0.28, rx / 100);
    lowerLip.position.copy(W(xl, lipTop)); lowerLip.scale.set(0.9, 0.28, rx / 100);
    // voice
    glow.material.emissive.setHex(p.voiced ? colorHex : 0x000000);
    glow.material.color.setHex(p.voiced ? colorHex : 0x9aa0a6);
    glow.material.emissiveIntensity = p.voiced ? 0.9 : 0;
    tongueMat.color.setHex(colorHex);
    pm.color.setHex(colorHex);
  }

  function airCurve(p) {
    const lt = lowerTeethTop(p.jaw);
    return new THREE.CatmullRomCurve3([W(165, 330), W(200, 300), W(280, 235), W(380, 205), W(440, (lt + UPPER_TEETH_BOTTOM) / 2), W(540, (lt + UPPER_TEETH_BOTTOM) / 2 - 4)]);
  }
  function noseCurve(p) {
    return new THREE.CatmullRomCurve3([W(190, roofY(190, p.nasal) - 10), W(260, 70), W(400, 56), W(520, 100), W(560, 110)]);
  }
  function updateAir(time, p) {
    const vis = p.air > 0.5 || p.nasal > 0.5;
    pm.opacity = vis ? 0.9 : 0;
    if (!vis) return;
    const curve = p.nasal > 0.5 ? noseCurve(p) : airCurve(p);
    const arr = pg.attributes.position;
    for (let i = 0; i < NP; i++) {
      const u = ((time * 0.00045) + i / NP) % 1;
      const v = curve.getPoint(u);
      arr.setXYZ(i, v.x, v.y, v.z + Math.sin(i * 12.9) * 0.06);
    }
    arr.needsUpdate = true;
  }

  function setTarget(p, ms) { from = { ...cur }; to = { ...p }; tStart = performance.now(); tDur = Math.max(1, ms); }

  function frame(time) {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    // word sequence
    if (seq) {
      const per = 800 / speed;
      const e = time - seqStart, i = Math.floor(e / per);
      if (i >= seq.length) { if (loop) { seqStart = time + 400; seqIdx = -1; } else { seq = null; onPhoneme && onPhoneme(null, -1); } }
      else if (i !== seqIdx && e >= 0) {
        seqIdx = i; const pid = seq[i];
        colorHex = new THREE.Color(groupOf(pid).color).getHex();
        setTarget(SOUNDS[pid].params, per * 0.45);
        onPhoneme && onPhoneme(pid, i);
      }
    }
    const k = Math.min(1, (time - tStart) / tDur);
    cur = lerpParams(from, to, smooth(k));
    build(cur);
    updateAir(time, cur);
    controls.update();
    renderer.render(scene, camera);
  }

  function resize() {
    const r = container.getBoundingClientRect();
    w = Math.max(200, Math.round(r.width)); h = Math.max(200, Math.round(r.height));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const VIEWS = { side: [0.55, 0.5, 6.2], angle: [3.6, 2.3, 4.6], front: [7, 0.7, 0.2], top: [0.6, 6.5, 1.2] };
  function view(name) { const v = VIEWS[name] || VIEWS.side; camera.position.set(...v); controls.update(); }
  view('side');
  build(cur); raf = requestAnimationFrame(frame);

  return {
    setCutaway(on) { clipOn.length = 0; if (on) clipOn.push(clip); [roof, floor, tongue, wall, glow, upperLip, lowerLip, ...upper, ...lower].forEach((m) => { m.material.clippingPlanes = on ? [clip] : []; m.material.needsUpdate = true; }); },
    showSound(pid) {
      seq = null; const s = SOUNDS[pid]; if (!s) { colorHex = 0x5b6b82; setTarget(REST, 400); return; }
      colorHex = new THREE.Color(groupOf(pid).color).getHex(); setTarget(s.params, 450);
    },
    playWord(word, opts = {}) {
      const ids = wordInfo(word).segs.flatMap((s) => s.p).filter((p) => SOUNDS[p]);
      if (!ids.length) return;
      loop = !!opts.loop; seq = ids; seqStart = performance.now(); seqIdx = -1;
    },
    stop() { seq = null; loop = false; onPhoneme && onPhoneme(null, -1); },
    setSpeed(s) { speed = s; },
    view, resize,
    pause(p) { running = p === undefined ? false : !p; },
    resume() { running = true; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); renderer.domElement.remove(); },
    get domElement() { return renderer.domElement; },
  };
}
