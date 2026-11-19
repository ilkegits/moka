// The eight monuments as 3D models. Every mesh carries a role (userData.role); a look (styles.js) turns roles into materials.
import * as THREE from 'three';

let DET = 1;   // detail: 1 full, 0 low-poly
const seg = (hi, lo) => (DET ? hi : lo);
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647);

function tag(m, role, o = {}) { m.userData.role = role; Object.assign(m.userData, o); m.castShadow = true; m.receiveShadow = true; return m; }
function at(m, x = 0, y = 0, z = 0, ry = 0) { m.position.set(x, y, z); m.rotation.y = ry; return m; }
const mesh = (g, role, o) => tag(new THREE.Mesh(g, null), role, o);

// a box standing on y
function box(w, h, d, role, x = 0, y = 0, z = 0, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return at(mesh(g, role), x, y, z, ry); }
// a cylinder standing on y
function cyl(rt, rb, h, n, role, x = 0, y = 0, z = 0, ry = 0) { const g = new THREE.CylinderGeometry(rt, rb, h, n, 1); g.translate(0, h / 2, 0); return at(mesh(g, role), x, y, z, ry); }
function sph(r, role, x = 0, y = 0, z = 0, n = 32) { return at(mesh(new THREE.SphereGeometry(r, seg(n, 8), seg(Math.round(n * .7), 6)), role), x, y, z); }
function torus(R, r, role, y = 0) { const m = mesh(new THREE.TorusGeometry(R, r, seg(8, 4), seg(64, 16)), role); m.rotation.x = Math.PI / 2; m.position.y = y; return m; }
// a rod between two points
function rod(a, b, r, role, r2 = r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const m = mesh(new THREE.CylinderGeometry(r2, r, len, seg(12, 5), 1), role);
  m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return m;
}
// a block whose walls lean in as they rise (Tibetan and brick walls)
function batter(wB, dB, wT, dT, h, role, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setXYZ(i, p.getX(i) * (top ? wT : wB), (p.getY(i) + .5) * h, p.getZ(i) * (top ? dT : dB)); }
  g.computeVertexNormals(); return at(mesh(g, role), x, y, z);
}
/* A Chinese roof: concave, shallow at the eaves and steep at the top, with the corners swept up.
   plan: n = 4 (w x d rectangle, a ridge of length ridge*w) or n = 6/8 (polygon of radius r, round to a point).
   inner > 0 makes an eave skirt that stops at a smaller copy of the outline (a roof between two floors). */
