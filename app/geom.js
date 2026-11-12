// Shared side-view (sagittal) geometry. Units are "px" in a 600 x 420 box, front of the mouth on the right.
// The 2D diagram draws this directly; the 3D model sweeps the same profile sideways.

export const TEETH_X = 455;       // front of the teeth
export const UPPER_TEETH_BOTTOM = 190;
export const RIDGE_X = 440;

// Roof of the mouth (y grows downward). Soft palate drops when the nose is open (m, n, ng).
const ROOF = [[150, 160], [175, 122], [215, 106], [275, 96], [340, 92], [400, 100], [430, 118], [446, 140], [452, 168], [455, UPPER_TEETH_BOTTOM]];

function interp(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

export function roofY(x, nasal = 0) {
  let y = x > TEETH_X ? UPPER_TEETH_BOTTOM : interp(ROOF, x);
  if (x < 260) y += nasal * 34 * Math.max(0, (260 - x) / 110) * Math.min(1, (x - 140) / 20);
  return y;
}
export const floorBase = (jaw) => 278 + jaw * 62;
export const lowerTeethTop = (jaw) => 200 + jaw * 74;

// Tongue spine: list of [x, y] from the back of the throat to the tip, for one set of params.
export function tongueSpine(p) {
  const fb = floorBase(p.jaw) - 22;
  const tipX = 330 + p.tipZ * 150;
  const hy = (x, h) => {
    const roof = roofY(Math.min(x, TEETH_X - 8), p.nasal) + 9;
    const lim = x > TEETH_X ? UPPER_TEETH_BOTTOM + 8 : roof;
    return fb - h * (fb - lim);
  };
  const pts = [
    [152, hy(185, p.back * 0.8 + 0.1) + 6],
    [190, hy(185, p.back * 0.85 + 0.1)],
    [235, hy(235, p.back)],
    [300, hy(300, p.mid)],
    [370, hy(370, p.blade)],
    [Math.min(tipX - 22, 420), hy(Math.min(tipX - 22, 420), (p.blade + p.tipY) / 2)],
    [tipX, hy(tipX, p.tipY)],
  ];
  // tidy x order
  for (let i = 1; i < pts.length; i++) if (pts[i][0] <= pts[i - 1][0]) pts[i][0] = pts[i - 1][0] + 6;
  return pts;
}

// Smooth the spine into n samples with Catmull-Rom.
export function sampleSpine(pts, n = 28) {
  const out = [];
  const g = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * (pts.length - 1);
    const i = Math.min(Math.floor(t), pts.length - 2);
    const f = t - i;
    const [p0, p1, p2, p3] = [g(i - 1), g(i), g(i + 1), g(i + 2)];
    const c = (a, b, cc, d) => 0.5 * ((2 * b) + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f * f + (-a + 3 * b - 3 * cc + d) * f * f * f);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

// Tongue thickness (px) at fraction u (0 back .. 1 tip).
export const tongueThickness = (u) => 12 + 62 * Math.pow(1 - u, 0.6) + 16 * (1 - u);
// Half width (px, sideways) at fraction u, for 3D.
export const tongueHalfWidth = (u) => 8 + 48 * Math.pow(1 - Math.pow(u, 2.2), 0.6);

export function lerpParams(a, b, t) {
  const o = {};
  for (const k in a) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}
export const smooth = (t) => t * t * (3 - 2 * t);
