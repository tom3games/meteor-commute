import '../mute-auto.mjs'
// v3 の確認（無音）: 屋根に乗った足と見えている面の差（建物の種類ごと）・スーツの段・確保の場面・ギリギリ回避の軽さ・新しい街の撮影
// node tools/v3check.mjs [land|suit|arrest|near|tour|all] [幅x高さ] [URL]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname
mkdirSync(ROOT + 'shots', { recursive: true })
const what = process.argv[2] || 'all', [W, H] = (process.argv[3] || '390x844').split('x').map(Number)
const PORT = 6790 + Math.floor(Math.random() * 9)
const srv = process.argv[4] ? null : spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | '))); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
await p.goto(process.argv[4] || `http://localhost:${PORT}/`)
await p.waitForFunction(() => window.__meteorReady && window.meteor, null, { timeout: 30000 }).catch(e => { console.log('起動しない', errs); process.exit(1) })
await p.waitForFunction(() => meteor.dbg.model && meteor.dbg.model.setSuit, null, { timeout: 30000 }).catch(() => {})
const muteOk = await p.evaluate(() => typeof window.__muteOk === 'function' ? window.__muteOk() : window.__muteOk)
console.log('muteOk', muteOk)
if (!muteOk) { console.log('音が止まっていない。中止'); process.exit(1) }
const shot = async n => { await p.waitForTimeout(250); await p.screenshot({ path: ROOT + `shots/v3_${n}.png` }) }
const all = what === 'all'

