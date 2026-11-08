// 画面を撮って目で見る（無音）。node tools/shot.mjs [名前] [幅x高さ] [台本]
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname
mkdirSync(ROOT + 'shots', { recursive: true })
const PORT = 6750 + Math.floor(Math.random() * 20)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const [W, H] = (process.argv[3] || '390x844').split('x').map(Number)
const b = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
p.on('requestfailed', r => { if (!/fonts\./.test(r.url())) errs.push('reqfail ' + r.url()) })
await p.goto(`http://localhost:${PORT}/`)
await p.waitForFunction(() => window.__meteorReady, null, { timeout: 60000 })
const name = process.argv[2] || 'shot'
await p.waitForTimeout(1500)
await p.screenshot({ path: ROOT + `shots/${name}_title.png` })
const script = process.argv[4] || 'play'
if (script === 'near') {
  // CPU に遊ばせて、ギリギリ回避・吹き飛ばされた瞬間を撮る
  await p.evaluate(() => { meteor.start(+(new URLSearchParams(location.search).get('s') || 12)); meteor.dbg.autoBot('skilled', 8) })
  const want = ['near', 'blast', 'near', 'near', 'station', 'roll']
  let k = 0, seen = 0
  for (let i = 0; i < 1400 && k < 8; i++) {
    await p.waitForTimeout(100)
    const ev = await p.evaluate(n => meteor.log.slice(n).map(e => e.t), seen)
    seen += ev.length
    const hit = ['near', 'blast', 'riderWarn', 'station', 'arrive'].find(x => ev.includes(x) && !(x === 'near' && k > 4))
    if (hit) { await p.waitForTimeout(hit === 'blast' ? 250 : 60); await p.screenshot({ path: ROOT + `shots/${name}_${k}_${hit}.png` }); k++; await p.waitForTimeout(1500) }
  }
  await p.evaluate(() => { const M = meteor; M.dbg.pause(true); let n = 0; while (!M.run.over && n < 60 * 300) { M.dbg.step(20); n += 20 } M.dbg.pause(false) })
  await p.waitForTimeout(1200); await p.screenshot({ path: ROOT + `shots/${name}_result.png` })
}
if (script === 'tour') {
  // 新しい街の見どころを順に撮る（時間を止めて、自分をそこへ移す）。[x, y, z, 向き(度), 見下ろし, 名前]
  const spots = [[0, 0, 14, 0, 0.25, 'home'], [0, 0, 250, 0, 0.2, 'resi'], [0, 0, 330, 0, 0.15, 'arcade'], [0, 0, 540, 30, 0.2, 'plaza'], [100, 0, 630, 90, 0.15, 'station'],
    [0, 0, 735, 0, 0.12, 'bridge'], [150, 10, 720, 0, 0.15, 'tracks'], [0, 0, 880, 0, 0.1, 'blvd'], [0, 0, 1080, 0, 0.05, 'tower'], [-30, 0, 960, -60, 0.05, 'crane'], [40, 0, 600, -90, 0.2, 'screen']]
  await p.evaluate(() => { meteor.start(7); meteor.dbg.quiet(999) })
  for (const [x, y, z, deg, pitch, nm] of spots) {
    await p.evaluate(([x, y, z, deg, pitch]) => { const M = meteor; M.dbg.pause(true); M.dbg.teleport(x, y, z, deg * Math.PI / 180); M.cam.hd = deg * Math.PI / 180; M.cam.pitch = pitch; M.cam.userT = performance.now(); M.dbg.step(30); M.dbg.render(40) }, [x, y, z, deg, pitch])
    await p.waitForTimeout(500)
    await p.screenshot({ path: ROOT + `shots/${name}_${nm}.png` })
  }
  await p.evaluate(() => meteor.dbg.pause(false))
}
if (script === 'car') {
  // 車の大きさを人と道と比べる: 止めた車の横に自分を立たせて、横と斜め後ろから撮る
  await p.evaluate(() => { meteor.start(7); meteor.dbg.quiet(999); meteor.dbg.pause(true); meteor.dbg.step(5) })
  for (const [k, side, deg, pitch, back] of [['side', 3.2, -90, 0.12, 0], ['back', 1.6, 0, 0.12, -6.5]]) {
    await p.evaluate(([side, deg, pitch, back]) => {
      const M = meteor, me = M.me, cars = M.street.traffic.cars.filter(c => !c.hidden && Math.abs(c.z - 880) < 400)
      const c = cars.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0]
      const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw)
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw)
      M.dbg.teleport(c.x + rx * side + fx * back, 0, c.z + rz * side + fz * back, c.yaw); M.cam.hd = c.yaw + deg * Math.PI / 180; M.cam.pitch = pitch; M.cam.userT = performance.now(); M.dbg.render(40)
    }, [side, deg, pitch, back])
    await p.waitForTimeout(400); await p.screenshot({ path: ROOT + `shots/${name}_car_${k}.png` })
  }
}
if (script === 'play') {
  await p.evaluate(() => { meteor.start(5); meteor.dbg.autoBot('skilled', 5) })
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(4000); await p.screenshot({ path: ROOT + `shots/${name}_seq${i}.png` }) }
  await p.evaluate(() => meteor.dbg.autoBot(null))
  await p.screenshot({ path: ROOT + `shots/${name}_play.png` })
  await p.evaluate(() => { meteor.dbg.quiet(99); meteor.dbg.drop(0, 14, false); meteor.dbg.drop(-10, -18, true) })
  await p.waitForTimeout(1600)
  await p.screenshot({ path: ROOT + `shots/${name}_warn.png` })
  await p.waitForTimeout(1300)
  await p.screenshot({ path: ROOT + `shots/${name}_impact.png` })
  await p.waitForTimeout(2000)
  await p.screenshot({ path: ROOT + `shots/${name}_after.png` })
  await p.evaluate(() => { meteor.run.arrived = 9 * 3600 - 100; meteor.run.over = true; meteor.showResult() })
  await p.waitForTimeout(800)
  await p.screenshot({ path: ROOT + `shots/${name}_result.png` })
}
console.log(JSON.stringify({ errs, muteOk: await p.evaluate(() => window.__muteOk ? window.__muteOk() : 'none') }))
await b.close(); srv.kill()
