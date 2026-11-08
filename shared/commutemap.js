// 隕石の日でも出社する v2 の街（2026-11-09 本人「それように新しくマップ作って欲しい。いい感じのマップにしてくれ」）
// 朝の通勤路を南から北へ1本の物語にする: 住宅街の家 → 商店街（アーケード）→ 駅前広場と高架の駅 → 川（道路橋・鉄道橋・歩道橋）→ オフィス街 → 会社のタワー
// 座標は track.js と同じ（x=東西, z=北が +）。three.js に依存しない。見た目は js/scene.js が look ごとに描く
// 寸法は実物に寄せる: 住宅街の道 6.5m・2車線 7m・4車線 14m・6車線 21m（1車線 3.5m）。人は 1.8m
//
// 掛け点の種類（どれもワイヤーが掛かる箱 = kind 'building' か、点 = mapPoles）
//   電柱（住宅街の両側に 20m おき）・街灯・アーケードの縦看板・入口の門・広場の時計塔・駅のホームの屋根・止まった電車・
//   高架の線路（橋桁）・鉄道橋のトラス・道路橋の主塔・川沿いの広告塔・歩道橋・工事現場のクレーン・ビル
// 近道: 高架の線路を走って川を渡る／クレーンの腕で大きく振る／川の歩道橋／アーケードの屋根の上

export const MAP = {
  bounds: { x0: -180, x1: 200, z0: -50, z1: 1250 },
  river: { z0: 760, z1: 830, floor: -8, y: -2.2 },
  home: { x: 0, z: 14, yaw: 0 },        // 家（メゾン朝日）の前の道。北を向いて出る
  shop: { x: -14, y: 0, z: 14, r: 7 },   // town.js の「店」の箱 = マンションの玄関（shop.x + 6 に置かれる）
  station: { x: 121, z: 640 },           // 明星台駅の改札（駅舎の西の面、広場の側）
  office: { x: 0, z: 1145 },             // ドンマイ商事のタワーの入口（南の面、大通りの突き当たり）
  officeBld: { x: 0, z: 1174 },
  bossSpot: { x: 14, z: 1134 }           // 部長が隕石に乗って降りてくる所（タワー前の広場）
}
const R = MAP.river
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export function commuteTerrain(x, z) {
  const m = sst(R.z0 - 2, R.z0, z) * (1 - sst(R.z1, R.z1 + 2, z))
  return m > 0 ? R.floor * m : 0
}

// 車線: 片側の車線の中心（道の中心から）。1車線 3.5m
const lanesFor = w => w >= 21 ? [1.75, 5.25, 8.75] : w >= 14 ? [1.75, 5.25] : w >= 7 ? [1.75] : null

