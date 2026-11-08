// 隕石の日でも出社する: 空から落ちてくる隕石（three.js に依存しない。画面と bot と検証で同じものが動く）
// 固定ステップで stepSky を呼ぶ。落ちる所は地面に赤い輪と、だんだん大きくなる影で予告する（スマホで読める大きさ）
// 当たると吹き飛ばされて顔から落ちる。輪のすぐ外でよける（ギリギリ回避）と、勢いがついて一瞬スローになる
import { mulberry } from './util.js?v=1'

export const SKY = {
  // v2（2026-11-09 本人「あんまり難しくないかも。もっと隕石をユーザの周りに集めて欲しい」）: 予告を短く（1.5秒以上は残す）、自分の周りに集める
  warn: 2.1,              // 予告から落ちるまで（秒）。v1 は 2.5。走って 21m、スイングなら 40m 動ける
  warnBig: 2.6,
  r: 8,                   // 吹き飛ばす半径（m）。輪の大きさ
  rBig: 13,
  nearBand: 7,            // 輪の外 7m 以内でよけたらギリギリ回避
  graceAfterHit: 2.4,     // 飛ばされてからこの秒数は新しい隕石を落とさない
  column: 22,             // 輪の上のこの高さまでは落ちてくる隕石に当たる（v2）
  gapStart: 1.6, gapEnd: 0.9,    // 次の隕石までの間（始め → 終わり。だんだん激しく）。v1 は 2.3 → 1.25
  lead: 0.85,             // 自分の何秒先の位置を狙うか（予告時間のこの割合）。まっすぐ走り続けると当たる
  aimJit: 6,              // 自分の先を狙う時のずれ（m の幅）。v1 は 8
  aimOdds: 0.55,          // 自分の先を狙う割合（残りは行く道の先・すぐ近く）
  routeOdds: 0.3,         // 行く道の先 22〜48m（道のりに沿って測る。曲がり角の先にも落ちる）
  bigOdds: 0.12,
  showerEvery: [22, 32],  // 流星群（4〜5個が進む向きを横切る一列に）の間隔。v1 は 34〜48秒
  clusterEvery: [9, 13], clusterEnd: [5, 8],   // 3つまとめて自分の先を囲む（始め → 終わり）
  cutEvery: [16, 22],     // 大きいのを行く道の先 34〜46m に落として、いちばん素直な道をふさぐ
  blastH: 15, blastUp: 13, blastStun: 1.0, faceplant: 2.2,   // 当たった時: 横へ 15m/s・上へ 13m/s・操作できない 0.9秒・着地して倒れる 1.6秒
  nearBoost: 6.5,         // ギリギリ回避で進む向きに足す速さ（m/s）
  chainSec: 5,            // この秒数の中で続けてよけるとつながる
  craterHot: 11,          // 落ちた所はしばらく燃えている（地面を走ると熱くて跳ねる）
  burnSec: 28,            // ビルの屋上に落ちると燃えて、その間はワイヤーが掛からない
  rollOdds: 0.3,          // 地面に落ちた隕石が転がり出す割合
  rollSpeed: 13, rollR: 1.9, rollSec: 6, rollKnock: 11,
  maxCraters: 28, maxFall: 11
}

const clamp = (v, a, b) => v < a ? a : v > b ? b : v

// 落ちる点の高さ（屋上に落ちるならその高さと建物）
function impactAt(world, x, z) {
  let h = 0, bld = null
  for (const o of world.nearby(x, z)) {
    if (o.slab || o.y1 == null || o.kind === 'bound' || o.kind === 'rail' || o.kind === 'lotwall') continue
    const c = Math.cos(o.yaw || 0), s = Math.sin(o.yaw || 0), dx = x - o.cx, dz = z - o.cz
    if (Math.abs(dx * c - dz * s) <= o.hw && Math.abs(dx * s + dz * c) <= o.hl && o.y1 > h) { h = o.y1 + (o.gable || 0) * 0.5; bld = o }
  }
  if (!bld) h = world.groundAt(x, z, 1).h
  return { y: h, bld }
}

