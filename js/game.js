// 隕石の日でも出社する。空中出前（sky-delivery）のワイヤーを使った、隕石よけの出勤ゲーム。v2 で通勤路の街を新しく作った（shared/commutemap.js）
// 地面の赤い輪に隕石が落ちる。輪の外へ出ればよけられ、すぐ外（ギリギリ）でよけると勢いがつく。9:00 までに会社へ
window.__jsUp = true
import * as THREE from 'three'
import { GAME } from '../shared/config.js?v=16'
import { createWorld } from '../shared/track.js?v=16'
import { buildScene } from './scene.js?v=16'
import { FX } from './fx.js?v=16'
import { loadSky, setAniso } from './look.js?v=16'
import { Q, LOW } from './quality.js?v=16'
import { RunnerModel } from './runnermodel.js?v=16'
import { CharRunnerModel, loadCharAssets, charAssets, Person, PERSON, Officer } from './charmodel.js?v=17'
import { createRunner, stepRunner, findAnchor, rayHit, floorAt, RUN } from '../shared/runner.js?v=16'
import { COM, DEADLINE, createRun, stepRun, verdict, clockSec, fmtClock, goalOf, SKY } from '../shared/commute.js?v=3'
import { dropAt } from '../shared/meteor.js?v=3'
import { createBot, botInput } from '../shared/bot.js?v=16'
import { createStreet, buildPoles } from '../shared/street.js?v=16'
import { addTown, clearShopFront } from '../shared/town.js?v=16'
import { buildPoles3d, buildHouses3d, trafficPool, pedPool } from './street3d.js?v=16'
import { carLights } from './carmodel.js?v=16'
import { MeteorView, NewsHeli } from './meteor3d.js?v=1'
import { drawCard } from './card.js?v=1'

const $ = id => document.getElementById(id)
// ---------------------------------------------------------------- 読み込みの進み具合（ロード画面）
const LM = THREE.DefaultLoadingManager, bootP = { done: 0, total: 0 }
LM.onStart = LM.onProgress = (url, a, b) => { bootP.done = a; bootP.total = b; bootP.at = performance.now(); window.__bootSet && window.__bootSet(0.2 + 0.8 * (b ? a / b : 0)) }
window.__bootDbg = () => ({ ...bootP, ch: charAssets.ready, chFail: charAssets.failed, now: Math.round(performance.now()) })
function bootWatch(onReady) {
  const t0 = performance.now()
  const tick = () => {
    const quiet = performance.now() - (bootP.at || 0) > 600
    const done = bootP.total > 0 && (bootP.done >= bootP.total || quiet)   // 人物（GLB）は待たない。届くまでは手続きの人形で遊べる
    if (done || performance.now() - t0 > 12000) {   // 遅い回線でも 12 秒で必ず消す（人物は届いたら差し替わる）
      window.__bootDone = true; window.__bootSet && window.__bootSet(1)
      const b = $('boot'); b.classList.add('out'); setTimeout(() => b.classList.add('hidden'), 380)
      onReady(); return
    }
    setTimeout(tick, 120)
  }
  tick()
}
const STEP = GAME.step
const URL_ = 'https://tom3games.github.io/meteor-commute/'
const store = { get: k => { try { return localStorage.getItem(k) } catch (e) { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} } }

// ---------------------------------------------------------------- 文言（日英）
const T = {
  ja: {
    breaking: '速報', news: ['本日朝 市内に隕石が多数落下の見込み', '交通機関は運転見合わせ', '気象庁「落ちる所は地面が赤く光ります」', '不要不急の出社は…'],
    logo1: '隕石の日でも', logo2: '出社する', bossName: '部長', calling: '着信中', bossLine: '「隕石？ 知らん。遅刻すんなよ」',
    start: '出社する', how: '遊び方', lang: 'EN', more: 'ほかのゲーム', muteOn: '音 入', muteOff: '音 切', loading: '隕石の予報を確認中',
    memoFrom: '総務部より', memoDate: '本日付', howTitle: '隕石の日の出社について', ok: '承知しました',
    howItems: [
      '移動はビルを<b>タッチ</b>してワイヤーで行うこと。右下の大きいボタンでも可',
      '地面の<b>赤い輪</b>には隕石が落ちる。当たるたびに<b>スーツが燃え</b>、パンツ一丁でもう一度当たると警察に保護される',
      '輪の<b>すぐ外</b>でよけると勢いがつく。服は<b>紳士服の店</b>の緑の輪で1段戻る。各自、<b>9:00</b>までに出社すること'
    ],
    keysPc: 'PC: WASD・矢印で移動　クリックでワイヤー（E は前の上へ自動）　Space ジャンプ　ドラッグで見回す',
    credit: '音・人物: Kenney, rubberduck, poinl, Almitory, WuxiaScrub, KayKit ほか（CC0）。詳しくは CREDITS.md',
    toStation: '駅まで', toOffice: '会社まで', left: m => `あと${m}分`, lateBy: m => `${m}分遅刻`, nineNow: '9:00',
    again: 'もう一回', save: '画像を保存', post: 'Xでポスト', toTitle: 'タイトル',
    pause: '休憩', paused: '一時停止', resume: '戻る', quit: '帰る（やめる）', jump: '跳ぶ', tooFar: '届かない', burning: '燃えてて掛からん',
    near: 'ギリギリ！', nearBig: '紙一重！', nearRoll: 'セーフ！', chain: n => `${n}連続`,
    hint1: '<small>こつ</small>ビルをタッチするとワイヤーが出る', hint1Pc: '<small>こつ</small>ビルをクリック（か E）でワイヤー',
    hintWarn: '<small>こつ</small>赤い輪に落ちる。輪の外へ！', hintNear: '<small>こつ</small>すぐ外でよけると加速する',
    call: '<small>部長から着信</small>', boss: '部長',
    callStart: '9時やぞ。隕石は言い訳にならんからな', callStation: '電車止まっとる？ 走ってこい', call58: 'あと2分や。どこにおる', callNine: '9時過ぎたぞ。何しとんねん',
    blast: ['ぐはっ', 'スーツが…', '顔から行った', '朝から何やねん'], hot: '熱っ！', shower: '<small>ニュース</small>流星群です！ 一列に来ます',
    riderWarn: '<small>後輩</small>先輩、おはようございまーす！', riderRoll: '<small>後輩</small>どいてどいてー！ 止まらへーん', senpai: '<small>先輩</small>お前も今日は飛んで来たんか！',
    officeWarn: '<small>あなた</small>会社の真上に…でかいのが', officeHit: '<small>部長</small>会社に落ちた。今日は休みや',
    arrive: '<small>受付</small>おはようございます', arriveLate: '<small>受付</small>部長、怒ってはりますよ', bossLand: '<small>部長</small>…ワシも今来たとこや', absent: '<small>部長</small>もうええ。今日は欠勤や',
    heli: '<small>中継</small>隕石の中、出社する会社員がいます',
    stationName: '明星台駅', stationBoard: '運転見合わせ', officeName: 'ドンマイ商事', homeName: 'メゾン朝日', townName: 'ようこそ 朝日町', arcadeName: 'あさひ通り商店街', screenLines: ['隕石', '多数', '落下中'], screenFoot: '外出は控えて',
    titles: { early: '出勤記録', ontime: '出勤記録', late: '遅刻届', verylate: '遅刻届', absent: '欠勤届', dayoff: '臨時休業のお知らせ' },
    stamps: { early: '早出', ontime: '受理', late: '却下', verylate: '却下', absent: '欠勤', dayoff: '休業', pardon: '不問' },
    lab: { date: '日付', name: '氏名', live: '中継', arrive: '出社時刻', reason: '理由', reasonOk: '道中の災難', noReason: '特になし', boss: '部長の欄' },
    you: 'あなた（営業部）',
    reasons: { hit: '隕石に吹き飛ばされたため', roll: '転がる隕石に追われたため', hot: 'クレーターが熱かったため', burn: '燃えるビルに掛けられなかったため', train: '電車が隕石で止まったため' },
    statL: ['ギリギリ回避', '最大連続', '吹き飛ばされた'], unit: ['回', '連続', '回'],
    sub: { early: m => `${m}分前`, ontime: () => '定時', late: m => `（${m}分遅刻）`, verylate: m => `（${m}分遅刻）` },
    caption: s => s.near >= 8 ? `隕石をギリギリでよけ続ける会社員（${s.near}回）` : s.hits >= 4 ? `隕石に何度も飛ばされる会社員` : '隕石の中 出社する会社員',
    comments: {
      dayoff: '会社に隕石が落ちた。今日は休みや。…よう来たな', absent: '電話にも出んと何しとった。今日は欠勤や',
      early: '隕石の日に早出か。お前、出世するで', ontime: '隕石くらいで遅刻せんのは当たり前や', ontimeNear: 'ようよけた。その動き、営業でも見せてくれ',
      late: '隕石は理由にならん。みんな来とる', lateHits: '飛ばされたんなら受け身を覚えろ', lateNear: 'よけるのは上手いんやけどな。間に合わせろ',
      verylate: '昼から来るつもりか', pardon: '今日のことは、お互い忘れよう'
    },
    postText: (s, c) => `隕石の日に出社した。${c}（ギリギリ回避${s.near}回）`,
    suitSay: ['', '<small>あなた</small>スーツが焦げた', '<small>あなた</small>上着が燃えた…', '<small>あなた</small>シャツまで燃えた', '<small>あなた</small>パンツしか残ってない'],
    police: '<small>警察</small>そこの下着の男性、止まりなさい！', arrestSay: '<small>警察</small>確保ー！', arrestSay2: '<small>あなた</small>出社するだけなんです…',
    tailorSay: '<small>紳士服の店</small>お急ぎですね。こちらでどうぞ', tailorName: ['紳士服 アサヒ', '紳士服 ヒノデ'], konbiniName: 'ヒノデマート', cleanerName: 'クリーニング',
    arrestTitle: '警察署からのお知らせ', arrestStamp: '保護', arrestLab: '保護時刻', arrestCaption: 'パンツ一丁で確保される会社員',
    arrestReasons: ['下着姿で市内を走っていたため', n => `隕石でスーツが燃えたため（${n}回）`, '「出社するだけ」と供述'],
    arrestComment: '迎えに行くの、ワシやぞ', arrestPlace: ['朝日町の住宅街', 'あさひ通り商店街', '明星台駅前', '川の上', 'ひので町', '本町大通り'],
    statL3: '焼けた', suitWord: ['無事', '焦げ', '上着なし', 'シャツなし', 'パンツ一丁']
  },
  en: {
    breaking: 'BREAKING', news: ['Meteors expected across the city this morning', 'All trains suspended', 'Officials: impact spots glow red on the ground', 'Non-essential commuting is...'],
    logo1: 'Meteor Day,', logo2: 'Still Commuting', bossName: 'Boss', calling: 'calling', bossLine: '"Meteors? Not my problem. Do not be late."',
    start: 'Go to work', how: 'How to play', lang: 'JP', more: 'More games', muteOn: 'Sound on', muteOff: 'Muted', loading: 'Checking the meteor forecast',
    memoFrom: 'From: General Affairs', memoDate: 'Today', howTitle: 'Commuting on meteor day', ok: 'Got it',
    howItems: [
      '<b>Tap</b> a building to shoot a wire. The big button aims ahead for you',
      'Meteors land in the <b>red rings</b>. Each hit <b>burns your suit</b>. Get hit again in your underwear and the police take you in',
      'Dodge <b>just outside</b> the ring for a boost. The green ring at a <b>tailor</b> mends one layer. Reach the office by <b>9:00</b>'
    ],
    keysPc: 'PC: WASD / arrows move · click to wire (E auto-aims) · Space jump · drag to look',
    credit: 'Sounds and characters: Kenney, rubberduck, poinl, Almitory, WuxiaScrub, KayKit and others (CC0). See CREDITS.md',
    toStation: 'Station', toOffice: 'Office', left: m => `${m} min left`, lateBy: m => `${m} min late`, nineNow: '9:00',
    again: 'Again', save: 'Save image', post: 'Post on X', toTitle: 'Title',
    pause: 'Pause', paused: 'Paused', resume: 'Back', quit: 'Go home (quit)', jump: 'Jump', tooFar: 'Too far', burning: 'On fire, no grip',
    near: 'CLOSE CALL!', nearBig: 'BY A HAIR!', nearRoll: 'SAFE!', chain: n => `x${n} chain`,
    hint1: '<small>Tip</small>Tap a building to shoot a wire', hint1Pc: '<small>Tip</small>Click a building (or E) to wire',
    hintWarn: '<small>Tip</small>It lands in the red ring. Get out!', hintNear: '<small>Tip</small>Dodge just outside for a boost',
    call: '<small>Call from the boss</small>', boss: 'Boss',
    callStart: 'Nine sharp. Meteors are no excuse', callStation: 'Trains stopped? Then run', call58: 'Two minutes. Where are you', callNine: 'It is past nine. What are you doing',
    blast: ['Oof', 'My suit...', 'Face first', 'Not this morning'], hot: 'Hot!', shower: '<small>News</small>Meteor shower! They come in a line',
    riderWarn: '<small>Junior</small>Good morning, sir!', riderRoll: '<small>Junior</small>Move! I cannot stop!', senpai: '<small>Senior</small>You flew in today too?',
    officeWarn: '<small>You</small>Something big... right above the office', officeHit: '<small>Boss</small>It hit the office. Day off',
    arrive: '<small>Reception</small>Good morning', arriveLate: '<small>Reception</small>The boss is not happy', bossLand: '<small>Boss</small>...I just got here too', absent: '<small>Boss</small>Forget it. You are absent today',
    heli: '<small>Live</small>A worker is commuting through the meteors',
    stationName: 'Myojodai Sta.', stationBoard: 'SUSPENDED', officeName: 'Donmai Trading', homeName: 'Maison Asahi', townName: 'ASAHI-CHO', arcadeName: 'ASAHI-DORI ARCADE', screenLines: ['METEORS', 'FALLING', 'NOW'], screenFoot: 'STAY INSIDE',
    titles: { early: 'Attendance Record', ontime: 'Attendance Record', late: 'Late Arrival Form', verylate: 'Late Arrival Form', absent: 'Absence Form', dayoff: 'Office Closed Today' },
    stamps: { early: 'EARLY', ontime: 'OK', late: 'NO', verylate: 'NO', absent: 'ABSENT', dayoff: 'CLOSED', pardon: 'PARDON' },
    lab: { date: 'Date', name: 'Name', live: 'LIVE', arrive: 'Arrived', reason: 'Reason', reasonOk: 'On the way', noReason: 'None', boss: 'Boss' },
    you: 'You (Sales)',
    reasons: { hit: 'Blown away by a meteor', roll: 'Chased by a rolling meteor', hot: 'The crater was too hot', burn: 'Could not wire a burning building', train: 'Trains stopped by a meteor' },
    statL: ['Close calls', 'Best chain', 'Blown away'], unit: ['', '', ''],
    sub: { early: m => `${m} min early`, ontime: () => 'on time', late: m => `(${m} min late)`, verylate: m => `(${m} min late)` },
    caption: s => s.near >= 8 ? `Worker keeps dodging meteors (${s.near})` : s.hits >= 4 ? 'Worker blown away again and again' : 'Worker commutes through meteors',
    comments: {
      dayoff: 'A meteor hit the office. Day off. ...Thanks for coming', absent: 'Not even answering the phone. Absent',
      early: 'Early on meteor day. You will go far', ontime: 'Not being late for a few meteors is the minimum', ontimeNear: 'Nice dodging. Show me that in sales',
      late: 'Meteors are not an excuse. Everyone else made it', lateHits: 'If you get blown away, learn to land', lateNear: 'Great dodging. Now be on time',
      verylate: 'Planning to come after lunch?', pardon: 'Let us both forget about today'
    },
    postText: (s, c) => `I commuted on meteor day. ${c} (${s.near} close calls)`,
    suitSay: ['', '<small>You</small>My suit is scorched', '<small>You</small>The jacket burned off...', '<small>You</small>Now the shirt too', '<small>You</small>Only my underwear is left'],
    police: '<small>Police</small>You in the underwear! Stop right there!', arrestSay: '<small>Police</small>Got him!', arrestSay2: '<small>You</small>I am just going to work...',
    tailorSay: '<small>Tailor</small>In a hurry? Right this way', tailorName: ['ASAHI SUITS', 'HINODE SUITS'], konbiniName: 'HINODE MART', cleanerName: 'CLEANERS',
    arrestTitle: 'Notice from the Police', arrestStamp: 'HELD', arrestLab: 'Held at', arrestCaption: 'Worker caught in his underwear',
    arrestReasons: ['Running through the city in underwear', n => `Suit burned by meteors (${n} times)`, 'Said "I am just going to work"'],
    arrestComment: 'And now I have to come pick you up', arrestPlace: ['Asahi-cho', 'Asahi-dori Arcade', 'Myojodai Sta.', 'on the bridge', 'Hinode-cho', 'Honmachi Ave.'],
    statL3: 'Burned', suitWord: ['OK', 'Scorched', 'No jacket', 'No shirt', 'Underwear']
  }
}
let lang = store.get('met.lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
const t = k => T[lang][k]
const touchMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
document.body.classList.toggle('is-touch', touchMode)
function applyLang() {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll('[data-t]')) { const v = t(el.dataset.t); if (typeof v === 'string') el.textContent = v }
  $('howList').innerHTML = t('howItems').map((s, i) => `<li data-n="${lang === 'ja' ? '一二三'[i] + '、' : (i + 1) + '.'}"><span>${s}</span></li>`).join('')
  $('howKeys').textContent = touchMode ? '' : t('keysPc')
  $('btnMute').textContent = Snd.muted ? t('muteOff') : t('muteOn')
  $('newsText').textContent = t('news').join('　／　')
  signs && signs.redraw()
  shopSigns && shopSigns.redraw()
}

