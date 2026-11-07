// 隕石の見た目: 落ちてくる岩と炎の尾・地面の予告（赤い輪と大きくなる影）・クレーター・転がる岩・燃えるビル・衝撃波
// 当たり判定は shared/meteor.js。ここは見せるだけ
import * as THREE from 'three'
import { mergeVertices } from '../vendor/jsm/utils/BufferGeometryUtils.js?v=16'

const H0 = 230   // 予告の瞬間に岩がいる高さ（m）

function rockGeo(seed, detail = 1) {
  let g = new THREE.IcosahedronGeometry(1, detail)
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g)
  const p = g.attributes.position
  let s = seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < p.count; i++) { const k = 0.78 + rnd() * 0.36; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k) }
  g.computeVertexNormals()
  return g
}
function radialTex(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size
  const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [o, col] of stops) g.addColorStop(o, col)
  x.fillStyle = g; x.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
// 予告の輪: 太い赤の縁と、内側の斜線（遠くても輪だと分かる）
function warnTex() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S
  const x = c.getContext('2d')
  x.translate(S / 2, S / 2)
  x.strokeStyle = 'rgba(255,40,20,1)'; x.lineWidth = 16; x.beginPath(); x.arc(0, 0, S / 2 - 10, 0, Math.PI * 2); x.stroke()
  x.strokeStyle = 'rgba(255,220,60,1)'; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, S / 2 - 24, 0, Math.PI * 2); x.stroke()
  x.save(); x.beginPath(); x.arc(0, 0, S / 2 - 28, 0, Math.PI * 2); x.clip()
  x.strokeStyle = 'rgba(255,60,30,.35)'; x.lineWidth = 10
  for (let i = -S; i < S; i += 26) { x.beginPath(); x.moveTo(i, -S); x.lineTo(i + S, S); x.stroke() }
  x.restore()
  // 真ん中の印（×）
  x.strokeStyle = 'rgba(255,240,200,.9)'; x.lineWidth = 9; x.lineCap = 'round'
  x.beginPath(); x.moveTo(-18, -18); x.lineTo(18, 18); x.moveTo(18, -18); x.lineTo(-18, 18); x.stroke()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
}