export function createSky(world, seed = 1, opt = {}) {
  const rnd = mulberry(seed * 104729 + 7)
  return {
    world, rnd, t: 0, next: 2.6, showerAt: SKY.showerEvery[0] + rnd() * (SKY.showerEvery[1] - SKY.showerEvery[0]),
    clusterAt: 7 + rnd() * 4, cutAt: 12 + rnd() * 6, path: null,
    falling: [], craters: [], rollers: [], fires: [], events: [], id: 1, goal: null, intensity: 0,
    stats: { hits: 0, rollHits: 0, near: 0, bestChain: 0, chain: 0, lastNear: -99, burnedWire: 0, hotFeet: 0, impacts: 0, bigNear: 0 },
    knocked: false, rare: opt.rare || null, officeHit: false, quiet: 0
  }
}

// 隕石を1つ予告する（x, z は落ちる所）
export function dropAt(sky, x, z, big = false, extra = {}) {
  const w = sky.world, at = impactAt(w, x, z)
  const a = sky.rnd() * Math.PI * 2, tilt = 0.35 + sky.rnd() * 0.25   // 斜めから落ちてくる
  const m = { id: sky.id++, x, z, y: at.y, bld: at.bld, big, r: big ? SKY.rBig : SKY.r, warn: big ? SKY.warnBig : SKY.warn, t: 0, ax: Math.sin(a) * tilt, az: Math.cos(a) * tilt, roll: false, ...extra }
  m.tLeft = m.warn
  sky.falling.push(m)
  sky.events.push({ t: 'warn', id: m.id, x, y: m.y, z, big, r: m.r, kind: m.kind || '' })
  return m
}

// 道のり（sky.path = [[x,z],...]）の上で、自分のいる所から d m 先の点。道のりが無ければ行き先へまっすぐ
export function aheadOnPath(sky, r, d) {
  const P = sky.path
  if (!P || P.length < 2) {
    const g = sky.goal || { x: r.x, z: r.z }, gx = g.x - r.x, gz = g.z - r.z, gl = Math.hypot(gx, gz) || 1, k = Math.min(gl, d)
    return { x: r.x + gx / gl * k, z: r.z + gz / gl * k }
  }
  // いちばん近い区間に下ろしてから先へ進む
  let bi = 0, bt = 0, bd = 1e18
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1
    const t = clamp(((r.x - ax) * dx + (r.z - az) * dz) / L2, 0, 1), px = ax + dx * t - r.x, pz = az + dz * t - r.z, dd = px * px + pz * pz
    if (dd < bd) { bd = dd; bi = i; bt = t }
  }
  let left = d, i = bi, t = bt
  while (i < P.length - 1) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az) || 1, rest = L * (1 - t)
    if (left <= rest) { const k = t + left / L; return { x: ax + (bx - ax) * k, z: az + (bz - az) * k } }
    left -= rest; i++; t = 0
  }
  const e = P[P.length - 1]
  return { x: e[0], z: e[1] }
}

// 道のりのどこまで来たか（0〜1）
export function pathFrac(P, r) {
  let tot = 0, at = 0, bd = 1e18
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1
    const t = clamp(((r.x - ax) * dx + (r.z - az) * dz) / (L * L), 0, 1), px = ax + dx * t - r.x, pz = az + dz * t - r.z, dd = px * px + pz * pz
    if (dd < bd) { bd = dd; at = tot + L * t }
    tot += L
  }
  return tot ? at / tot : 0
}

// 自分の少し先（今の速さのまま進んだ所。止まっていれば足元）
function aimPoint(sky, r, jit = SKY.aimJit) {
  const L = SKY.warn * SKY.lead
  return { x: r.x + r.vx * L + (sky.rnd() - 0.5) * jit, z: r.z + r.vz * L + (sky.rnd() - 0.5) * jit }
}

function pickTarget(sky, r) {
  const k = sky.rnd()
  let p
  if (k < SKY.aimOdds) p = aimPoint(sky, r)
  else if (k < SKY.aimOdds + SKY.routeOdds && sky.goal) {
    // 行く道の先（道のりに沿って 22〜48m）。少し横へずらす
    p = aheadOnPath(sky, r, 22 + sky.rnd() * 26); p.x += (sky.rnd() - 0.5) * 14; p.z += (sky.rnd() - 0.5) * 14
  } else {
    const a = sky.rnd() * Math.PI * 2, d = 6 + sky.rnd() * 20
    p = { x: r.x + Math.sin(a) * d, z: r.z + Math.cos(a) * d }
  }
  return inBounds(sky.world, p)
}
function inBounds(w, p) { const b = w.bounds; return { x: clamp(p.x, b.x0 + 10, b.x1 - 10), z: clamp(p.z, b.z0 + 10, b.z1 - 10) } }

