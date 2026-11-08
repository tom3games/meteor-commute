// SNS 用の画像 og.png（1200x630）。v2: 川の斜張橋の上をワイヤーで振り抜ける瞬間。すぐ後ろで隕石が炸裂、橋の先に大きい輪、正面に会社のタワー。node og.mjs
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { muteContext, MUTE_LAUNCH } from './mute.mjs'
const PORT = 6742
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 1200, height: 630 } }); await muteContext(ctx)
const p = await ctx.newPage()
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => m.type() === 'error' && console.log('CERR', m.text()))
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__meteorReady, null, { timeout: 30000 })
await p.evaluate(() => document.fonts.ready)
await p.evaluate(() => meteor.start(5, { rare: 'none' })); await p.waitForTimeout(800)
const A = process.argv.slice(2).map(Number)
await p.evaluate(([cx, cy, cz]) => {
  const M = meteor, me = M.me
  M.dbg.pause(true); M.dbg.quiet(999); M.run.sky.falling.length = 0
  const X = 0, Z = 772
  M.dbg.teleport(X - 3, 12, Z, 0.12)
  Object.assign(me, { grounded: false, vx: 2, vz: 24, vy: 5 })
  me.rope = { x: -13.6, y: 39.5, z: 795, len: 38, t: 0.5 }
  // すぐ後ろで炸裂した隕石と、いま落ちてくる大きい隕石（輪の上）
  M.run.t = 135   // 空が赤くなった頃
  window.__freeze = true; window.__holdFx = true
  const c = M.camera
  c.position.set(me.x + (cx || 3.4), me.y + (cy || 1.4), me.z + (cz || -6.5))
  c.lookAt(me.x + 5.5, me.y + 3.5, me.z + 30)
  c.fov = 64; c.updateProjectionMatrix()
  M.dbg.render(90)   // 遠くの空の流れ星が出るまで回す
  M.view.impact({ x: X - 8, y: 0.6, z: Z + 7, r: 8, big: false }, M.camera.position)
  M.run.sky.craters.push({ x: X - 8, y: 0.6, z: Z + 7, r: 6, hot: 11 })
  const m = M.dbg.drop(-me.x + X - 4, -me.z + Z + 42, true); m.t = m.warn - 0.35; m.tLeft = 0.35; m.ax = -0.25; m.az = -0.4
  const m2 = M.dbg.drop(-me.x + X + 6, -me.z + Z + 80, false); m2.t = m2.warn * 0.55; m2.tLeft = m2.warn - m2.t
  M.dbg.render(4)
  for (const id of ['hud', 'pause', 'title']) document.getElementById(id).classList.add('hidden')
  document.getElementById('speedfx').style.opacity = '0'
  const d = document.createElement('div')
  d.innerHTML = `<div style="position:fixed;left:0;top:0;bottom:0;width:560px;z-index:30;background:linear-gradient(90deg,rgba(14,18,32,.86) 0%,rgba(14,18,32,.62) 70%,rgba(14,18,32,0) 100%)"></div>
  <div style="position:fixed;left:48px;top:44px;z-index:31;color:#fff;font-family:'M PLUS 1p',sans-serif;font-weight:900;line-height:1.02;text-shadow:0 4px 0 #1b2233">
    <div style="display:inline-block;background:#d8341f;font-family:'BIZ UDPGothic',sans-serif;font-weight:700;font-size:24px;padding:5px 14px;margin-bottom:22px;text-shadow:none">速報　隕石 多数落下</div>
    <div style="font-size:64px">隕石の日でも</div>
    <div style="font-size:120px;color:#ffd27a;-webkit-text-stroke:3px #1b2233">出社する</div>
  </div>
  <div style="position:fixed;left:52px;top:392px;z-index:31;background:rgba(245,242,234,.97);color:#1b2233;border-radius:16px;padding:14px 22px 16px;transform:rotate(-1.5deg);box-shadow:0 8px 22px rgba(0,0,0,.4)">
    <div style="font-family:'BIZ UDPGothic',sans-serif;font-weight:700;font-size:19px;color:#d8341f">部長から着信</div>
    <div style="font-family:'Klee One',sans-serif;font-size:34px;margin-top:4px">「隕石？ 知らん。遅刻すんなよ」</div>
  </div>
  <div style="position:fixed;left:52px;bottom:34px;z-index:31;color:#fff;font-family:'BIZ UDPGothic',sans-serif;font-weight:700;font-size:24px;text-shadow:0 2px 8px rgba(0,0,0,.8)">赤い輪をギリギリでよけて、9:00 までに会社へ</div>`
  document.body.appendChild(d)
}, A)
await p.waitForTimeout(700)
await p.screenshot({ path: 'og.png' })
await b.close(); srv.kill()
console.log('og.png')
