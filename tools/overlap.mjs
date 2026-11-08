// 地図の箱どうしが重なっていないか（3D）。node tools/overlap.mjs
import { commuteWorld } from '../shared/commute.js?v=2'
const w = commuteWorld()
const C = w.colliders.filter(o => !o.slab && o.y1 != null && o.kind !== 'rail' && o.kind !== 'bound')
const allow = (a, b) => [a.look, b.look].includes('screen') || (a.look === 'jib' || b.look === 'jib') && (a.look === 'mast' || b.look === 'mast')
let n = 0
for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
  const a = C[i], b = C[j]
  const ox = Math.min(a.cx + a.hw, b.cx + b.hw) - Math.max(a.cx - a.hw, b.cx - b.hw), oz = Math.min(a.cz + a.hl, b.cz + b.hl) - Math.max(a.cz - a.hl, b.cz - b.hl), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  if (ox > 0.3 && oz > 0.3 && oy > 0.3 && !allow(a, b)) { n++; if (n < 30) console.log(`${a.kind}/${a.look || ''} (${a.cx.toFixed(1)},${a.cz.toFixed(1)}) x ${b.kind}/${b.look || ''} (${b.cx.toFixed(1)},${b.cz.toFixed(1)})  ${ox.toFixed(1)}x${oz.toFixed(1)}x${oy.toFixed(1)}`) }
}
// 道の上に建物が無いか（地面の箱だけ）
let r = 0
for (const o of C) {
  if (o.y0 > 3 || o.kind === 'post' || o.kind === 'vending' || o.kind === 'pillar' || o.kind === 'wall' || o.look) continue
  for (const s of w.segs) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L
    const t = Math.max(0, Math.min(L, (o.cx - s.ax) * ux + (o.cz - s.az) * uz)), px = s.ax + ux * t, pz = s.az + uz * t
    const ex = Math.abs(o.cx - px) - o.hw, ez = Math.abs(o.cz - pz) - o.hl
    const inside = (Math.abs(ux) > 0.5 ? ez < s.hw - 0.3 && Math.abs(o.cx - px) < o.hw - 0.3 : ex < s.hw - 0.3 && Math.abs(o.cz - pz) < o.hl - 0.3)
    if (inside && t > 1 && t < L - 1 && Math.abs(o.cx) < 220 && o.cz > -50 && o.cz < 1250) { r++; if (r < 20) console.log('道の上', o.kind, o.look || '', o.cx.toFixed(1), o.cz.toFixed(1)) }
  }
}
console.log('重なり', n, '道の上', r, '箱', C.length)
