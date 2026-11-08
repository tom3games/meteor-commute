// v2 の通勤路の見た目（掛け点の箱 look と、当たり判定の無い飾り mapDeco）。位置と大きさは shared/commutemap.js
// ほとんどを scene.js の Builder（頂点色で1つにまとめる）に足すので、描画の回数はほぼ増えない
import * as THREE from 'three'
import { EAVE } from '../shared/runner.js?v=16'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const _a = V(0, 0, 0), _u = V(0, 0, 0), _s1 = V(0, 0, 0), _s2 = V(0, 0, 0)

// 2点を結ぶ角材（断面は正方形、半幅 w）
export function beam(b, A, Bp, w, color) {
  _a.set(Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2])
  const L = _a.length(); if (L < 1e-4) return
  _a.divideScalar(L)
  _u.set(Math.abs(_a.y) < 0.9 ? 0 : 1, Math.abs(_a.y) < 0.9 ? 1 : 0, 0)
  _s2.copy(_u).addScaledVector(_a, -_u.dot(_a)).normalize()
  _s1.crossVectors(_s2, _a)
  const P = (base, i, j) => [base[0] + _s1.x * w * i + _s2.x * w * j, base[1] + _s1.y * w * i + _s2.y * w * j, base[2] + _s1.z * w * i + _s2.z * w * j]
  b.hexa([P(A, -1, -1), P(A, 1, -1), P(Bp, 1, -1), P(Bp, -1, -1), P(A, -1, 1), P(A, 1, 1), P(Bp, 1, 1), P(Bp, -1, 1)], color, { shade: false })
}

const STEEL = 0xd9a020, DARK = 0x3a3f46, CONC = 0xcfcac0, RAIL = 0x6e655c

