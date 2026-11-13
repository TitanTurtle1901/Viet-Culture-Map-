#!/usr/bin/env python3
"""
Chuyển GeoJSON 34 tỉnh/thành (sau sắp xếp 2025) thành SVG tương tác.

Công cụ chạy MỘT LẦN, ngoài website (website không cần Python).

Nguồn ranh giới: github.com/nguyenduy1133/Free-GIS-Data
  (thư mục "Vietnam Administrative Divisions (Post-2025)", file Provinces.geojson)

Cách dùng:
  pip install shapely
  python tools/build_map.py <đường dẫn Provinces.geojson> assets/maps/vietnam-34-provinces.svg

Lưu ý dữ liệu nguồn (đã kiểm tra thủ công):
  * Feature thứ 10 trong file bị gán nhầm thuộc tính "Lạng Sơn" (STT 20, Ma 31) nhưng hình học
    nằm trong lon 105.2–106.8, lat 10.1–10.97 → là Đồng Tháp (Tiền Giang + Đồng Tháp).
    Script ghép theo hình học (bbox), không theo thuộc tính này.
  * Trường "Ma" trong file nguồn KHÔNG phải mã hành chính; website không dùng trường này.
  * Quần đảo Hoàng Sa (Đà Nẵng) và Trường Sa (Khánh Hòa) được đặt trong khung phụ (inset)
    ở vùng biển phía đông; Trường Sa thu nhỏ. Đây là quy ước trình bày, không theo vị trí/tỷ lệ thật.
"""
import json
import math
import sys
from shapely.geometry import shape, Polygon, MultiPolygon

SRC = sys.argv[1]
OUT = sys.argv[2]

# Tên trong file nguồn -> id trong bộ dữ liệu Viet Culture Map
NAME_TO_ID = {
    "Đồng Tháp": "dong-thap",
    "An Giang": "an-giang", "Bắc Ninh": "bac-ninh", "Cà Mau": "ca-mau", "Cần Thơ": "can-tho",
    "Cao Bằng": "cao-bang", "Đà Nẵng": "da-nang", "Đắk Lắk": "dak-lak", "Điện Biên": "dien-bien",
    "Đồng Nai": "dong-nai", "Gia Lai": "gia-lai", "Hà Nội": "ha-noi", "Hà Tĩnh": "ha-tinh",
    "Hải Phòng": "hai-phong", "TP. Hồ Chí Minh": "ho-chi-minh", "Huế": "hue", "Hưng Yên": "hung-yen",
    "Khánh Hòa": "khanh-hoa", "Lai Châu": "lai-chau", "Lâm Đồng": "lam-dong", "Lạng Sơn": "lang-son",
    "Lào Cai": "lao-cai", "Nghệ An": "nghe-an", "Ninh Bình": "ninh-binh", "Phú Thọ": "phu-tho",
    "Quảng Ngãi": "quang-ngai", "Quảng Ninh": "quang-ninh", "Quảng Trị": "quang-tri", "Sơn La": "son-la",
    "Tây Ninh": "tay-ninh", "Thái Nguyên": "thai-nguyen", "Thanh Hóa": "thanh-hoa",
    "Tuyên Quang": "tuyen-quang", "Vĩnh Long": "vinh-long",
}

S = 80.0                       # đơn vị SVG trên 1 độ vĩ
K = math.cos(math.radians(16))  # hệ số hiệu chỉnh kinh độ (equirectangular)
LON0, LAT0 = 102.0, 23.8       # góc trên-trái của bản đồ chính
SIMPLIFY = 0.004               # ~400 m, dung sai làm mịn đường biên
TINY = 4e-5                    # deg² — đảo nhỏ hơn mức này vẽ thành chấm tròn

def px(lon, lat):
    return ((lon - LON0) * K * S, (LAT0 - lat) * S)

def polys(geom):
    return list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]

def ring_path(coords, fx):
    pts = [fx(x, y) for x, y in coords]
    out = []
    last = None
    for p in pts:
        q = (round(p[0], 1), round(p[1], 1))
        if q != last:
            out.append(q)
            last = q
    if len(out) < 3:
        return ""
    return "M" + "L".join(f"{x:g},{y:g}" for x, y in out) + "Z"

def poly_path(poly, fx, tol):
    p = poly.simplify(tol, preserve_topology=True) if tol else poly
    if p.is_empty:
        return ""
    parts = []
    for g in polys(p):
        parts.append(ring_path(list(g.exterior.coords), fx))
        for hole in g.interiors:
            parts.append(ring_path(list(hole.coords), fx))
    return "".join(parts)

def dot_path(cx, cy, r=0.9):
    return f"M{cx - r:g},{cy:g}a{r:g},{r:g} 0 1,0 {2 * r:g},0a{r:g},{r:g} 0 1,0 {-2 * r:g},0Z"

