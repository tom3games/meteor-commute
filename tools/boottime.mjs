// 起動の内訳（無音）: JS が動き出すまで・準備完了まで・読み込みの件数。node tools/boottime.mjs [CPU倍率]
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname, PORT = 6790 + Math.floor(Math.random() * 9)
const srv = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
for (let i = 0; i < 3; i++) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await muteContext(ctx)
  const p = await ctx.newPage(), c = await ctx.newCDPSession(p)
  await c.send('Network.setCacheDisabled', { cacheDisabled: true }); await c.send('Emulation.setCPUThrottlingRate', { rate: +(process.argv[2] || 1) })
  const t0 = Date.now(); await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'commit' })
  await p.waitForFunction(() => window.__jsUp, null, { timeout: 60000 }); const js = Date.now() - t0
  await p.waitForFunction(() => window.__meteorReady, null, { timeout: 60000 }); const rd = Date.now() - t0
  const d = await p.evaluate(() => ({ ...window.__bootDbg(), marks: window.__marks || null }))
  console.log(`JS ${js}ms 準備完了 ${rd}ms`, JSON.stringify(d))
  await ctx.close()
}
await b.close(); srv.kill()