// 掛け点の箱を描く。B = { conc, met, other, facade }
export function drawLook(o, B) {
  const { conc, met, other, facade } = B
  const y0 = o.y0, y1 = o.y1, cy = (y0 + y1) / 2, hh = (y1 - y0) / 2
  switch (o.look) {
    case 'viaduct': {
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, CONC)
      for (const s of [-1, 1]) other.box(o.cx + s * (o.hw - 0.2), y1 + 0.55, o.cz, 0.2, 0.55, o.hl, 0xbdb8ae)   // 側壁
      break
    }
    case 'platform': {
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0xd8d3c8)
      for (const s of [-1, 1]) other.box(o.cx + s * (o.hw - 1.2), y1 + 0.02, o.cz, 0.15, 0.02, o.hl - 1, 0xf2c230)   // 点字ブロックの黄色い線
      for (const s of [-1, 1]) other.box(o.cx + s * (o.hw - 0.15), y1 + 0.55, o.cz, 0.15, 0.55, o.hl, 0xbdb8ae)
      break
    }
    case 'canopy': {
      met.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0xe4e7ea)
      for (let z = o.cz - o.hl + 4; z <= o.cz + o.hl - 4; z += 11) for (const s of [-1, 1]) met.box(o.cx + s * 6.2, (10 + y0) / 2, z, 0.18, (y0 - 10) / 2, 0.18, 0x8d949c)
      break
    }
    case 'train': {
      // 3両。白い車体に緑の帯、窓は暗く
      const n = 3, gap = 0.8, L = (o.hl * 2 - gap * (n - 1)) / n
      for (let i = 0; i < n; i++) {
        const z0 = o.cz - o.hl + i * (L + gap), zc = z0 + L / 2
        other.box(o.cx, y0 + 0.55, zc, o.hw * 0.8, 0.45, L / 2 - 0.6, 0x2b2e33)            // 台車
        other.box(o.cx, y0 + 1.0 + (y1 - y0 - 1.0) / 2, zc, o.hw, (y1 - y0 - 1.0) / 2, L / 2, 0xe9ecef, 0, { top: 0xc9ced3 })
        for (const s of [-1, 1]) {
          other.box(o.cx + s * (o.hw + 0.01), y0 + 1.9, zc, 0.02, 0.18, L / 2 - 0.2, 0x1f8a52)      // 帯
          other.box(o.cx + s * (o.hw + 0.015), y0 + 2.8, zc, 0.02, 0.5, L / 2 - 1.2, 0x26323c)    // 窓
          for (const dz of [-L / 3, 0, L / 3]) other.box(o.cx + s * (o.hw + 0.02), y0 + 2.15, zc + dz, 0.02, 1.0, 0.65, 0x9aa3ab)  // 扉
        }
        for (const e of [-1, 1]) other.box(o.cx, y0 + 2.8, zc + e * (L / 2 + 0.01), o.hw * 0.75, 0.55, 0.02, 0x26323c)
      }
      met.box(o.cx, y1 + 0.9, o.cz - o.hl + L * 0.5, 0.05, 0.9, 0.5, 0x3a3f46)   // パンタグラフ
      break
    }
    case 'truss': {
      // 鉄道橋の側面のトラス（上弦・下弦・斜材）
      const zA = o.cz - o.hl, zB = o.cz + o.hl, x = o.cx
      beam(met, [x, y0 + 0.3, zA], [x, y0 + 0.3, zB], 0.32, 0x5f7a8e)
      beam(met, [x, y1 - 0.3, zA + 6], [x, y1 - 0.3, zB - 6], 0.32, 0x5f7a8e)
      for (let z = zA, k = 0; z < zB - 0.1; z += 6, k++) {
        const za = Math.max(zA + 6, Math.min(zB - 6, z)), zb = Math.max(zA + 6, Math.min(zB - 6, z + 6))
        if (k % 2) beam(met, [x, y0 + 0.3, z], [x, y1 - 0.3, zb], 0.2, 0x5f7a8e); else beam(met, [x, y0 + 0.3, z + 6], [x, y1 - 0.3, za], 0.2, 0x5f7a8e)
        if (z > zA + 1 && z < zB - 1) beam(met, [x, y0 + 0.3, z], [x, y1 - 0.3, z], 0.16, 0x5f7a8e)
      }
      break
    }
    case 'pylon': {
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0xe8e4dc)
      other.box(o.cx, y1 - 1.2, o.cz, o.hw + 0.3, 1.2, o.hl + 0.3, 0xcac5bb)
      met.box(o.cx + o.hw * 0.7, y1 + 1.2, o.cz + o.hl * 0.7, 0.1, 1.2, 0.1, 0xd23a2a)   // 航空灯（角に。真ん中に立てると乗った体に刺さる）
      break
    }
    case 'billboard': {
      // v3: 枠の箱を当たりの厚み（0.8m）いっぱいに。上に乗っても宙に浮かない
      facade.billboard(o.cx, y0, o.cz + (o.nz || -1) * (o.hl + 0.01), 0, o.nz || -1, o.hw * 2, y1 - y0, o.seed || 1)
      met.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0x4a4f55)
      met.box(o.cx, y0 - 0.15, o.cz, o.hw + 0.2, 0.15, 0.7, 0x5a5f66)   // 足場
      break
    }
    case 'vsign': {
      // 商店街の縦看板（壁から道へ突き出す）。看板の画像は facade の看板の絵
      const wallX = o.cx - o.nx * 0.7
      facade.sign(wallX, y0, o.cz, o.nx, 0, 1.3, y1 - y0, o.seed % 2, o.seed)
      met.box(wallX + o.nx * 0.65, y1 - 0.06, o.cz, 0.68, 0.06, 0.06, 0x5a5f66)
      break
    }
    case 'gate': {
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, o.town ? 0x2f6b4a : 0x8b2a22, 0, { top: o.town ? 0x24533a : 0x6d211b })
      for (const s of [-1, 1]) met.box(o.cx + s * (o.hw - 0.3), y0 / 2, o.cz, 0.3, y0 / 2, 0.3, 0x5a5f66)
      break
    }
    case 'screen': {
      met.box(o.cx, cy, o.cz, o.hw, hh, o.hl + 0.3, 0x2b2e33)
      break
    }
    case 'clock': {
      other.box(o.cx, cy - 1.5, o.cz, o.hw, hh - 1.5, o.hl, 0xe3dccd)
      other.box(o.cx, y1 - 1.5, o.cz, o.hw + 0.35, 1.5, o.hl + 0.35, 0x7a6a55)
      other.box(o.cx, 0.5, o.cz, o.hw + 0.8, 0.5, o.hl + 0.8, 0xc4bcae)
      break
    }
    case 'frame': {
      // 建てかけの鉄骨（柱と梁）。下の3階だけ床と壁がある
      const x0 = o.cx - o.hw, x1 = o.cx + o.hw, z0 = o.cz - o.hl, z1 = o.cz + o.hl
      for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / 3) for (let z = z0; z <= z1 + 0.1; z += (z1 - z0) / 7) met.box(x, cy, z, 0.25, hh, 0.25, 0x8a4a2a)
      for (let y = y0 + 4; y <= y1 + 0.1; y += 4) {
        for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / 3) met.box(x, y, o.cz, 0.18, 0.25, o.hl, 0x9a5a34)
        for (let z = z0; z <= z1 + 0.1; z += (z1 - z0) / 7) met.box(o.cx, y, z, o.hw, 0.25, 0.18, 0x9a5a34)
      }
      other.box(o.cx, y0 + 6, o.cz, o.hw - 0.3, 6, o.hl - 0.3, 0xc9c3b6)
      for (let y = 4; y < 12; y += 4) other.box(o.cx, y0 + y + 4, o.cz, o.hw, 0.15, o.hl, 0xb3ad9f)
      // 工事の幕（青）
      other.box(o.cx, y0 + 15, o.cz - o.hl - 0.4, o.hw, 3, 0.05, 0x2f5f9a)
      break
    }
    case 'mast': {
      const s = o.hw * 0.9
      for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) met.box(o.cx + x, cy, o.cz + z, 0.12, hh, 0.12, STEEL)
      for (let y = y0 + 2; y < y1; y += 2.6) {
        for (const e of [-1, 1]) { met.box(o.cx, y, o.cz + e * s, s, 0.07, 0.07, STEEL); met.box(o.cx + e * s, y, o.cz, 0.07, 0.07, s, STEEL) }
        beam(met, [o.cx - s, y, o.cz - s], [o.cx + s, y + 2.6, o.cz - s], 0.06, STEEL)
        beam(met, [o.cx + s, y, o.cz + s], [o.cx - s, y + 2.6, o.cz + s], 0.06, STEEL)
      }
      other.box(o.cx + 1.6, y1 - 3, o.cz, 1.3, 1.2, 1.1, 0xe8e2d0)   // 運転室
      met.box(o.cx, y1 - 0.1, o.cz, o.hw, 0.1, o.hl, STEEL)   // 頂上の床（v3: 乗れる面を見せる）
      break
    }
    case 'jib': {
      // 三角の格子の腕（先は大通りの上）
      const xa = o.cx - o.hw, xb = o.cx + o.hw, zc = o.cz, w = o.hl
      for (const e of [-1, 1]) beam(met, [xa, y0 + 0.1, zc + e * w], [xb, y0 + 0.1, zc + e * w], 0.09, STEEL)
      beam(met, [xa, y1 - 0.1, zc], [xb, y1 - 0.1, zc], 0.09, STEEL)
      for (let x = xa, k = 0; x < xb - 0.1; x += 2.2, k++) {
        const xn = Math.min(xb, x + 2.2)
        for (const e of [-1, 1]) beam(met, [k % 2 ? x : xn, y0 + 0.1, zc + e * w], [k % 2 ? xn : x, y1 - 0.1, zc], 0.05, STEEL)
        met.box(x, y0 + 0.1, zc, 0.05, 0.05, w, STEEL)
      }
      // 後ろの腕と重り（マストの西）
      met.box(o.cx - o.hw - 7, y0 + 0.6, zc, 7, 0.4, w * 0.8, STEEL)
      conc.box(o.cx - o.hw - 12, y0 - 0.6, zc, 2, 1.6, w * 0.9, 0x9a958c)
      // 頂上の塔と、腕を吊るす綱
      met.box(-61, y1 + 3.5, zc, 0.5, 3.5, 0.5, STEEL)
      beam(met, [-61, y1 + 7, zc], [xb - 6, y1, zc], 0.03, 0x2b2e33)
      beam(met, [-61, y1 + 7, zc], [o.cx - o.hw - 12, y0 + 1, zc], 0.03, 0x2b2e33)
      break
    }
    case 'footbridge': {
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0xa9c6d3, 0, { top: 0xa3a8ab })
      for (const s of [-1, 1]) {
        other.box(o.cx, y1 + 0.45, o.cz + s * (o.hl - 0.06), o.hw, 0.45, 0.05, 0x9fc0cf)   // 手すりの板（水色）
        met.box(o.cx, y1 + 1.15, o.cz + s * (o.hl - 0.06), o.hw, 0.05, 0.09, 0xd8dde2)
      }
      for (const s of [-1, 1]) met.box(o.cx + s * (o.hw - 0.4), y0 / 2, o.cz, 0.25, y0 / 2, 0.25, 0x8fb2c2)
      break
    }
    case 'company': {
      // ドンマイ商事のタワー: 青みのガラスに縦の方立てと階の帯。1階は高い吹き抜けのロビー、頂上は濃い帯（社名を貼る）
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0x7f9db3, 0, { top: 0x5d6873 })
      const fx = [[0, -1], [0, 1], [-1, 0], [1, 0]]
      for (const [nx, nz] of fx) {
        const W = nx ? o.hl : o.hw, ox = o.cx + nx * (o.hw + 0.05), oz = o.cz + nz * (o.hl + 0.05)
        for (let u = -W; u <= W + 0.01; u += W / 7) met.box(ox + (nx ? 0 : u), cy + 4, oz + (nx ? u : 0), nx ? 0.08 : 0.16, hh - 4, nx ? 0.16 : 0.08, 0xc9d0d6)
        for (let y = y0 + 12; y < y1 - 12; y += 4.2) met.box(ox, y, oz, nx ? 0.06 : W, 0.18, nx ? W : 0.06, 0x52606c)
      }
      other.box(o.cx, y1 - 6, o.cz, o.hw + 0.25, 6, o.hl + 0.25, 0x24303c)
      other.box(o.cx, y0 + 4.2, o.cz, o.hw + 0.2, 4.2, o.hl + 0.2, 0x5b7a92, 0, { top: 0x2a2f36 })
      met.box(o.cx, y0 + 8.6, o.cz - o.hl - 1.2, o.hw + 1, 0.25, 1.4, 0xd5dade)   // ひさし
      met.box(o.cx, y1 + 4, o.cz, 0.15, 4, 0.15, 0xc9ced6)
      break
    }
    // ---------------------------------------------------------------- v3 の街（住宅街に混ぜた店・神社・下町）
    case 'penthouse': conc.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0xcfcac2); met.box(o.cx + o.hw * 0.4, y0 + 1.0, o.cz - o.hl - 0.02, 0.45, 1.0, 0.02, 0x5a5f66); break
    case 'rooftank': {
      met.box(o.cx, y0 + 1.6, o.cz, o.hw, 1.0, o.hl, 0x9aa3ab)
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) met.box(o.cx + a * (o.hw - 0.2), y0 + 0.3, o.cz + b * (o.hl - 0.2), 0.1, 0.3, 0.1, 0x6d7278)
      break
    }
    case 'aircon': for (let j = -1; j <= 1; j++) met.box(o.cx + j * 1.6, cy, o.cz, 0.6, hh, o.hl, 0xb8bcc2); break
    case 'konbini': case 'cleaner': case 'tailor': {
      // 小さな店: 白い壁・色の帯・道に向いたガラスの正面・看板の板（文字は game.js が貼る）
      const nx = o.nx || 1, fx = o.cx + nx * o.hw
      const band = o.look === 'konbini' ? [[0x2f9a5a, 0xe9a23b], [0x2d6fb8, 0xe03a3a], [0xe2742a, 0x2f9a5a], [0x2d6fb8, 0x3aa0d8], [0xd23a3a, 0xf2c230]][(o.seed || 0) % 5] : o.look === 'cleaner' ? [0x2d6fb8, 0xffffff] : [0x1b2233, 0xc9a14a]
      const wall = o.look === 'tailor' ? 0xe8e2d4 : 0xf4f3ef
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, wall, 0, { top: 0xbab6ae })
      other.box(fx + nx * 0.03, y0 + 1.5, o.cz, 0.03, 1.3, o.hl - 0.6, 0x2c3a48)                     // ガラス
      other.box(fx + nx * 0.06, y0 + (o.look === 'tailor' ? 3.6 : 3.05), o.cz, 0.05, 0.22, o.hl, band[0])   // 帯
      other.box(fx + nx * 0.06, y0 + (o.look === 'tailor' ? 3.2 : 2.75), o.cz, 0.05, 0.08, o.hl, band[1])
      if (o.look === 'cleaner') other.box(fx + nx * 0.6, y0 + 2.6, o.cz, 0.6, 0.06, o.hl - 0.4, band[0])   // 日よけ
      if (o.look === 'tailor') { other.box(fx + nx * 0.03, y0 + 5.4, o.cz, 0.03, 1.1, o.hl - 1.2, 0x2c3a48); other.box(fx + nx * 0.9, y0 + 3.0, o.cz, 0.9, 0.08, o.hl, 0x1b2233) }
      break
    }
    case 'torii': {
      // 鳥居の笠木（当たる箱）: 朱色の梁に黒い上端。下に貫（ぬき）
      const big = o.big ? 1.6 : (o.hl > 5 || o.hw > 5) ? 1.6 : 1, alongX = o.ax === 'x'
      const L = alongX ? o.hw : o.hl, W = alongX ? o.hl : o.hw
      other.box(o.cx, cy - hh * 0.2, o.cz, alongX ? L : W, hh * 0.8, alongX ? W : L, 0xd2442c)
      other.box(o.cx, y1 - hh * 0.2, o.cz, alongX ? L + 0.3 : W + 0.08, hh * 0.2, alongX ? W + 0.08 : L + 0.3, 0x1e1e1e)
      const ny = y0 - 1.3 * big
      other.box(o.cx, ny, o.cz, alongX ? L * 0.82 : W * 0.6, 0.22 * big, alongX ? W * 0.6 : L * 0.82, 0xd2442c)
      other.box(o.cx, (ny + y0) / 2, o.cz, 0.18 * big, (y0 - ny) / 2, 0.18 * big, 0xd2442c)   // 額束
      break
    }
    case 'toriipost': {
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0xd2442c)
      other.box(o.cx, y0 + 0.35, o.cz, o.hw + 0.06, 0.35, o.hl + 0.06, 0x1e1e1e)
      break
    }
    case 'hall': {
      // お社: 木の壁と、切妻の屋根（当たりは shared/runner.js の topAt と同じ形: 軒の出 0.6m、厚み 0.08m）
      const g = o.gable, t = EAVE.t, E = o.hw + EAVE.slope, zA = o.cz - o.hl - EAVE.ridge, zB = o.cz + o.hl + EAVE.ridge, R = 0x3d4a44
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0x8a5a3a, 0, { noTop: true })
      other.box(o.cx, y0 + 0.3, o.cz, o.hw + 0.5, 0.3, o.hl + 0.5, 0xb9b2a4)   // 基壇
      const sl = (xa, xb, ya, yb) => other.hexa([[xa, ya - t, zA], [xb, yb - t, zA], [xb, yb - t, zB], [xa, ya - t, zB], [xa, ya + t, zA], [xb, yb + t, zA], [xb, yb + t, zB], [xa, ya + t, zB]], R, { top: R })
      sl(o.cx, o.cx + E, y1 + g, y1); sl(o.cx - E, o.cx, y1, y1 + g)
      for (const e of [-1, 1]) { const z = o.cz + e * o.hl; other.tri([o.cx - e * o.hw, y1, z], [o.cx + e * o.hw, y1, z], [o.cx, y1 + g, z], 0x8a5a3a) }
      { const gap = g * (1 - o.hw / E); other.box(o.cx, y1 + gap / 2, o.cz, o.hw, gap / 2 + 0.02, o.hl, 0x8a5a3a, 0, { noTop: true, noBottom: true }) }   // 壁の上と軒の間
      const fx = o.cx + (o.fx || 1) * (o.hw + 0.03)
      other.box(fx, y0 + 1.6, o.cz, 0.03, 1.2, o.hl * 0.5, 0x5a3a26)              // 正面の格子戸
      other.box(fx + (o.fx || 1) * 0.6, y0 + 0.5, o.cz, 0.5, 0.5, 1.2, 0x6a4a30)   // 賽銭箱
      met.box(fx + (o.fx || 1) * 0.2, y1 - 0.4, o.cz, 0.12, 0.25, 0.12, 0xc9a14a)  // 鈴
      break
    }
    case 'expressway': {
      // 首都高: コンクリートの床（上の面 = y1）と防音壁、白線
      conc.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0xa9a59e)
      other.box(o.cx, y1 + 0.01, o.cz, o.hw, 0.01, o.hl - 0.4, 0x4a4d52)
      for (const e of [-1, 1]) { conc.box(o.cx, y1 + 0.6, o.cz + e * (o.hl - 0.15), o.hw, 0.6, 0.15, 0xc9c6bf); met.box(o.cx, y1 + 1.5, o.cz + e * (o.hl - 0.12), o.hw, 0.3, 0.04, 0x9fb8c8) }
      for (const dz of [-4.5, 0, 4.5]) for (let x = o.cx - o.hw + 1; x < o.cx + o.hw; x += 8) other.box(x + 2, y1 + 0.025, o.cz + dz, 2, 0.01, 0.07, 0xf2f2ee)
      break
    }
    case 'expillar': {
      conc.box(o.cx, cy - 0.6, o.cz, o.hw, hh - 0.6, o.hl, 0xbdb8ae)
      conc.box(o.cx, y1 - 0.6, o.cz, o.hw + 0.6, 0.6, 8.6, 0xb3aea4)   // 梁
      break
    }
    case 'chimney': {
      other.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0x9a6a54)
      for (let y = y0 + 8; y < y1 - 1; y += 5) other.box(o.cx, y, o.cz, o.hw + 0.06, 0.15, o.hl + 0.06, 0x6a4a3c)
      other.box(o.cx, y1 - 0.5, o.cz, o.hw + 0.12, 0.5, o.hl + 0.12, 0x2b2522)
      break
    }
    default:
      conc.box(o.cx, cy, o.cz, o.hw, hh, o.hl, 0xd0ccc4)
  }
}