export function buildCommute() {
  const B = MAP.bounds
  const roads = [], slabs = [], boxes = [], props = [], trees = [], grassRects = [], dirtRects = [], mapPoles = [], deco = [], walks = []
  const town = { houses: [], apts: [], vends: [], posts: [] }
  let seed = 41
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const road = (pts, w, traffic = true) => roads.push({ pts, w, surf: 'road', lanes: traffic ? lanesFor(w) : null })
  const box = (x0, z0, x1, z1, h, kind = 'building', extra = {}) => {
    const y0 = extra.y0 || 0
    boxes.push({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, yaw: 0, hw: Math.abs(x1 - x0) / 2, hl: Math.abs(z1 - z0) / 2, y0, h, kind, ...extra })
  }
  const tree = (x, z, s = 0.6) => { trees.push({ x, y: 0, z, s, r: x * 0.37 + z }); props.push({ type: 'tree', x, z, yaw: 0, y: -0.5, ti: trees.length - 1 }) }
  const pole = (x, z, kind = 'pole', nx = 0, nz = 0, y0 = 0, h = null) => mapPoles.push({ x, z, y0, y1: y0 + (h ?? (kind === 'pole' ? 10.5 : 8)), kind, nx, nz })
  // 区画を2〜3棟のビルで埋める（間に 5m の路地）
  const fill = (x0, z0, x1, z1, hmin, hmax, opt = {}) => {
    const W = x1 - x0, D = z1 - z0
    if (W < 8 || D < 8) return
    const n = opt.n || (Math.max(W, D) > 70 ? 3 : Math.max(W, D) > 36 ? 2 : 1)
    const alongX = W >= D
    const L = alongX ? W : D, g = 5, seg = (L - g * (n - 1)) / n
    for (let i = 0; i < n; i++) {
      const a = (alongX ? x0 : z0) + i * (seg + g), b = a + seg
      const h = hmin + rnd() * (hmax - hmin)
      if (alongX) box(a, z0, b, z1, h, 'building', opt.extra); else box(x0, a, x1, b, h, 'building', opt.extra)
    }
  }
  // 家の列（通りに玄関を向ける）。side: 家が道のどちら側か。face は道の向き
  const houseRowZ = (x, z0, z1, fx, skip = []) => {   // 南北の道沿い（x は家の中心）
    for (let z = z0; z <= z1; z += 12) { if (skip.some(([a, b]) => z > a && z < b)) continue; town.houses.push({ x, z, fx, fz: 0 }) }
  }
  const houseRowX = (z, x0, x1, fz, skip = []) => {
    for (let x = x0; x <= x1; x += 12) { if (skip.some(([a, b]) => x > a && x < b)) continue; town.houses.push({ x, z, fx: 0, fz }) }
  }
  const polesZ = (x, z0, z1, gap, nx, skip = []) => { for (let z = z0; z <= z1; z += gap) if (!skip.some(([a, b]) => z > a && z < b)) pole(x, z, 'pole', nx, 0) }
  const polesX = (z, x0, x1, gap, nz, skip = []) => { for (let x = x0; x <= x1; x += gap) if (!skip.some(([a, b]) => x > a && x < b)) pole(x, z, 'pole', 0, nz) }
  const lampsZ = (x, z0, z1, gap, nx, skip = []) => { for (let z = z0; z <= z1; z += gap) if (!skip.some(([a, b]) => z > a && z < b)) pole(x, z, 'lamp', nx, 0) }
  const lampsX = (z, x0, x1, gap, nz, skip = []) => { for (let x = x0; x <= x1; x += gap) if (!skip.some(([a, b]) => x > a && x < b)) pole(x, z, 'lamp', 0, nz) }

  // ================================================================ 道
  // 住宅街（z -50〜300）
  road([[0, B.z0 - 15], [0, 300]], 6.5, false)            // 家の前の道（北へまっすぐ商店街へ）
  road([[-110, B.z0 - 15], [-110, 700]], 6.5, false)      // 西の裏道（駅前広場の西まで）
  road([[B.x0 - 15, 120], [B.x1 + 15, 120]], 6.5, false)  // 住宅街を東西に
  road([[B.x0 - 15, 300], [B.x1 + 15, 300]], 7)           // 商店街の入口の通り（2車線）
  road([[90, B.z0 - 15], [90, 548]], 14)                  // 駅前通り（4車線。背の高いビルが並ぶ、振りやすい道）
  // 商店街（z 300〜548）: アーケードは歩行者だけ
  road([[0, 300], [0, 548]], 9, false); roads[roads.length - 1].tile = true   // 石畳（白線なし）
  road([[-110, 420], [90, 420]], 6.5, false)              // 商店街を横切る路地
  // 駅前（z 548〜700）
  road([[-60, 556], [128, 556]], 7, false)                // バスとタクシーの乗り場
  road([[B.x0 - 15, 700], [B.x1 + 15, 700]], 14)          // 川の手前の通り
  // 川を渡る道路橋と対岸（オフィス街）
  road([[0, 700], [0, 845]], 14, false)
  road([[B.x0 - 15, 845], [B.x1 + 15, 845]], 14)          // 川沿いの通り（北岸）
  road([[0, 845], [0, 1142]], 21)                         // 本町大通り（6車線。突き当たりが会社のタワー）
  road([[B.x0 - 15, 950], [B.x1 + 15, 950]], 14)
  road([[B.x0 - 15, 1050], [B.x1 + 15, 1050]], 14)
  road([[-100, 845], [-100, B.z1 + 15]], 14)
  road([[100, 845], [100, B.z1 + 15]], 14)

  // ================================================================ 住宅街
  // 家（メゾン朝日）: town.js の店の箱が玄関、後ろに4階建てのアパート
  town.apts.push({ x: -19, z: 14, fz: -1 })
  // 家の前の道（x=0）の両側に一軒家。電柱は両側に 20m おき（電線でつながる）
  houseRowZ(-8.5, 34, 292, 1, [[110, 131]])
  houseRowZ(-8.5, -40, 0, 1)
  houseRowZ(8.5, -40, 292, -1, [[110, 131]])
  // 裏の家（道から1軒奥。開始地点から見て家と家の隙間に見える）
  houseRowZ(-20.5, -34, 292, 1, [[98, 142], [4, 25]])
  houseRowZ(20.5, -34, 292, -1, [[98, 142], [55, 97], [155, 189], [195, 292]])
  // 町の入口のアーチ（家の 42m 先で道をまたぐ。まっすぐ前をタップしても掛かる）
  box(-4.6, 55.4, 4.6, 56.6, 1.4, 'building', { y0: 6.4, small: true, look: 'gate', town: true })
  polesZ(-3.9, -42, 296, 20, 1, [[112, 128]])
  polesZ(3.9, -32, 296, 20, -1, [[112, 128]])
  // 西の裏道（x=-110）
  houseRowZ(-101.5, -40, 292, -1, [[110, 131]])
  houseRowZ(-118.5, -40, 292, 1, [[110, 131]])
  polesZ(-106.1, -40, 296, 20, -1, [[112, 128]])
  polesZ(-113.9, -30, 296, 20, 1, [[112, 128]])
  // 東西の道（z=120）
  houseRowX(128.5, -92, -16, -1); houseRowX(111.5, -92, -16, 1)
  houseRowX(128.5, 18, 54, -1); houseRowX(111.5, 18, 54, 1)
  polesX(123.9, -170, 190, 20, -1, [[-8, 8], [-118, -102], [80, 100], [140, 160]])
  polesX(116.1, -160, 190, 20, 1, [[-8, 8], [-118, -102], [80, 100], [140, 160]])
  // 区画の中: アパートとマンション（振れる高さ）
  for (const [x, z] of [[-40, 40], [-70, 70], [-40, 180], [-75, 230], [-45, 265], [40, 30], [-150, 60], [-150, 200]]) town.apts.push({ x, z, fz: z % 20 ? 1 : -1 })
  box(-80, 20, -60, 48, 16); box(-82, 150, -58, 174, 18); box(-90, 255, -66, 285, 14)
  box(18, 160, 38, 184, 15); box(22, 60, 46, 92, 17)
  // 小さな公園（住宅街の東）
  grassRects.push({ x0: 28, z0: 200, x1: 58, z1: 286 })
  for (const [x, z] of [[32, 210], [48, 214], [54, 232], [36, 248], [52, 256], [50, 278], [30, 276]]) tree(x, z, 0.62)
  pole(42, 230, 'lamp', 0, 1); pole(28, 262, 'lamp', 1, 0)
  // 駅前通り（x=90）の両側: 中くらいのビル（屋上に広告）
  for (const [z0, z1] of [[-44, 112], [128, 292]]) { fill(62, z0, 79, z1, 16, 28); fill(101, z0, 140, z1, 18, 34) }
  lampsZ(81.5, -30, 290, 26, 1, [[110, 130]]); lampsZ(98.5, -20, 290, 26, -1, [[110, 130]])
  // 自動販売機（低い掛け点）
  for (const [x, z, fx, fz] of [[-4.2, 26, 1, 0], [4.2, 75, -1, 0], [-4.2, 150, 1, 0], [4.2, 235, -1, 0], [-105.8, 90, -1, 0]]) town.vends.push({ x, z, fx, fz, c: town.vends.length % 3 })
  // 高架の東（x 157〜）: 倉庫と小さな工場
  for (const [z0, z1] of [[-44, 112], [128, 292], [306, 414], [426, 546]]) fill(160, z0, 196, z1, 8, 14)

  // ================================================================ 商店街（アーケード）z 300〜548
  // 両側に3階建ての店（間口 10m）。道に縦看板が突き出していて、低い掛け点になる。屋根は見た目だけ（ガラスと鉄骨のアーチ）
  const ARC = { hw: 4.5, z0: 306, z1: 548 }
  for (const s of [-1, 1]) {
    for (let z = ARC.z0; z < ARC.z1 - 2; z += 10.5) {
      if (z > 405 && z < 428) continue
      const z1 = Math.min(ARC.z1, z + 10)
      const h = 13 + rnd() * 6   // 1階が店、上は住まいと事務所（4〜5階）。低すぎるとワイヤーが振り子にならない
      const x0 = s * (ARC.hw + 1), x1 = s * (ARC.hw + 15)
      box(Math.min(x0, x1), z, Math.max(x0, x1), z1, h, 'building', { shopfront: s })
      // 縦看板（道に 1.4m 突き出す。看板の板そのものに掛かる）
      if (((z - ARC.z0) / 10.5 | 0) % 2 === (s > 0 ? 0 : 1)) {
        const sx = s * (ARC.hw + 1 - 0.75)
        box(sx - 0.7, z + 4.9, sx + 0.7, z + 5.1, 4.6, 'building', { y0: 4.4, small: true, look: 'vsign', nx: -s, seed: (z * 7 + (s > 0 ? 3 : 0)) | 0 })
      }
    }
  }
  // 入口と出口の門（道をまたぐ梁。掛かる）
  for (const z of [ARC.z0 - 1, ARC.z1]) box(-ARC.hw - 1, z - 0.6, ARC.hw + 1, z + 0.6, 2.2, 'building', { y0: 9.6, small: true, look: 'gate' })
  deco.push({ t: 'arcade', x0: -ARC.hw - 1, x1: ARC.hw + 1, z0: ARC.z0, z1: ARC.z1, y: 10.5 })
  walks.push({ ax: -2, az: ARC.z0 + 2, ux: 0, uz: 1, L: ARC.z1 - ARC.z0 - 4 }, { ax: 2, az: ARC.z0 + 2, ux: 0, uz: 1, L: ARC.z1 - ARC.z0 - 4 })
  // 商店街の裏: 中くらいのビル（雑居ビル）
  for (const [z0, z1] of [[306, 414], [426, 546]]) { fill(-104, z0, -22, z1, 14, 30); fill(22, z0, 80, z1, 14, 28); fill(101, z0, 140, z1, 22, 40) }
  for (const [z0, z1] of [[306, 414], [426, 690]]) fill(-176, z0, -117, z1, 12, 24)
  lampsZ(81.5, 310, 540, 26, 1, [[410, 430]]); lampsZ(98.5, 320, 540, 26, -1, [[410, 430]])
  polesX(424, -104, -12, 20, -1); polesX(416, 14, 80, 20, 1)

  // ================================================================ 駅前広場 z 548〜692（広い。隕石をよける見せ場）
  // 西は百貨店（大きな画面が広場を向く）、東は高架の駅
  box(-104, 552, -64, 690, 34, 'building', { dept: true })
  box(-64.6, 600, -63.6, 640, 9, 'building', { y0: 14, small: true, look: 'screen' })   // 百貨店の壁の大型画面（掛かる）
  box(28.8, 618.8, 31.2, 621.2, 18, 'building', { small: true, look: 'clock' })         // 時計塔
  for (const [x, z] of [[-24, 566], [64, 566]]) box(x - 4, z - 1.2, x + 4, z + 1.2, 2.8, 'shelter')   // バス停の屋根つき待合
  for (const [x, z] of [[-40, 600], [-40, 650], [0, 680], [70, 680], [100, 600], [-10, 610], [75, 625]]) tree(x, z, 0.55)
  for (const [x, z] of [[-50, 580], [-50, 670], [10, 640], [60, 600], [110, 680], [110, 570], [-10, 570], [40, 680]]) pole(x, z, 'lamp', 0, -1)
  for (let i = 0; i < 6; i++) walks.push({ ax: -50 + i * 30, az: 560, ux: 0, uz: 1, L: 120 })
  walks.push({ ax: -55, az: 600, ux: 1, uz: 0, L: 170 }, { ax: -55, az: 650, ux: 1, uz: 0, L: 170 })
  // 駅舎（高架の下）と、高架の上のホーム・屋根・止まった電車
  box(128, 588, 172, 692, 8.4, 'building', { station: true })

  // ================================================================ 高架の線路（x=150）。南の端から北の端まで。川を鉄道橋で渡る
  const VIA = { x: 150, hw: 5, y0: 8.8, y1: 10 }
  for (let z = B.z0 - 20; z < B.z1 + 20; z += 40) {
    const z1 = Math.min(B.z1 + 20, z + 40)
    for (const [a, b] of (z1 > 590 && z < 690) ? [[z, 590], [690, z1]] : [[z, z1]]) {
      if (b - a < 1) continue
      box(VIA.x - VIA.hw, a, VIA.x + VIA.hw, b, VIA.y1 - VIA.y0, 'building', { y0: VIA.y0, small: true, look: 'viaduct' })
    }
  }
  box(138, 590, 162, 690, VIA.y1 - VIA.y0, 'building', { y0: VIA.y0, small: true, look: 'platform' })
  box(141, 596, 159, 684, 0.7, 'building', { y0: 14.4, small: true, look: 'canopy' })
  box(146.5, 702, 149.5, 762, 4.0, 'building', { y0: VIA.y1, small: true, look: 'train' })   // 運転見合わせで止まった電車（3両。幅 3.0m・高さ 4.0m は実物の通勤電車）
  // 橋脚（道の上には立てない）
  const roadZ = [120, 300, 420, 556, 700, 845, 950, 1050]
  for (let z = B.z0; z < B.z1; z += 20) {
    if (roadZ.some(rz => Math.abs(z - rz) < 10)) continue
    if (z > 586 && z < 694) continue   // 駅舎の中
    const water = z > R.z0 - 2 && z < R.z1 + 2
    box(VIA.x - 3.4, z - 0.8, VIA.x - 1.8, z + 0.8, VIA.y0 + (water ? 8 : 0), 'pillar', { y0: water ? R.floor : 0 })
    box(VIA.x + 1.8, z - 0.8, VIA.x + 3.4, z + 0.8, VIA.y0 + (water ? 8 : 0), 'pillar', { y0: water ? R.floor : 0 })
  }
  // 鉄道橋のトラス（線路の両側。掛かる）
  for (const s of [-1, 1]) box(VIA.x + s * 5.6 - 0.3, R.z0 - 6, VIA.x + s * 5.6 + 0.3, R.z1 + 6, 6.5, 'building', { y0: VIA.y1, small: true, look: 'truss' })
  // 架線柱（線路の両側に 30m おき。電線でつながる）
  for (let z = B.z0 + 10; z < B.z1; z += 30) {
    if (z > 586 && z < 694) continue
    for (const s of [-1, 1]) pole(VIA.x + s * 4.6, z, 'pole', -s, 0, VIA.y1, 6)
  }
  deco.push({ t: 'tracks', x: VIA.x, y: VIA.y1, z0: B.z0 - 20, z1: B.z1 + 20 })

  // ================================================================ 川沿い（z 708〜757）と川
  grassRects.push({ x0: B.x0, z0: 708, x1: B.x1, z1: 756 })
  for (let x = -170; x < 195; x += 17) { if (Math.abs(x) < 14 || Math.abs(x - 150) < 12 || Math.abs(x + 90) < 6) continue; tree(x + (rnd() - 0.5) * 4, 716 + rnd() * 6, 0.58) }
  lampsX(748, -170, 190, 24, -1, [[-12, 12], [140, 160], [-96, -84]])
  // 広告塔（川の手前と向こう。道路橋へ向かう人の頭上で掛かる）
  for (const [x, z, nz] of [[-45, 738, -1], [62, 738, -1], [118, 738, -1], [-60, 866, -1]]) {
    box(x - 7, z - 0.4, x + 7, z + 0.4, 7, 'building', { y0: 10, small: true, look: 'billboard', nz, seed: x * 3 + z })
    deco.push({ t: 'post', x: x - 4.5, z, y0: 0, y1: 10 }, { t: 'post', x: x + 4.5, z, y0: 0, y1: 10 })
  }
  // 川の縁の柵（橋の所は開ける）
  const open = [[-11.5, 11.5], [-92.6, -87.4]]
  for (const zEdge of [R.z0 - 1.2, R.z1 + 1.2]) {
    let x = B.x0 - 20
    for (const [a, b] of open) { boxes.push({ cx: (x + a) / 2, cz: zEdge, yaw: 0, hw: (a - x) / 2, hl: 0.25, y0: 0, h: 0.95, kind: 'rail' }); x = b }
    boxes.push({ cx: (x + B.x1 + 20) / 2, cz: zEdge, yaw: 0, hw: (B.x1 + 20 - x) / 2, hl: 0.25, y0: 0, h: 0.95, kind: 'rail' })
  }
  // 道路橋（x=0、歩道込みで幅 23m）と斜張橋の主塔2本
  slabs.push({ cx: 0, cz: (R.z0 + R.z1) / 2, yaw: 0, hw: 11.5, hl: (R.z1 - R.z0) / 2 + 4, y0: 0, y1: 0, thick: 1.6, surf: 'road', solid: true, kind: 'bridge' })
  for (const s of [-1, 1]) boxes.push({ cx: s * 11.7, cz: (R.z0 + R.z1) / 2, yaw: 0, hw: 0.25, hl: (R.z1 - R.z0) / 2 + 4, y0: 0, h: 1.1, kind: 'rail' })
  for (const s of [-1, 1]) box(s * 13.6 - 1.1, 793.5, s * 13.6 + 1.1, 796.5, 50, 'building', { y0: R.floor, small: true, look: 'pylon' })
  deco.push({ t: 'cables', x: 13.6, z: 795, top: 40, deck: 0.6, span: 34 })
  // 歩道橋（x=-90、細い。真ん中に街灯）
  slabs.push({ cx: -90, cz: (R.z0 + R.z1) / 2, yaw: 0, hw: 2.2, hl: (R.z1 - R.z0) / 2 + 3, y0: 0.5, y1: 0.5, thick: 0.6, surf: 'road', solid: true, kind: 'bridge' })
  for (const s of [-1, 1]) boxes.push({ cx: -90 + s * 2.4, cz: (R.z0 + R.z1) / 2, yaw: 0, hw: 0.15, hl: (R.z1 - R.z0) / 2 + 3, y0: 0.5, h: 1.1, kind: 'rail' })
  for (const z of [772, 795, 818]) pole(-92.6, z, 'lamp', 1, 0, 0.5)

  // ================================================================ オフィス街（z 845〜）
  grassRects.push({ x0: -86, z0: 857, x1: -18, z1: 938 })   // 川沿いの広場（芝生と噴水）
  box(-56, 893, -48, 901, 1.2, 'fountain')
  for (const [x, z] of [[-80, 865], [-26, 866], [-80, 930], [-26, 930], [-70, 897], [-34, 897], [-52, 870], [-52, 925]]) tree(x, z, 0.62)
  for (const [x, z] of [[-66, 882], [-38, 912], [-66, 912], [-38, 882]]) pole(x, z, 'lamp', 0, 1)
  // 工事現場とタワークレーン（腕が大通りの上まで伸びる。いちばん高く振れる近道）
  dirtRects.push({ x0: -89, z0: 961, x1: -18, z1: 1040 })
  box(-87, 966, -68, 1036, 24, 'building', { look: 'frame' })   // 建てかけの鉄骨のビル
  box(-62.2, 998.2, -59.8, 1000.8, 60, 'building', { small: true, look: 'mast' })
  box(-80, 998.6, -8, 1000.4, 2.2, 'building', { y0: 56, small: true, look: 'jib' })
  deco.push({ t: 'crane', x: -61, z: 999.5, y: 56, tip: -10 })
  // ビル街（大通りの両側は 40〜95m、外側は 25〜55m）
  const cols = [[-176, -111], [-89, -18], [18, 89], [111, 141], [159, 196]]
  const rows = [[857, 939], [961, 1039], [1061, 1246]]
  cols.forEach(([x0, x1], ci) => rows.forEach(([z0, z1], ri) => {
    if (ci === 1 && ri < 2) return                             // 広場と工事現場
    if (ri === 2 && (ci === 1 || ci === 2)) {                  // タワーの前の広場を空ける
      const inner = ci === 1 ? [x0, -36] : [36, x1]
      fill(inner[0], z0, inner[1], 1134, 45, 90, { n: 2 })
      fill(inner[0], 1160, inner[1], z1, 40, 70, { n: 1 })
      return
    }
    const tall = ci === 1 || ci === 2
    fill(x0, z0, x1, z1, tall ? 45 : ci === 3 ? 22 : 26, tall ? 95 : ci === 3 ? 40 : 55)
  }))
  // 会社のタワー（いちばん高い。大通りの突き当たりで、川の橋から真正面に見える）
  box(-22, 1152, 22, 1196, 150, 'building', { company: true, look: 'company' })
  // 歩道橋（大通りをまたぐ。下から掛かり、上を走れる）
  for (const z of [1000, 1100]) {
    box(-14.5, z - 1.6, 14.5, z + 1.6, 1, 'building', { y0: 5.8, small: true, look: 'footbridge' })
    deco.push({ t: 'stairs', x: -16, z, y: 6.3 }, { t: 'stairs', x: 16, z, y: 6.3 })
  }
  // 大通りの街灯（両側）と、ビル街の通りの街灯
  lampsZ(-14.6, 860, 1135, 28, 1, [[940, 960], [1040, 1060], [993, 1007], [1093, 1107]])
  lampsZ(14.6, 872, 1135, 28, -1, [[940, 960], [1040, 1060], [993, 1007], [1093, 1107]])
  for (const z of [950, 1050]) { lampsX(z - 10.5, -170, 190, 30, 1, [[-20, 20], [-108, -92], [92, 108], [142, 158]]); lampsX(z + 10.5, -160, 190, 30, -1, [[-20, 20], [-108, -92], [92, 108], [142, 158]]) }
  lampsX(838.5, -170, 190, 26, 1, [[-14, 14], [-108, -92], [92, 108], [142, 158]])
  lampsX(851.5, -160, 190, 26, -1, [[-14, 14], [-108, -92], [92, 108], [142, 158]])
  lampsX(693.5, -170, 190, 26, 1, [[-10, 10], [-118, -102], [140, 160]])
  for (const x of [-100, 100]) { lampsZ(x - 10.5, 862, 1240, 30, 1, [[940, 962], [1040, 1062]]); lampsZ(x + 10.5, 870, 1240, 30, -1, [[940, 962], [1040, 1062]]) }
  for (const [x, z] of [[-30, 1146], [30, 1146]]) pole(x, z, 'lamp', 0, -1)
  for (let x = -28; x <= 28; x += 14) if (x) tree(x, 1137, 0.5)
  walks.push({ ax: -30, az: 1146, ux: 1, uz: 0, L: 60 })

  // ================================================================ 外周（街の外へ出られない。高さを変えたビルの列）
  const rim = (x0, z0, x1, z1, alongX) => {
    const L = alongX ? x1 - x0 : z1 - z0
    for (let a = 0; a < L; a += 42) {
      const b = Math.min(L, a + 42), h = 22 + rnd() * 30
      if (alongX) box(x0 + a, z0, x0 + b, z1, h); else box(x0, z0 + a, x1, z0 + b, h)
    }
  }
  rim(B.x0 - 40, B.z0 - 40, B.x0, R.z0 - 3, false); rim(B.x0 - 40, R.z1 + 3, B.x0, B.z1 + 40, false)
  rim(B.x1, B.z0 - 40, B.x1 + 40, R.z0 - 3, false); rim(B.x1, R.z1 + 3, B.x1 + 40, B.z1 + 40, false)
  rim(B.x0, B.z0 - 40, B.x1, B.z0, true); rim(B.x0, B.z1, B.x1, B.z1 + 40, true)
  // 川の両端（外へ泳いで出ない）
  for (const x of [B.x0 - 2, B.x1 + 2]) boxes.push({ cx: x, cz: (R.z0 + R.z1) / 2, yaw: 0, hw: 2, hl: (R.z1 - R.z0) / 2 + 3, y0: R.floor, h: 12, kind: 'wall' })

  // ================================================================ 道のり（bot と隕石の「行く道の先」）
  const legs = [
    [[0, 14], [0, 120], [0, 300], [0, 420], [0, 548], [40, 600], [MAP.station.x, MAP.station.z]],
    [[MAP.station.x, MAP.station.z], [70, 690], [0, 704], [0, 748], [0, 842], [0, 950], [0, 1050], [0, MAP.office.z]]
  ]
  const XS = [-110, -100, 0, 90, 100], ZS = [120, 300, 420, 700, 845, 950, 1050]
  return {
    roads, slabs, boxes, props, dirt: dirtRects, repair: [], decor: [], gates: [], grid: [{ x: MAP.home.x, z: MAP.home.z, yaw: 0 }], labels: [], routes: [], trees, laps: 1,
    shortcuts: [], lotRects: [], pickups: [], bounds: B, fallY: -3, water: { z0: R.z0, z1: R.z1, y: R.y }, trafficLoops: [], grassRects,
    cityGrid: { XS, ZS, WIDE_X: [0], WIDE_Z: [] },
    nav: { canal: { z0: R.z0, z1: R.z1 }, bridges: [0, -90], legs },
    terrain: commuteTerrain, mapPoles, townFill: town, mapDeco: deco, extraWalks: walks, mapName: 'commute',
    ground: (x, z) => grassRects.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) ? 'grass' : 'road'
  }
}