export class MeteorView {
  constructor(scene, fx, world) {
    this.scene = scene; this.fx = fx; this.world = world
    this.rockGeos = [rockGeo(11), rockGeo(29), rockGeo(53), rockGeo(97)]
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x3b302a, roughness: 0.95, flatShading: true })
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a })
    this.coolMat = new THREE.MeshStandardMaterial({ color: 0x2c2724, roughness: 1, flatShading: true })
    const glowTex = radialTex([[0, 'rgba(255,240,190,1)'], [0.25, 'rgba(255,170,60,.9)'], [0.6, 'rgba(255,80,20,.35)'], [1, 'rgba(255,40,0,0)']])
    this.glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })
    // 炎の尾: 先が細い円錐（加算）。+y が尾の向き
    const trailC = document.createElement('canvas'); trailC.width = 8; trailC.height = 128
    { const x = trailC.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,60,10,0)'); g.addColorStop(0.5, 'rgba(255,120,30,.55)'); g.addColorStop(1, 'rgba(255,230,160,1)'); x.fillStyle = g; x.fillRect(0, 0, 8, 128) }
    const trailTex = new THREE.CanvasTexture(trailC)
    this.trailMat = new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
    this.trailGeo = new THREE.ConeGeometry(1, 1, 10, 1, true).translate(0, -0.5, 0).rotateX(Math.PI)   // 根元が原点、+y へ細くなる
    // 落ちてくる岩
    this.falls = []
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group()
      const rock = new THREE.Mesh(this.rockGeos[i % 4], this.rockMat); rock.castShadow = false
      const core = new THREE.Mesh(this.rockGeos[(i + 1) % 4], this.coreMat); core.scale.setScalar(0.9)
      const glow = new THREE.Sprite(this.glowMat); glow.scale.setScalar(7)
      const trail = new THREE.Mesh(this.trailGeo, this.trailMat)
      g.add(rock, core, glow, trail); g.visible = false; scene.add(g)
      this.falls.push({ g, rock, core, glow, trail, id: null })
    }
    // 予告: 輪（赤）と影（黒）。屋上にも出す
    const wt = warnTex()
    this.ringMat = new THREE.MeshBasicMaterial({ map: wt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false })
    const shadowTex = radialTex([[0, 'rgba(0,0,0,.9)'], [0.6, 'rgba(0,0,0,.7)'], [1, 'rgba(0,0,0,0)']])
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)
    this.marks = []
    for (let i = 0; i < 9; i++) {
      const ring = new THREE.Mesh(plane, this.ringMat.clone()); ring.renderOrder = 4
      const sh = new THREE.Mesh(plane, this.shadowMat.clone()); sh.renderOrder = 3
      const g = new THREE.Group(); g.add(sh, ring); g.visible = false; scene.add(g)
      this.marks.push({ g, ring, sh, id: null })
    }
    // クレーター: 焦げた円・燃えて光る縁・転がった岩
    const scorch = radialTex([[0, 'rgba(10,6,4,.95)'], [0.55, 'rgba(30,18,10,.85)'], [0.8, 'rgba(50,34,22,.4)'], [1, 'rgba(60,40,25,0)']])
    const lava = radialTex([[0, 'rgba(255,200,80,1)'], [0.35, 'rgba(255,110,20,.85)'], [0.7, 'rgba(200,40,0,.35)'], [1, 'rgba(120,20,0,0)']])
    this.craters = []
    for (let i = 0; i < 28; i++) {
      const g = new THREE.Group()
      const s = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })); s.renderOrder = 2
      const l = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: lava, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, fog: false })); l.renderOrder = 3; l.scale.setScalar(0.7)
      const rock = new THREE.Mesh(this.rockGeos[i % 4], this.coolMat); rock.position.y = 0.4; rock.castShadow = true
      g.add(s, l, rock); g.visible = false; scene.add(g)
      this.craters.push({ g, s, l, rock, id: null })
    }
    // 転がる岩
    this.rolls = []
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(), spin = new THREE.Group()
      const rock = new THREE.Mesh(this.rockGeos[(i + 2) % 4], this.rockMat); rock.castShadow = true
      const core = new THREE.Mesh(this.rockGeos[i % 4], this.coreMat); core.scale.setScalar(0.88)
      spin.add(rock, core); g.add(spin); g.visible = false; scene.add(g)
      this.rolls.push({ g, spin, id: null })
    }
    // 衝撃波の輪
    this.waveMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })
    this.waves = []
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), this.waveMat.clone()); m.visible = false; m.renderOrder = 5; scene.add(m); this.waves.push({ m, t: 9, r: 10 }) }
    // 閃光（1つを使い回す。光の数を変えるとシェーダーを作り直して止まる）
    this.flashL = new THREE.PointLight(0xffa860, 0, 90, 1.4); scene.add(this.flashL); this.flashT = 9
    // 燃えるビルの炎（板を屋上の縁に並べる）
    const flameTex = radialTex([[0, 'rgba(255,250,210,1)'], [0.3, 'rgba(255,170,40,.95)'], [0.65, 'rgba(230,60,10,.5)'], [1, 'rgba(160,20,0,0)']])
    this.flameMat = new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
    this.flames = []
    for (let i = 0; i < 48; i++) { const s = new THREE.Sprite(this.flameMat); s.visible = false; scene.add(s); this.flames.push(s) }
    this.fireLight = new THREE.PointLight(0xff7a30, 0, 70, 1.2); scene.add(this.fireLight)
    this.smokeT = 0
    // 遠くの空を流れる隕石（飾り。当たらない）。どこを見ても空が騒がしい
    this.streaks = []
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(), glow = new THREE.Sprite(this.glowMat), tr = new THREE.Mesh(this.trailGeo, this.trailMat)
      glow.scale.setScalar(26); g.add(glow, tr); g.visible = false; scene.add(g)
      this.streaks.push({ g, tr, t: 99, life: 1, p: new THREE.Vector3(), v: new THREE.Vector3() })
    }
  }
  // 飾りの流れ星（カメラの周りの遠く）
  streak(camPos, dt, on) {
    for (const S of this.streaks) {
      S.t += dt
      if (S.t > S.life) {
        if (!on || Math.random() > 0.02) { S.g.visible = false; continue }
        const a = Math.random() * Math.PI * 2, d = 380 + Math.random() * 320
        S.p.set(camPos.x + Math.sin(a) * d, 320 + Math.random() * 120, camPos.z + Math.cos(a) * d)
        const b = a + (Math.random() - 0.5) * 1.6
        S.v.set(Math.sin(b) * 60, -150, Math.cos(b) * 60); S.t = 0; S.life = 1.4 + Math.random() * 0.8
        S.tr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), S.v.clone().normalize().negate()); S.tr.scale.set(5, 120, 5)
      }
      S.g.visible = true; S.g.position.copy(S.p).addScaledVector(S.v, S.t)
    }
  }
  // 衝撃（音と画面の揺れは game.js）
  impact(e, camPos) {
    const fx = this.fx, big = e.big
    fx.flash(e.x, e.y + 2, e.z)
    fx.debrisAt(e.x, e.y + 0.6, e.z, big ? 30 : 20, 0x6a5848, { speed: big ? 18 : 13, up: big ? 16 : 12, size: big ? 0.42 : 0.3 })
    fx.debrisAt(e.x, e.y + 0.6, e.z, 10, 0xff8a30, { speed: 10, up: 10, size: 0.22 })
    fx.sparks(e.x, e.y + 1, e.z, 26, null, 16)
    fx.dust(e.x, e.y, e.z, big ? 18 : 12, [0.55, 0.48, 0.4], big ? 2.2 : 1.6)
    for (let i = 0; i < 6; i++) fx.smoke(e.x, e.y + 1, e.z, { dark: 0.2, size: 4, life: 2.6, vy: 3, a: 0.55 })
    const w = this.waves.find(q => q.t >= 1) || this.waves[0]
    w.t = 0; w.r = e.r * 2.2; w.m.position.set(e.x, e.y + 0.3, e.z); w.m.visible = true
    this.flashL.position.set(e.x, e.y + 6, e.z); this.flashT = 0
  }
  update(sky, camPos, dt, now) {
    const k6 = now / 1000
    // 落ちてくる岩と予告
    const fs = sky.falling
    for (let i = 0; i < this.falls.length; i++) {
      const F = this.falls[i], M = this.marks[i], m = fs[i]
      if (!m) { F.g.visible = false; M.g.visible = false; continue }
      const k = Math.max(0, Math.min(1, m.t / m.warn)), h = H0 * (1 - k)
      const dx = m.ax, dz = m.az, l = Math.hypot(dx, 1, dz)
      const sz = (m.big ? 3.4 : 2.2) * (m.kind === 'office' ? 2.2 : 1)
      F.g.visible = true
      F.g.position.set(m.x + dx / l * h, m.y + 1 / l * h + sz * 0.6, m.z + dz / l * h)
      F.rock.scale.setScalar(sz); F.core.scale.setScalar(sz * 0.9)
      F.rock.rotation.set(k6 * 2.1 + i, k6 * 1.3, 0); F.core.rotation.copy(F.rock.rotation)
      F.glow.scale.setScalar(sz * (4 + Math.sin(k6 * 30 + i) * 0.4))
      // 尾は落ちてくる向きの逆（空の方）へ
      F.trail.position.set(0, 0, 0)
      F.trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / l, 1 / l, dz / l))
      F.trail.scale.set(sz * 0.9, sz * 14, sz * 0.9)
      // 予告: 輪はすぐに大きさいっぱい、影は小さく薄い所から大きく濃く。落ちる直前は点滅
      M.g.visible = true; M.g.position.set(m.x, m.y + 0.24, m.z)   // 歩道（高さ 0.16）の上に出す
      M.ring.scale.setScalar(m.r)
      const blink = m.tLeft < 0.7 ? (Math.sin(k6 * 40) > 0 ? 1 : 0.45) : 1
      M.ring.material.opacity = (0.55 + 0.45 * k) * blink
      M.ring.rotation.y = k6 * 0.8
      M.sh.scale.setScalar(m.r * (0.25 + 0.75 * k)); M.sh.material.opacity = 0.25 + 0.6 * k
      M.id = m.id
    }
    // クレーター
    const cr = sky.craters
    for (let i = 0; i < this.craters.length; i++) {
      const C = this.craters[i], c = cr[cr.length - 1 - i]
      if (!c) { C.g.visible = false; continue }
      C.g.visible = true; C.g.position.set(c.x, c.y + 0.2, c.z)
      C.s.scale.setScalar(c.r * 1.45)
      const hot = Math.min(1, c.hot / 6)
      C.l.visible = hot > 0.02; C.l.scale.setScalar(c.r * (0.9 + 0.1 * Math.sin(k6 * 5 + i))); C.l.material.opacity = hot
      C.rock.scale.setScalar(c.r * 0.22); C.rock.rotation.y = i
    }
    // 転がる岩
    for (let i = 0; i < this.rolls.length; i++) {
      const R = this.rolls[i], q = sky.rollers[i]
      if (!q) { R.g.visible = false; R.id = null; continue }
      R.g.visible = true; R.g.position.set(q.x, q.y + 1.9, q.z); R.g.scale.setScalar(1.9)
      R.g.rotation.y = Math.atan2(q.vx, q.vz); R.spin.rotation.x = q.spin
      R.id = q.id
      if (Math.random() < 0.4) this.fx.dust(q.x, q.y, q.z, 1, [0.5, 0.45, 0.4], 0.7)
    }
    // 燃えているビル: 屋上の縁に炎、煙の柱。いちばん近いビルに光
    let fi = 0, nearest = null, nd = 1e9
    for (const o of sky.fires) {
      const per = Math.min(10, Math.floor(this.flames.length / Math.max(1, sky.fires.length)))
      for (let j = 0; j < per && fi < this.flames.length; j++) {
        const s = this.flames[fi++], a = (j / per) * Math.PI * 2 + o.cx
        const px = o.cx + Math.cos(a) * o.hw * 0.75, pz = o.cz + Math.sin(a) * o.hl * 0.75
        const fl = 0.8 + 0.25 * Math.sin(k6 * 9 + j * 1.7 + o.cz)
        s.visible = true; s.position.set(px, o.y1 + 2.2 * fl, pz); s.scale.set(5.5 * fl, 7 * fl, 1)
      }
      const d = Math.hypot(o.cx - camPos.x, o.cz - camPos.z); if (d < nd) { nd = d; nearest = o }
    }
    for (; fi < this.flames.length; fi++) this.flames[fi].visible = false
    this.smokeT -= dt
    if (this.smokeT <= 0) {
      this.smokeT = 0.12
      for (const o of sky.fires) this.fx.smoke(o.cx + (Math.random() - 0.5) * o.hw, o.y1 + 3, o.cz + (Math.random() - 0.5) * o.hl, { dark: 0.12, size: 6, life: 3.5, vy: 6, a: 0.5 })
      for (const c of sky.craters) if (c.hot > 0 && Math.random() < 0.5) this.fx.smoke(c.x, c.y + 0.5, c.z, { dark: 0.3, size: 2.5, life: 1.8, vy: 2, a: 0.35 })
    }
    if (nearest && nd < 160) { this.fireLight.position.set(nearest.cx, nearest.y1 + 4, nearest.cz); this.fireLight.intensity = 60 + Math.sin(k6 * 13) * 12 } else this.fireLight.intensity = 0
    // 衝撃波と閃光
    for (const w of this.waves) {
      if (w.t >= 1) { w.m.visible = false; continue }
      w.t += dt * 2.2
      const s = w.r * (0.15 + 0.85 * Math.pow(Math.min(1, w.t), 0.5)); w.m.scale.set(s, 1, s); w.m.material.opacity = Math.max(0, 1 - w.t) * 0.9
    }
    this.flashT += dt; this.flashL.intensity = this.flashT < 0.35 ? 900 * (1 - this.flashT / 0.35) : 0
  }
  // 撮影と検証用: 落ちる所の画面座標を出す
  markOf(id) { return this.marks.find(M => M.id === id && M.g.visible) || null }
}

