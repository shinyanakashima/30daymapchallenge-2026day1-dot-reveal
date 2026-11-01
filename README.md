# 何点で分かる？ 北海道の点描

#30DayMapChallenge 2026 Day 1「Points」の作品です。

北海道本島の海岸線から選んだ点を、3点、10点、30点と少しずつ増やします。どの段階で形が分かるかを確かめながら、地図のどこを手がかりに場所を見分けているかを試します。

## 遊び方

- 最初は点が3つだけ表示されます。海岸線、地名、背景地図は表示しません。
- スライダー、＋／−、3・10・30・100・全部 のボタンで点の数を変えます。点を増やしても、それまでの点は同じ位置に残ります。
- 「自動再生」で 1 点から全点まで段階的に増やします。最後に答えを重ねて止まります。
- 「答えを重ねる」で元の輪郭線（実線）と、表示中の点を海岸線の順に結んだ形（破線）を重ねます。
- 「最初から」で 3 点・答えなしの状態に戻します。
- キーボードでは ←/→ で段階を移動し、A で答えを切り替えます。
- 状態は URL に入ります（例：`#n=30&m=dp&a=1`）。

## 点の選び方（3 方式）

| 方式 | 点 | 内容 |
|---|---|---|
| 最遠点 | 元の頂点 | すでに選んだ点との最短距離が最も大きい頂点を順に追加します（farthest point sampling）。全体にむらなく散らばります。 |
| 簡略化 | 元の頂点 | Douglas–Peucker 法を一点ずつ進める形にしたものです。今の点を結んだ輪郭から最も外れている頂点を順に追加します。岬や湾が先に出ます。答え表示時に、その時点での輪郭とのずれ（最大値）を表示します。 |
| 等間隔 | 補間点 | 海岸線の長さに沿って、van der Corput 列（1/2, 1/4, 3/4, 1/8 …）の位置に点を置きます。点を増やしても前の点が残り、全体ではほぼ等間隔になります。元の頂点ではなく、頂点の間を直線で補間した点です。 |

- 3 方式とも、最初の点は全頂点の重心から最も遠い頂点（渡島半島の南西端付近）です。最遠点と簡略化は、2 点目に同じ頂点を使います。
- 表示順は事前に計算して JSON に保存しています。乱数は使わないため、何度開いても同じ順に出ます。
- 元データにない地形は作っていません。補間点も元の線の上にあります。

## データ

| 項目 | 内容 |
|---|---|
| 元データ | Natural Earth「1:10m Coastline」 v5.0.0-pre9（ZIP 内 VERSION.txt の記載） |
| 説明ページ | https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-coastline/ |
| 取得元 | https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_coastline.zip |
| 取得日 | 2026-11-01 |
| 利用条件 | パブリックドメイン（https://www.naturalearthdata.com/about/terms-of-use/） |
| 対象 | `ne_10m_coastline.shp` の 266 番目の線（0 始まり）。北海道本島の閉じた線 1 本 |
| 範囲 | 東経 139.7676〜145.8250、北緯 41.4011〜45.5204 |
| 頂点数 | 626（始点と終点が同じ閉鎖点を含む）→ 重複を除いて 625 |
| 輪郭の長さ | 約 2,232 km（投影後の平面距離。一般化された線なので、実際の海岸線延長よりかなり短くなります） |

### 注意点

- 「10m」は縮尺 1:1,000 万向けという意味で、10 m 精度ではありません。広い範囲を描くために一般化された線で、細かな海岸線は省かれています。
- 対象は北海道本島だけです。利尻島、礼文島、奥尻島、天売島・焼尻島などの周辺の島、および近くの別の島の線は含みません。
- 画面の点数は重複を除いた実際の点数です。全部で 625 点です。

## 加工手順

1. Natural Earth の ZIP を取得して展開します。
2. `scripts/build_points.py` で次の処理を行います。
   - 範囲（東経 139.5〜146.0、北緯 41.2〜45.7）に完全に収まり、頂点が 300 を超える線を北海道本島として 1 本だけ選びます。1 本に決まらない場合は止まります。
   - 同じ座標の頂点を除きます。
   - 球面のランベルト正積方位図法（中心 東経 142.8°・北緯 43.5°、半径 6,371,008.8 m）で km 単位の平面座標に投影します。距離の計算はすべて投影後の座標で行い、緯度経度をそのまま平面として扱いません。
   - 3 方式の表示順を計算し、`data/hokkaido_points.json` に書き出します。
3. `scripts/check_points.py` で点数、重複、表示順が全点の並べ替えになっていることを確認します。

```bash
pip install -r scripts/requirements.txt
```

```bash
mkdir -p raw && curl -L -o raw/ne_10m_coastline.zip https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_coastline.zip && unzip -o raw/ne_10m_coastline.zip -d raw/ne_10m_coastline
```

```bash
python3 scripts/build_points.py raw/ne_10m_coastline/ne_10m_coastline.shp data/hokkaido_points.json
```

```bash
python3 scripts/check_points.py data/hokkaido_points.json
```

`raw/` はリポジトリに含めていません。

### `data/hokkaido_points.json` の中身

| キー | 内容 |
|---|---|
| `meta` | 出典、頂点数、範囲、投影法、輪郭の長さ、生成日 |
| `vertices` | 投影後の頂点 [x, y]（km、北が +y）。海岸線の順 |
| `lonlat` | 同じ頂点の経緯度 |
| `orders.farthest` / `orders.dp` | `vertices` の添字を表示順に並べたもの |
| `dp_deviation_km` | 簡略化方式で、k 点表示時に残っている頂点の輪郭からの最大のずれ |
| `arc_points` | 等間隔方式の補間点 [x, y]（表示順） |

## 構成と公開

ビルド不要の静的サイトです（HTML ＋ Canvas ＋ ES Modules）。

```
index.html
src/main.js       描画と操作
src/style.css
data/hokkaido_points.json
scripts/          データ生成・確認
```

公開先：https://shinyanakashima.github.io/30daymapchallenge-2026day1-dot-reveal/

`main` にプッシュすると、`.github/workflows/pages.yml` が `index.html`・`src/`・`data/` を GitHub Pages に公開します（Settings → Pages の Source は「GitHub Actions」）。ローカルで確認する場合は、`fetch` を使うためファイルを直接開かずにサーバーを立ててください。

```bash
python3 -m http.server 8000
```

## 次の段階の候補（未実装）

点から街を当てる「街クイズ」は別モードの候補です。今回のリポジトリには含めていません。

| データ | 状況 |
|---|---|
| 国土数値情報 鉄道データ N02（2025 年度版、CC BY 4.0） | 事前調査で ZIP を取得し、駅が LineString であることを確認済み。代表点の作り方（線の 50% 位置など）や出題地域は未検討。この作品ではまだ使っていません。 |
| Overture Maps Buildings（ODbL） | 仕様と取得方法の確認のみ。北海道の実データは未取得・未検証。 |
| 国土地理院 基盤地図情報 | 利用者登録が必要。未取得。 |

## 出典

- 海岸線：Natural Earth（パブリックドメイン）
