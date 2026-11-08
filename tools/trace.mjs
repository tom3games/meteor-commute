// bot の1回の出勤を、5秒ごとの位置で追う（迷う所を探す）。node tools/trace.mjs [性格] [種]
import { createRunner, stepRunner } from '../shared/runner.js?v=16'
import { COM, createRun, stepRun, commuteWorld, fmtClock, clockSec } from '../shared/commute.js?v=2'
import { createBot, botInput } from '../shared/bot.js?v=16'
import { createStreet } from '../shared/street.js?v=16'
const world = commuteWorld(), dt = 1 / 60
const kind = process.argv[2] || 'skilled', seed = +(process.argv[3] || 1)
const r = createRunner({ id: 'me', spawn: { x: COM.home.x, y: 0, z: COM.home.z, yaw: COM.home.yaw } })
const run = createRun(world, seed, { rare: 'none' }), b = createBot(kind, seed), st = createStreet(world, seed)
let steps = 0, line = []
while (!run.over && steps < 60 * 400) {
  const inp = botInput(b, r, run, world, dt)
  r.events.length = 0
  st.update(dt, r); stepRunner(r, inp, dt, world); st.collide(r); stepRun(run, r, dt)
  for (const e of run.sky.events) if (e.t === 'blast') line.push('HIT')
  for (const e of r.events) if (['splash', 'respawn', 'wire', 'unwire'].includes(e.t) && process.env.EV) line.push(e.t)
  run.events.length = 0; run.sky.events.length = 0
  if (steps % 300 === 0) { console.log(`${run.t.toFixed(0).padStart(3)}s ${fmtClock(clockSec(run))} leg${run.leg} (${r.x.toFixed(0)},${r.y.toFixed(0)},${r.z.toFixed(0)}) v${Math.hypot(r.vx, r.vz).toFixed(0)} ${r.rope ? 'rope' : ''}${r.climbing ? 'climb' : ''}${r.grounded ? 'gnd' : ''} plan→${b.plan && b.plan[b.idx] ? b.plan[b.idx].x.toFixed(0) + ',' + b.plan[b.idx].z.toFixed(0) : '-'} ${line.join(' ')}`); line = [] }
  steps++
}
console.log('end', run.arrived ? fmtClock(run.arrived) : 'absent')
