// フレームの速さを測る（無音）。GPU あり・CPU 4倍遅くした時も。node tools/fps.mjs
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname
const PORT = 6771
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const out = []
for (const [name, cpu] of [['empty', 1], ['play', 1], ['play-cpu4', 4]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }); await muteContext(ctx)
  const p = await ctx.newPage()
  if (cpu > 1) { const c = await ctx.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  if (name === 'empty') await p.goto('about:blank')
  else { await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__meteorReady, null, { timeout: 60000 }); await p.evaluate(() => { meteor.start(6); meteor.dbg.autoBot('skilled', 6) }); await p.waitForTimeout(5000) }
  const fps = await p.evaluate(() => new Promise(ok => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; n++; if (now - t0 < 6000) requestAnimationFrame(f); else ok({ fps: +(n / ((now - t0) / 1000)).toFixed(1), worstMs: Math.round(worst) }) }; requestAnimationFrame(f) }))
  const calls = name === 'empty' ? null : await p.evaluate(() => meteor.renderer.info.render.calls)
  out.push(`${name}: ${JSON.stringify({ ...fps, calls })}`)
  await ctx.close()
}
await b.close(); srv.kill()
console.log(out.join('\n'))
