// CPU の出勤（釣り合いの検証とタイトルのデモ用）
//   skilled: ワイヤーで飛んで、落ちてくる隕石の輪を見て横へよける
//   clumsy:  下手な人。反応が0.35秒遅れ、向きがぶれ、ワイヤーを掛け損ねる（3回に1回）。輪に気づくのは3回に1回
//   runner:  ワイヤーを使わず道を走る（よけるのは上手い）
//   blind:   上手く飛ぶが、隕石を全く見ない（よける操作が効いているかを測る）
//   idle:    何もしない
import { findAnchor } from './runner.js?v=16'
import { goalOf, COM } from './commute.js?v=3'

const K = 130 / 80
const XS = [-320, -240, -160, -80, 0, 80, 160, 240, 320].map(x => x * K)
const ZS = [40, 120, 200, 280, 360, 440, 520, 600, 680, 760, 840].map(z => 40 + (z - 40) * K)
const near = (arr, v) => arr.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a)
const ang = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a }

// 道に沿った経路: いちばん近い交差点 → 目的地の前の道へ曲がる → 目的地の前。通り過ぎた交差点は捨てる
// 地上で a→b をまっすぐ走って建物に当たらないか
function clearLine(world, ax, az, bx, bz) {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 4)
  for (let i = 1; i < n; i++) {
    const px = ax + (bx - ax) * i / n, pz = az + (bz - az) * i / n
    if (world.water && world.groundAt(px, pz, 2).h < -1) return false   // 川の上は通れない（橋の上は板の高さが返る）
    for (const o of world.nearby(px, pz)) {
      if (o.kind !== 'building' || o.y0 > 1 || o.y1 < 2) continue
      if (Math.abs(px - o.cx) < o.hw + 0.5 && Math.abs(pz - o.cz) < o.hl + 0.5) return false
    }
  }
  return true
}

function gridPath(ax, az, F) {
  const ix = near(XS, ax), iz = near(ZS, az), gx = near(XS, F.x), gz = near(ZS, F.z)
  const onXroad = Math.abs(F.x - gx) < 14
  return [{ x: ix, z: iz }, onXroad ? { x: gx, z: iz } : { x: ix, z: gz }, onXroad ? { x: gx, z: F.z } : { x: F.x, z: gz }, F]   // 最後は目的地のいちばん近くの道に出てから
}

// v2 の街: 地図の道のり（world.nav.legs）に沿う。見通せるいちばん先の曲がり角を目指す（3つ先まで）
function legRoute(r, P, world) {
  let bi = 0, bd = 1e18, bp = null
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((r.x - ax) * dx + (r.z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, dd = (px - r.x) ** 2 + (pz - r.z) ** 2
    if (dd < bd) { bd = dd; bi = i; bp = { x: px, z: pz } }
  }
  const rest = P.slice(bi + 1).map(([x, z]) => ({ x, z }))
  for (let j = Math.min(rest.length - 1, 2); j >= 0; j--) if (clearLine(world, r.x, r.z, rest[j].x, rest[j].z)) return rest.slice(j)
  return [bp, ...rest]
}

function route(r, goal, world, leg) {
  if (world && world.nav && world.nav.legs) return legRoute(r, world.nav.legs[leg], world)
  const F = { x: goal.fx, z: goal.fz }
  let pts
  // 運河をまたぐ時は橋を渡る（橋の無い通りは運河で切れている）
  const C = world && world.nav && world.nav.canal, BR = world && world.nav && world.nav.bridges
  const mid = C && (C.z0 + C.z1) / 2, inBand = C && r.z > C.z0 - 12 && r.z < C.z1 + 12
  const nb = BR && BR.reduce((a, x) => Math.abs(r.x - x) < Math.abs(r.x - a) ? x : a)
  if (inBand && BR && Math.abs(r.x - nb) < 12 && !(F.z > C.z0 - 12 && F.z < C.z1 + 12)) {
    const side = F.z < mid ? C.z0 - 12 : C.z1 + 12   // 橋の上: 目的地の側へ渡りきる
    pts = [{ x: nb, z: side }, ...gridPath(nb, side, F).slice(1)]
  } else if (C && BR && (r.z < mid) !== (F.z < mid)) {
    const bx = BR.reduce((a, x) => Math.abs(r.x - x) + Math.abs(x - F.x) < Math.abs(r.x - a) + Math.abs(a - F.x) ? x : a)
    const sideA = r.z < mid ? C.z0 - 12 : C.z1 + 12, sideB = r.z < mid ? C.z1 + 12 : C.z0 - 12
    pts = [{ x: near(XS, r.x), z: near(ZS, r.z) }, { x: bx, z: near(ZS, r.z) }, { x: bx, z: sideA }, { x: bx, z: sideB }, ...gridPath(bx, sideB, F).slice(1)]
  } else pts = gridPath(r.x, r.z, F)
  pts = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 1)
  while (pts.length > 1) {
    const p0 = pts[0], p1 = pts[1]
    if (Math.hypot(p0.x - r.x, p0.z - r.z) < 9 || (Math.hypot(p1.x - r.x, p1.z - r.z) < Math.hypot(p1.x - p0.x, p1.z - p0.z) + 2 && (!world || clearLine(world, r.x, r.z, p1.x, p1.z)))) pts.shift(); else break
  }
  return pts
}

