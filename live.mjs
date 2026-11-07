import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
mkdirSync('shots', { recursive: true })
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const SLUG = 'meteor-commute', URL0 = `https://tom3games.github.io/${SLUG}/`
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? { ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal'] } : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__meteorReady, null, { timeout: 20000 })
  // 遊びの通し: 出社 → 隕石をギリギリでよける → CPU に会社まで運ばせる → 結果
  if (opts.hasTouch) await p.tap('#btnStart'); else await p.click('#btnStart')
  await p.waitForTimeout(800)
  const flow = await p.evaluate(() => {
    const M = meteor; M.dbg.pause(true); M.dbg.quiet(3); M.dbg.drop(M.SKY.r + 3, 0); M.dbg.step(60 * 3)
    const near = M.run.sky.stats.near
    M.dbg.autoBot('skilled', 3); let n = 0; while (!M.run.over && n < 60 * 300) { M.dbg.step(30); n += 30 }
    M.dbg.pause(false); return { near, over: M.run.over, leg: M.run.leg }
  })
  await p.waitForTimeout(1500)
  const res = await p.evaluate(() => ({ mode: meteor.mode, v: window.__lastVerdict && window.__lastVerdict.status, mute: window.__muteOk() }))
  out.push(`${name}: flow=${JSON.stringify(flow)} result=${JSON.stringify(res)}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of [`https://github.com/tom3games/${SLUG}`, `https://github.com/tom3games/${SLUG}/commits/main`]) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
