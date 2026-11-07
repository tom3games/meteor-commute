# 隕石の日でも出社する（meteor-commute）

https://tom3games.github.io/meteor-commute/

隕石が降る朝、部長は「遅刻すんなよ」。地面の赤い輪をギリギリでよけながら、ワイヤーで街を飛んで 9:00 までに会社へ行く3Dバカゲー。空中出前（sky-delivery）のワイヤーと街を使っている。

- 遊ぶ: ブラウザで開くだけ（スマホ縦）
- 開発: `node server.mjs` → http://localhost:5310 ／ 検証 `node verify.mjs` ／ 釣り合い `node tools/sim.mjs 10` ／ 掛かる向き `node tools/reach.mjs` ／ 撮影 `node tools/shot.mjs`
- 調整値は shared/meteor.js の SKY（隕石）と shared/commute.js の COM（時計・駅・会社）
- 素材の出所は CREDITS.md（全部 CC0 か Public domain）