def star_path(cx, cy, outer=12, inner=5):
    pts = []
    for i in range(10):
        radius = outer if i % 2 == 0 else inner
        angle = math.radians(-90 + i * 36)
        pts.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z"

data = json.load(open(SRC, encoding="utf-8"))
feats = data["features"]

# --- Ghép feature với id ---
def feature_id(i, f):
    name = f["properties"]["TinhThanh"]
    minx, miny, maxx, maxy = shape(f["geometry"]).bounds
    # Sửa thuộc tính nhầm: feature mang tên "Lạng Sơn" nhưng nằm ở Đồng bằng sông Cửu Long
    if name == "Lạng Sơn" and miny < 12:
        return "dong-thap"
    return NAME_TO_ID[name]

items = []
seen = set()
for i, f in enumerate(feats):
    pid = feature_id(i, f)
    assert pid not in seen, f"Trùng id {pid}"
    seen.add(pid)
    items.append((pid, f))
assert len(items) == 34 and len(seen) == 34, "Phải đủ 34 tỉnh/thành"

# --- Khung phụ cho quần đảo ---
PARACEL_SHIFT_LON = -2.0       # dịch Hoàng Sa về phía tây (kinh độ)
SPRATLY_SCALE = 0.36           # thu nhỏ Trường Sa
SPRATLY_ORIGIN = (108.35, 10.2)  # góc trên-trái (lon, lat) của khung Trường Sa sau khi thu nhỏ

def is_paracel(c): return c.x > 110.5 and c.y > 14
def is_spratly(c): return c.x > 110.0 and c.y < 14

SPR_MINLON, SPR_MAXLAT = 110.3, 11.95

def fx_main(x, y): return px(x, y)
def fx_paracel(x, y): return px(x + PARACEL_SHIFT_LON, y)
def fx_spratly(x, y):
    bx, by = px(SPRATLY_ORIGIN[0], SPRATLY_ORIGIN[1])
    return (bx + (x - SPR_MINLON) * K * S * SPRATLY_SCALE,
            by + (SPR_MAXLAT - y) * S * SPRATLY_SCALE)

paths_main, paths_inset, label_pts = {}, {}, {}
for pid, f in items:
    geom = shape(f["geometry"])
    main_d, inset_d = [], []
    mainland = []
    for p in polys(geom):
        c = p.centroid
        if is_paracel(c):
            fx, bucket, k = fx_paracel, inset_d, "paracel"
        elif is_spratly(c):
            fx, bucket, k = fx_spratly, inset_d, "spratly"
        else:
            fx, bucket, k = fx_main, main_d, "main"
        if p.area < TINY:
            cx, cy = fx(c.x, c.y)
            bucket.append(dot_path(cx, cy, 0.7 if k != "main" else 0.9))
            continue
        d = poly_path(p, fx, SIMPLIFY * (0.5 if k != "main" else 1))
        if d:
            bucket.append(d)
        if k == "main":
            mainland.append(p)
    paths_main[pid] = "".join(main_d)
    paths_inset[pid] = "".join(inset_d)
    big = max(mainland, key=lambda p: p.area)
    rp = big.representative_point()
    label_pts[pid] = px(rp.x, rp.y)

# --- Kích thước viewBox ---
VB_W = round((111.5 - LON0) * K * S)
VB_H = round((LAT0 - 8.0) * S)

# Vị trí hiển thị riêng cho các quần đảo (không theo tỷ lệ thực)
par_x0, par_y0 = px(109.0 - 0.2, 17.35)
par_x1, par_y1 = px(110.9 + 0.2, 15.45)
spr_x0, spr_y0 = px(SPRATLY_ORIGIN[0] - 0.25, SPRATLY_ORIGIN[1] + 0.25)
spr_w = (117.9 - SPR_MINLON) * K * S * SPRATLY_SCALE + 0.5 * K * S
spr_h = (SPR_MAXLAT - 7.3) * S * SPRATLY_SCALE + 0.5 * S

NAMES = {}
_inv = {v: k for k, v in NAME_TO_ID.items()}
for pid, f in items:
    NAMES[pid] = _inv[pid] if pid in _inv else f["properties"]["TinhThanh"]
NAMES["ho-chi-minh"] = "TP. Hồ Chí Minh"
NAMES["dong-thap"] = "Đồng Tháp"

def esc(s): return s.replace("&", "&amp;").replace('"', "&quot;")

