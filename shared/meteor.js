// 隕石の日でも出社する: 空から落ちてくる隕石（three.js に依存しない。画面と bot と検証で同じものが動く）
// 固定ステップで stepSky を呼ぶ。落ちる所は地面に赤い輪と、だんだん大きくなる影で予告する（スマホで読める大きさ）
// 当たると吹き飛ばされて顔から落ちる。輪のすぐ外でよける（ギリギリ回避）と、勢いがついて一瞬スローになる
import { mulberry } from './util.js?v=1'

export const SKY = {
  warn: 2.5,              // 予告から落ちるまで（秒）。走って 25m、スイングなら 50m 以上動ける
  warnBig: 3.1,
  r: 8,                   // 吹き飛ばす半径（m）。輪の大きさ
  rBig: 13,
  nearBand: 7,            // 輪の外 7m 以内でよけたらギリギリ回避
  gapStart: 2.3, gapEnd: 1.25,   // 次の隕石までの間（始め → 終わり。だんだん激しく）
  lead: 0.85,             // 自分の何秒先の位置を狙うか（予告時間のこの割合）。まっすぐ走り続けると当たる
  aimOdds: 0.5,           // 自分の先を狙う割合（残りは行く道の先・近くのどこか）
  routeOdds: 0.3,
  bigOdds: 0.12,
  showerEvery: [34, 48],  // 流星群（3〜4個が一列に）の間隔
  blastH: 15, blastUp: 13, blastStun: 0.9, faceplant: 1.6,   // 当たった時: 横へ 15m/s・上へ 13m/s・操作できない 0.9秒・着地して倒れる 1.6秒
  nearBoost: 6.5,         // ギリギリ回避で進む向きに足す速さ（m/s）
  chainSec: 5,            // この秒数の中で続けてよけるとつながる
  craterHot: 11,          // 落ちた所はしばらく燃えている（地面を走ると熱くて跳ねる）
  burnSec: 28,            // ビルの屋上に落ちると燃えて、その間はワイヤーが掛からない
  rollOdds: 0.3,          // 地面に落ちた隕石が転がり出す割合
  rollSpeed: 13, rollR: 1.9, rollSec: 6, rollKnock: 11,
  maxCraters: 28, maxFall: 7
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
    world, rnd, t: 0, next: 3.2, showerAt: SKY.showerEvery[0] + rnd() * (SKY.showerEvery[1] - SKY.showerEvery[0]),
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

function pickTarget(sky, r) {
  const k = sky.rnd(), w = sky.world
  let x, z
  if (k < SKY.aimOdds) {
    // 自分の少し先（今の速さのまま進んだ所）。少しずらす
    const L = SKY.warn * SKY.lead
    x = r.x + r.vx * L + (sky.rnd() - 0.5) * 8; z = r.z + r.vz * L + (sky.rnd() - 0.5) * 8
  } else if (k < SKY.aimOdds + SKY.routeOdds && sky.goal) {
    // 行く道の先（会社や駅の方へ 35〜80m）。クレーターや燃えるビルで道が変わる
    const gx = sky.goal.x - r.x, gz = sky.goal.z - r.z, gl = Math.hypot(gx, gz) || 1, d = Math.min(gl, 35 + sky.rnd() * 45)
    x = r.x + gx / gl * d + (sky.rnd() - 0.5) * 30; z = r.z + gz / gl * d + (sky.rnd() - 0.5) * 30
  } else {
    const a = sky.rnd() * Math.PI * 2, d = 12 + sky.rnd() * 55
    x = r.x + Math.sin(a) * d; z = r.z + Math.cos(a) * d
  }
  const b = w.bounds
  return { x: clamp(x, b.x0 + 10, b.x1 - 10), z: clamp(z, b.z0 + 10, b.z1 - 10) }
}

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
    sky.intensity = clamp(sky.t / 150, 0, 1)
    sky.next -= dt
    if (sky.next <= 0 && sky.falling.length < SKY.maxFall && !(sky.quiet > 0)) {
      const p = pickTarget(sky, r)
      dropAt(sky, p.x, p.z, sky.rnd() < SKY.bigOdds)
      sky.next = SKY.gapStart + (SKY.gapEnd - SKY.gapStart) * sky.intensity + (sky.rnd() - 0.5) * 0.6
    }
    sky.showerAt -= dt
    if (sky.showerAt <= 0) {
      // 流星群: 進む向きを横切る一列（3〜4個、少しずつ時間をずらす）
      const v = Math.hypot(r.vx, r.vz), hx = v > 2 ? r.vx / v : Math.sin(r.yaw), hz = v > 2 ? r.vz / v : Math.cos(r.yaw)
      const n = 3 + Math.floor(sky.rnd() * 2), ahead = 22 + v * 1.4
      for (let i = 0; i < n; i++) {
        const s = (i - (n - 1) / 2) * 15
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
  const dh = Math.hypot(r.x - m.x, r.z - m.z), dv = Math.abs((r.y + 0.9) - m.y)
  const d = Math.hypot(dh, dv * 0.8)
  const office = sky.office && m.officeMeteor
  ev.push({ t: 'impact', id: m.id, x: m.x, y: m.y, z: m.z, big: m.big, r: m.r, d, bld: m.bld ? true : false, kind: m.kind || '', office: !!office })
  if (m.kind === 'boss' || m.kind === 'office') { addCrater(sky, m, false); return }   // 演出用（当たり判定なし）
  if (m.kind === 'rider') { m.rider = 'kohai'; addCrater(sky, m, 'force'); return }     // 後輩が乗ってきた隕石: そのまま転がり出す（乗ったまま）
  if (d < m.r && !(r.wreck > 0)) {
    sky.stats.hits++
    knock(sky, r, m.x, m.z, SKY.blastH, SKY.blastUp, SKY.blastStun)
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