// 当たり判定の無い飾り
export function drawDeco(world, B, root) {
  const { conc, met, other } = B
  for (const d of world.mapDeco || []) {
    if (d.t === 'tracks') {
      for (const tx of [-2.0, 2.0]) {   // 複線（線路の間 4.0m）
        other.box(d.x + tx, d.y + 0.015, (d.z0 + d.z1) / 2, 1.5, 0.015, (d.z1 - d.z0) / 2, 0x6b655e)   // 砂利（v3: 乗った足が埋まらないよう薄く）
        for (const rx of [-0.75, 0.75]) met.box(d.x + tx + rx, d.y + 0.09, (d.z0 + d.z1) / 2, 0.05, 0.06, (d.z1 - d.z0) / 2, RAIL)
      }
    } else if (d.t === 'lot') {
      // 駐車場: 暗いアスファルトと白い枠線
      other.box((d.x0 + d.x1) / 2, 0.02, (d.z0 + d.z1) / 2, (d.x1 - d.x0) / 2, 0.02, (d.z1 - d.z0) / 2, 0x3c3f44)
      for (let z = d.z0 + 0.3; z < d.z1; z += 2.6) other.box((d.x0 + d.x1) / 2, 0.045, z, (d.x1 - d.x0) / 2 - 1, 0.005, 0.06, 0xe8e8e2)
    } else if (d.t === 'slide') {
      // 公園のすべり台（見た目だけ）
      met.box(d.x - 1.6, 1.1, d.z, 0.5, 1.1, 0.5, 0xd8d0c0)
      beam(other, [d.x - 1.3, 2.2, d.z], [d.x + 2.2, 0.3, d.z], 0.35, 0xe0583a)
      for (const s2 of [-0.5, 0.5]) beam(met, [d.x - 2.1, 0, d.z + s2], [d.x - 2.1, 2.3, d.z + s2], 0.05, 0x4a90c8)
    } else if (d.t === 'post') met.box(d.x, (d.y0 + d.y1) / 2, d.z, 0.25, (d.y1 - d.y0) / 2, 0.25, 0x5a5f66)
    else if (d.t === 'stairs') {
      // 歩道橋の階段（歩道に沿って南へ降りる）
      const n = 18, run = 12
      for (let i = 0; i < n; i++) other.box(d.x, d.y * (i + 0.5) / n - d.y / n / 2 + 0.05, d.z - 2 - run + run * (i + 0.5) / n, 1.3, d.y * (i + 1) / n / 2, run / n / 2, 0x9aa3a8)
      for (const s of [-1, 1]) beam(other, [d.x + s * 1.3, 1, d.z - 2 - run], [d.x + s * 1.3, d.y + 1, d.z - 2], 0.08, 0x6f9fb6)
    } else if (d.t === 'cables') {
      // 斜張橋のケーブル（主塔の上から橋の縁へ扇形）
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 1; k <= 6; k++) {
        const z = d.z + sz * k * d.span / 6
        beam(met, [sx * d.x, d.top - k * 1.4, d.z], [sx * (d.x - 2.4), d.deck + 1, z], 0.06, 0xe6e9ec)
      }
    } else if (d.t === 'crane') {
      beam(met, [d.tip, d.y, d.z], [d.tip, 26, d.z], 0.03, 0x2b2e33)
      other.box(d.tip, 25.4, d.z, 0.6, 0.6, 0.4, 0xd9a020)
      other.box(d.tip, 21, d.z, 0.15, 3.6, 2.8, 0x8a4a2a)   // 吊った鉄骨
    } else if (d.t === 'arcade') {
      // アーチの鉄骨（8m おき）と、ガラスの屋根（1枚の半透明）
      const pts = [], N = 8, W = (d.x1 - d.x0) / 2, cx = (d.x0 + d.x1) / 2
      for (let i = 0; i <= N; i++) { const a = Math.PI * i / N; pts.push([cx - Math.cos(a) * W, d.y + Math.sin(a) * 2.6]) }
      for (let z = d.z0 + 2; z < d.z1; z += 8) for (let i = 0; i < N; i++) beam(met, [pts[i][0], pts[i][1], z], [pts[i + 1][0], pts[i + 1][1], z], 0.1, 0xe6e9ec)
      for (const i of [0, N / 2, N]) beam(met, [pts[i][0], pts[i][1], d.z0], [pts[i][0], pts[i][1], d.z1], 0.08, 0xe6e9ec)
      const pos = []
      for (let i = 0; i < N; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
        pos.push(ax, ay, d.z0, bx, by, d.z0, bx, by, d.z1, ax, ay, d.z0, bx, by, d.z1, ax, ay, d.z1)
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals()
      const roof = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xdfeaf0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }))
      roof.renderOrder = 2; root.add(roof)
    }
  }
}