function roof({ n = 4, w = 4, d = 4, r = 2, h = 1, ridge = .45, inner = 0, lift = .35, flare = .12, concave = 1.9, role = 'roof', y = 0, x = 0, z = 0, ry = 0 }) {
  const corners = n === 4 ? [[w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]]
    : Array.from({ length: n }, (_, i) => { const a = (i + .5) / n * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r]; });
  const S = seg(10, 2), T = seg(10, 3), out = [];
  for (let i = 0; i < corners.length; i++) { const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % corners.length];
    for (let s = 0; s < S; s++) { const q = s / S, c = Math.pow(Math.abs(2 * q - 1), 5); out.push([ax + (bx - ax) * q, az + (bz - az) * q, c]); } }
  const rl = ridge * w / 2, target = ([px, pz]) => inner ? [px * inner, pz * inner] : n === 4 ? [Math.max(-rl, Math.min(rl, px * (rl / (w / 2)))), 0] : [0, 0];
  const pos = [], idx = [], N = out.length;
  for (let t = 0; t <= T; t++) { const k = t / T;
    for (const [px, pz, c] of out) { const [tx, tz] = target([px, pz]), fl = 1 + flare * c * Math.pow(1 - k, 2);
      pos.push((px + (tx - px) * k) * fl, h * Math.pow(k, concave) + lift * c * Math.pow(1 - k, 2.4), (pz + (tz - pz) * k) * fl); } }
  for (let t = 0; t < T; t++) for (let i = 0; i < N; i++) { const a = t * N + i, b = t * N + (i + 1) % N, c2 = a + N, d2 = b + N; idx.push(a, c2, b, b, c2, d2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const grp = new THREE.Group(), m = mesh(g, role, { double: true }); grp.add(m);
  if (n === 4 && !inner) { const rb = box(rl * 2 + .2, .14, .16, 'ridge', 0, h - .03, 0); grp.add(rb);   // the ridge and its curled ends
    [-1, 1].forEach(sx => { const e = box(.12, .3, .14, 'ridge', sx * (rl + .1), h - .02, 0); e.rotation.z = sx * -.35; grp.add(e); }); }
  grp.position.set(x, y, z); grp.rotation.y = ry; return grp;
}
// a round concave roof (Temple of Heaven), optionally a ring that stops at rIn
function roundRoof(R, h, role, y, rIn = 0) {
  const pts = [], T = seg(14, 3); for (let t = 0; t <= T; t++) { const k = t / T; pts.push(new THREE.Vector2(R - (R - rIn) * k, h * Math.pow(k, 1.7))); }
  if (!rIn) pts.push(new THREE.Vector2(0.001, h));
  const g = new THREE.LatheGeometry(pts, seg(64, 10)); const m = mesh(g, role, { double: true }); m.position.y = y; return m;
}
// many copies of one small part
function many(g, role, list, color) {
  const m = new THREE.InstancedMesh(g, null, list.length), o = new THREE.Object3D(), col = new THREE.Color();
  list.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3] || 0, 0); o.scale.setScalar(p[4] || 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (color) m.setColorAt(i, col.set(color(i))); });
  return tag(m, role, { inst: true });
}
// windows along the front (z+) face of a block
function windowsOn(x0, x1, y0, y1, z, cols, rows, role = 'window', ry = 0, ww = .16, wh = .26) {
  const L = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + (x1 - x0) * (c + .5) / cols, y = y0 + (y1 - y0) * (r + .5) / rows;
    L.push(ry ? [Math.sin(ry) * z + Math.cos(ry) * x, y, Math.cos(ry) * z - Math.sin(ry) * x, ry] : [x, y, z, 0]); }
  const g = new THREE.BoxGeometry(ww, wh, .06); return many(g, role, L);
}

/* ---------- the stage every monument stands on: a round base, grass, maybe water, trees and tiny people ---------- */
function stage(R, { water = 0, waterRole = 'water', people = 40, trees = 28, keep = 3, seed = 3 } = {}) {
  const g = new THREE.Group(), r = rnd(seed);
  g.add(cyl(R + .25, R + .45, .9, seg(96, 14), 'plinth', 0, -.9, 0));
  g.add(cyl(R, R, .06, seg(96, 14), 'grass', 0, -.06, 0));
  if (water) {   // the front of the disc is a river or a lake
    const sh = new THREE.Shape(), a = Math.asin(Math.min(1, water / R));
    sh.absarc(0, 0, R, a, Math.PI - a, false); sh.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    const wg = new THREE.ShapeGeometry(sh, seg(48, 8)); wg.rotateX(Math.PI / 2); wg.scale(1, 1, 1);
    const w = mesh(wg, waterRole, { double: true }); w.position.y = .02; g.add(w);
    g.add(box(2 * Math.sqrt(R * R - water * water), .12, .14, 'stone', 0, 0, water));
  }
  const ok = (x, z) => Math.hypot(x, z) > keep && Math.hypot(x, z) < R - .5 && !(water && z > water - .3);
  for (let i = 0, n = 0; i < 400 && n < trees; i++) { const a = r() * Math.PI * 2, d = keep + r() * (R - keep - .6), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!ok(x, z)) continue; n++;
    const s = .6 + r() * .6; g.add(cyl(.05 * s, .07 * s, .5 * s, seg(6, 4), 'trunk', x, 0, z));
    if (r() < .5) g.add(at(mesh(new THREE.ConeGeometry(.42 * s, 1.3 * s, seg(10, 5)), 'tree'), x, .5 * s + .6 * s, z));
    else g.add(sph(.5 * s, 'tree', x, .75 * s, z, 12)); }
  if (people) { const L = []; for (let i = 0, n = 0; i < 600 && n < people; i++) { const a = r() * Math.PI * 2, d = keep - .4 + r() * (R - keep), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!ok(x, z)) continue; n++; L.push([x, 0, z, r() * 6, .9 + r() * .3]); }
    const body = new THREE.CapsuleGeometry(.055, .16, 2, 6); body.translate(0, .14, 0);
    const pal = ['#C9302A', '#2F5D8A', '#E8B44C', '#F2EEE6', '#4E9A72', '#7B4B67', '#2A2A2A', '#E07A3A'];
    g.add(many(body, 'person', L, i => pal[i % pal.length]));
    const head = new THREE.SphereGeometry(.05, 6, 5); head.translate(0, .32, 0); g.add(many(head, 'skin', L)); }
  return g;
}
function boat(x, z, ry, s = 1) {
  const g = new THREE.Group(); g.add(box(1.2 * s, .14 * s, .38 * s, 'boat', 0, 0, 0)); g.add(box(.7 * s, .18 * s, .3 * s, 'cabin', -.1 * s, .14 * s, 0)); g.add(box(.36 * s, .12 * s, .24 * s, 'boat', -.1 * s, .32 * s, 0));
  return at(g, x, .02, z, ry);
}

