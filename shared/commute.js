// 隕石の日でも出社する: 出勤の中身（時計・駅・会社・珍しい出来事・遅刻届の中身）。three.js に依存しない
// 家（空中出前の店の場所の町）→ 駅（電車は止まっている）→ 会社。9:00 までに会社の入口の輪に入る
import { mulberry } from './util.js?v=1'
import { createSky, stepSky, dropAt, noteRunner, SKY } from './meteor.js?v=1'

export const COM = {
  home: { x: 21, z: 842, yaw: Math.PI / 2 },          // 家の前（空中出前の店の場所。町の家に囲まれている）
  station: { x: 390, z: 905, r: 7, name: ['明星台駅', 'Myojodai Sta.'] },   // 東の大通りの駅前（電車は隕石で止まっている）
  office: { x: 264, z: 108, r: 6.5, name: ['株式会社ドンマイ商事', 'Donmai Trading Co.'] },  // 運河の南。会社の入口（西の通り側）
  officeBld: { x: 294, z: 108 },                       // 会社のビル（入口の東）
  startMin: 8 * 60 + 47,  // 家を出る時刻
  rate: 5.3,              // 1秒で時計が 5.3秒進む（9:00 は 147秒後）
  endMin: 9 * 60 + 10,    // これを過ぎたら欠勤扱いで終わる（260秒）
  officeHitOdds: 0.04,    // 珍しい: 会社に隕石が落ちて臨時休業
  bossRideOdds: 0.06,     // 珍しい: 部長が隕石に乗って出社してくる
  riderAt: [26, 40]       // 後輩が転がる隕石に乗って通り過ぎる時間
}
export const DEADLINE = 9 * 60 * 60   // 9:00:00（秒）

export const clockSec = run => COM.startMin * 60 + run.t * COM.rate
export function fmtClock(s) { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return `${h}:${String(m).padStart(2, '0')}` }
export const goalOf = run => run.leg === 0 ? COM.station : COM.office

export function createRun(world, seed = 1, opt = {}) {
  const rnd = mulberry(seed * 2654435761 + 11)
  const rare = opt.rare === 'none' ? null : opt.rare || (rnd() < COM.officeHitOdds ? 'officeHit' : rnd() < COM.bossRideOdds / (1 - COM.officeHitOdds) ? 'bossRide' : null)
  const run = {
    t: 0, leg: 0, over: false, arrived: null, rnd, rare, events: [], seed,
    riderAt: COM.riderAt[0] + rnd() * (COM.riderAt[1] - COM.riderAt[0]), riderDone: false,
    officeHit: false, officeHitAt: null, bossAt: null, bossLanded: false, endIn: null, path: 0, lx: COM.home.x, lz: COM.home.z, stationAt: null,
    called9: false
  }
  run.sky = createSky(world, seed, { rare })
  run.sky.goal = goalOf(run)
  return run
}