// ---------------------------------------------------------------- 音（録音素材だけ）
Snd.muted = store.get('met.mute') === '1'
Snd.def({
  wire: ['snd/swish-1.mp3', 'snd/swish-2.mp3', 'snd/swish-3.mp3'], hook: ['snd/metalClick.mp3', 'snd/metal_02.mp3'], whoosh: 'snd/swish-5.mp3',
  land: ['snd/footstep_01.mp3', 'snd/footstep_02.mp3'], bonk: ['snd/thwack-01.mp3', 'snd/thwack-03.mp3'], grunt: ['snd/grunt_01.mp3', 'snd/grunt_02.mp3', 'snd/grunt_03.mp3', 'snd/grunt_04.mp3'],
  boom: 'snd/boom.mp3', rumble: 'snd/rumble.mp3', rock: ['snd/rock1.mp3', 'snd/rock2.mp3'], rockfall: 'snd/rockfall.mp3', incoming: 'snd/incoming.mp3',
  scream: ['snd/scream1.mp3', 'snd/scream2.mp3', 'snd/scream3.mp3'], ring: 'snd/ring.mp3', ding: 'snd/bell_ding1.mp3', click: 'snd/click_001.mp3', tick: 'snd/tick_002.mp3',
  win: 'snd/jingles_SAX01.mp3', meh: 'snd/jingles_SAX03.mp3', lose: 'snd/jingles_PIZZA07.mp3'
})
const sfx = (n, o) => Snd.play(n, o)

// ---------------------------------------------------------------- 描画の土台
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
renderer.setPixelRatio(Q.pixelRatio)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
setAniso(renderer)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0xc9d6e2, 0.0022)
scene.background = new THREE.Color(0xa9c4e0)
const sun = new THREE.DirectionalLight(0xfff1dc, 3.0)
sun.userData.dir = new THREE.Vector3(-0.45, 0.62, -0.64).normalize()
sun.castShadow = true
sun.shadow.mapSize.set(Q.shadow, Q.shadow)
Object.assign(sun.shadow.camera, { left: -Q.shadowRange, right: Q.shadowRange, top: Q.shadowRange, bottom: -Q.shadowRange, near: 1, far: 400 })
sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0004
scene.add(sun, sun.target)
const hemi = new THREE.HemisphereLight(0xc4d8ff, 0x6a5a48, 1.8)
scene.add(hemi)
let hemiBase = 1.8, dayK = -1
loadSky(renderer, scene, sun, () => { hemiBase = 0.4; hemi.intensity = 0.4; dayK = -1 })
const camera = new THREE.PerspectiveCamera(64, 1, 0.3, 2400)
const world = createWorld('commute')
const HOME = COM.shop   // 家（メゾン朝日）の玄関の箱の場所
clearShopFront(world, HOME)
const built = buildScene(scene, world)
for (const g of built.gates) g.grp.visible = false
const fx = new FX(scene, world)
const town = addTown(world, HOME)
const poles3d = buildPoles3d(scene, buildPoles(world, HOME))
const houses3d = buildHouses3d(scene, town)
const carsDraw = trafficPool(scene, LOW), pedsDraw = pedPool(scene, LOW)
let street = createStreet(world, 1)
const view = new MeteorView(scene, fx, world)
const heli = new NewsHeli(scene)
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx }

