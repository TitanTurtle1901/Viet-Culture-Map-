#!/usr/bin/env python3
"""
Tách bộ dữ liệu hợp nhất (viet-culture-map-34-provinces.json) thành cấu trúc thư mục của dự án:

  data/provinces/index.json        danh sách 34 đơn vị + summary (dùng cho Hover, Khám phá, tìm kiếm)
  data/provinces/<id>.json         hồ sơ đầy đủ từng tỉnh/thành (summary + detail + metadata)
  data/sources.json                354 nguồn tham khảo
  data/taxonomy.json               phân loại do bộ dữ liệu quy định
  data/image-manifest.json         danh mục ảnh (hiện rỗng – chưa có ảnh đã xác minh giấy phép)

Script KHÔNG sửa nội dung văn hóa/lịch sử. Chỉ bổ sung 2 trường dẫn xuất (đánh dấu rõ):
  * formerUnits: danh sách đơn vị tiền thân (theo Nghị quyết 202/2025/QH15 – bảng ở FORMER_UNITS bên dưới).
  * originUnitIds: ở từng địa điểm/đặc sản/lễ hội/nghệ thuật…, suy ra TỰ ĐỘNG từ chuỗi originArea
    (khớp tên không dấu). Mục không khớp đơn vị nào → [] (giao diện xếp vào "Chung / chưa phân định").
Trường dẫn xuất được ghi nhận ở metadata.derivedFields của từng tỉnh.

Cách dùng:
  python tools/build_data.py <bundle.json> .
"""
import json
import os
import re
import sys
import unicodedata

SRC, ROOT = sys.argv[1], sys.argv[2]

# id đơn vị tiền thân: slug không dấu. aliases: tên gọi khác thường gặp trong chuỗi originArea.
FORMER_UNITS = {
    "an-giang": [("an-giang", "An Giang", []), ("kien-giang", "Kiên Giang", ["Rạch Giá", "Hà Tiên", "Phú Quốc"])],
    "bac-ninh": [("bac-ninh", "Bắc Ninh", []), ("bac-giang", "Bắc Giang", [])],
    "ca-mau": [("ca-mau", "Cà Mau", []), ("bac-lieu", "Bạc Liêu", [])],
    "can-tho": [("can-tho", "Cần Thơ", []), ("soc-trang", "Sóc Trăng", []), ("hau-giang", "Hậu Giang", [])],
    "cao-bang": [("cao-bang", "Cao Bằng", [])],
    "da-nang": [("da-nang", "Đà Nẵng", []), ("quang-nam", "Quảng Nam", ["Hội An"])],
    "dak-lak": [("dak-lak", "Đắk Lắk", []), ("phu-yen", "Phú Yên", [])],
    "dien-bien": [("dien-bien", "Điện Biên", [])],
    "dong-nai": [("dong-nai", "Đồng Nai", []), ("binh-phuoc", "Bình Phước", [])],
    "dong-thap": [("dong-thap", "Đồng Tháp", []), ("tien-giang", "Tiền Giang", [])],
    "gia-lai": [("gia-lai", "Gia Lai", []), ("binh-dinh", "Bình Định", [])],
    "ha-noi": [("ha-noi", "Hà Nội", [])],
    "ha-tinh": [("ha-tinh", "Hà Tĩnh", [])],
    "hai-phong": [("hai-phong", "Hải Phòng", []), ("hai-duong", "Hải Dương", [])],
    "ho-chi-minh": [("ho-chi-minh", "Thành phố Hồ Chí Minh", ["TP.HCM", "TP HCM", "Sài Gòn", "Hồ Chí Minh"]),
                    ("binh-duong", "Bình Dương", []),
                    ("ba-ria-vung-tau", "Bà Rịa – Vũng Tàu", ["Bà Rịa", "Vũng Tàu", "Côn Đảo"])],
    "hue": [("hue", "Huế", ["Thừa Thiên Huế", "Thừa Thiên - Huế"])],
    "hung-yen": [("hung-yen", "Hưng Yên", []), ("thai-binh", "Thái Bình", [])],
    "khanh-hoa": [("khanh-hoa", "Khánh Hòa", []), ("ninh-thuan", "Ninh Thuận", [])],
    "lai-chau": [("lai-chau", "Lai Châu", [])],
    "lam-dong": [("lam-dong", "Lâm Đồng", []), ("dak-nong", "Đắk Nông", []), ("binh-thuan", "Bình Thuận", [])],
    "lang-son": [("lang-son", "Lạng Sơn", [])],
    "lao-cai": [("lao-cai", "Lào Cai", []), ("yen-bai", "Yên Bái", [])],
    "nghe-an": [("nghe-an", "Nghệ An", [])],
    "ninh-binh": [("ninh-binh", "Ninh Bình", []), ("ha-nam", "Hà Nam", []), ("nam-dinh", "Nam Định", [])],
    "phu-tho": [("phu-tho", "Phú Thọ", []), ("vinh-phuc", "Vĩnh Phúc", []), ("hoa-binh", "Hòa Bình", [])],
    "quang-ngai": [("quang-ngai", "Quảng Ngãi", []), ("kon-tum", "Kon Tum", [])],
    "quang-ninh": [("quang-ninh", "Quảng Ninh", [])],
    "quang-tri": [("quang-tri", "Quảng Trị", []), ("quang-binh", "Quảng Bình", [])],
    "son-la": [("son-la", "Sơn La", [])],
    "tay-ninh": [("tay-ninh", "Tây Ninh", []), ("long-an", "Long An", [])],
    "thai-nguyen": [("thai-nguyen", "Thái Nguyên", []), ("bac-kan", "Bắc Kạn", [])],
    "thanh-hoa": [("thanh-hoa", "Thanh Hóa", [])],
    "tuyen-quang": [("tuyen-quang", "Tuyên Quang", []), ("ha-giang", "Hà Giang", [])],
    "vinh-long": [("vinh-long", "Vĩnh Long", []), ("tra-vinh", "Trà Vinh", []), ("ben-tre", "Bến Tre", [])],
}

