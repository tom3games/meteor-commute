// 結果の紙（遅刻届・出勤記録・臨時休業のお知らせ）を 1080x1350 の canvas に描く。保存して SNS に貼れる
const W = 1080, H = 1350
const INK = '#1b2233', RED = '#c8321e', PAPER = '#f7f4ec', LINE = '#c9c1ad'
const F = { title: '"M PLUS 1p", "BIZ UDPGothic", sans-serif', hand: '600 1px "Klee One", "Hiragino Maru Gothic ProN", sans-serif', sans: '"BIZ UDPGothic", "Hiragino Sans", sans-serif' }
const font = (px, fam, w = '') => `${w || (fam === F.title ? '900' : '')} ${px}px ${fam}`.trim()
const hand = px => `600 ${px}px "Klee One", "Hiragino Maru Gothic ProN", sans-serif`

function fitText(x, s, maxW, px, fam, w = '') { let p = px; x.font = font(p, fam, w); while (x.measureText(s).width > maxW && p > 12) { p -= 2; x.font = font(p, fam, w) } return p }

export function drawCard(cv, d) {
  cv.width = W; cv.height = H
  const x = cv.getContext('2d')
  // 机（紺）と紙
  x.fillStyle = '#1b2233'; x.fillRect(0, 0, W, H)
  x.save(); x.translate(W / 2, H / 2); x.rotate(-0.012); x.translate(-W / 2, -H / 2)
  x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 30; x.shadowOffsetY = 10
  x.fillStyle = PAPER; x.fillRect(54, 46, W - 108, H - 92)
  x.shadowColor = 'transparent'
  const L = 96, R = W - 96
  // 上: 書類の題
  x.fillStyle = d.titleColor || INK; x.textAlign = 'center'; x.textBaseline = 'alphabetic'
  fitText(x, d.title, R - L, 84, F.title)
  x.fillText(d.title, W / 2, 150)
  x.strokeStyle = INK; x.lineWidth = 3; x.beginPath(); x.moveTo(L, 176); x.lineTo(R, 176); x.stroke()
  // 日付・氏名・所属
  x.textAlign = 'left'; x.font = font(26, F.sans); x.fillStyle = '#5a5649'
  const row = (y, label, val, vx = L + 120) => { x.font = font(26, F.sans); x.fillStyle = '#5a5649'; x.fillText(label, L, y); x.font = hand(34); x.fillStyle = INK; x.fillText(val, vx, y); x.strokeStyle = LINE; x.lineWidth = 2; x.beginPath(); x.moveTo(vx - 6, y + 10); x.lineTo(R, y + 10); x.stroke() }
  row(226, d.lab.date, d.date)
  row(276, d.lab.name, d.name)
  // 写真（その日の一番すごい瞬間）
  const py = 306, ph = 330
  x.fillStyle = '#222'; x.fillRect(L, py, R - L, ph)
  if (d.photo) {
    const iw = d.photo.width, ih = d.photo.height, k = Math.max((R - L) / iw, ph / ih)
    const sw = (R - L) / k, sh = ph / k
    x.drawImage(d.photo, (iw - sw) / 2, (ih - sh) / 2, sw, sh, L, py, R - L, ph)
  }
  // ニュースの字幕の帯
  x.fillStyle = 'rgba(200,50,30,.94)'; x.fillRect(L, py + ph - 58, 150, 58)
  x.fillStyle = 'rgba(255,255,255,.94)'; x.fillRect(L + 150, py + ph - 58, R - L - 150, 58)
  x.fillStyle = '#fff'; x.font = font(30, F.sans, '700'); x.textAlign = 'center'; x.fillText(d.lab.live, L + 75, py + ph - 18)
  x.fillStyle = INK; x.textAlign = 'left'; fitText(x, d.caption, R - L - 182, 30, F.sans, '700'); x.fillText(d.caption, L + 166, py + ph - 18)
  // 出社時刻（大きく手書き）
  let y = py + ph + 76
  x.font = font(28, F.sans); x.fillStyle = '#5a5649'; x.fillText(d.lab.arrive, L, y)
  x.font = hand(92); x.fillStyle = d.late ? RED : INK; x.fillText(d.arrive, L + 190, y + 16)
  const aw = x.measureText(d.arrive).width
  if (d.sub) { x.font = hand(34); x.fillStyle = d.late ? RED : '#5a5649'; x.fillText(d.sub, L + 210 + aw, y + 4) }
  // 理由（チェック欄）
  y += 74
  x.font = font(28, F.sans); x.fillStyle = '#5a5649'; x.fillText(d.lab.reason, L, y)
  const items = d.reasons.slice(0, 3)
  if (!items.length) items.push({ text: d.lab.noReason, n: 0, plain: true })
  for (let i = 0; i < items.length; i++) {
    const yy = y + 4 + i * 48, it = items[i]
    // 手書きの言い訳（チェック欄にしない）。書き直した跡のように行ごとに少しずれる
    const s = (i ? '' : '') + it.text + (it.n > 1 ? `（${it.n}回）` : '')
    x.save(); x.translate(L + 190 + (i % 2) * 6, yy); x.rotate((i % 2 ? 0.012 : -0.008))
    x.fillStyle = INK; fitText(x, s, R - L - 200, 32, '"Klee One", sans-serif', '600'); x.fillText(s, 0, 0)
    x.restore()
  }
  // 回避の記録（小さく3つ）
  y += 4 + Math.max(1, items.length) * 48 + 24
  x.strokeStyle = LINE; x.lineWidth = 2; x.beginPath(); x.moveTo(L, y - 30); x.lineTo(R, y - 30); x.stroke()
  const st = d.stats, cw = (R - L) / 3
  for (let i = 0; i < 3; i++) {
    const cx = L + cw * i + cw / 2
    x.textAlign = 'center'; x.font = font(22, F.sans); x.fillStyle = '#5a5649'; x.fillText(st[i][0], cx, y)
    x.font = font(52, F.title); const nw = x.measureText(st[i][1]).width; x.font = font(24, F.sans, '700'); const uw = st[i][3] ? x.measureText(st[i][3]).width + 6 : 0
    x.textAlign = 'left'; x.font = font(52, F.title); x.fillStyle = i === 2 && st[i][2] ? RED : INK; x.fillText(st[i][1], cx - (nw + uw) / 2, y + 58)
    if (uw) { x.font = font(24, F.sans, '700'); x.fillText(st[i][3], cx - (nw + uw) / 2 + nw + 6, y + 56) }
  }
  x.textAlign = 'left'
  // 部長の欄: ひとこと（手書き）と判子
  y += 110
  const boxH = 170
  x.fillStyle = '#efe9da'; x.fillRect(L, y, R - L, boxH)
  x.font = font(24, F.sans); x.fillStyle = '#5a5649'; x.fillText(d.lab.boss, L + 20, y + 40)
  x.font = hand(36); x.fillStyle = INK
  const lines = wrap(x, '「' + d.comment + '」', R - L - 230)
  lines.slice(0, 2).forEach((s, i) => x.fillText(s, L + 20, y + 88 + i * 46))
  // 判子（赤い丸）
  const sx = R - 112, sy = y + boxH / 2
  x.save(); x.translate(sx, sy); x.rotate(-0.22)
  x.strokeStyle = d.stampColor || RED; x.fillStyle = d.stampColor || RED; x.globalAlpha = 0.88
  x.lineWidth = 8; x.beginPath(); x.arc(0, 0, 78, 0, Math.PI * 2); x.stroke()
  x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 66, 0, Math.PI * 2); x.stroke()
  x.textAlign = 'center'; x.textBaseline = 'middle'
  const sp = d.stamp.length > 2 ? 38 : 54
  x.font = font(sp, F.title); x.fillText(d.stamp, 0, 4)
  // 押した跡: 朱肉のかすれ（紙の色で小さな欠けを散らす）
  x.globalAlpha = 1; x.fillStyle = PAPER
  let q = d.stamp.length * 7919 + 13; const rnd = () => (q = (q * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, r = 30 + rnd() * 56; x.globalAlpha = 0.5 + rnd() * 0.5; x.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2 + rnd() * 5, 1.5 + rnd() * 3) }
  x.restore()
  // 下の URL
  x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = font(22, F.sans); x.fillStyle = '#8a8474'; x.fillText(d.footer, W / 2, Math.min(H - 64, y + boxH + 40))
  x.restore()
}

function wrap(x, s, maxW) {
  const out = []; let cur = ''
  for (const ch of s) { if (x.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch } else cur += ch }
  if (cur) out.push(cur)
  return out
}
