"""Natural Earth 1:10m Coastline から北海道本島の点列と表示順を生成する。

使い方:
    python3 scripts/build_points.py <ne_10m_coastline.shp> data/hokkaido_points.json

依存: pyshp (pip install pyshp)
"""
import heapq
import json
import math
import sys
from datetime import date

import shapefile

# 北海道本島の線を特定するための範囲（調査時の値に余裕を持たせたもの）
BBOX_MIN = (139.5, 41.2)
BBOX_MAX = (146.0, 45.7)
# 投影：球面のランベルト正積方位図法（北海道中央付近を中心）
LON0, LAT0 = 142.8, 43.5
R = 6371008.8  # 地球の平均半径 [m]


def laea(lon, lat):
    """経緯度 → 平面座標 [km]（北が+y）。"""
    l, p = math.radians(lon - LON0), math.radians(lat)
    p0 = math.radians(LAT0)
    k = math.sqrt(2 / (1 + math.sin(p0) * math.sin(p) + math.cos(p0) * math.cos(p) * math.cos(l)))
    x = R * k * math.cos(p) * math.sin(l)
    y = R * k * (math.cos(p0) * math.sin(p) - math.sin(p0) * math.cos(p) * math.cos(l))
    return x / 1000, y / 1000


def find_hokkaido(reader):
    hits = []
    for i, s in enumerate(reader.iterShapes()):
        x0, y0, x1, y1 = s.bbox
        if x0 >= BBOX_MIN[0] and y0 >= BBOX_MIN[1] and x1 <= BBOX_MAX[0] and y1 <= BBOX_MAX[1] and len(s.points) > 300:
            hits.append((i, s))
    if len(hits) != 1:
        sys.exit(f"北海道本島の線が一意に決まりません: {[h[0] for h in hits]}")
    return hits[0]


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def seg_dist(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return dist(p, a)
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
    return dist(p, (a[0] + t * dx, a[1] + t * dy))


def order_farthest(pts, start):
    """最遠点サンプリング：既に選んだ点との最短距離が最大の点を順に追加。"""
    n = len(pts)
    order = [start]
    mind = [dist(p, pts[start]) for p in pts]
    mind[start] = -1
    for _ in range(n - 1):
        j = max(range(n), key=lambda i: mind[i])
        order.append(j)
        for i in range(n):
            if mind[i] >= 0:
                mind[i] = min(mind[i], dist(pts[i], pts[j]))
        mind[j] = -1
    return order


def order_dp(pts, a, b):
    """Douglas–Peucker の逐次版：輪郭から最も外れている頂点を順に追加（段階間で点が残る）。
    戻り値は (順序, 各点追加時のずれ[km])。"""
    n = len(pts)

    def arc(i, j):  # 環上で i→j の間（両端を除く）で最大偏差の頂点
        best, bi = -1.0, None
        k = (i + 1) % n
        while k != j:
            d = seg_dist(pts[k], pts[i], pts[j])
            if d > best:
                best, bi = d, k
            k = (k + 1) % n
        return best, bi

    order, dev = [a, b], [None, None]
    heap = []
    for i, j in ((a, b), (b, a)):
        d, k = arc(i, j)
        if k is not None:
            heapq.heappush(heap, (-d, k, i, j))
    while heap:
        d, k, i, j = heapq.heappop(heap)
        order.append(k)
        dev.append(round(-d, 3))
        for s, e in ((i, k), (k, j)):
            dd, kk = arc(s, e)
            if kk is not None:
                heapq.heappush(heap, (-dd, kk, s, e))
    return order, dev


def vdc(k):
    """van der Corput 列（2進）：0, 1/2, 1/4, 3/4, 1/8, …"""
    v, d = 0.0, 1.0
    while k:
        d *= 2
        v += (k & 1) / d
        k >>= 1
    return v


def order_arc(pts, start, count):
    """輪郭線上の等間隔に近い補間点。van der Corput 列で位置を決めるため、点を増やしても前の点が残る。"""
    ring = pts + [pts[0]]
    cum = [0.0]
    for p, q in zip(ring, ring[1:]):
        cum.append(cum[-1] + dist(p, q))
    L = cum[-1]
    out = []
    for k in range(count):
        s = (cum[start] + vdc(k) * L) % L
        # 二分探索で区間を特定
        lo, hi = 0, len(cum) - 1
        while hi - lo > 1:
            m = (lo + hi) // 2
            if cum[m] <= s:
                lo = m
            else:
                hi = m
        seg = cum[lo + 1] - cum[lo]
        t = 0 if seg == 0 else (s - cum[lo]) / seg
        p, q = ring[lo], ring[lo + 1]
        out.append([round(p[0] + t * (q[0] - p[0]), 3), round(p[1] + t * (q[1] - p[1]), 3)])
    return out, L


def main(shp, out_path):
    reader = shapefile.Reader(shp)
    idx, shape = find_hokkaido(reader)
    raw = shape.points
    # 重複頂点（閉鎖点など）を除去
    seen, lonlat = set(), []
    for x, y in raw:
        key = (round(x, 9), round(y, 9))
        if key in seen:
            continue
        seen.add(key)
        lonlat.append((x, y))
    pts = [laea(x, y) for x, y in lonlat]
    pts = [(round(x, 3), round(y, 3)) for x, y in pts]
    if len(set(pts)) != len(pts):
        sys.exit("投影・丸め後に重複点があります")

    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    start = max(range(len(pts)), key=lambda i: dist(pts[i], (cx, cy)))
    far = order_farthest(pts, start)
    second = far[1]
    dp, dp_dev = order_dp(pts, start, second)
    assert sorted(far) == list(range(len(pts))) and sorted(dp) == list(range(len(pts)))
    arc, length = order_arc(pts, start, len(pts))

    lons = [p[0] for p in lonlat]
    lats = [p[1] for p in lonlat]
    data = {
        "meta": {
            "title": "北海道本島の海岸線",
            "source": "Natural Earth 1:10m Coastline (ne_10m_coastline.zip, version " + VERSION + ")",
            "source_url": "https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-coastline/",
            "license": "Public domain (Natural Earth)",
            "feature_index": idx,
            "raw_vertex_count": len(raw),
            "vertex_count": len(pts),
            "bbox_lonlat": [min(lons), min(lats), max(lons), max(lats)],
            "projection": f"Lambert Azimuthal Equal-Area (sphere R={R} m), lon0={LON0}, lat0={LAT0}, unit=km",
            "outline_length_km": round(length, 1),
            "generated": date.today().isoformat(),
        },
        # 元の頂点（環の順、投影後 km）
        "vertices": [list(p) for p in pts],
        "lonlat": [[round(x, 6), round(y, 6)] for x, y in lonlat],
        "orders": {
            "farthest": far,
            "dp": dp,
        },
        "dp_deviation_km": dp_dev,
        # 補間点（元の頂点ではない。輪郭線上に置いた点）
        "arc_points": arc,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"feature #{idx}: raw {len(raw)} → distinct {len(pts)} vertices, outline {length:.1f} km")


VERSION = "unknown"
if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    try:
        import os
        vf = os.path.splitext(sys.argv[1])[0] + ".VERSION.txt"
        VERSION = open(vf).read().strip()
    except OSError:
        pass
    main(sys.argv[1], sys.argv[2])
