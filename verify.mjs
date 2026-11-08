// 隕石の日でも出社する の検証。node verify.mjs（テスト中は無音: mute-auto.mjs）。ONLY=正規表現 で一部だけ
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium, webkit } from 'playwright'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { createRunner, stepRunner, RUN, rayHit, findAnchor } from './shared/runner.js?v=16'
import { SKY, createSky, stepSky, dropAt } from './shared/meteor.js?v=3'
import { COM, DEADLINE, createRun, stepRun, verdict, clockSec, commuteWorld } from './shared/commute.js?v=3'
import { sweep } from './tools/reach.mjs'
import { play } from './tools/sim.mjs'
const ROOT = import.meta.dirname
execFileSync(process.execPath, ['tools/build.mjs'], { cwd: ROOT, stdio: 'inherit' })   // 公開するのは1つにまとめた dist/game.js。先に作り直す
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 6741
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
const dt = 1 / 60
const world = commuteWorld()
const clear = () => { for (const o of world.colliders) if (o.burning) o.burning = 0 }
const runner = (x, z, yaw = 0) => createRunner({ id: 't', spawn: { x, y: 0, z, yaw } })

// ---------------------------------------------------------------- 仕組み（node だけ）
await t('ワイヤー: 75m 以内に掛かる・スイングは走るより速い（6秒で進む距離が1.4倍以上）', () => {
  const r = runner(0, 700); stepRunner(r, { wire: true, wireAt: { x: 18, y: 18, z: 715 } }, dt, world)
  expect(r.rope, 'no rope')
  const go = wire => { const q = runner(0, 860); let s = 0; while (s < 6) { stepRunner(q, { throttle: 1, wire: wire && Math.floor(s * 4) % 3 === 0 && !q.rope }, dt, world); s += dt } return Math.hypot(q.x, q.z - 860) }
  const a = go(false), b = go(true); expect(b > a * 1.4, JSON.stringify({ a, b })); return { run: Math.round(a), swing: Math.round(b) }
})
await t('クレーンの腕（高さ 56m）: 空中から腕を狙うと掛かり、大通りの上まで大きく振れる', () => {
  const jib = world.colliders.find(o => o.look === 'jib'), Z0 = jib.cz - 49.5, r = runner(-30, Z0); r.y = 28; r.grounded = false   // v3: オフィス街は 560m 北へ
  const L = Math.hypot(0, 57 - 29.5, jib.cz - Z0), h = rayHit(world, -30, 29.5, Z0, 0, (57 - 29.5) / L, (jib.cz - Z0) / L, 80)
  stepRunner(r, { wire: true, wireAt: h }, dt, world)
  const on = !!r.rope && Math.abs(r.rope.y - 56) < 1.5
  let maxX = r.x; for (let i = 0; i < 60 * 3 && r.rope; i++) { stepRunner(r, { throttle: 1, moveDir: { x: 1, z: 0.2 } }, dt, world); maxX = Math.max(maxX, r.x) }
  expect(jib && h && on, JSON.stringify({ h, rope: r.rope })); return { hitY: +h.y.toFixed(1), swingToX: Math.round(maxX) }
})
await t('開始地点（家の前）の全方位: 5度ごとの72向きすべてで75m以内に掛かる物がある・ワイヤーボタンも不発なし', () => {
  const rows = sweep(world, COM.home.x, 0, COM.home.z, RUN.wireRange)
  const miss = rows.filter(r => !r.hit).map(r => r.deg), btn = rows.filter(r => r.btn == null).map(r => r.deg)
  expect(!miss.length && !btn.length, JSON.stringify({ miss, btn })); return { hit: rows.length - miss.length }
})
await t('予告: 隕石は赤い輪が出てから 2秒以上たって落ちる（大きいのは2.5秒。どちらも 1.5秒より長い）。輪の半径 8m・大 13m', () => {
  const sky = createSky(world, 1), r = runner(0, 700)
  const m = dropAt(sky, 40, 700), b = dropAt(sky, -40, 700, true)
  let tm = null, tb = null
  for (let i = 1; i <= 60 * 4; i++) { stepSky(sky, r, dt, { spawn: false }); for (const e of sky.events) if (e.t === 'impact') { if (e.id === m.id) tm = i * dt; else tb = i * dt } sky.events.length = 0 }
  expect(tm >= 2.0 && tb >= 2.5 && m.r === 8 && b.r === 13, JSON.stringify({ tm, tb })); return { normal: +tm.toFixed(2), big: +tb.toFixed(2) }
})
const at = (dx) => {
  const sky = createSky(world, 2), r = runner(0, 700)
  dropAt(sky, dx, 700)
  const ev = []
  for (let i = 0; i < 60 * 5; i++) { stepRunner(r, {}, dt, world); stepSky(sky, r, dt, { spawn: false }); ev.push(...sky.events); sky.events.length = 0 }
  return { sky, r, ev }
}
await t('輪の中で落ちると吹き飛ばされて顔から倒れる／輪のすぐ外（+3m）はギリギリ回避／遠く（+20m）は何も起きない', () => {
  const a = at(3), b = at(SKY.r + 3), c = at(SKY.r + 20)
  const blast = a.ev.some(e => e.t === 'blast'), face = a.ev.some(e => e.t === 'faceplant')
  const near = b.ev.find(e => e.t === 'near'), none = !c.ev.some(e => e.t === 'blast' || e.t === 'near')
  expect(blast && face && a.sky.stats.hits === 1 && near && b.sky.stats.near === 1 && none, JSON.stringify({ blast, face, near: !!near, none }))
  return { hits: a.sky.stats.hits, near: b.sky.stats.near }
})
await t('ギリギリ回避は進む向きに速さが乗る（走っている時に +5m/s 以上）。5秒以内に続けると連続になる', () => {
  const sky = createSky(world, 3), r = runner(0, 700, Math.PI / 2)
  for (let i = 0; i < 60; i++) stepRunner(r, { throttle: 1 }, dt, world)
  const v0 = Math.hypot(r.vx, r.vz)
  const m = dropAt(sky, r.x, r.z + SKY.r + 3); m.warn = m.tLeft = 0.01
  stepSky(sky, r, dt, { spawn: false })
  const v1 = Math.hypot(r.vx, r.vz)
  const m2 = dropAt(sky, r.x, r.z - SKY.r - 3); m2.warn = m2.tLeft = 0.01
  stepSky(sky, r, dt, { spawn: false })
  const ch = sky.events.filter(e => e.t === 'near').map(e => e.chain)
  expect(v1 - v0 > 5 && ch.join() === '1,2', JSON.stringify({ v0, v1, ch })); return { v0: +v0.toFixed(1), v1: +v1.toFixed(1), chain: ch }
})
await t('屋上に落ちるとビルが燃えて、その間ワイヤーが掛からない（タップは「燃えている」で外れ、ボタンの自動の狙いからも外れる）。28秒で消える', () => {
  clear()
  const open = (x, z) => !world.nearby(x, z).some(o => o.y1 != null && !o.slab && Math.abs(x - o.cx) < o.hw + 1 && Math.abs(z - o.cz) < o.hl + 1)
  const b = world.colliders.find(o => o.kind === 'building' && !o.small && !o.look && o.y1 > 30 && o.hl > 6 && open(o.cx - o.hw - 20, o.cz) && open(o.cx - o.hw - 10, o.cz) && world.groundAt(o.cx - o.hw - 20, o.cz, 2).h > -1)
  const sky = createSky(world, 4), r = runner(b.cx - b.hw - 20, b.cz, Math.PI / 2)
  const m = dropAt(sky, b.cx, b.cz); m.warn = m.tLeft = 0.01
  stepSky(sky, r, dt, { spawn: false })
  const burning = b.burning > 0
  const hit = rayHit(world, r.x, 10, r.z, 1, 0.3, 0, 80)
  stepRunner(r, { wire: true, wireAt: hit }, dt, world)
  const miss = r.events.find(e => e.t === 'wireMiss' && e.burning)
  const a = findAnchor(world, { ...r, yaw: Math.PI / 2 }, Math.PI / 2)
  const onB = !!a && Math.abs(a.x - (b.cx - b.hw)) < 0.6 && Math.abs(a.z - b.cz) < b.hl
  for (let i = 0; i < 60 * (SKY.burnSec + 1); i++) stepSky(sky, r, dt, { spawn: false })
  const out = !(b.burning > 0) && !sky.fires.includes(b)
  clear()
  expect(burning && hit && hit.burning && miss && !r.rope && !onB && out, JSON.stringify({ burning, hb: hit && hit.burning, miss: !!miss, rope: !!r.rope, onB, out })); return true
})
await t('落ちた所は11秒熱い: 地面を走って入ると跳ね上がる（言い訳は1つのクレーターで1回）', () => {
  const sky = createSky(world, 5), r = runner(0, 700)
  sky.craters.push({ x: 0, y: 0, z: 712, r: 6, hot: SKY.craterHot })
  let hops = 0
  for (let i = 0; i < 60 * 3; i++) { stepRunner(r, { throttle: 1 }, dt, world); stepSky(sky, r, dt, { spawn: false }); hops += sky.events.filter(e => e.t === 'hot').length; sky.events.length = 0 }
  expect(hops >= 1 && sky.stats.hotFeet === 1, JSON.stringify({ hops, n: sky.stats.hotFeet })); return { hops }
})
await t('転がる隕石: 道に沿って転がり、当たると飛ばされる。6秒で止まる', () => {
  const sky = createSky(world, 6), r = runner(0, 760)
  sky.rollers.push({ id: 99, x: 0, y: 0, z: 700, vx: 0, vz: SKY.rollSpeed, t: 0, spin: 0, bounces: 0 })
  let hit = false, stop = false
  for (let i = 0; i < 60 * 8; i++) { stepRunner(r, {}, dt, world); stepSky(sky, r, dt, { spawn: false }); for (const e of sky.events) { if (e.t === 'rollHit') hit = true; if (e.t === 'rollStop') stop = true } sky.events.length = 0 }
  expect(hit && stop && sky.stats.rollHits === 1 && !sky.rollers.length, JSON.stringify({ hit, stop })); return true
})
await t('狙い（v3 で散らした）: 1.5〜4.5割が自分の少し先、ほかは行く道の先と近く。だんだん間隔が短くなる', () => {
  const sky = createSky(world, 7), r = runner(0, 700); r.vz = 10
  sky.goal = COM.office
  const pts = []
  for (let i = 0; i < 60 * 200; i++) { stepSky(sky, r, dt); for (const e of sky.events) if (e.t === 'warn' && !sky.falling.find(m => m.id === e.id).shower) pts.push({ t: sky.t, d: Math.hypot(e.x - (r.x + r.vx * SKY.warn * SKY.lead), e.z - (r.z + r.vz * SKY.warn * SKY.lead)) }); sky.events.length = 0; sky.falling.length = 0 }
  const lead = pts.filter(p => p.d < 9).length / pts.length
  const early = pts.filter(p => p.t < 40).length / 40, late = pts.filter(p => p.t > 150).length / 50
  expect(lead > 0.15 && lead < 0.45 && late > early * 1.3, JSON.stringify({ lead, early, late })); return { lead: +lead.toFixed(2), perSecEarly: +early.toFixed(2), perSecLate: +late.toFixed(2) }
})
await t('時計: 8:47 に家を出て 9:00 は 139秒後。駅（電車は止まっている）を通ってから会社。駅より先に会社へ行っても着いたことにならない', () => {
  const run = createRun(world, 1, { rare: 'none' })
  const c0 = clockSec(run); run.t = (DEADLINE - c0) / COM.rate
  const nine = Math.abs(run.t - 139.3) < 1
  const run2 = createRun(world, 2, { rare: 'none' }), r2 = runner(COM.office.x, COM.office.z)
  stepRun(run2, r2, dt, { spawn: false }); const notYet = !run2.arrived
  r2.x = COM.station.x; r2.z = COM.station.z; stepRun(run2, r2, dt, { spawn: false }); const st = run2.leg === 1
  r2.x = COM.office.x; r2.z = COM.office.z; stepRun(run2, r2, dt, { spawn: false })
  expect(c0 === 8 * 3600 + 47 * 60 && nine && notYet && st && run2.arrived, JSON.stringify({ c0, nine, notYet, st, arr: run2.arrived })); return { nineAt: +run.t.toFixed(1) }
})
await t('判定: 早出（3分前より前）・定時・遅刻（5分まで）・大遅刻・欠勤（9:12 で打ち切り）', () => {
  const mk = sec => { const run = createRun(world, 3, { rare: 'none' }); run.arrived = sec; return verdict(run).status }
  const r = { early: mk(DEADLINE - 200), ontime: mk(DEADLINE - 10), late: mk(DEADLINE + 120), verylate: mk(DEADLINE + 400), absent: mk(null) }
  expect(Object.entries(r).every(([k, v]) => k === v), JSON.stringify(r)); return r
})
await t('v3 スーツ: 当たるたびに1段燃える（焦げ → 上着 → シャツ → パンツ一丁）→ 5回目で確保（5.2秒後に終わり・判定は確保）。紳士服の店の輪で1段戻る（店ごとに1回）', () => {
  const run = createRun(world, 5, { rare: 'none' }), r = runner(0, 330), seen = []
  for (let k = 1; k <= 4; k++) { run.sky.stats.hits = k; stepRun(run, r, dt, { spawn: false }); seen.push(run.suit) }
  const T = COM.tailors[0]; r.x = T.x; r.z = T.z; stepRun(run, r, dt, { spawn: false }); const fixed = run.suit
  stepRun(run, r, dt, { spawn: false }); const once = run.suit
  run.sky.stats.hits = 5; stepRun(run, r, dt, { spawn: false }); const s5 = run.suit
  run.sky.stats.hits = 6; stepRun(run, r, dt, { spawn: false })
  const ar = !!run.arrest; let n = 0; while (!run.over && n < 600) { stepRun(run, r, dt, { spawn: false }); n++ }
  const v = verdict(run)
  expect(seen.join() === '1,2,3,4' && fixed === 3 && once === 3 && s5 === 4 && ar && run.over && v.status === 'arrest' && Math.abs(n * dt - (COM.arrestSec - dt)) < 0.1, JSON.stringify({ seen, fixed, once, s5, ar, n, v: v.status }))
  return { stages: seen, tailor: '4→3', arrestAfter: +(n * dt).toFixed(1) }
})
await t('v3 屋根: 一軒家・お社の切妻屋根は、落ちて乗っても・軒から棟へ歩いて登っても、足が見た目の屋根の面（軒の出 0.6m・厚み 0.08m）から 5cm 以内', async () => {
  const { topAt } = await import('./shared/runner.js?v=16')
  const out = []
  for (const o of [world.colliders.find(o => o.gable && o.ridgeX && o.fill), world.colliders.find(o => o.gable && !o.ridgeX && o.fill), world.colliders.find(o => o.look === 'hall')]) {
    const r = runner(o.cx, o.cz); r.y = o.y1 + o.gable + 4; r.grounded = false
    for (let i = 0; i < 200 && !r.grounded; i++) stepRunner(r, {}, dt, world)
    const drop = Math.abs(r.y - topAt(o, r.x, r.z))
    // 軒先から棟へ歩く（棟と直角の向き）
    const along = o.ridgeX ? { x: 0, z: 1 } : { x: 1, z: 0 }, run0 = (o.ridgeX ? o.hl : o.hw) + 0.4
    const q = runner(o.cx - along.x * run0, o.cz - along.z * run0); q.y = topAt(o, q.x, q.z); q.grounded = true
    let worst = 0
    for (let i = 0; i < 90; i++) { stepRunner(q, { throttle: 1, moveDir: along }, dt, world); const tp = topAt(o, q.x, q.z); if (tp != null && q.grounded) worst = Math.max(worst, tp - q.y) }
    out.push({ drop: +(drop * 100).toFixed(1), sinkWalk: +(worst * 100).toFixed(1) })
  }
  expect(out.every(o => o.drop <= 5 && o.sinkWalk <= 5), JSON.stringify(out)); return out
})
await t('同じ種なら同じ展開（着いた時刻・当たった数が同じ）・種が違えば違う', () => {
  const a = play('skilled', 11, { rare: 'none' }), b = play('skilled', 11, { rare: 'none' }), c = play('skilled', 12, { rare: 'none' })
  expect(a.arr === b.arr && a.hits === b.hits && (c.arr !== a.arr || c.hits !== a.hits), JSON.stringify([a.arr, b.arr, c.arr])); return { a: a.arr, c: c.arr }
})
const SIM = {}
await t('bot（10回ずつ）: 何もしないと全部が確保か欠勤（最低）／上手い人は5〜9割が定時で確保は2回まで／下手な人は半分以上が確保／上手い人の方が定時が多い／よけない人は当たる回数が1.3倍以上', () => {
  for (const k of ['skilled', 'clumsy', 'runner', 'blind', 'idle']) { const rs = []; for (let s = 1; s <= 10; s++) rs.push(play(k, s, { rare: 'none' })); SIM[k] = { on: rs.filter(r => r.status === 'early' || r.status === 'ontime').length, absent: rs.filter(r => r.status === 'absent').length, arrest: rs.filter(r => r.status === 'arrest').length, hits: rs.reduce((a, r) => a + r.hits, 0) / 10, near: rs.reduce((a, r) => a + r.near, 0) / 10 } }
  const S = SIM
  expect(S.idle.absent + S.idle.arrest === 10 && S.skilled.on >= 5 && S.skilled.on <= 9 && S.skilled.arrest <= 2 && S.clumsy.arrest >= 5 && S.skilled.on > S.clumsy.on && S.skilled.on > S.runner.on && S.skilled.on > S.blind.on && S.blind.hits >= S.skilled.hits * 1.3, JSON.stringify(S))
  return Object.fromEntries(Object.entries(S).map(([k, v]) => [k, `定時${v.on}/10 欠勤${v.absent} 確保${v.arrest} 当${v.hits.toFixed(1)} ギリ${v.near.toFixed(1)}`]))
})
await t('珍しい出来事: 会社に隕石（約4%）→ 臨時休業「休業」／部長が隕石で出社（約6%）→ 遅れても不問', () => {
  const cnt = { officeHit: 0, bossRide: 0 }
  for (let s = 1; s <= 3000; s++) { const r = createRun(world, s); if (r.rare) cnt[r.rare]++ }
  let a = null; for (let sd = 3; sd < 14 && (!a || a.status === 'arrest'); sd++) a = play('skilled', sd, { rare: 'officeHit' })   // v3: 途中で確保された種は飛ばす
  let b = null; for (let sd = 4; sd < 16 && (!b || b.status === 'arrest'); sd++) b = play('skilled', sd, { rare: 'bossRide' })
  expect(cnt.officeHit > 75 && cnt.officeHit < 180 && cnt.bossRide > 120 && cnt.bossRide < 260 && a.status === 'dayoff' && a.pardon && b.arr != null && b.pardon, JSON.stringify({ cnt, a: a.status, b: [b.status, b.pardon] }))
  return { per3000: cnt, office: a.status, boss: b.pardon }
})
await t('後輩が隕石に乗ってくる（1回）。自分には当たらない所に落ちて、乗ったまま転がり出す', () => {
  const run = createRun(world, 9, { rare: 'none' }), r = runner(0, 700)
  let roll = null, hitMe = false
  for (let i = 0; i < 60 * 48; i++) { stepRun(run, r, dt); for (const e of run.sky.events) { if (e.t === 'roll' && e.rider) roll = e; if (e.t === 'impact' && e.kind === 'rider' && e.d < SKY.r) hitMe = true } run.sky.events.length = 0; run.events.length = 0 }
  expect(roll && !hitMe, JSON.stringify({ roll: !!roll, hitMe })); return true
})
await t('本体は1つにまとめた dist/game.js（index から読む）／元のファイルで同じファイルを違う ?v= で読んでいない（まとめる前の開発中に別物になる）', () => {
  const h = readFileSync(ROOT + '/index.html', 'utf8')
  expect(/<script type="module" src="dist\/game\.js\?v=\d+"/.test(h) && !/src="js\/game\.js/.test(h), 'index')
  const seen = {}, bad = []
  for (const f of execFileSync('/bin/sh', ['-c', 'ls js/*.js shared/*.js'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n')) {
    for (const m of readFileSync(ROOT + '/' + f, 'utf8').matchAll(/from '([^']+\.js)\?v=(\d+)'/g)) { const k = m[1].split('/').pop(); (seen[k] ||= new Set()).add(m[2]) }
  }
    for (const [k, s] of Object.entries(seen)) if (s.size > 1) bad.push(k + ':' + [...s])
  expect(!bad.length, bad.join(' ')); return true
})
await t('AI臭さチェック NG 0', () => {
  let out = ''; try { out = execFileSync(process.execPath, [process.env.HOME + '/Desktop/claudecode/_shared/ai_tells.mjs', ROOT], { encoding: 'utf8' }) } catch (e) { out = (e.stdout || '') + (e.stderr || '') }
  const m = out.match(/NG\s*[:：]?\s*(\d+)/); expect(m && +m[1] === 0, out.slice(-300)); return { warn: (out.match(/WARN\s*[:：]?\s*(\d+)/) || [])[1] }
})
await t('文字だけのフォント: 画面で使う文字が全部フォントの読み込み（text=）に入っている・フォントの読み込みが本体を待たせない（media=print）', async () => {
  const { fontHref } = await import('./tools/fontlink.mjs')
  const h = readFileSync(ROOT + '/index.html', 'utf8'), m = h.match(/<link id="gfonts" href="([^"]+)"[^>]*>/)
  expect(m && m[1].replace(/&amp;/g, '&') === fontHref() && /media="print"/.test(m[0]), 'node tools/fontlink.mjs を回す'); return { chars: decodeURIComponent(fontHref().split('text=')[1]).length }
})
await t('og.png は 1200x630', () => { const b = readFileSync(ROOT + '/og.png'); expect(b.readUInt32BE(16) === 1200 && b.readUInt32BE(20) === 630, 'size'); return true })

// ---------------------------------------------------------------- 画面（Chromium）
const GL = ['--use-angle=metal', '--enable-unsafe-swiftshader']
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error' && !/GL Driver|WebGL|GPU stall/.test(m.text())) p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__meteorReady, null, { timeout: 60000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('.screen:not(.hidden) *, #hud:not(.hidden) *')) {
    if (el.closest('.hidden') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.closest('#miss,#dangers,.news-bar')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('.screen:not(.hidden) button,.screen:not(.hidden) a,.screen:not(.hidden) canvas,#hud:not(.hidden) button,#watch,#goalBox')) {
    if (el.closest('.hidden')) continue
    const r = el.getBoundingClientRect(); if (!r.width) continue
    if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom))
  }
  const rs = [...document.querySelectorAll('#hud:not(.hidden) #watch,#hud:not(.hidden) #goalBox,#hud:not(.hidden) #arrow,#hud:not(.hidden) #btnPause,#hud:not(.hidden) #say:not(.hidden),#touch:not(.hidden) .tbtn,#touch:not(.hidden) .stick')].map(e => [e.id || e.dataset.k || e.className, e.getBoundingClientRect()])
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i][1], b = rs[j][1]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) over.push('overlap ' + rs[i][0] + '×' + rs[j][0]) }
  return { H, over: over.slice(0, 6) }
})
const cb = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, ...GL] })
const p = await open(cb, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ロード画面: 開いた瞬間に隕石の街の絵・文字・進み具合が出て、読み込みが終わると消える', async () => {
  const ctx = await cb.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } }); await muteContext(ctx); const q = await ctx.newPage()
  await q.goto(URL0, { waitUntil: 'commit' }); await q.waitForSelector('#boot .boot-sky', { timeout: 5000 })
  const early = await q.evaluate(() => ({ vis: getComputedStyle(document.getElementById('boot')).display !== 'none', msg: document.querySelector('.boot-msg').textContent, ready: !!window.__meteorReady }))
  await q.waitForFunction(() => window.__meteorReady, null, { timeout: 60000 }); await q.waitForTimeout(600)
  const late = await q.evaluate(() => document.getElementById('boot').classList.contains('hidden'))
  await ctx.close()
  expect(early.vis && early.msg.length <= 14 && !early.ready && late, JSON.stringify({ early, late })); return early.msg
})
await t('起動失敗の保険: 本体のファイルが読めないと、9秒で原因の表示が出る', async () => {
  const ctx = await cb.newContext({ viewport: { width: 390, height: 844 } }); await ctx.route('**/dist/game.js*', r => r.abort()); const q = await ctx.newPage()
  await q.goto(URL0); await q.waitForSelector('#boot-err', { timeout: 12000 }); const txt = await q.textContent('#boot-err'); await ctx.close()
  expect(/起動できませんでした/.test(txt), txt); return true
})
await t('人物（GLB）が届く前に始めても遊べる（手続きの人形で走れて、隕石も落ちる。エラーなし）', async () => {
  const ctx = await cb.newContext({ viewport: { width: 390, height: 844 } }); await muteContext(ctx); await ctx.route('**/assets/chars/**', r => r.abort()); const q = await ctx.newPage(); const errs = []
  q.on('pageerror', e => errs.push(e.message))
  await q.goto(URL0); await q.waitForFunction(() => window.__meteorReady, null, { timeout: 30000 })
  const r = await q.evaluate(() => { const M = meteor; M.start(3); M.dbg.pause(true); M.dbg.autoBot('skilled', 3); M.dbg.step(60 * 20); M.dbg.pause(false); return { moved: Math.hypot(M.me.x - M.COM.home.x, M.me.z - M.COM.home.z), impacts: M.run.sky.stats.impacts } })
  await q.waitForTimeout(500); await ctx.close()
  expect(r.moved > 60 && r.impacts > 3 && !errs.length, JSON.stringify({ r, errs })); return { moved: Math.round(r.moved) }
})
await t('ブラウザの拡大が起きない（ジェスチャー・Ctrl+ホイール・Ctrl+＋）', async () => {
  const r = await p.evaluate(() => {
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return [g.defaultPrevented, w.defaultPrevented, k.defaultPrevented, document.querySelector('meta[name=viewport]').content.includes('user-scalable=no')]
  })
  expect(r.every(Boolean), JSON.stringify(r)); return true
})
await t('OGP 一式がある', async () => {
  const m = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => document.querySelector(`meta[property="${k}"]`)?.content).concat(document.querySelector('meta[name="twitter:card"]')?.content))
  expect(m.every(Boolean) && m[2].includes('meteor-commute/og.png'), JSON.stringify(m)); return true
})
await t('画面に「AI」「画像生成」の文字が無い', async () => {
  const txt = await p.evaluate(() => document.body.innerText)
  expect(!/\bAI\b|画像生成/.test(txt), 'found'); return true
})
await t('タイトルの後ろで CPU が隕石の中を出社している（隕石も落ちている）', async () => {
  const a = await p.evaluate(() => ({ x: meteor.demo.r.x, z: meteor.demo.r.z }))
  await p.waitForTimeout(4500)
  const b = await p.evaluate(() => ({ x: meteor.demo.r.x, z: meteor.demo.r.z, n: meteor.demo.run.sky.stats.impacts + meteor.demo.run.sky.falling.length }))
  expect(Math.hypot(b.x - a.x, b.z - a.z) > 15 && b.n > 0, JSON.stringify({ a, b })); return { moved: Math.round(Math.hypot(b.x - a.x, b.z - a.z)) }
})
await t('出社: 本物の指で「出社する」を押すと始まり、腕時計 8:47・「駅まで」・方角の矢印・部長の電話が出る。実際には無音', async () => {
  await p.tap('#btnStart'); await p.waitForTimeout(500)
  const r = await p.evaluate(() => ({ mode: meteor.mode, time: document.getElementById('wTime').textContent, goal: document.getElementById('gName').textContent, arrow: !document.getElementById('arrow').classList.contains('hidden'), say: document.getElementById('say').textContent, touch: !document.getElementById('touch').classList.contains('hidden'), mute: window.__muteOk(), calls: Snd.played.ring || 0 }))
  expect(r.mode === 'play' && r.time === '8:47' && r.goal === '駅まで' && r.arrow && /部長/.test(r.say) && r.touch && r.mute && r.calls >= 1, JSON.stringify(r)); return r
})
await t('本物の指でビルをタッチするとワイヤーが掛かる（画面の座標をタップ）', async () => {
  await p.evaluate(() => { meteor.dbg.quiet(999); meteor.dbg.teleport(meteor.COM.home.x, 0, meteor.COM.home.z, Math.PI / 2); meteor.cam.hd = Math.PI / 2; meteor.cam.pitch = 0.3 })
  await p.waitForTimeout(400)
  let got = null, tried = 0
  for (const [fx, fy] of [[0.5, 0.25], [0.3, 0.3], [0.7, 0.3], [0.5, 0.4], [0.2, 0.2], [0.8, 0.2]]) {
    tried++
    await p.touchscreen.tap(390 * fx, 844 * fy); await p.waitForTimeout(200)
    got = await p.evaluate(() => ({ rope: !!meteor.me.rope, ev: meteor.log.slice(-3).map(e => e.t) }))
    if (got.rope) break
  }
  expect(got.rope, JSON.stringify(got)); return { tries: tried, ev: got.ev }
})
await t('新しい街の掛け点を本物の指でタッチ: 商店街の縦看板・歩道橋・鉄道橋のトラス・斜張橋の主塔', async () => {
  const out = {}
  for (const [name, at, look, deg, pitch] of [['看板', [0, 0, 360], 'vsign', 0, 0.15], ['歩道橋', [0, 0, 985], 'footbridge', 0, 0.3], ['トラス', [130, 0, 742], 'truss', 20, 0.25], ['主塔', [0, 0, 745], 'pylon', 15, 0.35]]) {
    const q = await p.evaluate(([at, look, deg, pitch]) => {
      const M = meteor; if (M.mode !== 'play') M.start(5); M.dbg.pause(true); M.dbg.quiet(999); M.run.sky.falling.length = 0
      M.dbg.teleport(at[0], at[1], at[2], deg * Math.PI / 180); M.cam.hd = deg * Math.PI / 180; M.cam.pitch = pitch; M.cam.userT = performance.now(); M.dbg.render(30)
      const me = M.me, os = []
      for (const o of M.world.colliders.filter(o => o.look === look)) for (let k = 0; k <= 10; k++) {
        const x = o.hw > o.hl ? o.cx - o.hw + 2 * o.hw * k / 10 : o.cx, z = o.hw > o.hl ? o.cz : o.cz - o.hl + 2 * o.hl * k / 10
        os.push({ o, x, z, y: (o.y0 + o.y1) / 2, d: Math.hypot(x - me.x, z - me.z) })
      }
      os.sort((a, b) => a.d - b.d)
      for (const c of os) { const s = M.dbg.screenOf(c.x, c.y, c.z); if (s.front && s.x > 50 && s.x < innerWidth - 50 && s.y > 150 && s.y < innerHeight - 250) return { ...s, ty: c.y } }
      return null
    }, [at, look, deg, pitch])
    if (!q) { out[name] = '画面外'; continue }
    await p.touchscreen.tap(q.x, q.y); await p.waitForTimeout(60)
    const r = await p.evaluate(() => { meteor.dbg.step(2); const rp = meteor.me.rope; const v = rp ? { y: +rp.y.toFixed(1), x: +rp.x.toFixed(1), z: +rp.z.toFixed(1) } : null; meteor.me.rope = null; return v })
    out[name] = !r ? '掛からない' : Math.abs(r.y - q.ty) < 4 ? r.y : `別の物 ${JSON.stringify(r)} 狙い ${JSON.stringify(q)}`   // 狙った物の高さで掛かったか
  }
  await p.evaluate(() => meteor.dbg.pause(false))
  expect(Object.values(out).every(v => typeof v === 'number'), JSON.stringify(out)); return out
})
await t('大きいワイヤーボタンを本物の指で押すと前の上へ自動で掛かる（もう一度で外れる）', async () => {
  await p.evaluate(() => meteor.dbg.teleport(meteor.COM.home.x, 0, meteor.COM.home.z, Math.PI / 2)); await p.waitForTimeout(300)
  const bb = await p.locator('.tbtn[data-k=wire]').boundingBox()
  await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(150)
  const on = await p.evaluate(() => !!meteor.me.rope)
  await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(150)
  const off = await p.evaluate(() => !meteor.me.rope)
  expect(on && off, JSON.stringify({ on, off })); return true
})
await t('左下のスティックを本物の指で倒すと走る', async () => {
  await p.evaluate(() => meteor.dbg.teleport(meteor.COM.home.x, 0, meteor.COM.home.z, Math.PI / 2)); await p.waitForTimeout(200)
  const c = await p.evaluate(() => window.__stickCenter())
  const x0 = await p.evaluate(() => ({ x: meteor.me.x, z: meteor.me.z }))
  const cdp = await p.context().newCDPSession(p)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1 }] })
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x, y: c.y - i * 8, id: 1 }] }); await p.waitForTimeout(30) }
  await p.waitForTimeout(700)
  const x1 = await p.evaluate(() => ({ x: meteor.me.x, z: meteor.me.z }))
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const d = Math.hypot(x1.x - x0.x, x1.z - x0.z); expect(d > 3, JSON.stringify({ x0, x1 })); return { moved: +d.toFixed(1) }
})
await t('真上に隕石: 赤い輪（半径8m）と影が出て、影はだんだん濃く大きくなる → 吹き飛ばされて画面のふちが赤く光る', async () => {
  const r = await p.evaluate(() => {
    const M = meteor; M.dbg.pause(true); M.dbg.teleport(M.COM.home.x, 0, M.COM.home.z, Math.PI / 2); M.dbg.quiet(999)
    const m = M.dbg.drop(0, 0); M.dbg.step(30)
    const mk = M.view.markOf(m.id), s1 = mk && mk.sh.scale.x, o1 = mk && mk.sh.material.opacity
    M.dbg.step(80); const s2 = mk && mk.sh.scale.x, o2 = mk && mk.sh.material.opacity
    const ring = mk && mk.ring.scale.x
    M.dbg.step(60); const hits = M.run.sky.stats.hits
    const red = M.redA
    M.dbg.pause(false)
    return { mk: !!mk, s1, s2, o1, o2, ring, hits, red }
  })
  expect(r.mk && r.s2 > r.s1 * 1.8 && r.o2 > r.o1 && Math.abs(r.ring - 8) < 0.01 && r.hits === 1 && r.red > 0.3, JSON.stringify(r)); return r
})
await t('ギリギリ回避（v3 で軽く）: 輪のすぐ外で落ちると、ほんの一瞬（0.16秒以下）だけ 0.7倍・止めない・光・「ギリギリ！」・「2連続」が出る', async () => {
  await p.waitForTimeout(2800)
  const r = await p.evaluate(() => {
    const M = meteor; M.dbg.pause(true); M.dbg.teleport(M.COM.home.x, 0, M.COM.home.z, Math.PI / 2)
    const a = M.dbg.drop(M.SKY.r + 2.5, 0); a.warn = a.tLeft = 0.05; M.dbg.step(4)
    M.dbg.teleport(M.COM.home.x, 0, M.COM.home.z, Math.PI / 2)
    const b = M.dbg.drop(-(M.SKY.r + 2.5), 0); b.warn = b.tLeft = 0.05; M.dbg.step(4)
    const near = !document.getElementById('near').classList.contains('hidden'), txt = document.getElementById('nearTxt').textContent, n = document.getElementById('nearN').textContent
    return { near, txt, n, slow: M.slowT, stop: M.hitStop, flash: M.flashA, stats: M.run.sky.stats.near }
  })
  await p.evaluate(() => meteor.dbg.pause(false))
  expect(r.near && r.txt === 'ギリギリ！' && r.n === '2連続' && r.slow <= 0.16 && !(r.stop > 0) && r.flash > 0.4 && r.stats === 2, JSON.stringify(r)); return r
})
await t('後ろに落ちてくる隕石は、画面のふちの赤い印で知らせる', async () => {
  const r = await p.evaluate(() => {
    const M = meteor; M.dbg.pause(true); M.dbg.teleport(M.COM.home.x, 0, M.COM.home.z, Math.PI / 2); M.cam.hd = Math.PI / 2
    M.run.sky.falling.length = 0; M.dbg.render(3)
    const m = M.dbg.drop(-25, 0); m.t = 0.8; m.tLeft = 1.7; M.dbg.render(2)
    const els = [...document.querySelectorAll('.danger')].filter(e => !e.classList.contains('hidden')).map(e => e.getBoundingClientRect())
    M.run.sky.falling.length = 0; M.dbg.render(1); M.dbg.pause(false)
    return els.map(b => ({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }))
  })
  expect(r.length >= 1 && r.every(q => q.x < 60 || q.x > 330 || q.y < 60 || q.y > 784), JSON.stringify(r)); return r
})
await t('燃えているビルを本物の指でタッチすると「燃えてて掛からん」で掛からない', async () => {
  const r = await p.evaluate(() => {
    const M = meteor; M.dbg.pause(true)
    const open = (x, z) => !M.world.nearby(x, z).some(o => o.y1 != null && !o.slab && Math.abs(x - o.cx) < o.hw + 1 && Math.abs(z - o.cz) < o.hl + 1)
    const b = M.world.colliders.find(o => o.kind === 'building' && !o.small && !o.look && o.y1 > 30 && o.hl > 6 && open(o.cx - o.hw - 18, o.cz) && open(o.cx - o.hw - 9, o.cz) && M.world.groundAt(o.cx - o.hw - 18, o.cz, 2).h > -1)
    M.dbg.teleport(b.cx - b.hw - 18, 0, b.cz, Math.PI / 2); M.cam.hd = Math.PI / 2; M.cam.pitch = 0.3
    b.burning = 20; M.run.sky.fires.push(b); M.dbg.render(6)
    return M.dbg.screenOf(b.cx - b.hw, 12, b.cz)
  })
  await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(80)
  const q = await p.evaluate(() => { meteor.dbg.step(2); const lg = meteor.log.slice(-3); const t = document.getElementById('missTxt').textContent, v = !document.getElementById('miss').classList.contains('hidden'); for (const o of meteor.world.colliders) if (o.burning) o.burning = 0; meteor.run.sky.fires.length = 0; meteor.dbg.pause(false); return { t, v, rope: !!meteor.me.rope, lg } })
  expect(q.v && q.t === '燃えてて掛からん' && !q.rope, JSON.stringify({ r, q })); return q
})
await t('通しの遊び（CPU に操作させて家 → 駅 → 会社）: 駅で部長の電話・会社で受付の一言 → 出勤記録か遅刻届（保存・Xのリンク・ボタンの文字・支援リンク）', async () => {
  const r = await p.evaluate(() => {
    const M = meteor; M.start(21, { rare: 'none' }); M.dbg.pause(true); M.dbg.autoBot('skilled', 21)
    let n = 0; while (!M.run.over && n < 60 * 300) { M.dbg.step(20); n += 20 }
    M.dbg.autoBot(null); M.dbg.pause(false)
    const ev = M.log.filter(e => e.src === 'c').map(e => e.t)
    return { ev: [...new Set(ev)], mode: M.mode, v: window.__lastVerdict }
  })
  await p.waitForTimeout(600)
  const ui = await p.evaluate(() => ({ again: document.getElementById('btnAgain').textContent, save: document.getElementById('btnSave').textContent, post: document.getElementById('btnPost').href, support: (document.getElementById('tmSupport') || {}).textContent, slip: document.getElementById('slip').width }))
  await p.screenshot({ path: ROOT + '/shots/v_result.png' })
  expect(r.mode === 'result' && r.ev.includes('station') && r.ev.includes('arrive') && r.v && ['早出', '受理', '却下'].includes(r.v.stamp) && ui.again && ui.save && /intent\/tweet/.test(ui.post) && ui.support === '作者に缶コーヒーをおごる' && ui.slip === 1080, JSON.stringify({ r, ui })); return { status: r.v.status, stamp: r.v.stamp, near: r.v.near, hits: r.v.hits }
})
await t('何もしない出社は最低の判定（隕石でスーツが燃え尽きてパンツ一丁 → 警察に確保・「警察署からのお知らせ」「保護」）', async () => {
  const r = await p.evaluate(() => {
    const M = meteor; M.start(22, { rare: 'none' }); M.dbg.pause(true)
    let n = 0; while (!M.run.over && n < 60 * 300) { M.dbg.step(30); n += 30 }
    M.dbg.pause(false); return { v: window.__lastVerdict, t: M.run.t }
  })
  expect(r.v.status === 'arrest' && r.v.stamp === '保護' && r.v.title === '警察署からのお知らせ' && r.v.hits >= 5, JSON.stringify(r)); return { t: Math.round(r.t), hits: r.v.hits }
})
await t('珍しい出来事の画面: 会社に隕石 → 臨時休業のお知らせ（休業）', async () => {
  const r = await p.evaluate(() => {
    const M = meteor; M.start(23, { rare: 'officeHit' }); M.dbg.pause(true)
    M.run.leg = 1; M.run.sky.goal = M.COM.office; M.dbg.teleport(M.COM.office.x, 0, M.COM.office.z - 120)
    let n = 0; while (!M.run.over && n < 60 * 20) { M.dbg.step(10); n += 10 }
    M.dbg.pause(false); return window.__lastVerdict
  })
  expect(r && r.status === 'dayoff' && r.stamp === '休業', JSON.stringify(r)); return r.title
})
await t('英語に切り替わる（タイトル・遊び方・行き先）', async () => {
  const r = await p.evaluate(() => new Promise(ok => { meteor.toTitle(); meteor.setLang('en'); const a = document.getElementById('btnStart').textContent, h = document.getElementById('howList').textContent; meteor.start(3); setTimeout(() => { const g = document.getElementById('gName').textContent; meteor.toTitle(); meteor.setLang('ja'); ok({ a, h, g }) }, 300) }))
  expect(r.a === 'Go to work' && /red rings/.test(r.h) && r.g === 'Station', JSON.stringify(r)); return true
})
await t('同時に出る文字は2つまで（電話の一言・ギリギリの表示・×）', async () => {
  const n = await p.evaluate(() => { meteor.start(4); return [...document.querySelectorAll('#say,#near,#miss')].filter(e => !e.classList.contains('hidden')).length })
  expect(n <= 2, String(n)); return n
})
await t('音: 鳴らした回数は数えられ、実際には無音（Chromium）', async () => {
  const r = await p.evaluate(() => ({ played: Object.keys(Snd.played).length, mute: window.__muteOk() }))
  expect(r.played > 3 && r.mute, JSON.stringify(r)); return r
})
for (const [W, H] of [[360, 640], [390, 844], [430, 932]]) {
  const q = await open(cb, { viewport: { width: W, height: H }, hasTouch: true, isMobile: true })
  const shots = {}
  for (const name of ['title', 'how', 'play', 'pause', 'result']) {
    await q.evaluate(n => {
      const M = meteor
      if (n === 'title') M.toTitle()
      if (n === 'how') document.getElementById('btnHow').click()
      if (n === 'play') { M.start(7); M.dbg.say('<small>部長から着信</small>あと2分や。どこにおる', 3) }
      if (n === 'pause') document.getElementById('btnPause').click()
      if (n === 'result') { document.getElementById('btnResume').click(); M.run.arrived = 9 * 3600 + 130; M.showResult() }
    }, name)
    await q.waitForTimeout(name === 'play' ? 900 : 350)
    const f = await fit(q), o = await overflow(q)
    shots[name] = { f, o }
    await q.screenshot({ path: `${ROOT}/shots/fit_${W}x${H}_${name}.png` })
  }
  await t(`${W}x${H}: 全画面が一画面に収まり（スクロールなし・ボタンが画面内）・HUD が重ならず・横にはみ出さない・エラーなし`, async () => {
    const bad = Object.entries(shots).filter(([, v]) => v.f.over.length || v.o.bad.length || v.o.sw > v.o.W).map(([k, v]) => k + JSON.stringify([v.f.over, v.o.bad]))
    expect(!bad.length && !q.errs.length, bad.join(' ') + q.errs.join('|')); return true
  })
  await q.context().close()
}
await t('エラーが出ていない（通しのあと）', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await cb.close()

// ---------------------------------------------------------------- WebKit（iPhone の Safari 相当）
const wb = await webkit.launch()
const wp = await open(wb, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, 'not prevented'); return true
})
await t('WebKit: タップで出社してスマホ操作が出る・ワイヤーボタンで掛かる・隕石が落ちて爆発する・実際には無音', async () => {
  await wp.tap('#btnStart'); await wp.waitForTimeout(600)
  const bb = await wp.locator('.tbtn[data-k=wire]').boundingBox()
  await wp.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await wp.waitForTimeout(150)
  const rope = await wp.evaluate(() => !!meteor.me.rope)
  const r = await wp.evaluate(() => { const M = meteor; const m = M.dbg.drop(30, 0); m.warn = m.tLeft = 0.1; return new Promise(ok => setTimeout(() => ok({ impacts: M.run.sky.stats.impacts, touch: !document.getElementById('touch').classList.contains('hidden'), mute: window.__muteOk(), ctx: Snd.ctx && Snd.ctx.state }), 600)) })
  expect(rope && r.impacts >= 1 && r.touch && r.mute && r.ctx !== 'running', JSON.stringify({ rope, r })); return r
})
await t('WebKit: 結果の紙が描ける・エラーなし', async () => {
  await wp.evaluate(() => { meteor.run.arrived = 9 * 3600 + 200; meteor.showResult() }); await wp.waitForTimeout(500)
  await wp.screenshot({ path: ROOT + '/shots/webkit_result.png' })
  const w = await wp.evaluate(() => document.getElementById('slip').width)
  expect(w === 1080 && wp.errs.length === 0, wp.errs.join('|')); return true
})
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