if (all || what === 'land') {
  const rows = await p.evaluate(() => {
    const M = meteor, w = M.world
    M.start(5); M.dbg.quiet(9999); M.dbg.pause(true)
    const C = w.colliders
    const pick = (f, n = 1) => C.filter(f).slice(0, n)
    const cases = []
    const add = (name, o, pts) => { if (o) for (const [u, v] of pts) cases.push({ name, x: o.cx + u * o.hw, z: o.cz + v * o.hl, o }) }
    const hx = pick(o => o.gable && o.ridgeX && o.fill)[0], hz = pick(o => o.gable && !o.ridgeX && o.fill)[0], hall = pick(o => o.look === 'hall', 2)
    add('一軒家（棟が東西）', hx, [[0, 0], [0, 0.5], [0.4, -0.85]]); add('一軒家（棟が南北）', hz, [[0, 0], [0.5, 0], [-0.85, 0.4]])
    add('お社（小）', hall[0], [[0, 0], [0.5, 0]]); add('お社（大）', hall[1], [[0, 0], [-0.6, 0.3]])
    add('アパート（4階）', w.town.fill.apts[1], [[0.6, 0]])
    const gen = pick(o => o.roofProps && o.h < 30 && o.hw > 6, 3)
    add('ビル（屋上の床）', gen[0], [[0.75, 0.75]]); add('ビル（屋上の床）', gen[1], [[-0.75, -0.75]])
    for (const lk of ['penthouse', 'rooftank', 'aircon', 'konbini', 'cleaner', 'tailor', 'expressway', 'viaduct', 'platform', 'canopy', 'footbridge', 'train', 'gate', 'torii', 'chimney', 'billboard', 'pylon', 'clock', 'screen', 'vsign', 'jib', 'mast']) add(lk, pick(o => o.look === lk)[0], [[0, 0]])
    add('家（メゾン朝日の玄関）', w.town.shop, [[0, 0]]); add('駐車場の車', pick(o => o.kind === 'parked')[0], [[0, 0]])
    add('駅舎', pick(o => o.station)[0], [[0.6, 0.6]]); add('百貨店', pick(o => o.dept)[0], [[0.6, 0.6]]); add('会社のタワー', pick(o => o.company)[0], [[0.6, 0.6]])
    add('商店街の店', pick(o => o.shopfront)[0], [[0, 0]]); add('自動販売機', w.town.fill.vends[0], [[0, 0]]); add('貯水槽（アパート）', pick(o => o.kind === 'tank' && !o.look)[0], [[0, 0]])
    add('バス停', pick(o => o.kind === 'shelter')[0], [[0, 0]])
    const out = []
    const skip = new Set([M.dbg.model && M.dbg.model.group])
    const isSkip = ob => { for (let q = ob; q; q = q.parent) { if (skip.has(q) || !q.visible) return true } return false }
    for (const c of cases) {
      const top = c.o.y1 + (c.o.gable || 0) + 3
      M.dbg.teleport(c.x, top, c.z, 0); M.me.grounded = false
      let n = 0
      while (n < 400 && !(M.me.grounded && n > 4)) { M.dbg.step(2); n += 2 }
      M.dbg.render(1)
      const fy = M.me.y
      const cl = (v, a, b) => Math.max(a, Math.min(b, v)), o = c.o   // 体の半径で縁に乗った時は、乗っている箱の縁の真上から見る
      M.dbg.raycaster.set(M.dbg.vec(cl(M.me.x, o.cx - o.hw + 0.01, o.cx + o.hw - 0.01), fy + 2.5, cl(M.me.z, o.cz - o.hl + 0.01, o.cz + o.hl - 0.01)), M.dbg.vec(0, -1, 0)); M.dbg.raycaster.far = 8; M.dbg.raycaster.camera = M.camera
      const hits = M.dbg.raycaster.intersectObjects(M.dbg.scene.children, true).filter(h => !isSkip(h.object) && h.object.isMesh && !h.object.isSkinnedMesh && !(h.object.material && (h.object.material.transparent || h.object.material.side === 1)))
      const vis = hits.length ? hits[0].point.y : null
      out.push({ name: c.name, at: [Math.round(M.me.x), Math.round(M.me.z)], drift: +Math.hypot(M.me.x - c.x, M.me.z - c.z).toFixed(2), feet: +fy.toFixed(3), visible: vis == null ? null : +vis.toFixed(3), diff: vis == null ? null : +((fy - vis) * 100).toFixed(1), grounded: M.me.grounded, roof: M.me.onRoof })
    }
    M.dbg.pause(false)
    return out
  })
  let bad = 0
  for (const r of rows) { const ok = r.diff != null && Math.abs(r.diff) <= 5 && r.grounded; if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'NG  '}${r.name.padEnd(14)} 足 ${r.feet}m 見た目 ${r.visible}m 差 ${r.diff}cm ずれ ${r.drift}m @${r.at}`) }
  console.log('屋根の着地', rows.length - bad, '/', rows.length)
}

// スーツの段（正面から撮る）
if (all || what === 'suit') {
  await p.evaluate(() => { const M = meteor; M.start(9, { rare: 'none' }); M.dbg.quiet(9999); M.dbg.pause(true); M.dbg.teleport(0, 0, 330, 0); M.dbg.step(30) })
  for (let n = 0; n <= 4; n++) {
    await p.evaluate(n => { const M = meteor; if (n) { M.dbg.burn(1); M.dbg.step(2) } M.dbg.teleport(0, 0, 340, 0); M.me.wreck = 0; M.dbg.step(10); M.cam.hd = Math.PI; M.cam.pitch = 0.05; M.cam.userT = performance.now(); for (let i = 0; i < 20; i++) M.dbg.render(1); window.__freeze = true; const me = M.me; M.camera.position.set(me.x + 1.2, me.y + 1.5, me.z + 3.4); M.camera.lookAt(me.x, me.y + 0.85, me.z); for (let i = 0; i < 20; i++) M.dbg.render(1) }, n)
    await p.waitForTimeout(900)
    await shot('suit' + n)
    await p.evaluate(() => { window.__freeze = false })
    console.log('suit', n, await p.evaluate(() => ({ run: meteor.run.suit, model: meteor.dbg.model.suit, hud: document.getElementById('suit').getAttribute('class') })))
  }
  await p.evaluate(() => meteor.dbg.pause(false))
}

// 確保の場面
if (all || what === 'arrest') {
  await p.evaluate(() => { const M = meteor; M.start(11, { rare: 'none' }); M.dbg.quiet(9999); M.dbg.teleport(0, 0, 1000, 0); M.dbg.burn(4) })
  await p.waitForTimeout(1500)
  await p.evaluate(() => { meteor.dbg.drop(0, 0, false) })   // 5回目: 真上に落とす
  for (const [ms, n] of [[3200, 'arrest1'], [1500, 'arrest2']]) { await p.waitForTimeout(ms); await shot(n); console.log(n, await p.evaluate(() => { const m = meteor.dbg.model, B = m.bones, a = B['upperarm.l'], b = B['lowerarm.l']; const pa = a.getWorldPosition(meteor.dbg.vec(0, 0, 0)), pb = b.getWorldPosition(meteor.dbg.vec(0, 0, 0)); return { ...window.__arrestDbg, mh: m.handsUp, arm: [+(pb.x - pa.x).toFixed(2), +(pb.y - pa.y).toFixed(2), +(pb.z - pa.z).toFixed(2)], st: m.state } })) }
  await p.evaluate(() => { const M = meteor, me = M.me; window.__freeze = true; M.camera.position.set(me.x + Math.sin(me.yaw) * 3.2, me.y + 1.4, me.z + Math.cos(me.yaw) * 3.2); M.camera.lookAt(me.x, me.y + 0.9, me.z) })
  await p.waitForTimeout(150); await shot('arrest_close'); await p.evaluate(() => { window.__freeze = false })
  await p.waitForFunction(() => meteor.mode === 'result', null, { timeout: 20000 })
  await p.waitForTimeout(800); await shot('arrest_result')
  console.log('arrest verdict', await p.evaluate(() => { const v = window.__lastVerdict; return { status: v.status, stamp: v.stamp, title: v.title, hits: v.hits } }))
}

// ギリギリ回避の軽さ（スローの長さと倍率）
if (all || what === 'near') {
  const r = await p.evaluate(async () => {
    const M = meteor; M.start(13, { rare: 'none' }); M.dbg.quiet(9999); M.dbg.teleport(0, 0, 330, 0)
    M.me.vz = 9
    M.me.vz = 0; M.dbg.drop(M.SKY.r + 2.5, 0, false); const m = M.run.sky.falling[M.run.sky.falling.length - 1]; m.tLeft = 0.02; m.t = m.warn - 0.02
    const t0 = performance.now(); let slow0 = 0, stop = 0
    await new Promise(ok => { const f = () => { slow0 = Math.max(slow0, M.slowT); if (M.hitStop > 0) stop++; if (performance.now() - t0 < 900) requestAnimationFrame(f); else ok() }; requestAnimationFrame(f) })
    return { slowMax: +slow0.toFixed(2), hitStopFrames: stop, near: M.run.sky.stats.near, impacts: M.run.sky.stats.impacts, log: M.log.slice(-6).map(e => e.t + (e.d != null ? ':' + e.d : '')), mode: M.mode, falling: M.run.sky.falling.length }
  })
  console.log('near', r)
}

// 新しい街
if (all || what === 'tour') {
  const spots = [[0, 0, 14, 0, 0.25, 'home'], [0, 0, 40, 0, 0.22, 'resi1'], [-2, 0, 150, 0, 0.22, 'resi2'], [2, 0, 445, 0, 0.15, 'arcade_tailor'],
    [0, 0, 850, 0, 0.12, 'hinode_torii'], [-6, 0, 930, -90, 0.12, 'shrine'], [0, 0, 1060, 0, 0.0, 'expressway'], [0, 0, 1132, 30, 0.15, 'tailor'], [0, 0, 1190, -20, 0.2, 'park_chimney'], [0, 0, 1400, 0, 0.08, 'office']]
  await p.evaluate(() => { meteor.start(7, { rare: 'none' }); meteor.dbg.quiet(9999) })
  for (const [x, y, z, deg, pitch, nm] of spots) {
    await p.evaluate(([x, y, z, deg, pitch]) => { const M = meteor; M.dbg.pause(true); M.dbg.teleport(x, y, z, deg * Math.PI / 180); M.cam.hd = deg * Math.PI / 180; M.cam.pitch = pitch; M.cam.userT = performance.now(); M.dbg.step(30); M.dbg.render(40) }, [x, y, z, deg, pitch])
    await p.waitForTimeout(600); await shot('tour_' + nm)
  }
  await p.evaluate(() => meteor.dbg.pause(false))
}
// 一画面に収まるか（タイトル・遊び方・遊び中・確保の結果）。はみ出し（縦スクロール・横はみ出し）を数える
if (all || what === 'screens') {
  const over = async nm => { const r = await p.evaluate(() => { const el = [...document.querySelectorAll('section:not(.hidden), .memo, #result .slip-wrap, #result canvas')]; let bad = 0; for (const e of el) { const b = e.getBoundingClientRect(); if (b.bottom > innerHeight + 1 || b.right > innerWidth + 1 || b.left < -1) bad++ } return { sh: document.documentElement.scrollHeight, h: innerHeight, sw: document.documentElement.scrollWidth, w: innerWidth, bad } }); console.log(nm, JSON.stringify(r)); return r }
  await p.evaluate(() => meteor.toTitle()); await p.waitForTimeout(500); await shot(`scr_${W}_title`); await over('title')
  await p.evaluate(() => document.getElementById('btnHow').click()); await p.waitForTimeout(400); await shot(`scr_${W}_how`); await over('how')
  await p.evaluate(() => { document.querySelector('[data-close]').click(); meteor.start(3, { rare: 'none' }); meteor.dbg.quiet(999); meteor.dbg.burn(2) }); await p.waitForTimeout(1200); await shot(`scr_${W}_hud`); await over('hud')
  await p.evaluate(() => { meteor.dbg.burn(3); meteor.dbg.drop(0, 0) }); await p.waitForFunction(() => meteor.mode === 'result', null, { timeout: 20000 }); await p.waitForTimeout(700); await shot(`scr_${W}_arrest`); await over('arrest')
}
console.log('errors', errs.length ? errs.slice(0, 8) : 'none')
await b.close(); if (srv) srv.kill()