// ---------------------------------------------------------------- 家・駅・会社の見た目と、行き先の光の柱
const sp = world.town.shop   // 空中出前の店の箱を、自分の住むアパートの1階に見立てる
const homeGroup = new THREE.Group()
{
  const wall = new THREE.MeshStandardMaterial({ color: 0xe6dccb, roughness: 0.9 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(sp.hw * 2, sp.y1, sp.hl * 2), wall); body.position.set(0, sp.y1 / 2, 0); body.castShadow = body.receiveShadow = true
  const roof = new THREE.Mesh(new THREE.BoxGeometry(sp.hw * 2 + 0.6, 0.3, sp.hl * 2 + 0.6), new THREE.MeshStandardMaterial({ color: 0x4a4f58 })); roof.position.y = sp.y1 - 0.13
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), new THREE.MeshStandardMaterial({ color: 0x5b3a26 })); door.position.set(sp.hw + 0.01, 1.05, 0); door.rotation.y = Math.PI / 2
  homeGroup.add(body, roof, door); homeGroup.position.set(sp.cx, 0, sp.cz); scene.add(homeGroup)
}
const offBld = world.colliders.filter(o => o.kind === 'building' && !o.small && o.hw < 80).sort((a, b) => Math.hypot(a.cx - COM.officeBld.x, a.cz - COM.officeBld.z) - Math.hypot(b.cx - COM.officeBld.x, b.cz - COM.officeBld.z))[0]
const signs = (() => {
  // 会社の看板（入口の上・通りの側）
  const oc = document.createElement('canvas'); oc.width = 1024; oc.height = 192
  const otex = new THREE.CanvasTexture(oc); otex.colorSpace = THREE.SRGBColorSpace
  const oSign = new THREE.Mesh(new THREE.PlaneGeometry(16, 3), new THREE.MeshStandardMaterial({ map: otex, roughness: 0.6, emissive: 0xffffff, emissiveMap: otex, emissiveIntensity: 0.25 }))
  const fz = offBld.cz - offBld.hl - 0.3   // 入口は南の面（大通りの突き当たり）。ロビーのガラスの箱より前に貼る
  oSign.position.set(COM.office.x, 9, fz - 0.08); oSign.rotation.y = Math.PI; scene.add(oSign)
  const crown = new THREE.Mesh(new THREE.PlaneGeometry(36, 6.75), oSign.material)   // 屋上の社名（川の橋から真正面に見える）
  crown.position.set(offBld.cx, offBld.y1 - 6, fz - 0.1); crown.rotation.y = Math.PI; scene.add(crown)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.6), new THREE.MeshStandardMaterial({ color: 0x2c3a48, roughness: 0.1, metalness: 0.6 }))
  glass.position.set(COM.office.x, 1.8, fz - 0.06); glass.rotation.y = Math.PI; scene.add(glass)
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 3), new THREE.MeshStandardMaterial({ color: 0x1b2233 })); canopy.position.set(COM.office.x, 4, fz - 1.5); scene.add(canopy)
  // 駅: 駅名の板と運転見合わせの電光板、改札の柵、線路に落ちた大きな隕石
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 384
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace
  const S = COM.station, sg = new THREE.Group(); sg.position.set(S.x + 6.6, 0, S.z); scene.add(sg)
  const post = new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.4, roughness: 0.5 })
  for (const dz of [-4.5, 4.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), post); p.position.set(0, 3, dz); sg.add(p) }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 3.6), new THREE.MeshStandardMaterial({ map: stex, emissive: 0xffffff, emissiveMap: stex, emissiveIntensity: 0.55 })); board.position.set(-0.2, 5.2, 0); board.rotation.y = -Math.PI / 2; sg.add(board)
  for (let i = -2; i <= 2; i++) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.25), new THREE.MeshStandardMaterial({ color: 0x8c96a3, metalness: 0.5, roughness: 0.4 })); g.position.set(-1.5, 0.55, i * 1.8); sg.add(g) }
  // 電車が止まった理由: 鉄道橋の上に落ちた大きな隕石
  const rock = new THREE.Mesh(view.rockGeos[2], view.coolMat); rock.scale.setScalar(3.6); rock.position.set(150, 12.6, 788); rock.rotation.set(0.4, 1, 0.2); scene.add(rock)
  sg.userData.smoke = new THREE.Vector3(150, 14, 788)
  // 商店街の門の名前・百貨店の大型画面・広場の時計塔（文字は日英で描き直す）
  const gc = document.createElement('canvas'); gc.width = 1024; gc.height = 160
  const gtex = new THREE.CanvasTexture(gc); gtex.colorSpace = THREE.SRGBColorSpace
  const gMat = new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.6, emissive: 0xffffff, emissiveMap: gtex, emissiveIntensity: 0.2 })
  const tc = document.createElement('canvas'); tc.width = 1024; tc.height = 160
  const ttex = new THREE.CanvasTexture(tc); ttex.colorSpace = THREE.SRGBColorSpace
  const tMat = new THREE.MeshStandardMaterial({ map: ttex, roughness: 0.6 })
  for (const g of world.colliders.filter(o => o.look === 'gate')) for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(g.hw * 2 - 0.4, (g.y1 - g.y0) * 0.74), g.town ? tMat : gMat); m.position.set(g.cx, (g.y0 + g.y1) / 2, g.cz + s * (g.hl + 0.03)); m.rotation.y = s > 0 ? 0 : Math.PI; scene.add(m)
  }
  const vc = document.createElement('canvas'); vc.width = 512; vc.height = 1024
  const vtex = new THREE.CanvasTexture(vc); vtex.colorSpace = THREE.SRGBColorSpace
  const scr = world.colliders.find(o => o.look === 'screen')
  if (scr) { const m = new THREE.Mesh(new THREE.PlaneGeometry(scr.hl * 2, scr.y1 - scr.y0), new THREE.MeshBasicMaterial({ map: vtex, toneMapped: false })); m.position.set(scr.cx + scr.hw + 0.32, (scr.y0 + scr.y1) / 2, scr.cz); m.rotation.y = Math.PI / 2; scene.add(m) }
  const cc = document.createElement('canvas'); cc.width = cc.height = 128
  const ctex = new THREE.CanvasTexture(cc); ctex.colorSpace = THREE.SRGBColorSpace
  const ck = world.colliders.find(o => o.look === 'clock')
  if (ck) { const plain = new THREE.MeshStandardMaterial({ color: 0x9c8f7a }), face = new THREE.MeshStandardMaterial({ map: ctex }); const m = new THREE.Mesh(new THREE.BoxGeometry(3.18, 2.6, 3.18), [face, face, plain, plain, face, face]); m.position.set(ck.cx, ck.y1 - 1.5, ck.cz); scene.add(m) }
  let clockMin = -1
  function setClock(sec) {
    const mm = Math.floor(sec / 60); if (mm === clockMin) return; clockMin = mm
    const x = cc.getContext('2d'); x.fillStyle = '#f4efe2'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#2b2e33'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.stroke()
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.lineWidth = i % 3 ? 3 : 6; x.beginPath(); x.moveTo(64 + Math.sin(a) * 44, 64 - Math.cos(a) * 44); x.lineTo(64 + Math.sin(a) * 52, 64 - Math.cos(a) * 52); x.stroke() }
    const m = mm % 60, h = (mm / 60) % 12, hand = (a, L, w) => { x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.sin(a) * L, 64 - Math.cos(a) * L); x.stroke() }
    hand(h / 12 * Math.PI * 2, 30, 7); hand(m / 60 * Math.PI * 2, 46, 4)
    ctex.needsUpdate = true
  }
  setClock(COM.startMin * 60)
  // 家の表札
  const hc = document.createElement('canvas'); hc.width = 512; hc.height = 128
  const htex = new THREE.CanvasTexture(hc); htex.colorSpace = THREE.SRGBColorSpace
  const hSign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshStandardMaterial({ map: htex })); hSign.position.set(sp.cx + sp.hw + 0.03, sp.y1 - 0.8, sp.cz); hSign.rotation.y = Math.PI / 2; scene.add(hSign)
  function redraw() {
    let x = oc.getContext('2d'); x.fillStyle = '#1b2233'; x.fillRect(0, 0, 1024, 192); x.fillStyle = '#f5f2ea'; x.font = '900 110px "M PLUS 1p", "BIZ UDPGothic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t('officeName'), 512, 100); otex.needsUpdate = true
    x = sc.getContext('2d'); x.fillStyle = '#f5f2ea'; x.fillRect(0, 0, 1024, 150); x.fillStyle = '#1b2233'; x.font = '96px "BIZ UDPGothic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t('stationName'), 512, 80)
    x.fillStyle = '#111'; x.fillRect(0, 150, 1024, 234); x.fillStyle = '#ff9a1f'; x.font = 'bold 110px "BIZ UDPGothic", sans-serif'; x.fillText(t('stationBoard'), 512, 270); stex.needsUpdate = true
    x = hc.getContext('2d'); x.fillStyle = '#5b3a26'; x.fillRect(0, 0, 512, 128); x.fillStyle = '#f5f2ea'; x.font = '70px "Klee One", serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t('homeName'), 256, 66); htex.needsUpdate = true
    x = gc.getContext('2d'); x.fillStyle = '#8b2a22'; x.fillRect(0, 0, 1024, 160); x.fillStyle = '#f7e9c8'; x.font = '900 104px "M PLUS 1p", "BIZ UDPGothic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t('arcadeName'), 512, 86); gtex.needsUpdate = true
    x = tc.getContext('2d'); x.fillStyle = '#2f6b4a'; x.fillRect(0, 0, 1024, 160); x.fillStyle = '#f5f2ea'; x.font = '900 100px "M PLUS 1p", "BIZ UDPGothic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t('townName'), 512, 86); ttex.needsUpdate = true
    x = vc.getContext('2d'); x.fillStyle = '#0d1016'; x.fillRect(0, 0, 512, 1024); x.fillStyle = '#d8262a'; x.fillRect(0, 0, 512, 210); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'
    x.font = '900 120px "M PLUS 1p", "BIZ UDPGothic", sans-serif'; x.fillText(t('breaking'), 256, 110)
    x.font = '900 96px "M PLUS 1p", "BIZ UDPGothic", sans-serif'; t('screenLines').forEach((l, i) => x.fillText(l, 256, 360 + i * 150))
    x.fillStyle = '#ffcf3a'; x.font = 'bold 64px "BIZ UDPGothic", sans-serif'; x.fillText(t('screenFoot'), 256, 930); vtex.needsUpdate = true
  }
  if (document.fonts) document.fonts.ready.then(() => { redraw(); shopSigns && shopSigns.redraw() })
  return { redraw, station: sg, setClock }
})()
// 行き先の光の柱（駅 → 会社）と地面の輪
const goalMark = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(0.15, 'rgba(120,220,255,.9)'); g.addColorStop(1, 'rgba(90,180,255,.5)')
  x.fillStyle = g; x.fillRect(0, 0, 4, 128)
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0), mat); col.renderOrder = 3
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.85, depthWrite: false })); ring.position.y = 0.07
  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.82, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.18, depthWrite: false })); fill.position.y = 0.06
  const g2 = new THREE.Group(); g2.add(col, ring, fill); scene.add(g2)
  return { g: g2, col, ring, fill, mat }
})()
// 朝 → 隕石が増えるほど空が赤くなる
const skyTint = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 12), new THREE.MeshBasicMaterial({ color: 0xff6a2c, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }))
skyTint.renderOrder = -1; scene.add(skyTint)
const DAY = { fog: new THREE.Color(0xd6dde4), red: new THREE.Color(0xd8906a), sunA: new THREE.Color(0xfff1dc), sunB: new THREE.Color(0xffa068) }
function applyDayTime(k) {
  if (Math.abs(k - dayK) < 0.004) return
  dayK = k
  scene.fog.color.copy(DAY.fog).lerp(DAY.red, k * 0.8)
  sun.color.copy(DAY.sunA).lerp(DAY.sunB, k)
  sun.intensity = 3.0 - k * 0.7
  hemi.intensity = hemiBase
  skyTint.material.opacity = 0.16 + k * 0.4   // 朝から少し赤い（隕石の日）
  poles3d.bulbMat.emissiveIntensity = 0; houses3d.winMat.emissiveIntensity = 0.2; houses3d.vendMat.emissiveIntensity = 0.5
  carLights(0)
}
// ワイヤー
const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0x2b2b2b }))
ropeMesh.visible = false; scene.add(ropeMesh)
const aimMark = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.9, depthTest: false }))
aimMark.renderOrder = 5; aimMark.visible = false; scene.add(aimMark)
// 登場人物（後輩・先輩・部長）
const kohai = new Person(PERSON.kohai), senpai = new Person(PERSON.senpai), bossP = new Person(PERSON.boss)
for (const p of [kohai, senpai, bossP]) { p.group.visible = false; scene.add(p.group) }
const senpaiRock = new THREE.Group()
{ const r = new THREE.Mesh(view.rockGeos[1], view.rockMat); r.scale.set(2.2, 0.9, 1.6); const c = new THREE.Mesh(view.rockGeos[3], view.coreMat); c.scale.set(2, 0.8, 1.4); const gl = new THREE.Sprite(view.glowMat); gl.scale.setScalar(8); senpaiRock.add(r, c, gl); senpaiRock.visible = false; scene.add(senpaiRock) }

