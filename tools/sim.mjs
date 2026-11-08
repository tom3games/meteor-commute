// bot の出勤を種を変えて回し、着いた時刻の分布を出す。node tools/sim.mjs [回数] [性格,性格]
import { createRunner, stepRunner } from '../shared/runner.js?v=16'
import { COM, createRun, stepRun, verdict, fmtClock, DEADLINE, commuteWorld } from '../shared/commute.js?v=2'
import { createBot, botInput } from '../shared/bot.js?v=16'
import { createStreet } from '../shared/street.js?v=16'
const world = commuteWorld()
const dt = 1 / 60
export function play(kind, seed, opt = {}) {
  const r = createRunner({ id: 'me', spawn: { x: COM.home.x, y: 0, z: COM.home.z, yaw: COM.home.yaw } })
  const run = createRun(world, seed, opt), b = createBot(kind, seed), st = createStreet(world, seed)
  for (const o of world.colliders) if (o.burning) o.burning = 0
  let steps = 0
  while (!run.over && steps < 60 * 400) {
    const inp = botInput(b, r, run, world, dt)
    r.events.length = 0
    st.update(dt, r); stepRunner(r, inp, dt, world); st.collide(r)
    stepRun(run, r, dt, { spawn: !process.env.NOSKY })
    if (opt.verbose) for (const e of run.events) console.log(run.t.toFixed(1), JSON.stringify(e))
    run.events.length = 0; run.sky.events.length = 0
    steps++
  }
  for (const o of world.colliders) if (o.burning) o.burning = 0
  return { ...verdict(run), t: run.t, stationAt: run.stationAt, dodges: b.dodges }
}
if (process.argv[1] && process.argv[1].endsWith('sim.mjs')) {
  const N = +(process.argv[2] || 10), kinds = (process.argv[3] || 'skilled,clumsy,runner,blind,idle').split(',')
  for (const k of kinds) {
    const rs = []
    for (let s = 1; s <= N; s++) rs.push(play(k, s, { rare: 'none' }))
    const arr = rs.filter(r => r.arr != null).map(r => r.arr).sort((a, b) => a - b)
    const cnt = st => rs.filter(r => r.status === st).length
    const avg = a => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length))
    console.log(`${k.padEnd(8)} 着 ${arr.length}/${N}  中央 ${arr.length ? fmtClock(arr[arr.length >> 1]) : '-'}  最速 ${arr.length ? fmtClock(arr[0]) : '-'}  早出${cnt('early')} 定時${cnt('ontime')} 遅刻${cnt('late')} 大遅刻${cnt('verylate')} 欠勤${cnt('absent')}  当たる ${avg(rs.map(r => r.hits)).toFixed(1)}  ギリギリ ${avg(rs.map(r => r.near)).toFixed(1)}  点 ${Math.round(avg(rs.map(r => r.score)))}  駅 ${fmtClock(COM.startMin * 60 + avg(rs.filter(r => r.stationAt).map(r => r.stationAt - COM.startMin * 60)))}`)
    if (process.env.V) rs.forEach((r, i) => console.log('   ', i + 1, r.status, r.arr ? fmtClock(r.arr) : '-', 'hit', r.hits, 'near', r.near, 'path', r.path))
  }
}
