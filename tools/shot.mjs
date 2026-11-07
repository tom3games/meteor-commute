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