// v3: 警察（パンツ一丁で捕まる場面）。白黒のパトカーと警官2人
const police = (() => {
  // パトカー（白黒）: 下半分が黒、上と屋根が白、屋根に赤色灯。前は +z
  const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.15, ...o })
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o }
  const white = M(0xf2f2ee), black = M(0x16171b), glass = M(0x1f2a36, { roughness: 0.1, metalness: 0.5 })
  add(new THREE.BoxGeometry(1.8, 0.5, 4.7), black, 0, 0.55, 0)
  add(new THREE.BoxGeometry(1.82, 0.22, 4.72), white, 0, 0.9, 0)
  add(new THREE.BoxGeometry(1.62, 0.5, 2.3), glass, 0, 1.26, -0.2)
  add(new THREE.BoxGeometry(1.5, 0.06, 2.1), white, 0, 1.53, -0.2)
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.5, 0.18), white, sx * 0.8, 1.26, 0.4)
  const red = new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 2 })
  add(new THREE.BoxGeometry(1.1, 0.16, 0.32), red, 0, 1.64, -0.1)
  for (const [x, z] of [[-0.82, 1.45], [0.82, 1.45], [-0.82, -1.45], [0.82, -1.45]]) { const w = add(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16), black, x, 0.34, z); w.rotation.z = Math.PI / 2 }
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.3, 0.1, 0.04), M(0xfff6d8, { emissive: 0xfff6d8, emissiveIntensity: 0.6 }), sx * 0.6, 0.78, 2.36)
  g.visible = false; scene.add(g)
  const car = { group: g, update(st) { g.position.set(st.x, st.y, st.z); g.rotation.set(0, st.yaw, 0) } }
  const offs = [new Officer(), new Officer()]
  for (const o of offs) { o.group.visible = false; scene.add(o.group) }
  return { car, red, offs, st: null }
})()
// 紳士服の店の前の緑の輪（入るとスーツが1段戻る）と、店・コンビニ・クリーニング店の看板の文字
const tailorRings = COM.tailors.map(T => {
  const g = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.r - 0.35, T.r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x45d07a, transparent: true, opacity: 0.85, depthWrite: false })); ring.position.y = 0.09
  const fill = new THREE.Mesh(new THREE.CircleGeometry(T.r - 0.35, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x45d07a, transparent: true, opacity: 0.2, depthWrite: false })); fill.position.y = 0.08
  // 輪の上に浮かぶハンガー（細い線の形）
  const hm = new THREE.MeshBasicMaterial({ color: 0x45d07a })
  const hanger = new THREE.Group()
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16, Math.PI * 1.4), hm); hook.position.y = 0.42; hook.rotation.z = -0.3
  const L = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 6), hm); L.rotation.z = Math.PI / 2 - 0.5; L.position.set(-0.36, 0.05, 0)
  const Rr = L.clone(); Rr.rotation.z = -(Math.PI / 2 - 0.5); Rr.position.x = 0.36
  const B = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), hm); B.rotation.z = Math.PI / 2; B.position.y = -0.17
  hanger.add(hook, L, Rr, B); hanger.position.y = 2.4
  g.add(ring, fill, hanger); g.position.set(T.x, world.groundAt(T.x, T.z, 2).h, T.z); scene.add(g)
  return { g, ring, fill, hanger }
})
const shopSigns = (() => {
  const list = []
  for (const o of world.colliders) {
    if (!['konbini', 'cleaner', 'tailor'].includes(o.look)) continue
    const c = document.createElement('canvas'); c.width = 512; c.height = 128
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace
    const H = o.look === 'tailor' ? 1.5 : 0.9, W = Math.min(o.hl * 2 - 1, H * 4)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.3 }))
    const nx = o.nx || 1
    m.position.set(o.cx + nx * (o.hw + 0.09), o.look === 'tailor' ? o.y1 - 1.2 : o.y1 - 0.62, o.cz); m.rotation.y = nx > 0 ? Math.PI / 2 : -Math.PI / 2
    scene.add(m)
    const ti = COM.tailors.findIndex(T => Math.abs(T.z - o.cz) < 14 && Math.abs(T.x - o.cx) < 20)
    list.push({ o, c, tx, ti })
  }
  // 商店街の紳士服の店（アーケードの中、西側の店の1階）
  for (const T of COM.tailors) {
    if (list.some(q => q.ti >= 0 && COM.tailors[q.ti] === T)) continue
    const c = document.createElement('canvas'); c.width = 512; c.height = 128
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.3 }))
    m.position.set(-5.4, 3.3, T.z); m.rotation.y = Math.PI / 2; scene.add(m)
    list.push({ o: { look: 'tailor' }, c, tx, ti: COM.tailors.indexOf(T) })
  }
  function redraw() {
    for (const q of list) {
      const x = q.c.getContext('2d'), L = q.o.look
      const name = L === 'tailor' ? t('tailorName')[q.ti >= 0 ? COM.tailors[q.ti].name : 0] : L === 'konbini' ? t('konbiniName') : t('cleanerName')
      x.fillStyle = L === 'tailor' ? '#1b2233' : L === 'cleaner' ? '#2d6fb8' : '#f6f6f2'; x.fillRect(0, 0, 512, 128)
      x.fillStyle = L === 'tailor' ? '#e7cf8a' : L === 'cleaner' ? '#fff' : '#2f7a4a'
      x.font = `900 ${lang === 'ja' ? 76 : 64}px "M PLUS 1p", "BIZ UDPGothic", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'
      let px = lang === 'ja' ? 76 : 64; while (x.measureText(name).width > 480 && px > 30) { px -= 4; x.font = `900 ${px}px "M PLUS 1p", "BIZ UDPGothic", sans-serif` }
      x.fillText(name, 256, 68); q.tx.needsUpdate = true
    }
  }
  return { redraw }
})()

// ---------------------------------------------------------------- 状態
let mode = 'title', autoBot = null, snapAt = null
const newsCam = new THREE.PerspectiveCamera(46, 1, 0.3, 2400)
let me = null, run = null, model = null, demo = null
let paused = false, dbgPause = false, photo = null, photoScore = -1, snapIn = -1, snapScore = 0
let hitStop = 0, fovKick = 0, flashA = 0, redA = 0, slowT = 0
let tut = store.get('met.tut') !== '1', tutWarn = false, tutNear = false, hintAt = 0, senpaiFly = null, heliSaid = false
const cam = { hd: -Math.PI / 2, pitch: 0.15, userT: -1e9, pos: new THREE.Vector3(), off: new THREE.Vector3(-6, 3, 0), look: new THREE.Vector3(), lookOff: new THREE.Vector3(), fov: 64 }
const _v = new THREE.Vector3(), _w = new THREE.Vector3()
function spawnRunner(id) { return createRunner({ id, spawn: { x: COM.home.x, y: 0, z: COM.home.z, yaw: COM.home.yaw } }) }
function newModel() { const sn = model && model.suit || 0; if (model) { scene.remove(model.group); model.dispose() } model = charAssets.ready ? new CharRunnerModel() : new RunnerModel(); scene.add(model.group); if (model.setSuit && mode === 'play' && run) model.setSuit(run.suit); else if (model.setSuit) model.setSuit(0); return model }
loadCharAssets().then(() => { if (charAssets.ready && model && !(model instanceof CharRunnerModel)) newModel() })
function clearFires() { for (const o of world.colliders) if (o.burning) o.burning = 0 }

// ---------------------------------------------------------------- 入力
const keys = new Set()
const press = { jump: false }
let pendingWire = null
addEventListener('keydown', e => {
  if (mode !== 'play' || e.repeat) return
  keys.add(e.code)
  if (e.code === 'KeyE') pendingWire = { at: null, key: true }
  if (e.code === 'Space') { press.jump = true; e.preventDefault() }
  if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused)
})
addEventListener('keyup', e => keys.delete(e.code))
const gest = new Map()
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
renderer.domElement.addEventListener('pointerdown', e => {
  Snd.init()
  if (mode !== 'play' || paused) return
  gest.set(e.pointerId, { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false })
})
addEventListener('pointermove', e => {
  const g = gest.get(e.pointerId); if (!g) return
  const dx = e.clientX - g.lx, dy = e.clientY - g.ly; g.lx = e.clientX; g.ly = e.clientY
  if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) g.moved = true
  if (!g.moved) return
  cam.hd -= dx * 0.00792; cam.pitch = Math.max(-0.35, Math.min(1, cam.pitch + dy * 0.00528)); cam.userT = performance.now()   // 見回す感度は空中出前の最新と同じ（2026-11-05 本人「ほんの少しだけ上げて」）
})
addEventListener('pointerup', e => {
  const g = gest.get(e.pointerId); if (!g) return
  gest.delete(e.pointerId)
  if (!g.moved && performance.now() - g.t < 450 && mode === 'play' && !paused) aimAt(e.clientX, e.clientY)
})
addEventListener('pointercancel', e => gest.delete(e.pointerId))
function aimAt(cx, cy) {
  const rc = renderer.domElement.getBoundingClientRect()
  ndc.set((cx - rc.left) / rc.width * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const o = ray.ray.origin, d = ray.ray.direction
  const b = me && me.rope ? null : rayHit(world, o.x, o.y, o.z, d.x, d.y, d.z, 400, me ? Math.max(0, (me.x - o.x) * d.x + (me.y + 1 - o.y) * d.y + (me.z - o.z) * d.z - 1) : 0)
  let at = b
  // 地面ワイヤー: 空中にいて、画面の地面をちゃんとタップした時だけ（建物にも当たる時は建物）
  if (me && !me.rope && !me.grounded && !me.climbing) {
    const g = groundRay(o, d, RUN.wireRange + 60)
    const tb = b ? Math.hypot(b.x - o.x, b.y - o.y, b.z - o.z) : Infinity
    if (g && !(tb < g.t + 6)) at = { x: g.x, y: g.y, z: g.z, ground: true }
  }
  pendingWire = { at, sx: cx, sy: cy }
}
function groundRay(o, d, maxT) {
  const below = t => { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; return y <= floorAt(world, x, z, y).h }
  for (let t = 1; t < maxT; t += 1) {
    if (!below(t)) continue
    let a = t - 1, b2 = t
    for (let i = 0; i < 6; i++) { const m = (a + b2) / 2; if (below(m)) b2 = m; else a = m }
    const x = o.x + d.x * b2, z = o.z + d.z * b2
    return { x, y: floorAt(world, x, z, o.y + d.y * b2 + 0.5).h, z, t: b2 }
  }
  return null
}
const stick = { x: 0, y: 0, id: null }
{
  const el = $('stick'), knob = el.querySelector('.knob')
  const ctr = () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 } }
  const upd = e => {
    const c = ctr()
    let dx = (e.clientX - c.x) / c.R, dy = (e.clientY - c.y) / c.R
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l }
    stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`
  }
  const grab = e => { stick.id = e.pointerId; el.classList.add('held'); upd(e) }
  el.addEventListener('pointerdown', e => { Snd.init(); if (stick.id != null) return; e.preventDefault(); e.stopPropagation(); grab(e) })
  addEventListener('pointermove', e => {
    if (e.pointerId === stick.id) { upd(e); return }
    if (stick.id == null && gest.has(e.pointerId)) { const c = ctr(); if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < c.R) { gest.delete(e.pointerId); grab(e) } }
  }, true)
  const end = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; el.classList.remove('held') }
  addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true)
  window.__stickCenter = () => ctr()
  for (const b of document.querySelectorAll('.tbtn')) b.addEventListener('pointerdown', e => {
    e.preventDefault(); Snd.init()
    if (b.dataset.k === 'wire') pendingWire = { at: null, key: true }
    else press[b.dataset.k] = true
  })
}
function screenBasis() { const e = camera.matrixWorld.elements; let rx = e[0], rz = e[2], fx = -e[8], fz = -e[10]; const a = Math.hypot(rx, rz) || 1, b = Math.hypot(fx, fz) || 1; return { r: { x: rx / a, z: rz / a }, f: { x: fx / b, z: fz / b } } }
function gather() {
  let thr = 0, brk = 0, steer = 0, wallY = null, wallX = null
  if (keys.has('KeyW') || keys.has('ArrowUp')) thr = 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) brk = 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1
  const B = screenBasis(), SR = B.r, SF = B.f
  let moveDir = null
  if (stick.id != null) {
    const mag = Math.min(1, Math.hypot(stick.x, stick.y))
    if (mag > 0.15) {
      const dx = SR.x * stick.x - SF.x * stick.y, dz = SR.z * stick.x - SF.z * stick.y, l = Math.hypot(dx, dz) || 1
      moveDir = { x: dx / l, z: dz / l }; steer = 0; thr = Math.max(thr, Math.min(1, mag * 1.3))
    }
    if (me.climbing) {
      const cl = me.climbing, sideSign = SR.x * cl.nz - SR.z * cl.nx >= 0 ? 1 : -1
      wallY = Math.abs(stick.y) > 0.25 ? -stick.y : 0; wallX = Math.abs(stick.x) > 0.25 ? stick.x * sideSign : 0
    }
  }
  const inp = { throttle: thr, brake: brk, steer, jump: press.jump, wire: false, wallY, wallX, moveDir }
  inp.wireYaw = moveDir ? Math.atan2(moveDir.x, moveDir.z) : touchMode ? Math.atan2(SF.x, SF.z) : undefined
  if (pendingWire) { inp.wire = true; if (pendingWire.at) inp.wireAt = pendingWire.at; me._tap = pendingWire; pendingWire = null }
  press.jump = false
  return inp
}

// ---------------------------------------------------------------- 画面の切り替え
function show(id) { for (const s of ['title', 'how', 'pause', 'result']) $(s).classList.toggle('hidden', s !== id); $('hud').classList.toggle('hidden', mode !== 'play') }
function resetScene() { clearFires(); senpaiFly = null; for (const p of [kohai, senpai, bossP]) p.group.visible = false; senpaiRock.visible = false; police.st = null; police.car.group.visible = false; for (const o of police.offs) o.group.visible = false; setSuitHud(0); document.body.classList.remove('chased') }
function toTitle() {
  mode = 'title'; paused = false; me = null; run = null; resetScene()
  const s = Math.floor(Math.random() * 1000)
  demo = { r: spawnRunner('demo'), b: createBot('skilled', s), run: createRun(world, s, { rare: 'none' }) }
  street = createStreet(world, s); panic(street)
  newModel()
  show('title'); $('touch').classList.add('hidden')
  Snd.loop('bgm', 'snd/bgm_title.mp3', 0.2); Snd.loop('amb', 'snd/city_street_loop.wav', 0.2); Snd.loop('siren', 'snd/siren.mp3', 0.05); Snd.loop('heli', null); Snd.loop('crowd', null); Snd.loop('wind', null)
}
// 通行人は逃げ惑う（走る速さ）
function panic(st) { for (const p of st.peds) p.speed = 3.2 + (p.id % 5) * 0.4 }
function startRun(seed = Math.floor(Math.random() * 1e6), opt = {}) {
  Snd.init(); sfx('click')
  if (window.TM) TM.start()
  mode = 'play'; paused = false; demo = null; photo = null; photoScore = -1; snapIn = -1; resetScene()
  me = spawnRunner('me'); run = createRun(world, seed, opt); run.seed = seed; street = createStreet(world, seed); panic(street)
  newModel()
  cam.hd = COM.home.yaw; cam.pitch = 0.3; cam.userT = -1e9
  show(null); $('touch').classList.toggle('hidden', !touchMode)
  Snd.loop('bgm', 'snd/bgm_play.mp3', 0.16); Snd.loop('amb', 'snd/city_street_loop.wav', 0.22); Snd.loop('wind', 'snd/wind_loop.wav', 0.0001)
  Snd.loop('siren', 'snd/siren.mp3', 0.06); Snd.loop('crowd', 'snd/crowd.mp3', 0.1); Snd.loop('heli', 'snd/heli.mp3', 0.0001)
  sfx('ring', { vol: 0.7 }); sfx('ring', { vol: 0.7, delay: 0.45 })
  say(t('call') + t('callStart'), 2.8)
  hintAt = 3.4; tutWarn = false; tutNear = false; heliSaid = false
  window.__runSeed = seed
}
function setPause(p) { if (mode !== 'play') return; paused = p; $('pause').classList.toggle('hidden', !p) }