export function createBot(kind, seed = 1) { let q = (seed * 9301 + 49297) % 233280; return { rnd: () => ((q = (q * 9301 + 49297) % 233280) / 233280), lag: [], kind, plan: null, idx: 0, replan: 0, wT: 0, prevW: false, stuck: 0, lx: 0, lz: 0, dodges: 0 } }

// 落ちてくる隕石で、このまま進むと輪の中に入るもの（いちばん早く落ちるもの）
function danger(sky, r) {
  let best = null
  for (const m of sky.falling) {
    if (m.kind === 'boss' || m.kind === 'office' || m.kind === 'rider') continue
    if (m.tLeft > 1.7) continue
    const px = r.x + r.vx * m.tLeft * 0.8, pz = r.z + r.vz * m.tLeft * 0.8
    const d = Math.min(Math.hypot(px - m.x, pz - m.z), Math.hypot(r.x - m.x, r.z - m.z) + (m.tLeft < 0.5 ? 0 : 99))
    if (d < m.r + 2.5 && r.y + 0.9 - m.y > -3 && r.y + 0.9 - m.y < 26 && (!best || m.tLeft < best.tLeft)) best = m
  }
  return best
}

export function botInput(b, r, run, world, dt) {
  const inp = { throttle: 0, steer: 0 }
  if (run.over || run.arrived || b.kind === 'idle') return inp
  const G = goalOf(run)
  const goal = { fx: G.x, fz: G.z, x: G.x, z: G.z, y: 0 }
  b.replan -= dt
  const key = G.x + ',' + G.z
  if (!b.plan || b.goalKey !== key || b.replan <= 0) { b.plan = route(r, goal, world, run.leg); b.idx = 0; b.replan = world.nav && world.nav.legs ? 0.6 : 1.5; b.goalKey = key }
  while (b.idx < b.plan.length - 1 && Math.hypot(b.plan[b.idx].x - r.x, b.plan[b.idx].z - r.z) < 9) b.idx++
  const final = b.idx >= b.plan.length - 1
  let p = final ? { x: G.x, z: G.z } : b.plan[b.idx]
  // スーツが燃えていたら、近くの紳士服の店（前の緑の輪）に寄る（上手い人だけ。下手な人は気づいたら）
  if (run.suit >= (b.kind === 'skilled' ? 2 : 3) && b.kind !== 'idle' && b.kind !== 'blind') {
    COM.tailors.forEach((T, i) => { if (!run.tailorUsed[i] && Math.hypot(T.x - r.x, T.z - r.z) < 90 && (b.kind === 'skilled' || b.rnd() < 0.5)) b.tailor = i })
  }
  if (b.tailor != null && (run.tailorUsed[b.tailor] || run.suit === 0)) b.tailor = null
  if (b.tailor != null) { const T = COM.tailors[b.tailor]; p = { x: T.x, z: T.z } }
  let want = Math.atan2(p.x - r.x, p.z - r.z)
  const dGoal = Math.hypot(goal.x - r.x, goal.z - r.z)
  // 隕石をよける: 輪の中心から離れる向き（進みたい向きに近い側の真横）へ
  const sees = b.kind === 'skilled' || b.kind === 'runner' || (b.kind === 'clumsy' && b.rnd() < 0.012)   // clumsy は気づくのが遅い（毎フレーム1.2% ≒ 1秒に半分）
  let m = sees ? danger(run.sky, r) : null
  if (b.kind === 'clumsy') { if (m) b.saw = m.id; m = b.saw != null ? run.sky.falling.find(q => q.id === b.saw) : null; if (!m) b.saw = null }
  let dodge = false
  if (m) {
    const ax = r.x - m.x, az = r.z - m.z, al = Math.hypot(ax, az) || 1
    const sx = -az / al, sz = ax / al, side = Math.sin(want) * sx + Math.cos(want) * sz >= 0 ? 1 : -1
    const ox = ax / al * 0.6 + sx * side, oz = az / al * 0.6 + sz * side
    want = Math.atan2(ox, oz); dodge = true; b.dodgeId !== m.id && (b.dodges++, b.dodgeId = m.id)
    // 上手い人は、近く落ちる輪を全部見て、どの輪にも入らない向きを選ぶ（3つで囲まれた時・流星群）
    if (b.kind === 'skilled' || b.kind === 'runner') {
      const base = Math.atan2(G.x - r.x, G.z - r.z), v = Math.max(9, Math.hypot(r.vx, r.vz))
      let bestA = want, bestS = -1e9
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8, dx = Math.sin(a), dz = Math.cos(a)
        let sc = -Math.abs(ang(a - base)) * 0.8
        for (const q of run.sky.falling) {
          if (q.kind === 'boss' || q.kind === 'office' || q.kind === 'rider' || q.tLeft > 2.2) continue
          const t = q.tLeft, px = r.x + dx * v * t * 0.8, pz = r.z + dz * v * t * 0.8, d = Math.hypot(px - q.x, pz - q.z)
          if (d < q.r + 1.5) sc -= 10 + (q.r + 1.5 - d)
        }
        if (sc > bestS) { bestS = sc; bestA = a }
      }
      want = bestA
    }
  }
  const diff = ang(want - r.yaw)
  inp.steer = Math.max(-1, Math.min(1, -diff * 2.5))
  inp.throttle = Math.abs(diff) > 1.6 && r.grounded && !dodge ? 0.3 : 1
  if (dodge) inp.moveDir = { x: Math.sin(want), z: Math.cos(want) }
  const swingOK = b.kind !== 'runner' && dGoal > 30 && !(b.tailor != null && Math.hypot(COM.tailors[b.tailor].x - r.x, COM.tailors[b.tailor].z - r.z) < 45)
  b.wT += dt
  let wire = false
  b.noWire = Math.max(0, (b.noWire || 0) - dt)
  b.progT = (b.progT || 0) + dt
  if (b.progRef == null || b.goalKey2 !== b.goalKey) { b.progRef = dGoal; b.progT = 0; b.goalKey2 = b.goalKey }
  if (b.progT > 3) {
    const stuck = dGoal > b.progRef - 8 && dGoal > 20
    b.progRef = dGoal; b.progT = 0
    if (stuck) { b.noWire = 4; if (r.rope) wire = true; if (r.climbing) inp.jump = true }
  }
  const CN = world.nav && world.nav.canal, nearCanal = CN && Math.abs(r.z - (CN.z0 + CN.z1) / 2) < 45 && Math.abs(goal.z - (CN.z0 + CN.z1) / 2) > 45
  if (swingOK && !nearCanal && !(b.noWire > 0) && !r.rope && !r.climbing && b.wT > 0.35 && (r.grounded || r.vy < -1)) {
    const v = Math.max(8, Math.hypot(r.vx, r.vz))
    const a = findAnchor(world, { ...r, yaw: want, vx: Math.sin(want) * v, vz: Math.cos(want) * v })
    if (a && !(b.kind === 'clumsy' && b.rnd() < 0.33)) { wire = true; b.wT = 0; b.aim = a } else if (a) b.wT = 0
  }
  if (r.rope && (dGoal < 30 || (b.tailor != null && Math.hypot(COM.tailors[b.tailor].x - r.x, COM.tailors[b.tailor].z - r.z) < 30)) && r.y < 6) wire = true   // 着く前に振り子の下で外す
  // 空中で輪に向かっている時（上手い人だけ）: ワイヤーを外し、よける向きの掛け点へ掛け直す
  if (dodge && b.kind === 'skilled' && !r.grounded && m.tLeft < 1.3) {
    if (r.rope && !b.relDodge) { wire = true; b.relDodge = m.id }
    else if (!r.rope && b.wT > 0.15) {
      const v = Math.max(10, Math.hypot(r.vx, r.vz))
      const a = findAnchor(world, { ...r, yaw: want, vx: Math.sin(want) * v, vz: Math.cos(want) * v }, want)
      if (a) { wire = true; b.wT = 0; b.aim = a }
    }
  }
  if (!dodge) b.relDodge = null
  if (b.relNow && r.rope) { wire = true }
  b.relNow = false
  inp.wire = wire && !b.prevW; b.prevW = wire
  if (inp.wire && !r.rope && b.aim) inp.wireAt = b.aim
  b.aim = null
  // 壁に張り付いたら登って越える（壁を這うより早い）。低い壁でなければ跳んで離れる
  if (r.climbing) { b.climbT = (b.climbT || 0) + dt; inp.wallY = 1; inp.wallX = 0; if (b.climbT > 2.5 || dGoal < 40) { inp.jump = true; b.climbT = 0; b.replan = 0 } } else b.climbT = 0
  b.stuck = Math.hypot(r.x - b.lx, r.z - b.lz) < 0.05 && !r.climbing && !(r.wreck > 0) ? b.stuck + dt : 0
  b.lx = r.x; b.lz = r.z
  if (b.stuck > 1.2) { inp.jump = true; b.stuck = 0; b.replan = 0 }
  if (b.kind === 'clumsy') {
    inp.steer = Math.max(-1, Math.min(1, inp.steer + (b.rnd() - 0.5) * 0.8))
    b.lag.push(inp); const n = Math.round(0.35 / dt)
    if (b.lag.length <= n) return { throttle: 0, steer: 0 }
    return b.lag.shift()
  }
  return inp
}