// 建物が燃えているか（燃えている間はワイヤーが掛からない）。runner.js が o.burning を見る
function burn(sky, o) {
  if (!o || o.kind !== 'building') return
  if (!o.burning) sky.fires.push(o)
  o.burning = SKY.burnSec
}

export function stepSky(sky, r, dt, { active = true, spawn = true } = {}) {
  sky.t += dt
  const ev = sky.events
  // 次の隕石
  if (spawn && active) {
    // 激しさ: 道のりをどこまで進んだか（家 0 → 会社 1）で上げる。時間だけで上げると、遅れた人ほど隕石の雨から抜けられなくなる
    sky.intensity = sky.path ? clamp(0.8 * ((sky.leg || 0) + pathFrac(sky.path, r)) / 2 + 0.2 * sky.t / 150, 0, 1) : clamp(sky.t / 150, 0, 1)
    sky.next -= dt
    if (sky.next <= 0 && sky.falling.length < SKY.maxFall && !(sky.quiet > 0)) {
      const p = pickTarget(sky, r)
      dropAt(sky, p.x, p.z, sky.rnd() < SKY.bigOdds)
      sky.next = SKY.gapStart + (SKY.gapEnd - SKY.gapStart) * sky.intensity + (sky.rnd() - 0.5) * 0.6
    }
    // 3つまとめて自分の先を囲む（三角に並べ、少しずつ時間をずらす。真ん中の隙間か外へ抜ける）
    sky.clusterAt -= dt
    if (sky.clusterAt <= 0 && !(sky.quiet > 0)) {
      const c = aimPoint(sky, r, 3), a0 = sky.rnd() * Math.PI * 2
      for (let i = 0; i < 3; i++) {
        const a = a0 + i * Math.PI * 2 / 3, q = inBounds(sky.world, { x: c.x + Math.sin(a) * 11, z: c.z + Math.cos(a) * 11 })
        const m = dropAt(sky, q.x, q.z, false, { cluster: true }); m.warn += i * 0.3; m.tLeft = m.warn
      }
      ev.push({ t: 'cluster' })
      const E = SKY.clusterEvery, F = SKY.clusterEnd, k = sky.intensity
      sky.clusterAt = E[0] + (F[0] - E[0]) * k + sky.rnd() * (E[1] - E[0] + (F[1] - F[0] - E[1] + E[0]) * k)
    }
    // 道をふさぐ大きいの: 行く道の先に落として、素直な道を通れなくする（回り道か、上を越える）
    sky.cutAt -= dt
    if (sky.cutAt <= 0 && !(sky.quiet > 0) && sky.goal) {
      const q = inBounds(sky.world, aheadOnPath(sky, r, 34 + sky.rnd() * 12))
      if (Math.hypot(sky.goal.x - r.x, sky.goal.z - r.z) > 40) { dropAt(sky, q.x, q.z, true, { cut: true }); ev.push({ t: 'cut' }) }
      sky.cutAt = SKY.cutEvery[0] + sky.rnd() * (SKY.cutEvery[1] - SKY.cutEvery[0])
    }
    sky.showerAt -= dt
    if (sky.showerAt <= 0 && !(sky.quiet > 0)) {
      // 流星群: 進む向きを横切る一列（4〜5個、少しずつ時間をずらす）
      const v = Math.hypot(r.vx, r.vz), hx = v > 2 ? r.vx / v : Math.sin(r.yaw), hz = v > 2 ? r.vz / v : Math.cos(r.yaw)
      const n = 4 + Math.floor(sky.rnd() * 2), ahead = 18 + v * 1.3
      for (let i = 0; i < n; i++) {
        const s = (i - (n - 1) / 2) * 13
        const m = dropAt(sky, r.x + hx * ahead - hz * s, r.z + hz * ahead + hx * s, false, { shower: true })
        m.warn += i * 0.25; m.tLeft = m.warn
      }
      ev.push({ t: 'shower', n })
      sky.showerAt = SKY.showerEvery[0] + sky.rnd() * (SKY.showerEvery[1] - SKY.showerEvery[0])
    }
  }
  if (sky.quiet > 0) sky.quiet -= dt
  // 落ちてくる隕石
  for (let i = sky.falling.length - 1; i >= 0; i--) {
    const m = sky.falling[i]
    m.t += dt; m.tLeft = m.warn - m.t
    if (m.tLeft > 0) continue
    sky.falling.splice(i, 1)
    impact(sky, m, r)
  }
  // 転がる隕石
  for (let i = sky.rollers.length - 1; i >= 0; i--) {
    const q = sky.rollers[i]
    q.t += dt
    const nx = q.x + q.vx * dt, nz = q.z + q.vz * dt
    // 建物にぶつかったら跳ね返る（半分の速さで）
    let hit = false
    for (const o of sky.world.nearby(nx, nz)) {
      if (o.slab || o.y1 == null || o.y1 < 1) continue
      const c = Math.cos(o.yaw || 0), s = Math.sin(o.yaw || 0), dx = nx - o.cx, dz = nz - o.cz
      if (Math.abs(dx * c - dz * s) < o.hw + SKY.rollR && Math.abs(dx * s + dz * c) < o.hl + SKY.rollR) { hit = true; break }
    }
    if (hit) { q.vx *= -0.55; q.vz *= -0.55; q.bounces++; ev.push({ t: 'rollBonk', x: q.x, z: q.z }) }
    else { q.x = nx; q.z = nz }
    q.y = sky.world.groundAt(q.x, q.z, 2).h
    q.spin += Math.hypot(q.vx, q.vz) * dt / SKY.rollR
    const dd = Math.hypot(r.x - q.x, r.z - q.z), dy = r.y - q.y
    if (!q.hitMe && dd < SKY.rollR + 0.7 && dy < SKY.rollR * 1.7 && dy > -1) {
      q.hitMe = true
      knock(sky, r, q.x, q.z, SKY.rollKnock, 8, 0.6)
      sky.stats.rollHits++
      ev.push({ t: 'rollHit', x: q.x, z: q.z })
    } else if (!q.hitMe && !q.nearMe && dd < SKY.rollR + 3.2 && dy < 4) { q.nearMe = true; nearMiss(sky, r, q.x, q.z, 'roll') }
    if (q.t > SKY.rollSec || q.bounces > 3) { sky.rollers.splice(i, 1); ev.push({ t: 'rollStop', id: q.id, x: q.x, z: q.z }) }
  }
  // 燃えている地面とビル
  for (const c of sky.craters) c.hot = Math.max(0, c.hot - dt)
  for (let i = sky.fires.length - 1; i >= 0; i--) { const o = sky.fires[i]; o.burning -= dt; if (o.burning <= 0) { o.burning = 0; sky.fires.splice(i, 1); ev.push({ t: 'fireOut', o }) } }
  if (r.grounded && !(r.wreck > 0)) {
    for (const c of sky.craters) {
      if (c.hot <= 0 || Math.hypot(r.x - c.x, r.z - c.z) > c.r * 0.75) continue
      if (Math.abs(r.y - c.y) > 1.5) continue
      // 熱っ: 跳ね上がる（少し外へ）。地面の道が遅くなる
      const dx = r.x - c.x, dz = r.z - c.z, l = Math.hypot(dx, dz) || 1
      r.vy = 7.5; r.grounded = false; r.vx = r.vx * 0.5 + dx / l * 4; r.vz = r.vz * 0.5 + dz / l * 4
      if (!c.burnt) { c.burnt = true; sky.stats.hotFeet++ }   // 遅刻届の「熱かった」は1つのクレーターで1回
      ev.push({ t: 'hot', x: r.x, z: r.z })
      break
    }
  }
  // 吹き飛ばされて落ちたら、顔から倒れる
  if (sky.knocked && r.grounded && r.t - sky.knockAt > 0.15) { sky.knocked = false; r.wreck = SKY.faceplant; r.vx *= 0.3; r.vz *= 0.3; ev.push({ t: 'faceplant', x: r.x, z: r.z }) }
  if (sky.stats.chain && sky.t - sky.stats.lastNear > SKY.chainSec) { if (sky.stats.chain >= 2) ev.push({ t: 'chainEnd', n: sky.stats.chain }); sky.stats.chain = 0 }
}