// ---------------------------------------------------------------- 画面の文字
let sayT = 0
function say(html, sec = 1.8) { const el = $('say'); el.innerHTML = html; sayT = sec; el.classList.remove('hidden') }
let nearT = 0
function nearPop(txt, n) { const el = $('near'); $('nearTxt').textContent = txt; $('nearN').textContent = n >= 2 ? t('chain')(n) : ''; el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop'); nearT = 1.0 }
// スーツの小さな絵（腕時計の横）。体の上の絵と同じ段階
function setSuitHud(n) { const el = $('suit'); if (!el) return; if (el._n === n) return; el._n = n; el.setAttribute('class', 'suit s' + n); void el.getBoundingClientRect(); if (n) el.classList.add('pop') }
function updateHud(dt) {
  const c = clockSec(run), G = goalOf(run)
  const h = Math.floor(c / 3600), m = Math.floor(c / 60) % 60, s = c % 60
  const wt = $('wTime'); const txt = fmtClock(c); if (wt._t !== txt) { wt._t = txt; wt.textContent = txt }
  const late = c > DEADLINE, leftM = Math.ceil((DEADLINE - c) / 60)
  const lt = run.arrived ? '' : late ? t('lateBy')(Math.ceil((c - DEADLINE) / 60)) : t('left')(leftM)
  const wl = $('wLeft'); if (wl._t !== lt) { wl._t = lt; wl.textContent = lt; $('watch').classList.toggle('late', late); $('watch').classList.toggle('hurry', !late && leftM <= 2) }
  const mA = (m + s / 60) / 60 * Math.PI * 2, hA = ((h % 12) + m / 60) / 12 * Math.PI * 2
  $('wMin').setAttribute('d', `M32 32 L${(32 + Math.sin(mA) * 22).toFixed(1)} ${(32 - Math.cos(mA) * 22).toFixed(1)}`)
  $('wHour').setAttribute('d', `M32 32 L${(32 + Math.sin(hA) * 14).toFixed(1)} ${(32 - Math.cos(hA) * 14).toFixed(1)}`)
  // 9:00 までの残り（分針から12時まで）を赤い扇で
  if (!late) { const ex = 32 + Math.sin(mA) * 26, ey = 32 - Math.cos(mA) * 26, big = (Math.PI * 2 - mA) > Math.PI ? 1 : 0; $('wDeadline').setAttribute('d', `M32 32 L${ex.toFixed(1)} ${ey.toFixed(1)} A26 26 0 ${big} 1 32 6 Z`) }
  else $('wDeadline').setAttribute('d', 'M32 32 Z')
  const gn = run.leg === 0 ? t('toStation') : t('toOffice'); if ($('gName')._t !== gn) { $('gName')._t = gn; $('gName').textContent = gn }
  $('gDist').textContent = Math.round(Math.hypot(G.x - me.x, G.z - me.z)) + 'm'
  if (sayT > 0) { sayT -= dt; if (sayT <= 0) $('say').classList.add('hidden') }
  if (nearT > 0) { nearT -= dt; if (nearT <= 0) $('near').classList.add('hidden') }
  const ar = $('arrow'); ar.classList.remove('hidden')
  ar.querySelector('svg').style.transform = `rotate(${compassAng(G.x, G.z)}rad)`
  updateDangers()
}
function compassAng(gx, gz) {
  camera.updateMatrixWorld()
  const e = camera.matrixWorld.elements, fx = -e[8], fz = -e[10], rx = -fz, rz = fx
  const dx = gx - me.x, dz = gz - me.z
  return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)
}
// 画面の外（後ろ・横）に落ちてくる隕石を、画面のふちの赤い印で知らせる
const dangerEls = []
for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'danger hidden'; d.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3 L22 20 H2 Z"/><path d="M12 9 V14 M12 16.5 V17.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>'; $('dangers').appendChild(d); dangerEls.push(d) }
function updateDangers() {
  const list = []
  for (const m of run.sky.falling) {
    if (m.kind === 'office' || m.kind === 'boss') continue
    const d = Math.hypot(m.x - me.x, m.z - me.z); if (d > m.r + 45 || m.tLeft > 2.3) continue
    _v.set(m.x, m.y, m.z).project(camera)
    const on = _v.z < 1 && Math.abs(_v.x) < 0.92 && Math.abs(_v.y) < 0.92
    if (!on) list.push({ m, d })
  }
  list.sort((a, b) => a.m.tLeft - b.m.tLeft)
  const W = innerWidth, H = innerHeight
  dangerEls.forEach((el, i) => {
    const q = list[i]; if (!q) { el.classList.add('hidden'); return }
    const a = compassAng(q.m.x, q.m.z), sx = Math.sin(a), sy = -Math.cos(a)
    const k = Math.min((W / 2 - 34) / Math.max(1e-3, Math.abs(sx)), (H / 2 - 34) / Math.max(1e-3, Math.abs(sy)))
    el.style.left = (W / 2 + sx * k) + 'px'; el.style.top = (H / 2 + sy * k) + 'px'
    el.classList.remove('hidden'); el.classList.toggle('soon', q.m.tLeft < 1)
  })
}

// ---------------------------------------------------------------- 出来事
const log = []
const near3 = (x, z) => me ? Math.max(0, 1 - Math.hypot(x - me.x, z - me.z) / 110) : 0.3
function onRunnerEvent(e) {
  log.push({ src: 'r', ...e, at: run ? +run.t.toFixed(2) : 0 })
  if (e.t === 'wire') { sfx('wire', { vol: 0.7 }); sfx('hook', { vol: 0.5, delay: 0.06 }) }
  else if (e.t === 'wireMiss') {
    sfx('wire', { vol: 0.4, rate: 1.3 })
    const tp = me._tap
    if ((e.far || e.burning) && tp && tp.sx != null) { const el = $('miss'); $('missTxt').textContent = e.burning ? t('burning') : t('tooFar'); el.style.left = tp.sx + 'px'; el.style.top = tp.sy + 'px'; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 800) }
    if (e.burning) run.sky.stats.burnedWire++
  }
  else if (e.t === 'land') { sfx('land', { vol: Math.min(1, 0.3 + e.impact / 20) }); if (e.impact > 14) { sfx('bonk', { vol: 0.5 }); fx.addShake(Math.min(0.6, e.impact / 40)) } }
  else if (e.t === 'bonk') { sfx('bonk', { vol: 0.8 }); fx.addShake(0.4) }
  else if (e.t === 'unwire' && !e.auto) { const v = Math.hypot(me.vx, me.vy, me.vz); if (v > 16) { sfx('whoosh', { vol: Math.min(0.8, v / 50), rate: 0.9 + Math.random() * 0.2 }); fovKick = Math.min(6, (v - 16) * 0.3) } }
  else if (e.t === 'ped' || e.t === 'car') { sfx('bonk', { vol: 0.7 }); fx.addShake(0.4) }
}
function onSkyEvent(e, live) {
  if (live) log.push({ src: 'k', t: e.t, kind: e.kind, at: run ? +run.t.toFixed(2) : 0, d: e.d != null ? +e.d.toFixed(1) : undefined, chain: e.chain })
  const nv = near3(e.x, e.z)
  if (e.t === 'warn') { if (live && nv > 0.2) sfx('incoming', { vol: 0.25 + nv * 0.5, rate: 1.6, offset: 0.4 }); if (live && e.big) sfx('rumble', { vol: 0.35 * nv }) ; if (live && tut && !tutWarn) { tutWarn = true; say(t('hintWarn'), 2.4) } }
  else if (e.t === 'impact') {
    view.impact(e, camera.position)
    if (nv > 0) { sfx('boom', { vol: Math.min(1, 0.25 + nv), rate: e.big ? 0.75 : 0.9 + Math.random() * 0.2 }); sfx('rock', { vol: 0.6 * nv, delay: 0.05 }); if (e.big) sfx('rumble', { vol: 0.6 * nv }) }
    fx.addShake(Math.min(1.4, nv * nv * (e.big ? 1.8 : 1.2)))
    if (live && nv > 0.55 && Math.random() < 0.4) sfx('scream', { vol: 0.35, delay: 0.15 })
    if (live && e.d < e.r + SKY.nearBand + 6) { snapIn = 3; snapAt = { x: e.x, y: e.y, z: e.z }; snapScore = e.d < e.r ? 60 : 90 }   // 近くに落ちた瞬間は結果の紙の写真（中継のヘリから撮った絵）の候補
  }
  else if (e.t === 'blast') { hitStop = 0.09; redA = 0.85; fx.addShake(1.2); sfx('grunt', { vol: 0.9 }); const L = t('blast'); say(L[run.sky.stats.hits % L.length], 1.6); fovKick = 9 }
  else if (e.t === 'faceplant') { sfx('bonk', { vol: 0.9, rate: 0.8 }); fx.dust(e.x, 0, e.z, 6, [0.5, 0.46, 0.42], 1) }
  else if (e.t === 'near') {
    // ギリギリ回避: ほんの一瞬だけ少し遅く（0.7倍・0.13秒）・光・視野が広がる・風を切る。止めない（v3 本人「止まる時間長い。もっと避けていく感じがほしい」。v2 は 0.3倍を 0.42秒＋0.03秒止め）
    // つないでいる間はスローを入れず、光と加速と音だけで流す
    if (e.chain <= 1) slowT = e.src === 'big' ? 0.16 : 0.13
    flashA = Math.max(flashA, 0.55); fovKick = -6 - Math.min(5, e.chain * 1.2)
    if (me) { const k = 0.45; fx.sparks(me.x + (e.x - me.x) * k, me.y + 1, me.z + (e.z - me.z) * k, 18, null, 12); fx.dust(me.x + (e.x - me.x) * 0.6, 0, me.z + (e.z - me.z) * 0.6, 4, [0.55, 0.48, 0.4], 1.2) }   // 爆風がすぐ横を抜ける
    sfx('whoosh', { vol: 0.9, rate: 0.8 }); sfx('ding', { vol: 0.35 + Math.min(0.4, e.chain * 0.08), rate: 1 + Math.min(0.5, (e.chain - 1) * 0.08) })
    nearPop(e.src === 'big' ? t('nearBig') : e.src === 'roll' ? t('nearRoll') : t('near'), e.chain)
    if (tut && !tutNear) { tutNear = true; say(t('hintNear'), 2.2); store.set('met.tut', '1'); tut = false }
    snapScore = Math.max(snapScore, 100 + e.chain * 10)
  }
  else if (e.t === 'hot') { sfx('grunt', { vol: 0.6, rate: 1.3 }); say(t('hot'), 0.9) }
  else if (e.t === 'shower') { if (live) say(t('shower'), 2.2); sfx('rumble', { vol: 0.5 }) }
  else if (e.t === 'roll') { sfx('rockfall', { vol: 0.5 * nv }); if (e.rider && live) say(t('riderRoll'), 2.2) }
  else if (e.t === 'rollHit') { hitStop = 0.07; redA = 0.7; fx.addShake(0.9); sfx('bonk', { vol: 1 }); sfx('grunt', { vol: 0.8 }) }
  else if (e.t === 'rollBonk') { sfx('rock', { vol: 0.4 * nv }); fx.addShake(0.25 * nv) }
}
function onRunEvent(e) {
  log.push({ src: 'c', ...e, at: +run.t.toFixed(2) })
  if (e.t === 'station') { sfx('ring', { vol: 0.7 }); sfx('ring', { vol: 0.7, delay: 0.45 }); say(t('call') + t('callStation'), 2.6) }
  else if (e.t === 'call58') { sfx('ring', { vol: 0.7 }); say(t('call') + t('call58'), 2.2) }
  else if (e.t === 'nine') { sfx('ring', { vol: 0.8 }); say(t('call') + t('callNine'), 2.4); redA = 0.4 }
  else if (e.t === 'riderWarn') say(t('riderWarn'), 2)
  else if (e.t === 'officeWarn') { say(t('officeWarn'), 2.6); sfx('rumble', { vol: 0.9 }) }
  else if (e.t === 'officeHit') { say(t('officeHit'), 3); flashA = 1; fx.addShake(1.6); snapIn = 3; snapScore = 999 }
  else if (e.t === 'arrive') { sfx('ding', { vol: 0.9 }); say(e.late ? t('arriveLate') : t('arrive'), 2.2); flashA = 0.6; fovKick = -6 }
  else if (e.t === 'bossLand') { setTimeout(() => say(t('bossLand'), 2.6), 400); snapIn = 8; snapScore = 999 }
  else if (e.t === 'absent') say(t('absent'), 2)
  else if (e.t === 'suit') {
    // スーツが1段燃えた: 体の絵を替え、煙と火の粉。パンツ一丁になったら警察が追ってくる
    if (model.setSuit) model.setSuit(e.n)
    setSuitHud(e.n)
    setTimeout(() => { if (mode === 'play') say(t('suitSay')[e.n], 1.8) }, 650)
    fx.sparks(me.x, me.y + 1.1, me.z, 26, null, 9)
    if (e.n >= 4) { document.body.classList.add('chased'); Snd.loop('siren', 'snd/siren.mp3', 0.22); setTimeout(() => { if (mode === 'play' && !run.arrest) say(t('police'), 2.6) }, 2600) }
  }
  else if (e.t === 'tailor') {
    if (model.setSuit) model.setSuit(e.n)
    setSuitHud(e.n); say(t('tailorSay'), 2.2); sfx('ding', { vol: 0.9 }); sfx('click', { vol: 0.6, delay: 0.1 }); flashA = 0.7
    fx.sparks(me.x, me.y + 1, me.z, 20, null, 6)
    if (e.n < 4) { document.body.classList.remove('chased'); Snd.loop('siren', 'snd/siren.mp3', 0.06) }
  }
  else if (e.t === 'arrest') {
    // パンツ一丁で5回目: 警察に確保される（結果は「警察署からのお知らせ」）
    if (model.setSuit) model.setSuit(4)
    setSuitHud(5); document.body.classList.add('chased')
    Snd.loop('siren', 'snd/siren.mp3', 0.4); Snd.loop('bgm', null)
    startArrest()
  }
  else if (e.t === 'end') showResult()
}