out = []
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" id="vietnam-map" viewBox="0 0 {VB_W} {VB_H}" role="group" aria-labelledby="map-title map-desc">')
out.append('<title id="map-title">Bản đồ hành chính Việt Nam – 34 đơn vị cấp tỉnh</title>')
out.append('<desc id="map-desc">Ranh giới 34 tỉnh/thành phố từ GeoJSON của Free-GIS-Data (nguyenduy1133), đã làm mịn đường biên. Tên sáu thành phố trực thuộc Trung ương luôn hiển thị; tên tỉnh khác xuất hiện khi được trỏ hoặc chọn. Dấu sao chỉ vị trí thủ đô Hà Nội. Hoàng Sa và Trường Sa được thể hiện riêng, không theo vị trí và tỷ lệ thật.</desc>')
out.append('<g id="provinces">')
for pid, _ in sorted(items, key=lambda t: t[0]):
    if paths_main[pid]:
        out.append(f'<path id="province-{pid}" class="province" data-province-id="{pid}" d="{paths_main[pid]}"/>')
out.append('</g>')
out.append('<g id="islands">')
out.append(f'<text class="inset-label" x="{par_x0 + 4:.1f}" y="{par_y0 + 10:.1f}">Quần đảo Hoàng Sa</text>')
out.append(f'<text class="inset-label" x="{spr_x0 + 4:.1f}" y="{spr_y0 + 10:.1f}">Quần đảo Trường Sa</text>')
for pid in ("da-nang", "khanh-hoa"):
    d = paths_inset[pid]
    island_id = "hoang-sa" if pid == "da-nang" else "truong-sa"
    out.append(f'<path id="province-{pid}-islands" class="province province-islands" data-province-id="{pid}" data-island-id="{island_id}" d="{d}"/>')
# Vùng bấm trong suốt bao quanh hình quần đảo để dễ chạm
out.append(f'<rect class="province-hit" data-province-id="da-nang" data-island-id="hoang-sa" x="{par_x0:.1f}" y="{par_y0:.1f}" width="{par_x1 - par_x0:.1f}" height="{par_y1 - par_y0:.1f}" fill="transparent"/>')
out.append(f'<rect class="province-hit" data-province-id="khanh-hoa" data-island-id="truong-sa" x="{spr_x0:.1f}" y="{spr_y0:.1f}" width="{spr_w:.1f}" height="{spr_h:.1f}" fill="transparent"/>')
capital_x, capital_y = px(105.8342, 21.0278)
out.append(f'<path class="capital-star" aria-label="Thủ đô Hà Nội" d="{star_path(capital_x, capital_y)}"/>')
out.append('</g>')
out.append('<g id="labels" aria-hidden="true">')
for pid, _ in sorted(items, key=lambda t: t[0]):
    x, y = label_pts[pid]
    out.append(f'<text class="province-label" data-for="{pid}" x="{x:.1f}" y="{y:.1f}">{esc(NAMES[pid])}</text>')
out.append('</g>')
out.append('</svg>')

svg = "\n".join(out)
open(OUT, "w", encoding="utf-8").write(svg)
print("viewBox", VB_W, VB_H, "| bytes", len(svg.encode()))
print("Provinces:", len(seen))

# --- Biểu tượng hình dạng Việt Nam (logo/favicon): hợp nhất phần đất liền + đảo lớn, làm mịn mạnh ---
from shapely.ops import unary_union
_land = []
for pid, f in items:
    for p in polys(shape(f["geometry"])):
        c = p.centroid
        if c.x < 110.0 and p.area > 2e-3:
            _land.append(p)
_u = unary_union(_land).simplify(0.05, preserve_topology=True)
_minx, _miny, _maxx, _maxy = _u.bounds
_pw = (_maxx - _minx) * K * S
_ph = (_maxy - _miny) * S
def _fx(x, y): return ((x - _minx) * K * S, (_maxy - y) * S)
_d = "".join(ring_path(list(g.exterior.coords), _fx) for g in polys(_u))
capital_x, capital_y = px(105.8342, 21.0278)
_icon = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 {VB_W + 8} {VB_H + 8}">'
         f'<title>Hình dạng lãnh thổ Việt Nam (đã làm mịn mạnh)</title>'
         f'<path d="{_d}" fill="#2f6a3f" stroke="#c4902c" stroke-width="5" stroke-linejoin="round"/>'
         f'<path id="silhouette-hoang-sa" d="{paths_inset["da-nang"]}" fill="#2f6a3f" stroke="#c4902c" stroke-width="5" stroke-linejoin="round"/>'
         f'<path id="silhouette-truong-sa" d="{paths_inset["khanh-hoa"]}" fill="#2f6a3f" stroke="#c4902c" stroke-width="5" stroke-linejoin="round"/>'
         f'<path id="silhouette-capital-star" d="{star_path(capital_x, capital_y, outer=18, inner=7.5)}" fill="#c4902c" stroke="#143a4b" stroke-width="3" stroke-linejoin="round"/></svg>')
import os as _os
_icon_path = _os.path.join(_os.path.dirname(OUT), "..", "icons", "vietnam-silhouette.svg")
_os.makedirs(_os.path.dirname(_icon_path), exist_ok=True)
open(_icon_path, "w", encoding="utf-8").write(_icon)
print("icon bytes", len(_icon))