// ニュースのヘリ（自分の上を回って中継している）
export class NewsHeli {
  constructor(scene) {
    const g = this.g = new THREE.Group()
    const body = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.4, metalness: 0.2 })
    const blue = new THREE.MeshStandardMaterial({ color: 0x1d4f9c, roughness: 0.5 })
    const glass = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, metalness: 0.6 })
    const cab = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12).scale(1, 0.85, 1.5), body); g.add(cab)
    const win = new THREE.Mesh(new THREE.SphereGeometry(1.25, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2).scale(1.05, 0.8, 1.2).translate(0, 0.25, 0.75), glass); g.add(win)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.35, 3.6), blue); stripe.position.y = -0.35; g.add(stripe)
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 5.2, 8).rotateX(Math.PI / 2), body); boom.position.set(0, 0.3, -3.8); g.add(boom)
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.9), blue); fin.position.set(0, 0.9, -6.2); g.add(fin)
    for (const s of [-1, 1]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.6), blue); sk.position.set(s * 1.1, -1.55, 0.2); g.add(sk) }
    // 社名の板（NEWS の文字）
    const c = document.createElement('canvas'); c.width = 256; c.height = 64
    const x = c.getContext('2d'); x.fillStyle = '#1d4f9c'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = 'bold 44px "BIZ UDPGothic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('HOSHI NEWS', 128, 34)
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: tx })); p.position.set(s * 1.62, -0.1, -0.2); p.rotation.y = s * Math.PI / 2; g.add(p) }
    this.rotor = new THREE.Group(); this.rotor.position.y = 1.6; g.add(this.rotor)
    const blade = new THREE.MeshStandardMaterial({ color: 0x222222 })
    for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.4), blade); b.rotation.y = i * Math.PI / 2; this.rotor.add(b) }
    this.tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.25), blade); this.tail.position.set(0.25, 0.9, -6.2); g.add(this.tail)
    g.scale.setScalar(1.2); g.visible = false; scene.add(g)
    this.a = 0; this.pos = new THREE.Vector3()
  }
  update(dt, me, on) {
    this.g.visible = on; if (!on || !me) return
    this.a += dt * 0.32
    const R = 55, tx = me.x + Math.cos(this.a) * R, tz = me.z + Math.sin(this.a) * R, ty = Math.max(48, me.y + 38)
    this.pos.lerp(new THREE.Vector3(tx, ty, tz), this.pos.lengthSq() ? 1 - Math.exp(-dt * 1.2) : 1)
    this.g.position.copy(this.pos)
    this.g.lookAt(me.x, this.pos.y - 8, me.z)
    this.rotor.rotation.y += dt * 40; this.tail.rotation.x += dt * 50
  }
}
