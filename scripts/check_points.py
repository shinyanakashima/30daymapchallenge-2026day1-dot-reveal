"""生成した JSON の点数・重複・段階間の保持を確認する。

使い方: python3 scripts/check_points.py data/hokkaido_points.json
"""
import json
import sys

d = json.load(open(sys.argv[1], encoding="utf-8"))
V = [tuple(p) for p in d["vertices"]]
n = len(V)
assert n == d["meta"]["vertex_count"], "頂点数がメタ情報と一致しない"
assert len(set(V)) == n, "頂点に重複がある"
for name, order in d["orders"].items():
    assert sorted(order) == list(range(n)), f"{name}: 全頂点を一度ずつ含んでいない"
arc = [tuple(p) for p in d["arc_points"]]
assert len(set(arc)) == len(arc), "補間点に重複がある"
assert len(d["dp_deviation_km"]) == n
print(f"OK: 頂点 {n} 点（元データ {d['meta']['raw_vertex_count']} 点から重複除去）、補間点 {len(arc)} 点、重複なし")
print("表示順は各方式とも全点の並べ替えなので、k 点目までの集合は k+1 点目までに必ず含まれる。")