// ---------------------------------------------------------------- 確保の場面（v3）
// パトカーが横から入ってきて止まり、警官が2人走ってきて両脇に立つ。自分は起き上がって両手を挙げる。カメラはゆっくり回る
function startArrest() {
  const a = Math.atan2(me.vx || Math.sin(me.yaw), me.vz || Math.cos(me.yaw)) + Math.PI / 2
  police.st = { t: 0, a, said: false, said2: false, shot: false }
  me.yaw = a + Math.PI   // パトカーに背を向けて、カメラの方を向く
  police.car.group.visible = true
  for (const o of police.offs) o.group.visible = true
  $('touch').classList.add('hidden')
  police.st.px = me.x + Math.sin(a) * 7; police.st.pz = me.z + Math.cos(a) * 7   // パトカーが止まる所（その近くの車は描かない）
}
function arrestTick(dt) {
  const P = police.st; if (!P || !me) return
  P.t += dt
  const fx_ = Math.sin(P.a), fz_ = Math.cos(P.a)
  // パトカー: 自分の横 7m の所へ、45m 先から 1.4 秒で滑り込む
  const k = Math.min(1, P.t / 1.4), ease = 1 - Math.pow(1 - k, 3), dd = 7 + (1 - ease) * 38
  const cx = me.x + fx_ * dd, cz = me.z + fz_ * dd, cy = world.groundAt(cx, cz, me.y + 2).h
  police.car.update({ x: cx, y: cy, z: cz, yaw: P.a + Math.PI / 2, pitch: 0, roll: 0, vx: (1 - k) * 25 * -fx_, vz: (1 - k) * 25 * -fz_, grounded: true }, dt, { braking: k < 1 })
  police.red.emissiveIntensity = Math.floor(P.t * 6) % 2 ? 3 : 0.3
  // 警官: 車から走ってきて、自分の左右 1.1m に立つ
  police.offs.forEach((o, i) => {
    const side = i ? 1 : -1, k2 = Math.max(0, Math.min(1, (P.t - 1.5) / 1.3))
    const sx = cx - fz_ * side * 1.2, sz = cz + fx_ * side * 1.2
    const tx = me.x + Math.cos(P.a) * side * 1.15, tz = me.z - Math.sin(P.a) * side * 1.15
    const x = sx + (tx - sx) * k2, z = sz + (tz - sz) * k2
    o.group.position.set(x, world.groundAt(x, z, me.y + 2).h, z)
    o.group.rotation.y = k2 < 1 ? Math.atan2(tx - sx, tz - sz) : Math.atan2(me.x - x, me.z - z)
    o.group.visible = P.t > 1.4
    o.update(dt, k2 > 0 && k2 < 1)
  })
  if (model) model.handsUp = P.t > 2.4 && me.grounded && !(me.wreck > 0)
  if (P.t > 2.4) { me.yaw = P.a + Math.PI; me.stun = 0 }
  window.__arrestDbg = { t: P.t, hands: model && model.handsUp, wreck: me.wreck, g: me.grounded }
  if (P.t > 2.4 && me.wreck > 0) me.wreck = 0   // 倒れていても、警官が来たら起き上がる
  if (!P.said && P.t > 2.5) { P.said = true; say(t('arrestSay'), 1.6); sfx('ding', { vol: 0.4, rate: 0.6 }); fx.addShake(0.3) }
  if (!P.said2 && P.t > 3.9) { P.said2 = true; say(t('arrestSay2'), 1.6) }
  if (!P.shot && P.t > 3.6) { P.shot = true; photo = arrestShot(); photoScore = 1e9 }
}
// 確保の間のカメラ: パトカーと反対側の斜め上から、自分・警官・パトカーが1枚に入るように。ゆっくり横へ回る
function arrestCamera(dt) {
  const P = police.st, a = P.a + Math.PI + 0.55 + P.t * 0.06
  const lx = me.x + Math.sin(P.a) * 2.6, lz = me.z + Math.cos(P.a) * 2.6
  _w.set(me.x + Math.sin(a) * 6, me.y + 3, me.z + Math.cos(a) * 6)
  if (!P.cam) P.cam = camera.position.clone()
  P.cam.lerp(_w, 1 - Math.exp(-dt * 3))
  camera.position.copy(P.cam)
  if (fx.shake > 0) camera.position.add(_v.set((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake * 0.7, (Math.random() - 0.5) * fx.shake))
  camera.lookAt(lx, me.y + 1.0, lz)
  const asp = camera.aspect, base = asp >= 1 ? 55 : Math.min(80, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(33)) / asp) * 180 / Math.PI)
  camera.fov = base; camera.updateProjectionMatrix()
}
// 確保の写真（結果の紙）: 斜め上から、自分と警官とパトカーが入るように
function arrestShot() {
  const c2 = document.createElement('canvas'); c2.width = 720; c2.height = 450
  const P = police.st, a = P.a + 0.9
  newsCam.aspect = 720 / 450; newsCam.updateProjectionMatrix()
  newsCam.position.set(me.x - Math.sin(a) * 9.5, me.y + 4.2, me.z - Math.cos(a) * 9.5)
  newsCam.lookAt(me.x + Math.sin(P.a) * 2.5, me.y + 1.1, me.z + Math.cos(P.a) * 2.5)
  const sz = renderer.getSize(new THREE.Vector2())
  renderer.setSize(720, 450, false); renderer.render(scene, newsCam)
  c2.getContext('2d').drawImage(renderer.domElement, 0, 0, 720, 450)
  renderer.setSize(sz.x, sz.y, false); renderer.render(scene, camera)
  return c2
}

