# 隕石の日でも出社する（meteor-commute）

https://tom3games.github.io/meteor-commute/

隕石が降る朝、部長は「遅刻すんなよ」。地面の赤い輪をギリギリでよけながら、ワイヤーで街を飛んで 9:00 までに会社へ行く3Dバカゲー。ワイヤーは空中出前（sky-delivery）のもの。街は v2 でこのゲーム用に作った通勤路（住宅街 → 商店街 → 駅前広場と高架の駅 → 川 → オフィス街のタワー）。

- 遊ぶ: ブラウザで開くだけ（スマホ縦）
- 開発: `node server.mjs` → http://localhost:5310 ／ 検証 `node verify.mjs` ／ 釣り合い `node tools/sim.mjs 10` ／ 掛かる向き `node tools/reach.mjs` ／ 撮影 `node tools/shot.mjs`
- 街は shared/commutemap.js（当たりと掛け点）と js/map3d.js（見た目）。重なりの検査 `node tools/overlap.mjs`
- 調整値は shared/meteor.js の SKY（隕石）と shared/commute.js の COM（時計・駅・会社）
- `node tools/build.mjs` で dist/game.js と、画面で使う文字だけのフォントの読み込み（index.html）を作り直す
- 素材の出所は CREDITS.md（全部 CC0 か Public domain）