function knock(sky, r, x, z, side, up, stun) {
  let dx = r.x - x, dz = r.z - z, l = Math.hypot(dx, dz)
  if (l < 0.5) { dx = -Math.sin(r.yaw); dz = -Math.cos(r.yaw); l = 1 }
  r.rope = null; r.climbing = null; r.grounded = false
  r.vx = dx / l * side + r.vx * 0.15; r.vz = dz / l * side + r.vz * 0.15; r.vy = Math.max(r.vy, up)
  r.y += 0.2; r.stun = Math.max(r.stun || 0, stun)
  sky.knocked = true; sky.knockAt = r.t
}

function nearMiss(sky, r, x, z, src) {
  const S = sky.stats
  S.near++
  S.chain = sky.t - S.lastNear <= SKY.chainSec ? S.chain + 1 : 1
  S.lastNear = sky.t
  S.bestChain = Math.max(S.bestChain, S.chain)
  // 勢いがつく: 進む向きへ（止まっていたら隕石から離れる向きへ）
  let hx = r.vx, hz = r.vz, l = Math.hypot(hx, hz)
  if (l < 3) { hx = r.x - x; hz = r.z - z; l = Math.hypot(hx, hz) || 1 }
  const v0 = Math.hypot(r.vx, r.vy, r.vz), add = SKY.nearBoost * Math.min(1.6, 1 + (S.chain - 1) * 0.15)
  if (v0 + add < 38) { r.vx += hx / l * add; r.vz += hz / l * add }
  sky.events.push({ t: 'near', x, z, chain: S.chain, src })
}