// ---------------------------------------------------------------- 結果
function showResult() {
  mode = 'result'
  document.body.classList.remove('chased'); if (model) model.handsUp = false
  Snd.loop('wind', null); Snd.loop('bgm', null); Snd.loop('heli', null); Snd.loop('crowd', null)
  const v = verdict(run), L = T[lang], ja = lang === 'ja'
  const st = v.pardon && v.status !== 'dayoff' ? 'pardon' : v.status
  const C = L.comments
  const comment = v.status === 'dayoff' ? C.dayoff : st === 'pardon' ? C.pardon : v.status === 'absent' ? C.absent : v.status === 'early' ? C.early
    : v.status === 'ontime' ? (v.near >= 8 ? C.ontimeNear : C.ontime) : v.status === 'verylate' ? C.verylate : v.hits >= 3 ? C.lateHits : v.near >= 8 ? C.lateNear : C.late
  const d0 = new Date()
  const late = v.status === 'late' || v.status === 'verylate'
  const arrive = v.status === 'dayoff' ? (ja ? '休み' : 'Off') : v.arr == null ? (ja ? '来ず' : '—') : fmtClock(v.arr)
  const sub = v.status === 'early' ? L.sub.early(Math.floor((DEADLINE - v.arr) / 60)) : v.status === 'ontime' ? L.sub.ontime() : late ? L.sub[v.status](v.lateMin) : ''
  if (v.status === 'arrest') return showArrestResult(v, L, ja)
  const d = {
    title: L.titles[v.status], titleColor: late || v.status === 'absent' ? '#c8321e' : '#1b2233',
    lab: { ...L.lab, reason: late || v.status === 'absent' ? L.lab.reason : L.lab.reasonOk }, date: `${d0.getFullYear()}.${String(d0.getMonth() + 1).padStart(2, '0')}.${String(d0.getDate()).padStart(2, '0')}`, name: L.you,
    photo, caption: L.caption(v), arrive, sub, late,
    reasons: v.excuses.map(x => ({ text: L.reasons[x.k], n: x.n })),
    stats: [[L.statL[0], String(v.near), false, L.unit[0]], [L.statL[1], String(v.bestChain), false, L.unit[1]], [L.statL[2], String(v.hits), v.hits > 0, L.unit[2]]],
    comment, stamp: L.stamps[st], stampColor: st === 'pardon' || v.status === 'dayoff' ? '#1d4f9c' : '#c8321e',
    footer: 'tom3games.github.io/meteor-commute'
  }
  if (!d.photo) d.photo = newsShot(null)   // 写真が撮れていない（すぐ終わった）時は今の自分
  drawCard($('slip'), d)
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => mode === 'result' && drawCard($('slip'), d))
  const good = v.status === 'early' || v.status === 'ontime' || v.status === 'dayoff' || st === 'pardon'
  sfx(good ? 'win' : late ? 'meh' : 'lose', { vol: 0.8 })
  const head = `${L.titles[v.status]}「${L.stamps[st]}」 ${arrive}`
  $('btnPost').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(L.postText(v, head)) + '&url=' + encodeURIComponent(URL_) + '&hashtags=' + encodeURIComponent(ja ? '隕石の日でも出社する' : 'MeteorCommute')
  $('touch').classList.add('hidden')
  show('result')
  window.__lastVerdict = { ...v, stamp: L.stamps[st], title: L.titles[v.status], comment }
  if (window.TM) TM.end(v.score, good)
}
function showArrestResult(v, L, ja) {
  const d0 = new Date(), A = v.arrest
  const d = {
    title: L.arrestTitle, titleColor: '#1d4f9c',
    lab: { ...L.lab, arrive: L.arrestLab, reason: L.lab.reason }, date: `${d0.getFullYear()}.${String(d0.getMonth() + 1).padStart(2, '0')}.${String(d0.getDate()).padStart(2, '0')}`, name: L.you,
    photo: photo || newsShot(null), caption: L.arrestCaption, arrive: fmtClock(A.clock), sub: L.arrestPlace[A.z < 300 ? 0 : A.z < 548 ? 1 : A.z < 700 ? 2 : A.z < 845 ? 3 : A.z < 1405 ? 4 : 5] || '', late: true,
    reasons: [{ text: L.arrestReasons[0], n: 0 }, { text: L.arrestReasons[1](v.hits), n: 0 }, { text: L.arrestReasons[2], n: 0 }],
    stats: [[L.statL[0], String(v.near), false, L.unit[0]], [L.statL[1], String(v.bestChain), false, L.unit[1]], [L.statL3, String(v.hits), true, L.unit[2]]],
    comment: L.arrestComment, stamp: L.arrestStamp, stampColor: '#1d4f9c', footer: 'tom3games.github.io/meteor-commute'
  }
  drawCard($('slip'), d)
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => mode === 'result' && drawCard($('slip'), d))
  sfx('lose', { vol: 0.8 })
  const head = `${L.arrestTitle}「${L.arrestStamp}」 ${d.arrive}`
  $('btnPost').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(L.postText(v, head)) + '&url=' + encodeURIComponent(URL_) + '&hashtags=' + encodeURIComponent(ja ? '隕石の日でも出社する' : 'MeteorCommute')
  $('touch').classList.add('hidden')
  show('result')
  window.__lastVerdict = { ...v, stamp: L.arrestStamp, title: L.arrestTitle, comment: L.arrestComment }
  if (window.TM) TM.end(0, false)
}
$('btnPost').addEventListener('click', () => { if (window.TM) TM.share('x') })
$('btnSave').onclick = () => { if (window.TM) TM.share('save'); $('slip').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'meteor-commute.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }) }
$('btnStart').onclick = () => startRun()
$('btnAgain').onclick = () => startRun()
$('btnTitle').onclick = () => toTitle()
$('btnHow').onclick = () => { Snd.init(); show('how') }
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => show('title')
$('btnLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('met.lang', lang); applyLang() }
$('btnMute').onclick = () => { Snd.init(); Snd.setMute(!Snd.muted); store.set('met.mute', Snd.muted ? '1' : '0'); applyLang() }
$('btnPause').onclick = () => setPause(true)
$('btnResume').onclick = () => setPause(false)
$('btnQuit').onclick = () => { setPause(false); toTitle() }

// ---------------------------------------------------------------- カメラ（空中出前と同じ追いかけ視点）
const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k }
function updateCamera(dt, c) {
  if (window.__freeze) return
  if (police.st && mode === 'play' && me && c === me) { arrestCamera(dt); return }
  const pos = model.group.position
  const v = Math.hypot(c.vx, c.vz)
  let hx = Math.sin(c.yaw), hz = Math.cos(c.yaw)
  if (v > 8) { const k = c.grounded ? 0.25 : 0.45; hx = hx * (1 - k) + (c.vx / v) * k; hz = hz * (1 - k) + (c.vz / v) * k; const l = Math.hypot(hx, hz); hx /= l; hz /= l }
  const manual = (touchMode && mode === 'play') || performance.now() - cam.userT < 1800
  if (!manual) { cam.hd = lerpAngle(cam.hd, Math.atan2(hx, hz), 1 - Math.exp(-dt * (touchMode ? 2.2 : 5))); cam.pitch += (0.3 - cam.pitch) * (1 - Math.exp(-dt * 1.5)) }   // 少し高めから見下ろす（地面の赤い輪が読める）
  hx = Math.sin(cam.hd); hz = Math.cos(cam.hd)
  let back = 5.2 + Math.min(2.4, v * 0.07), up = 2.1
  if (camera.aspect < 1) { back += 0.6; up += 0.5 }
  up += cam.pitch * 4.2; back *= 1 - Math.max(0, cam.pitch) * 0.15
  let tx = pos.x - hx * back, tz = pos.z - hz * back, ty = pos.y + up
  for (let i = 1; i <= 6; i++) {
    const f = i / 6, px = pos.x + (tx - pos.x) * f, pz = pos.z + (tz - pos.z) * f, py = pos.y + (ty - pos.y) * f
    let hit = false
    for (const o of world.nearby(px, pz)) {
      if (o.slab || o.kind === 'bound' || o.y0 == null || py < o.y0 || py > o.y1) continue
      const cs = Math.cos(o.yaw || 0), sn = Math.sin(o.yaw || 0), dx = px - o.cx, dz = pz - o.cz
      if (Math.abs(dx * cs - dz * sn) < o.hw + 0.4 && Math.abs(dx * sn + dz * cs) < o.hl + 0.4) { hit = true; break }
    }
    if (hit) { const ff = Math.max(0.25, (i - 1) / 6); tx = pos.x + (tx - pos.x) * ff; tz = pos.z + (tz - pos.z) * ff; ty = pos.y + up * 0.8 + (1 - ff) * 2; break }
  }
  const gy = world.groundAt(tx, tz, ty).h + 0.8
  if (ty < gy) ty = gy
  cam.off.lerp(_v.set(tx - pos.x, ty - pos.y, tz - pos.z), 1 - Math.exp(-dt * 10))
  cam.pos.set(pos.x + cam.off.x, pos.y + cam.off.y, pos.z + cam.off.z)
  cam.lookOff.lerp(_v.set(hx * 10, (camera.aspect < 1 ? 0.4 : 1.1) + 1.3 - cam.pitch * 1.2, hz * 10), 1 - Math.exp(-dt * 12))
  cam.look.set(pos.x + cam.lookOff.x, pos.y + cam.lookOff.y, pos.z + cam.lookOff.z)
  camera.position.copy(cam.pos)
  const sh_ = fx.shake
  if (sh_ > 0) camera.position.add(_v.set((Math.random() - 0.5) * sh_, (Math.random() - 0.5) * sh_ * 0.7, (Math.random() - 0.5) * sh_))
  camera.lookAt(cam.look)
  const asp = camera.aspect
  const base = asp >= 1 ? 60 : Math.min(84, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(37)) / asp) * 180 / Math.PI)
  const fov = base + Math.min(18, Math.max(0, Math.hypot(c.vx, c.vy, c.vz) - 6) * 0.5)
  cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 4))
  fovKick *= Math.exp(-dt * 6)
  camera.fov = cam.fov + fovKick; camera.updateProjectionMatrix()
  const me_ = camera.matrixWorld.elements, rl = Math.hypot(me_[0], me_[2]) || 1, lat = (c.vx * me_[0] + c.vz * me_[2]) / rl
  cam.bank = (cam.bank || 0) + (Math.max(-0.1, Math.min(0.1, (c.rope ? lat : 0) * -0.004)) - (cam.bank || 0)) * (1 - Math.exp(-dt * 3))
  camera.rotateZ(cam.bank)
}