# Phân vùng Bắc / Trung / Nam — QUY TẮC CỦA DỰ ÁN (biên tập), ghi ở data/regions.json.
MACRO = {
    "bac": ["ha-noi", "hai-phong", "quang-ninh", "bac-ninh", "hung-yen", "ninh-binh", "phu-tho", "thai-nguyen",
            "tuyen-quang", "lao-cai", "lang-son", "cao-bang", "dien-bien", "lai-chau", "son-la"],
    "trung": ["thanh-hoa", "nghe-an", "ha-tinh", "quang-tri", "hue", "da-nang", "quang-ngai", "gia-lai",
              "dak-lak", "khanh-hoa", "lam-dong"],
    "nam": ["dong-nai", "ho-chi-minh", "tay-ninh", "vinh-long", "dong-thap", "an-giang", "can-tho", "ca-mau"],
}
FEATURED = ["ha-noi", "hue", "da-nang", "ho-chi-minh", "ninh-binh", "quang-ninh", "lao-cai", "lam-dong"]


def norm(s):
    s = unicodedata.normalize("NFD", s.lower().replace("đ", "d"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " " + re.sub(r"[^a-z0-9]+", " ", s).strip() + " "


def match_units(text, units):
    """Trả về id các đơn vị tiền thân xuất hiện trong text (khớp tên không dấu, bỏ 'X mới')."""
    t = norm(text or "")
    found = []
    for uid, name, aliases in units:
        for n in [name] + aliases:
            nn = norm(n)  # có khoảng trắng hai đầu
            idx = t.find(nn)
            while idx != -1:
                after = t[idx + len(nn):idx + len(nn) + 5]
                if not after.startswith("moi "):  # "tỉnh An Giang mới" = đơn vị hiện hành, không phải tiền thân
                    found.append(uid)
                    break
                idx = t.find(nn, idx + 1)
            if uid in found:
                break
    return found


def tag_items(obj, units, stats):
    if isinstance(obj, dict):
        if "originArea" in obj and isinstance(obj["originArea"], str):
            ids = match_units(obj["originArea"], units)
            obj["originUnitIds"] = ids
            stats["items"] += 1
            stats["matched"] += 1 if ids else 0
        for v in obj.values():
            tag_items(v, units, stats)
    elif isinstance(obj, list):
        for v in obj:
            tag_items(v, units, stats)


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


bundle = json.load(open(SRC, encoding="utf-8"))
provinces = bundle["provinces"]
assert len(provinces) == 34
assert sum(len(v) for v in FORMER_UNITS.values()) == 63, "34 đơn vị mới phải gồm đủ 63 đơn vị cũ"
assert sorted(sum(MACRO.values(), [])) == sorted(p["id"] for p in provinces)

index_units = []
tot = {"items": 0, "matched": 0}
report = []
for p in provinces:
    pid = p["id"]
    units = FORMER_UNITS[pid]
    p["formerUnits"] = [{"id": u[0], "name": u[1]} for u in units]
    st = {"items": 0, "matched": 0}
    tag_items(p["detail"], units, st)
    tot["items"] += st["items"]
    tot["matched"] += st["matched"]
    report.append((pid, len(units), st["items"], st["matched"]))
    p["metadata"]["derivedFields"] = [
        "formerUnits: bảng đơn vị tiền thân theo Nghị quyết 202/2025/QH15, nhập bằng tay trong tools/build_data.py",
        "originUnitIds: suy ra tự động từ chuỗi originArea (khớp tên không dấu); chưa được rà soát thủ công",
    ]
    dump(os.path.join(ROOT, "data", "provinces", pid + ".json"), p)

    d = p["detail"]
    index_units.append({
        "id": pid,
        "name": p["name"],
        "administrativeType": p["administrativeType"],
        "region": p["region"],
        "administrativeCode": d["overview"].get("administrativeCode"),
        "file": pid + ".json",
        "researchStatus": p["metadata"].get("researchStatus"),
        "formerUnits": p["formerUnits"],
        "summary": {
            "image": p["summary"]["image"],
            "shortIntroduction": p["summary"]["shortIntroduction"],
            "featuredDestinations": [{"id": x["id"], "name": x["name"]} for x in d["destinations"]
                                     if x["id"] in p["summary"]["featuredDestinationIds"]],
            "featuredSpecialties": [{"id": x["id"], "name": x["name"]} for x in d["specialties"]
                                    if x["id"] in p["summary"]["featuredSpecialtyIds"]],
        },
        # Chỉ tên – phục vụ tìm kiếm ở trang Khám phá mà không phải tải 34 hồ sơ đầy đủ
        "searchNames": {
            "destinations": [x["name"] for x in d["destinations"]],
            "specialties": [x["name"] for x in d["specialties"]],
        },
    })

dump(os.path.join(ROOT, "data", "provinces", "index.json"), {
    "schemaVersion": bundle["index"]["schemaVersion"],
    "asOfDate": bundle["index"]["asOfDate"],
    "generatedBy": "tools/build_data.py",
    "units": index_units,
})
dump(os.path.join(ROOT, "data", "sources.json"), {"schemaVersion": bundle["schemaVersion"], "sources": bundle["sources"]["sources"]})
dump(os.path.join(ROOT, "data", "taxonomy.json"), bundle["taxonomy"])
dump(os.path.join(ROOT, "data", "image-manifest.json"), bundle["imageManifest"])
dump(os.path.join(ROOT, "data", "regions.json"), {
    "schemaVersion": "1.0.0",
    "rule": "Quy tắc phân vùng của dự án Viet Culture Map (biên tập, KHÔNG phải phân loại hành chính chính thức): "
            "mỗi đơn vị cấp tỉnh thuộc đúng một trong ba miền Bắc/Trung/Nam, xếp theo vị trí của trụ sở và phần lớn lãnh thổ. "
            "Trường 'region' trong hồ sơ từng tỉnh giữ nguyên phân vùng địa lý – kinh tế của bộ dữ liệu gốc.",
    "regions": [
        {"id": "bac", "label": "Miền Bắc", "description": "Từ biên giới phía Bắc đến vùng đồng bằng sông Hồng: núi cao Tây Bắc – Đông Bắc, châu thổ Bắc Bộ, văn hóa Kinh Bắc, Hạ Long và nhiều cộng đồng dân tộc thiểu số.", "provinceIds": MACRO["bac"]},
        {"id": "trung", "label": "Miền Trung", "description": "Dải đất từ Thanh Hóa đến Khánh Hòa và Tây Nguyên: kinh đô Huế, phố cổ Hội An, biển miền Trung, cao nguyên và không gian cồng chiêng.", "provinceIds": MACRO["trung"]},
        {"id": "nam", "label": "Miền Nam", "description": "Đông Nam Bộ và đồng bằng sông Cửu Long: đô thị sôi động, sông nước miệt vườn, ẩm thực phong phú và văn hóa Kinh – Khmer – Hoa – Chăm.", "provinceIds": MACRO["nam"]},
    ],
    "featuredProvinceIds": FEATURED,
    "featuredRule": "Danh sách biên tập: 8 địa phương đại diện cho nhiều vùng và nhiều loại hình di sản; không phải xếp hạng.",
})

print("Đã ghi 34 hồ sơ.")
print(f"originArea khớp đơn vị tiền thân: {tot['matched']}/{tot['items']}")
for pid, nu, ni, nm in report:
    if nu > 1 and nm < ni:
        print(f"  {pid}: {nm}/{ni} mục gán được đơn vị tiền thân")