/* ---------- 1 Shanghai: the Oriental Pearl Tower ---------- */
function pearl() {
  const g = new THREE.Group(), A = [Math.PI / 2, Math.PI / 2 + 2.094, Math.PI / 2 + 4.189];
  g.add(cyl(1.7, 1.9, .45, seg(48, 8), 'glass'));
  A.forEach(a => {
    g.add(rod([Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6], [Math.cos(a) * .5, 4.3, Math.sin(a) * .5], .34, 'concrete', .28));
    const b = a + Math.PI / 3; g.add(rod([Math.cos(b) * .62, 0, Math.sin(b) * .62], [Math.cos(b) * .62, 10.6, Math.sin(b) * .62], .27, 'concrete'));
    g.add(sph(.5, 'pearl', Math.cos(b) * 2.3, .5, Math.sin(b) * 2.3, 20));
  });
  const ball = (r, y) => { g.add(sph(r, 'pearl', 0, y, 0, 48)); [-.55, -.25, .25, .55].forEach(q => g.add(torus(r * Math.sqrt(1 - q * q) * 1.003, .025, 'glassBand', y + r * q)));
    g.add(torus(r * 1.04, .07, 'concrete', y)); };
  ball(1.85, 4.6);
  [6.9, 7.45, 8.0, 8.55, 9.1].forEach((y, i) => g.add(sph(.36, 'pearl', i % 2 ? .22 : -.22, y, i % 2 ? -.12 : .12, 20)));
  ball(1.25, 10.3);
  g.add(cyl(.22, .26, 1.3, seg(16, 6), 'concrete', 0, 11.5));
  g.add(sph(.52, 'pearl', 0, 13.2, 0, 24)); g.add(torus(.58, .04, 'concrete', 13.2));
  g.add(cyl(.03, .15, 3.2, seg(12, 5), 'steel', 0, 13.6)); [14.1, 14.8, 15.5].forEach((y, i) => g.add(cyl(.2 - i * .04, .2 - i * .04, .08, 12, 'steel', 0, y)));
  g.add(sph(.08, 'light', 0, 16.85, 0, 8));
  return g;
}
/* ---------- 2 Hangzhou: the Leifeng Pagoda ---------- */
function leifeng() {
  const g = new THREE.Group(), n = 8, rot = Math.PI / 8;
  g.add(cyl(4.0, 4.3, .5, n, 'stone', 0, 0, 0, rot)); g.add(cyl(3.4, 3.5, .45, n, 'stone', 0, .5, 0, rot));
  let y = .95;
  for (let i = 0; i < 5; i++) {
    const r = 2.45 - i * .26, h = 1.35;
    if (i) g.add(cyl(r + .42, r + .42, .1, n, 'stone', 0, y, 0, rot));
    g.add(cyl(r, r, h, n, 'wallRed', 0, y, 0, rot));
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + rot; g.add(cyl(.075, .075, h, seg(8, 4), 'column', Math.cos(a) * r, y, Math.sin(a) * r));
      const fa = a + Math.PI / n, fr = r * Math.cos(Math.PI / n) + .01; g.add(box(.5, .78, .05, k % 2 ? 'lattice' : 'door', Math.cos(fa) * fr, y + .12, Math.sin(fa) * fr, Math.PI / 2 - fa));
      if (i) g.add(cyl(.03, .03, .32, 4, 'stone', Math.cos(a) * (r + .4), y + .1, Math.sin(a) * (r + .4))); }
    g.add(cyl(r + .14, r, .22, n, 'band', 0, y + h, 0, rot));
    const top = i === 4;
    g.add(roof({ n, r: r + 1.05, h: top ? 1.9 : .62, inner: top ? 0 : r / (r + 1.05), lift: .42, role: 'roofBronze', y: y + h + .12, ry: rot }));
    y += h + (top ? 0 : .52);
  }
  g.add(cyl(.05, .09, 2.4, 8, 'gold', 0, y + 1.6)); [0, .32, .62, .9].forEach((d, i) => g.add(cyl(.26 - i * .04, .26 - i * .04, .07, 16, 'gold', 0, y + 2.1 + d)));
  g.add(sph(.17, 'gold', 0, y + 3.2, 0, 12)); g.add(sph(.1, 'gold', 0, y + 3.5, 0, 10));
  return g;
}
/* ---------- 3 Wuhan: the Yellow Crane Tower ---------- */
function crane() {
  const g = new THREE.Group();
  g.add(batter(10, 10, 9.4, 9.4, .7, 'stone')); g.add(batter(8.6, 8.6, 8.2, 8.2, .45, 'stone', 0, .7));
  [0, 1, 2].forEach(i => g.add(box(2.4, .16, .5, 'stone', 0, i * .2, 5.0 + .5 - i * .45 + 0)));   // steps at the front
  let y = 1.15;
  for (let i = 0; i < 5; i++) {
    const w = 5.4 - i * .62, h = 1.3, top = i === 4;
    g.add(box(w, h, w, 'wallRed', 0, y));
    for (let s = 0; s < 4; s++) { const ry = s * Math.PI / 2, nc = Math.max(3, Math.round(w / .62));
      for (let c = 0; c <= nc; c++) { const u = -w / 2 + w * c / nc; g.add(cyl(.07, .07, h, seg(8, 4), 'column', Math.cos(ry) * u + Math.sin(ry) * w / 2, y, Math.cos(ry) * w / 2 - Math.sin(ry) * u)); }
      const lat = box(w * .7, h * .62, .04, 'lattice', 0, y + .22, 0, ry); lat.position.set(Math.sin(ry) * (w / 2 + .01), y + .22, Math.cos(ry) * (w / 2 + .01)); g.add(lat);
      // a wing on every side under its own little roof: the tower's cross plan
      if (!top) { const wing = new THREE.Group(); wing.add(box(w * .42, h * .8, .7, 'wallRed', 0, 0, w / 2 + .35)); wing.add(box(w * .3, h * .5, .02, 'lattice', 0, .1, w / 2 + .71));
        wing.add(roof({ w: w * .42 + .9, d: 1.5, h: .55, ridge: .5, lift: .32, role: 'roofGold', y: h * .8 + .02, z: w / 2 + .45 }));
        wing.position.y = y; wing.rotation.y = ry; g.add(wing); } }
    g.add(box(w + .24, .2, w + .24, 'band', 0, y + h));
    g.add(roof(top ? { w: w + 2.0, d: w + 2.0, h: 2.0, ridge: .38, lift: .55, role: 'roofGold', y: y + h + .16 }
      : { w: w + 1.9, d: w + 1.9, h: .7, inner: w / (w + 1.9), lift: .5, role: 'roofGold', y: y + h + .16 }));
    y += h + (top ? 0 : .62);
  }
  g.add(cyl(.05, .05, .5, 8, 'gold', 0, y + 2.1)); g.add(sph(.32, 'gold', 0, y + 2.75, 0, 16)); g.add(sph(.2, 'gold', 0, y + 3.15, 0, 12)); g.add(cyl(.02, .04, .4, 6, 'gold', 0, y + 3.3));
  return g;
}
/* ---------- 4 Guangzhou: the Canton Tower ---------- */
function canton() {
  const g = new THREE.Group(), H = 12.5, rB = 2.5, rT = 1.65, tw = 2.36, N = seg(24, 12);
  g.add(cyl(3.3, 3.5, .35, seg(48, 10), 'stone'));
  g.add(cyl(.62, .7, H + .4, seg(24, 8), 'concrete', 0, .3));
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2;
    g.add(rod([Math.cos(a) * rB, .3, Math.sin(a) * rB], [Math.cos(a + tw) * rT, H, Math.sin(a + tw) * rT], .055, 'steel'));
    if (i % 2 === 0) g.add(rod([Math.cos(a) * rB, .3, Math.sin(a) * rB], [Math.cos(a - tw * .6) * rT, H, Math.sin(a - tw * .6) * rT], .03, 'steel2')); }
  const hw = t => Math.sqrt((1 - t) * (1 - t) * rB * rB + t * t * rT * rT + 2 * t * (1 - t) * rB * rT * Math.cos(tw));
  for (let j = 1; j < seg(28, 10); j++) { const t = j / seg(28, 10); g.add(torus(hw(t), .035, 'steel', .3 + (H - .3) * t)); }
  g.add(cyl(rT + .15, rT + .05, .5, seg(48, 10), 'glass', 0, H)); g.add(cyl(rT * .8, rT + .15, .35, seg(48, 10), 'concrete', 0, H + .5));
  g.add(cyl(.22, .3, 3.0, seg(16, 6), 'concrete', 0, H + .85)); g.add(cyl(.02, .1, 3.4, 8, 'steel', 0, H + 3.85)); g.add(sph(.07, 'light', 0, H + 7.3, 0, 8));
  return g;
}
/* ---------- 5 Chongqing: Hongya Cave ---------- */
function hongya() {
  const g = new THREE.Group(), r = rnd(11);
  g.add(box(14.5, 11.5, 3.2, 'rock', 0, 0, -4.4)); for (let i = 0; i < 9; i++) g.add(box(1.6 + r() * 2.4, 1.2 + r() * 3, 1.2, 'rock', -6.5 + r() * 13, r() * 9, -2.6 - r() * .4));
  g.add(box(14.6, .2, 3.4, 'grass', 0, 11.5, -4.4));
  [[-5.6, 1.2, 2.2], [-3.9, 1.0, 3.4], [3.6, 1.1, 2.8], [5.4, 1.3, 1.8]].forEach(([x, w, h]) => { g.add(box(w, h, w, 'concrete', x, 11.7, -4.6)); g.add(windowsOn(x - w / 2 + .1, x + w / 2 - .1, 11.8, 11.6 + h, -4.6 + w / 2 + .01, 4, Math.round(h / .45), 'windowLit', 0, .12, .18)); });
  for (let x = -5; x <= 5; x += .9) g.add(cyl(.09, .09, 1.25, seg(8, 4), 'wood', x, 0, -.1));
  for (let x = -5; x < 5; x += 1.8) g.add(rod([x, .1, -.1], [x + .9, 1.15, -.1], .04, 'wood')), g.add(rod([x + .9, .1, -.1], [x + 1.8, 1.15, -.1], .04, 'wood'));
  let y = 1.2;
  for (let i = 0; i < 6; i++) {
    const w = 11.4 - i * 1.15, d = 2.3, h = 1.3, z = -.9 - i * .42;
    g.add(box(w, h, d, 'plaster', 0, y, z));
    for (let x = -w / 2; x <= w / 2 + .01; x += w / Math.round(w / 1.1)) g.add(box(.1, h, .08, 'wood', x, y, z + d / 2 + .02));
    g.add(windowsOn(-w / 2 + .2, w / 2 - .2, y + .25, y + h - .15, z + d / 2 + .03, Math.round(w / .42), 2, 'windowLit', 0, .2, .32));
    g.add(box(w, .12, .5, 'wood', 0, y - .02, z + d / 2 + .2));   // the walkway in front of each floor
    g.add(roof({ w: w + .7, d: d + .9, h: .55, ridge: .9, lift: .22, role: 'roofGrey', y: y + h, z }));
    for (let k = 0; k < Math.round(w / 3); k++) { const gx = -w / 2 + w * (k + .5) / Math.round(w / 3) + (r() - .5) * .6;   // little gables along the roofs
      g.add(box(.9, .5, .8, 'plaster', gx, y + h + .25, z + .3)); g.add(roof({ w: 1.5, d: 1.3, h: .55, ridge: .3, lift: .25, role: 'roofGrey', y: y + h + .75, x: gx, z: z + .3, ry: Math.PI / 2 })); }
    for (let x = -w / 2 + .4; x < w / 2; x += .9) g.add(sph(.09, 'lantern', x, y + h - .12, z + d / 2 + .45, 10));
    y += h + .55;
  }
  [[-1.3, 1.0], [1.3, 1.0]].forEach(([x, s]) => { g.add(box(1.1 * s, 1.0, 1.1 * s, 'plaster', x, y, -3.6)); g.add(roof({ n: 4, w: 1.9, d: 1.9, h: 1.1, ridge: .02, lift: .3, role: 'roofGrey', y: y + 1.0, x, z: -3.6 })); });
  g.add(box(1.4, 1.6, 1.4, 'plaster', 0, y, -3.4)); g.add(roof({ w: 2.4, d: 2.4, h: .6, inner: .58, lift: .3, role: 'roofGrey', y: y + 1.6, z: -3.4 }));
  g.add(box(.9, .9, .9, 'plaster', 0, y + 2.0, -3.4)); g.add(roof({ w: 1.7, d: 1.7, h: 1.2, ridge: .02, lift: .32, role: 'roofGrey', y: y + 2.9, z: -3.4 }));
  return g;
}
/* ---------- 6 Lhasa: the Potala Palace ---------- */
function potala() {
  const g = new THREE.Group();
  const hill = new THREE.LatheGeometry([[9.2, 0], [8.2, .7], [6.5, 1.6], [5.2, 2.3], [4.2, 2.7], [.01, 2.8]].map(p => new THREE.Vector2(...p)), seg(48, 10));
  const hm = mesh(hill, 'rock'); hm.scale.set(1, 1, .62); g.add(hm);
  g.add(batter(12.2, 4.4, 11.4, 4.0, 2.4, 'white', 0, 1.7, .3));
  g.add(windowsOn(-5.3, 5.3, 2.0, 3.9, 2.32 + .3, 26, 3, 'windowDark', 0, .17, .26));
  g.add(box(11.4, .3, 4.0, 'maroon', 0, 4.1, .3));
  const block = (x, w, d, h, y0, z, role, cols, rows) => { g.add(batter(w, d, w - .4, d - .3, h, role, x, y0, z)); g.add(box(w - .4, .32, d - .3, 'maroon', x, y0 + h, z));
    g.add(windowsOn(x - w / 2 + .45, x + w / 2 - .45, y0 + .3, y0 + h - .25, z + d / 2 - .1, cols, rows, 'windowDark', 0, .17, .26)); };
  block(-3.6, 4.4, 3.8, 3.0, 4.1, .1, 'white', 9, 4);
  block(3.7, 4.6, 3.9, 3.5, 4.1, 0, 'white', 9, 5);
  block(0, 3.6, 3.4, 5.4, 4.1, .25, 'redPalace', 7, 7);
  g.add(box(.9, 4.6, .06, 'redPalace2', 0, 4.5, 1.92));   // the middle strip of the Red Palace
  [-1.0, 0, 1.0].forEach((x, i) => { g.add(box(.8, .45, .8, 'redPalace', x, 9.82, -.2)); g.add(roof({ w: 1.25, d: 1.25, h: .55, ridge: i === 1 ? .35 : .05, lift: .22, role: 'gold', y: 10.27, x, z: -.2 })); });
  [-1.6, 1.6].forEach(x => g.add(cyl(.14, .16, .7, 12, 'gold', x, 9.82, .9)));
  [-1, 1].forEach(sx => {   // white wings stepping down the hill on both sides, with dark windows and maroon trims
    [[7.3, 2.6, 2.0, .35, 1.1], [9.0, 1.9, 1.4, 0, 1.6]].forEach(([x, w, h, y0, z]) => { g.add(batter(w, 2.6, w - .3, 2.3, h, 'white', sx * x, y0, z)); g.add(box(w - .3, .2, 2.3, 'maroon', sx * x, y0 + h, z));
      g.add(windowsOn(sx * x - w / 2 + .35, sx * x + w / 2 - .35, y0 + .3, y0 + h - .2, z + 1.2, Math.round(w / .5), Math.max(1, Math.round(h / .7)), 'windowDark', 0, .15, .22)); });
    g.add(batter(.6, .7, .4, .5, 1.4, 'white', sx * 10.2, 0, 1.6));   // the round end towers
  });
  const rr = rnd(29); for (let k = 0; k < 16; k++) { const a = (rr() - .5) * 2.4, R = 6.4 + rr() * 2.4;   // rocks on the hill
    const m = box(.5 + rr() * .9, .3 + rr() * .5, .5 + rr() * .7, 'rock', Math.sin(a) * R, .1 + (9.2 - R) * .25, Math.cos(a) * R * .62, rr() * 3); m.rotation.x = (rr() - .5) * .4; g.add(m); }
  [[-1, 1], [1, -1]].forEach(([sx]) => { const z = 2.6; let px = sx * 6.6, py = .1;   // zigzag stairs up the hill
    for (let k = 0; k < 3; k++) { const nx = sx * (k % 2 ? 6.4 : 4.6), ny = py + .55; g.add(rod([px, py, z + .9 - k * .3], [nx, ny, z + .6 - k * .3], .16, 'white')); px = nx; py = ny; } });
  return g;
}
/* ---------- 7 Xi'an: the Big Wild Goose Pagoda ---------- */
function goose() {
  const g = new THREE.Group();
  g.add(batter(7.4, 7.4, 7.0, 7.0, 1.4, 'brick2')); g.add(box(7.2, .12, 7.2, 'stone', 0, 1.4));
  let y = 1.52;
  for (let i = 0; i < 7; i++) {
    const w = 4.6 - i * .36, h = 1.32 - i * .05;
    g.add(batter(w, w, w - .14, w - .14, h, 'brick', 0, y));
    for (let s = 0; s < 4; s++) { const ry = s * Math.PI / 2, dx = Math.sin(ry) * (w / 2 - .02), dz = Math.cos(ry) * (w / 2 - .02);
      g.add(box(.42, .62, .06, 'door', dx, y + .2, dz, ry));
      [-.3, .3].forEach(u => g.add(box(.09, h, .05, 'brick2', dx + Math.cos(ry) * u * w, y, dz - Math.sin(ry) * u * w, ry))); }
    g.add(box(w + .5, .12, w + .5, 'brick2', 0, y + h)); g.add(box(w + .3, .1, w + .3, 'brick', 0, y + h + .12)); g.add(box(w + .1, .08, w + .1, 'brick2', 0, y + h + .22));
    y += h + .3;
  }
  g.add(batter(2.3, 2.3, .4, .4, .9, 'brick2', 0, y)); g.add(cyl(.04, .06, 1.6, 8, 'gold', 0, y + .9));
  [0, .3, .55].forEach((d, i) => g.add(cyl(.22 - i * .05, .22 - i * .05, .07, 14, 'gold', 0, y + 1.2 + d))); g.add(sph(.15, 'gold', 0, y + 2.1, 0, 12));
  return g;
}
/* ---------- 8 Beijing: the Temple of Heaven ---------- */
function heaven() {
  const g = new THREE.Group();
  const terr = [[6.4, 0], [5.3, .5], [4.2, 1.0]];
  terr.forEach(([R, y]) => { g.add(cyl(R, R + .05, .5, seg(96, 14), 'marble', 0, y));
    const n = seg(Math.round(R * 9), 20), L = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; L.push([Math.cos(a) * (R - .08), y + .5, Math.sin(a) * (R - .08)]); }
    g.add(many(new THREE.CylinderGeometry(.045, .05, .34, 6).translate(0, .17, 0), 'marble', L)); g.add(torus(R - .08, .035, 'marble', y + .78)); });
  [0, 1, 2].forEach(i => g.add(box(1.4, .5, 1.0, 'marble', 0, i * .5, 6.6 - i * 1.1)));   // the steps up the front
  let y = 1.5;
  g.add(cyl(2.8, 2.8, 1.9, seg(48, 10), 'wallRed', 0, y));
  for (let k = 0; k < seg(24, 10); k++) { const a = k / seg(24, 10) * Math.PI * 2; g.add(cyl(.09, .09, 1.9, 8, 'column', Math.cos(a) * 2.82, y, Math.sin(a) * 2.82)); }
  g.add(cyl(2.88, 2.85, .3, seg(48, 10), 'band', 0, y + 1.9));
  g.add(roundRoof(3.9, .8, 'roofBlue', y + 2.15, 2.4));
  g.add(cyl(2.3, 2.3, .9, seg(48, 10), 'wallRed', 0, y + 2.75)); g.add(cyl(2.38, 2.35, .26, seg(48, 10), 'band', 0, y + 3.65));
  g.add(roundRoof(3.25, .75, 'roofBlue', y + 3.88, 1.8));
  g.add(cyl(1.75, 1.75, .85, seg(48, 10), 'wallRed', 0, y + 4.45)); g.add(cyl(1.83, 1.8, .26, seg(48, 10), 'band', 0, y + 5.3));
  g.add(roundRoof(2.7, 1.9, 'roofBlue', y + 5.52));
  g.add(cyl(.12, .2, .5, 12, 'gold', 0, y + 7.3)); g.add(sph(.38, 'gold', 0, y + 8.0, 0, 18));
  return g;
}