export function stepRun(run, r, dt, opt = {}) {
  if (run.over) return
  run.t += dt
  const ev = run.events, sky = run.sky
  run.path += Math.hypot(r.x - run.lx, r.z - run.lz); run.lx = r.x; run.lz = r.z
  noteRunner(sky, r)
  stepSky(sky, r, dt, { active: !run.arrived && !run.officeHit, spawn: opt.spawn !== false })
  const c = clockSec(run)
  // 駅: 電車は止まっている。会社まで行く
  if (run.leg === 0 && Math.hypot(r.x - COM.station.x, r.z - COM.station.z) < COM.station.r + 2 && r.y < 6) {
    run.leg = 1; run.stationAt = c; sky.goal = goalOf(run)
    ev.push({ t: 'station', clock: c })
  }
  // 8:58 の電話
  if (!run.called9 && c >= DEADLINE - 120 && !run.arrived) { run.called9 = true; ev.push({ t: 'call58' }) }
  if (!run.lateSaid && c >= DEADLINE && !run.arrived) { run.lateSaid = true; ev.push({ t: 'nine' }) }
  // 後輩が転がる隕石に乗ってくる（落ちる所は自分の横 26m。自分には当たらない）
  if (!run.riderDone && run.t >= run.riderAt) {
    run.riderDone = true
    const v = Math.hypot(r.vx, r.vz), hx = v > 2 ? r.vx / v : Math.sin(r.yaw), hz = v > 2 ? r.vz / v : Math.cos(r.yaw)
    const s = run.rnd() < 0.5 ? -1 : 1
    dropAt(sky, r.x + hx * 30 - hz * s * 26, r.z + hz * 30 + hx * s * 26, false, { kind: 'rider' })
    ev.push({ t: 'riderWarn' })
  }
  // 珍しい: 会社に隕石（会社まで 220m を切ったら）
  const dO = Math.hypot(r.x - COM.office.x, r.z - COM.office.z)
  if (run.rare === 'officeHit' && run.leg === 1 && !run.officeHitAt && !run.arrived && dO < 220) {
    run.officeHitAt = run.t
    sky.quiet = 6
    dropAt(sky, COM.officeBld.x, COM.officeBld.z, true, { kind: 'office', warn: 3.4, r: 20 })
    ev.push({ t: 'officeWarn' })
  }
  for (const e of sky.events) {
    if (e.t === 'impact' && e.kind === 'office') { run.officeHit = true; run.endIn = 3.2; ev.push({ t: 'officeHit', clock: c }) }
    if (e.t === 'impact' && e.kind === 'boss') { run.bossLanded = true; ev.push({ t: 'bossLand' }) }
  }
  // 会社に着いた
  if (run.leg === 1 && !run.arrived && !run.officeHit && dO < COM.office.r + 1.5 && r.y < 5) {
    run.arrived = c
    ev.push({ t: 'arrive', clock: c, late: c > DEADLINE })
    if (run.rare === 'bossRide') { run.bossAt = run.t; dropAt(sky, COM.office.x - 14, COM.office.z + 10, true, { kind: 'boss', warn: 2.4 }); run.endIn = 5.2 }
    else run.endIn = 2.6
  }
  if (run.endIn != null) { run.endIn -= dt; if (run.endIn <= 0) { run.over = true; ev.push({ t: 'end' }) } }
  else if (c >= COM.endMin * 60) { run.over = true; ev.push({ t: 'absent' }); ev.push({ t: 'end' }) }
}

// 遅刻届・出勤記録の中身
export function verdict(run) {
  const S = run.sky.stats, ja = true
  const arr = run.arrived
  let status
  if (run.officeHit) status = 'dayoff'
  else if (arr == null) status = 'absent'
  else if (arr <= DEADLINE - 180) status = 'early'
  else if (arr <= DEADLINE) status = 'ontime'
  else if (arr <= DEADLINE + 300) status = 'late'
  else status = 'verylate'
  const lateMin = arr != null && arr > DEADLINE ? Math.ceil((arr - DEADLINE) / 60) : 0
  // 言い訳（遅刻届の「理由」欄）。多い順に
  const ex = []
  if (S.hits) ex.push({ k: 'hit', n: S.hits })
  if (S.rollHits) ex.push({ k: 'roll', n: S.rollHits })
  if (S.hotFeet) ex.push({ k: 'hot', n: S.hotFeet })
  if (S.burnedWire) ex.push({ k: 'burn', n: S.burnedWire })
  if (run.stationAt != null) ex.push({ k: 'train', n: 1 })
  ex.sort((a, b) => b.n - a.n)
  const pardon = status === 'dayoff' || (run.rare === 'bossRide' && run.bossLanded)
  // 点数（同じ出勤の上手さを比べる。早いほど・よけるほど・当たらないほど高い）
  const score = status === 'dayoff' ? 0 : arr == null ? 0 : Math.max(0, Math.round((DEADLINE + 900 - arr) * 1.2 + S.near * 25 + S.bestChain * 40 - S.hits * 30))
  return { status, arr, lateMin, excuses: ex, pardon, near: S.near, bestChain: S.bestChain, hits: S.hits + S.rollHits, score, path: Math.round(run.path), rare: run.rare }
}
export { SKY }