// ---------------------------------------------------------------- ループ
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fx.setScale && fx.setScale(h) }
addEventListener('resize', resize); resize()
let last = performance.now(), acc = 0, frameN = 0
function stepOnce() {
  if (mode === 'play' && !paused && me && !run.over) {
    let inp = autoBot ? botInput(autoBot, me, run, world, STEP) : gather()   // autoBot: 撮影と検証で CPU に操作させる
    if (run.arrest) { inp = { throttle: 0, steer: 0 }; if (me.grounded && !(me.wreck > 0)) { me.vx *= 0.8; me.vz *= 0.8 } }   // 確保: 操作できない
    me.events.length = 0
    street.update(STEP, me)
    stepRunner(me, inp, STEP, world)
    street.collide(me)
    stepRun(run, me, STEP)
    for (const e of me.events) onRunnerEvent(e)
    for (const e of run.sky.events) onSkyEvent(e, true)
    run.sky.events.length = 0
    const evs = run.events.splice(0)
    for (const e of evs) onRunEvent(e)
  } else if (mode === 'title' && demo) {
    const inp = botInput(demo.b, demo.r, demo.run, world, STEP)
    demo.r.events.length = 0
    street.update(STEP, demo.r)
    stepRunner(demo.r, inp, STEP, world)
    street.collide(demo.r)
    stepRun(demo.run, demo.r, STEP)
    for (const e of demo.run.sky.events) if (e.t === 'impact') onSkyEvent(e, false)
    demo.run.sky.events.length = 0; demo.run.events.length = 0
    if (demo.run.over || demo.run.arrived) { clearFires(); const s = Math.floor(Math.random() * 1000); demo = { r: spawnRunner('demo'), b: createBot('skilled', s), run: createRun(world, s, { rare: 'none' }) } }
  }
}
function frame() {
  requestAnimationFrame(frame)
  const now = performance.now()
  let dt = Math.min(0.1, (now - last) / 1000); last = now
  // ギリギリ回避のスロー（実時間で数える）
  let scale = 1
  if (slowT > 0) { slowT -= dt; scale = 0.7 }
  if (hitStop > 0) { hitStop -= dt; acc = 0 }
  else if (!dbgPause && !paused) { acc += dt * scale; let n = 0; while (acc >= STEP && n < 6) { stepOnce(); acc -= STEP; n++ } if (n >= 6) acc = 0 }
  render(dbgPause ? 0 : dt * scale || 0.016)
}
const spd = $('speedfx'), sctx = spd.getContext('2d'), hf = $('hitflash'), rf = $('redflash')
const lines = Array.from({ length: 46 }, () => ({ a: Math.random() * Math.PI * 2, p: Math.random(), s: 0.6 + Math.random() * 0.8, w: 1 + Math.random() * 2 }))
let spdOn = false
function drawSpeed(v, dt) {
  if (!window.__holdFx) { flashA = Math.max(0, flashA - dt * 4); redA = Math.max(0, redA - dt * 2.2) }
  hf.style.opacity = flashA.toFixed(2); rf.style.opacity = redA.toFixed(2)
  const k = Math.max(0, Math.min(1, (v - 20) / 18))
  window.__speedK = k
  if (k <= 0) { if (spdOn) { sctx.clearRect(0, 0, spd.width, spd.height); spdOn = false } return }
  spdOn = true
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1)
  if (spd.width !== Math.round(W * dpr) || spd.height !== Math.round(H * dpr)) { spd.width = Math.round(W * dpr); spd.height = Math.round(H * dpr) }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H * 0.45, R = Math.hypot(W, H) * 0.55
  sctx.lineCap = 'round'
  const n = Math.round(lines.length * (0.35 + 0.65 * k))
  for (let i = 0; i < n; i++) {
    const L = lines[i]
    L.p += dt * L.s * (1.6 + k * 2.4); if (L.p > 1) { L.p -= 1; L.a = Math.random() * Math.PI * 2 }
    const r1 = R * (1.05 - L.p * 0.45), r0 = r1 - R * (0.12 + 0.2 * k) * L.s
    const ca = Math.cos(L.a), sa = Math.sin(L.a)
    sctx.strokeStyle = `rgba(255,255,255,${(0.1 + 0.32 * k) * Math.min(1, L.p * 4)})`; sctx.lineWidth = L.w
    sctx.beginPath(); sctx.moveTo(cx + ca * r0, cy + sa * r0); sctx.lineTo(cx + ca * r1, cy + sa * r1); sctx.stroke()
  }
}
function render(dt) {
  const c = mode === 'title' ? demo && demo.r : me
  const R0 = mode === 'title' ? demo && demo.run : run
  if (c && model) {
    model.update(c, dt)
    model.okamochi.visible = true
    if (c.rope) { const h = model.handWorld; ropeMesh.visible = true; ropeMesh.position.copy(h); ropeMesh.lookAt(c.rope.x, c.rope.y, c.rope.z); ropeMesh.scale.set(1, 1, Math.max(0.1, h.distanceTo(_v.set(c.rope.x, c.rope.y, c.rope.z)))) }
    else ropeMesh.visible = false
    updateCamera(dt, c)
    const d = sun.userData.dir; sun.position.set(c.x + d.x * 150, c.y + d.y * 150, c.z + d.z * 150); sun.target.position.set(c.x, c.y, c.z)
  }
  const k6 = performance.now()
  if (R0) {
    view.update(R0.sky, camera.position, dt, k6)
    view.streak(camera.position, dt, true)
    // 行き先の柱と輪
    const G = goalOf(R0), gy = world.groundAt(G.x, G.z, 2).h
    const dC = Math.hypot(camera.position.x - G.x, camera.position.z - G.z)
    goalMark.g.visible = mode === 'play' && !R0.arrived && !R0.officeHit
    goalMark.g.position.set(G.x, gy, G.z)
    const Rr = Math.max(0.6, dC * 0.008)
    goalMark.col.scale.set(Rr, 70, Rr); goalMark.mat.opacity = Math.max(0, Math.min(1, (dC - 12) / 30)) * 0.85
    goalMark.ring.scale.setScalar(G.r); goalMark.fill.scale.setScalar(G.r)
    goalMark.ring.material.opacity = 0.6 + Math.sin(k6 / 220) * 0.3
    people(R0, dt)
  }
  if (R0) signs.setClock(clockSec(R0))   // 広場の時計塔はゲームの時刻
  // 線路の隕石の煙
  if (frameN % 6 === 0) fx.smoke(signs.station.userData.smoke.x, signs.station.userData.smoke.y, signs.station.userData.smoke.z, { dark: 0.2, size: 4, life: 3, vy: 3, a: 0.4 })
  aimMark.visible = false
  if (mode === 'play' && me && !me.rope && frameN % 4 === 0) aimMark.userData.p = findAnchor(world, me)
  const aimOn = mode === 'play' && me && !me.rope && !!aimMark.userData.p
  if (aimOn) { const p = aimMark.userData.p; aimMark.visible = true; aimMark.position.set(p.x, p.y, p.z); aimMark.lookAt(camera.position); aimMark.scale.setScalar(Math.max(1, camera.position.distanceTo(aimMark.position) * 0.04)) }
  const wb = document.querySelector('.tbtn[data-k=wire]'); if (wb && wb._aim !== aimOn) { wb._aim = aimOn; wb.classList.toggle('aim', aimOn) }
  if (mode === 'play' && me) {
    const v3 = Math.hypot(me.vx, me.vy, me.vz)
    const wl = Snd.loops.wind; if (wl && wl.g) { const gv = me.grounded ? 0 : Math.min(0.35, Math.max(0, (v3 - 16) / 40)); wl.g.gain.value = Number.isFinite(gv) ? gv : 0 }   // 風: 地面では鳴らさない・空中で 16m/s から
    const hl = Snd.loops.heli; if (hl && hl.g) { const dh = heli.pos.distanceTo(_v.set(me.x, me.y, me.z)); hl.g.gain.value = Math.max(0, Math.min(0.16, 0.16 * (1 - dh / 160))) }
  }
  drawSpeed(mode === 'play' && me ? Math.hypot(me.vx, me.vy, me.vz) : 0, dt)
  heli.update(dt, c, !!c && (mode === 'title' || (run && run.t > 8)))
  if (mode === 'play' && run && !heliSaid && run.t > 9) { heliSaid = true; if (!(sayT > 0)) say(t('heli'), 2.2) }
  const P_ = police.st, carList = P_ && mode === 'play' ? street.traffic.cars.filter(c => Math.hypot(c.x - P_.px, c.z - P_.pz) > 9 && Math.hypot(c.x - me.x, c.z - me.z) > 5) : street.traffic.cars
  carsDraw.draw(carList, camera.position, dt); pedsDraw.draw(street.peds, camera.position, dt)
  applyDayTime(R0 ? Math.min(1, R0.t / 150) : 0)
  skyTint.position.copy(camera.position)
  fx.update(dt)
  fx.shake = Math.max(0, fx.shake - dt * 2.5)
  if (mode === 'play' && run) {
    if (hintAt > 0 && !paused) { hintAt -= dt; if (hintAt <= 0 && tut && me.swings === 0) say(touchMode ? t('hint1') : t('hint1Pc'), 3) }
    updateHud(dt)
    senpaiTick(dt)
    arrestTick(dt)
    // 焦げたスーツから細い煙（段が進むほど濃い。パンツ一丁は燃える物が無い）
    if (run.suit > 0 && run.suit < 4 && frameN % (6 - run.suit) === 0) fx.smoke(me.x, me.y + 1.3, me.z, { dark: 0.45, size: 0.5 + run.suit * 0.25, life: 0.9, vy: 1.2, a: 0.35 })
  }
  // 紳士服の店の輪: 使ったら消える。浮いたハンガーが回る
  tailorRings.forEach((q, i) => {
    const used = mode === 'play' && run && run.tailorUsed[i]
    q.g.visible = !used && !(mode === 'play' && run && run.suit === 0 && run.t < 1)
    q.hanger.rotation.y += dt * 1.6; q.hanger.position.y = 2.4 + Math.sin(k6 / 300 + i) * 0.15
    q.ring.material.opacity = 0.55 + Math.sin(k6 / 200) * 0.3
  })
  if (frameN % 9 === 0) fx.smoke(-35.8, 28.4, 1215.7, { dark: 0.15, size: 3, life: 3.4, vy: 2.2, a: 0.35 })   // 銭湯の煙突
  renderer.render(scene, camera)
  // 明細の写真: 近くに落ちた・ギリギリでよけた瞬間の少し後（爆発が写る）
  if (snapIn >= 0) { if (snapIn-- === 0 && snapScore > photoScore) { photoScore = snapScore; photo = newsShot(snapAt) } }
  if (!photo && mode === 'play' && run && run.t > 6) { photo = newsShot(null); photoScore = 0 }
  frameN++
}
// 中継のヘリから撮った絵（結果の紙の写真）: 自分と落ちた所の両方が入るように、横の少し上から撮る。撮ったら普段のカメラで描き直す
function newsShot(at) {
  const c2 = document.createElement('canvas'); c2.width = 720; c2.height = 450
  if (!me) return c2
  const f = at || { x: me.x + Math.sin(me.yaw) * 10, y: 0, z: me.z + Math.cos(me.yaw) * 10 }
  const mx = (me.x + f.x) / 2, mz = (me.z + f.z) / 2, my = (me.y + f.y) / 2 + 1
  let dx = me.x - f.x, dz = me.z - f.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L
  const back = 9 + L * 0.7
  newsCam.aspect = 720 / 450; newsCam.updateProjectionMatrix()
  newsCam.position.set(mx - dz * back + dx * 3, my + 3.5 + L * 0.12, mz + dx * back + dz * 3)
  // 建物に埋まらないよう、届かない時は上へ逃がす
  if (world.nearby(newsCam.position.x, newsCam.position.z).some(o => o.kind === 'building' && o.y1 > newsCam.position.y && Math.abs(newsCam.position.x - o.cx) < o.hw && Math.abs(newsCam.position.z - o.cz) < o.hl)) newsCam.position.y = Math.max(...world.nearby(newsCam.position.x, newsCam.position.z).map(o => o.y1 || 0)) + 6
  newsCam.lookAt(mx, my, mz)
  const sz = renderer.getSize(new THREE.Vector2())
  renderer.setSize(720, 450, false); renderer.render(scene, newsCam)
  c2.getContext('2d').drawImage(renderer.domElement, 0, 0, 720, 450)
  renderer.setSize(sz.x, sz.y, false); renderer.render(scene, camera)
  return c2
}
// 隕石に乗ってくる後輩・部長、空を飛んでいく先輩
function people(R0, dt) {
  const sky = R0.sky
  let kv = false, bv = false
  sky.falling.forEach((m, i) => {
    if (m.kind !== 'rider' && m.kind !== 'boss') return
    const g = view.falls[i] && view.falls[i].g; if (!g || !g.visible) return
    const P = m.kind === 'rider' ? kohai : bossP
    P.group.visible = true; P.group.position.set(g.position.x, g.position.y + (m.big ? 3.4 : 2.2) * 0.8, g.position.z); P.group.rotation.y = Math.atan2(-m.ax, -m.az); P.update(dt, 'surf')
    if (m.kind === 'rider') kv = true; else bv = true
  })
  sky.rollers.forEach((q, i) => {
    if (!q.rider) return
    const g = view.rolls[i] && view.rolls[i].g; if (!g || !g.visible) return
    kohai.group.visible = true; kohai.group.position.set(q.x, q.y + 3.7, q.z); kohai.group.rotation.y = Math.atan2(q.vx, q.vz); kohai.update(dt, 'surf'); kv = true
  })
  if (!kv) kohai.group.visible = false
  // 部長: 降りてきたら会社の前に立って手を挙げる
  if (R0.bossLanded) { bossP.group.visible = true; bossP.group.position.set(COM.bossSpot.x - 3, 0, COM.bossSpot.z - 2); bossP.group.rotation.y = Math.atan2(me ? me.x - bossP.group.position.x : 0, me ? me.z - bossP.group.position.z : 1); bossP.update(dt, 'wave') }
  else if (!bv) bossP.group.visible = false
}
function senpaiTick(dt) {
  if (!senpaiFly && run.t > 70 && !run.senpaiDone && !me.rope && me.y < 4 && !run.arrived) {
    run.senpaiDone = true
    const a = Math.atan2(me.vx || Math.sin(me.yaw), me.vz || Math.cos(me.yaw)), side = Math.PI / 2
    senpaiFly = { t: 0, ax: me.x + Math.sin(a - side) * 80 + Math.sin(a) * 30, az: me.z + Math.cos(a - side) * 80 + Math.cos(a) * 30, bx: me.x + Math.sin(a + side) * 80 + Math.sin(a) * 50, bz: me.z + Math.cos(a + side) * 80 + Math.cos(a) * 50, y: me.y + 16 }
    say(t('senpai'), 2.6)
  }
  if (!senpaiFly) return
  const F = senpaiFly; F.t += dt
  const k = F.t / 3.4
  if (k >= 1) { senpaiFly = null; senpai.group.visible = false; senpaiRock.visible = false; return }
  const x = F.ax + (F.bx - F.ax) * k, z = F.az + (F.bz - F.az) * k, y = F.y + Math.sin(k * Math.PI) * 6
  senpaiRock.visible = true; senpaiRock.position.set(x, y, z); senpaiRock.rotation.y = Math.atan2(F.bx - F.ax, F.bz - F.az)
  senpai.group.visible = true; senpai.group.position.set(x, y + 0.7, z); senpai.group.rotation.y = senpaiRock.rotation.y; senpai.update(dt, 'surf')
  if (frameN % 2 === 0) fx.smoke(x, y, z, { dark: 0.35, size: 2.4, life: 1.2, vy: 0.5, a: 0.5 })
}

// ---------------------------------------------------------------- 検証用の窓口
window.meteor = {
  get mode() { return mode }, log, get hitStop() { return hitStop }, get flashA() { return flashA }, get fovKick() { return fovKick }, get slowT() { return slowT }, get redA() { return redA },
  get me() { return me }, get run() { return run }, get demo() { return demo }, get street() { return street }, world, camera, touchMode, cam, renderer, view, COM, SKY, RUN,
  start: (seed, opt) => startRun(seed, opt), toTitle, showResult, setLang: l => { lang = l; applyLang() }, get lang() { return lang },
  dbg: {
    pause: on => { dbgPause = on }, step: n => { for (let i = 0; i < n; i++) stepOnce(); render(STEP) },
    teleport: (x, y, z, yaw) => { Object.assign(me, { x, y, z, vx: 0, vy: 0, vz: 0, rope: null, climbing: null, grounded: y < 0.1, stun: 0, wreck: 0, freeze: 0 }); if (run) run.sky.knocked = false; if (yaw != null) me.yaw = yaw },
    pressWire: (sx, sy) => aimAt(sx, sy), compass: (x, z) => compassAng(x, z), pressJump: () => { press.jump = true }, wireAuto: () => { pendingWire = { at: null, key: true } },
    keys, stick, say, render: n => { for (let i = 0; i < n; i++) render(1 / 30) },
    drop: (dx, dz, big = false, extra = {}) => dropAt(run.sky, me.x + dx, me.z + dz, big, extra),
    quiet: s => { run.sky.quiet = s; run.sky.next = s },
    // 画面の座標（本物の指で押すテスト用）
    screenOf: (x, y, z) => { _v.set(x, y, z).project(camera); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight, front: _v.z < 1 } },
    setTime: s => { run.t = s },
    autoBot: (kind, seed = 1) => { autoBot = kind ? createBot(kind, seed) : null },
    burn: (n = 1) => { run.sky.stats.hits += n },   // 当たったことにする（スーツの段と確保の検証）
    police, get model() { return model }, scene, raycaster: new THREE.Raycaster(), vec: (x, y, z) => new THREE.Vector3(x, y, z)
  }
}
applyLang()
toTitle()
requestAnimationFrame(frame)
bootWatch(() => { window.__meteorReady = true })