function impact(sky, m, r) {
  const ev = sky.events
  sky.stats.impacts++
  // 自分との距離（落ちた点を中心に、横と縦。屋上に落ちたら屋上の高さが中心）
  // v2: 隕石は空から輪の真上を落ちてくるので、輪の上の空（落ちた点から上へ column m）にいても当たる。v1 は高く振っていれば当たらなかった
  const dh = Math.hypot(r.x - m.x, r.z - m.z), up = r.y + 0.9 - m.y
  const dv = up < -1.5 ? -1.5 - up : up > SKY.column ? up - SKY.column : 0
  const d = Math.hypot(dh, dv * 0.8)
  const office = sky.office && m.officeMeteor
  ev.push({ t: 'impact', id: m.id, x: m.x, y: m.y, z: m.z, big: m.big, r: m.r, d, bld: m.bld ? true : false, kind: m.kind || '', office: !!office })
  if (m.kind === 'boss' || m.kind === 'office') { addCrater(sky, m, false); return }   // 演出用（当たり判定なし）
  if (m.kind === 'rider') { m.rider = 'kohai'; addCrater(sky, m, 'force'); return }     // 後輩が乗ってきた隕石: そのまま転がり出す（乗ったまま）
  if (d < m.r && !(r.wreck > 0)) {
    sky.stats.hits++
    knock(sky, r, m.x, m.z, SKY.blastH, SKY.blastUp, SKY.blastStun)
    sky.quiet = Math.max(sky.quiet || 0, SKY.graceAfterHit)   // 飛ばされた直後は次を落とさない（起き上がる前に次が来て抜けられなくなるのを防ぐ）
    ev.push({ t: 'blast', x: m.x, z: m.z, big: m.big })
  } else if (d < m.r + SKY.nearBand && !(r.wreck > 0)) {
    if (m.big) sky.stats.bigNear++
    nearMiss(sky, r, m.x, m.z, m.big ? 'big' : 'meteor')
  }
  if (m.bld) burn(sky, m.bld)
  else addCrater(sky, m, true)
}

function addCrater(sky, m, mayRoll) {
  sky.craters.push({ x: m.x, y: m.y, z: m.z, r: m.r * 0.75, hot: SKY.craterHot, id: m.id })
  if (sky.craters.length > SKY.maxCraters) sky.craters.shift()
  if (mayRoll === 'force' || (mayRoll && sky.rnd() < SKY.rollOdds)) {
    // 道の向き（東西か南北）に沿って、だいたい自分の方へ転がる
    const w = sky.world, gx = (sky.lastR ? sky.lastR.x : m.x) - m.x, gz = (sky.lastR ? sky.lastR.z : m.z) - m.z
    const alongX = Math.abs(gx) > Math.abs(gz)
    const s = alongX ? Math.sign(gx || 1) : Math.sign(gz || 1)
    const q = { id: m.id, x: m.x, y: m.y, z: m.z, vx: alongX ? s * SKY.rollSpeed : 0, vz: alongX ? 0 : s * SKY.rollSpeed, t: 0, spin: 0, bounces: 0, rider: m.rider || null }
    sky.rollers.push(q)
    sky.events.push({ t: 'roll', id: q.id, x: q.x, z: q.z, rider: q.rider })
  }
}

// 今の自分の位置を覚えておく（転がる向きに使う）
export function noteRunner(sky, r) { sky.lastR = { x: r.x, z: r.z } }