export const MONUMENTS = [
  { id: 'pearl', name: 'Oriental Pearl Tower', zh: '东方明珠', city: 'Shanghai', czh: '上海', build: pearl, stage: { R: 7.5, water: 4.6, seed: 2 }, boats: [[-3, 6, .2], [3.2, 5.6, -.1]] },
  { id: 'leifeng', name: 'Leifeng Pagoda', zh: '雷峰塔', city: 'Hangzhou', czh: '杭州', build: leifeng, stage: { R: 7.5, water: 4.8, waterRole: 'lake', keep: 4.5, seed: 5 }, boats: [[2.2, 6.1, .6, .7]] },
  { id: 'crane', name: 'Yellow Crane Tower', zh: '黄鹤楼', city: 'Wuhan', czh: '武汉', build: crane, stage: { R: 8.2, keep: 5.4, seed: 7 } },
  { id: 'canton', name: 'Canton Tower', zh: '广州塔', city: 'Guangzhou', czh: '广州', build: canton, stage: { R: 7.2, water: 4.4, keep: 3.6, seed: 9 }, boats: [[-2.6, 5.6, -.15], [2.8, 6.0, .1]] },
  { id: 'hongya', name: 'Hongya Cave', zh: '洪崖洞', city: 'Chongqing', czh: '重庆', build: hongya, stage: { R: 8.4, water: 2.2, keep: 7.4, people: 30, trees: 8, seed: 13 }, boats: [[-3.4, 4.6, .1], [3.6, 5.6, -.2]] },
  { id: 'potala', name: 'Potala Palace', zh: '布达拉宫', city: 'Lhasa', czh: '拉萨', build: potala, stage: { R: 9.6, keep: 8.0, trees: 10, seed: 17 } },
  { id: 'goose', name: 'Big Wild Goose Pagoda', zh: '大雁塔', city: "Xi'an", czh: '西安', build: goose, stage: { R: 7.4, keep: 4.6, seed: 19 } },
  { id: 'heaven', name: 'Temple of Heaven', zh: '天坛', city: 'Beijing', czh: '北京', build: heaven, stage: { R: 8.2, keep: 6.8, trees: 30, seed: 23 } },
];

// the whole diorama for one monument; detail 0 builds the low-poly version
export function diorama(M, detail = 1) {
  DET = detail;
  const g = new THREE.Group(), mon = M.build();
  mon.userData.monument = true; g.add(mon); g.add(stage(M.stage.R, M.stage));
  (M.boats || []).forEach(([x, z, ry, s]) => g.add(boat(x, z, ry, s || 1)));
  DET = 1; return g;
}
