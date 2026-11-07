# Viet Culture Map – Bản đồ văn hóa Việt Nam

Website tĩnh (HTML5, CSS3, JavaScript thuần, jQuery 3.7.1, Tailwind CSS CDN) với bản đồ SVG tương tác 34 tỉnh/thành phố.
Luồng chính: **bản đồ 34 đơn vị → hover → thông tin nhanh → click → hồ sơ đầy đủ.**

## Chạy dự án

Dữ liệu nạp bằng `fetch()` nên **phải chạy qua máy chủ cục bộ**, không mở trực tiếp file HTML:

1. Mở thư mục `Viet-Culture-Map` bằng VS Code.
2. Cài extension **Live Server** → chuột phải `index.html` → *Open with Live Server*.

Cần Internet để tải jQuery, Tailwind và Google Fonts từ CDN.

## Cấu trúc

```
index.html  explore.html  detail.html  login.html
css/style.css
js/data.js      lớp dữ liệu (JS thuần): tải JSON, chuẩn hóa chuỗi, phiên mô phỏng
js/main.js      header/footer dùng chung, menu, thẻ địa phương, ảnh giữ chỗ (jQuery)
js/map.js       bản đồ: hover, click, cảm ứng, zoom/kéo, lọc miền, danh sách
js/home.js      khu vực nổi bật / vùng miền / số liệu của trang chủ
js/explore.js   tìm kiếm, lọc, sắp xếp, phân trang (đồng bộ URL)
js/detail.js    5 tab, lọc theo đơn vị tiền thân, modal, nguồn
js/auth.js      đăng nhập/đăng ký MÔ PHỎNG
data/provinces/index.json     34 đơn vị + summary (Hover, Khám phá)
data/provinces/<id>.json      hồ sơ đầy đủ từng tỉnh (summary + detail + metadata)
data/sources.json             354 nguồn tham khảo
data/regions.json             quy tắc phân vùng Bắc/Trung/Nam + danh sách nổi bật
data/taxonomy.json, data/image-manifest.json
assets/maps/vietnam-34-provinces.svg   bản đồ (34 id, sinh từ GeoJSON)
assets/icons/vietnam-silhouette.svg    logo/favicon (từ cùng dữ liệu ranh giới)
tools/build_map.py, tools/build_data.py   script dựng dữ liệu (chạy một lần, không thuộc website)
```

Phân công JS: `data.js` thuần (không đụng DOM); mọi thao tác DOM/sự kiện dùng jQuery. Ngoại lệ duy nhất: `wheel` dùng
`addEventListener` gốc vì cần `{passive:false}`.

## Bản đồ

- Nguồn ranh giới: GeoJSON "Vietnam Administrative Divisions (Post-2025)" trong
  [nguyenduy1133/Free-GIS-Data](https://github.com/nguyenduy1133/Free-GIS-Data). Đây là bộ dữ liệu cộng đồng,
  **không phải bản đồ chính thức của cơ quan nhà nước**, và kho này **không có file giấy phép**. Cần xác minh quyền sử dụng
  trước khi công bố rộng rãi/thương mại.
- Đã làm mịn đường biên (~400 m), đảo nhỏ vẽ thành chấm. Mỗi tỉnh là một `<path id="province-<id>" data-province-id="<id>">`.
- Hoàng Sa (Đà Nẵng) và Trường Sa (Khánh Hòa) nằm trong **khung phụ**, dịch chuyển/thu nhỏ, không theo vị trí và tỷ lệ thật.
- Lỗi dữ liệu nguồn đã xử lý: một feature mang thuộc tính "Lạng Sơn" (lặp) nhưng hình học nằm ở đồng bằng sông Cửu Long
  → được ghép thành **Đồng Tháp** theo vị trí; trường `Ma` của nguồn không phải mã hành chính nên không dùng.
- Dựng lại: `python tools/build_map.py <Provinces.geojson> assets/maps/vietnam-34-provinces.svg` (cần `pip install shapely`).

## Dữ liệu

Hồ sơ lấy từ file `viet-culture-map-34-provinces.json` do Hoang Nhat cung cấp `tools/build_data.py` chỉ tách file và thêm:

- `formerUnits` (63 đơn vị tiền thân của 34 đơn vị, theo Nghị quyết 202/2025/QH15, nhập tay trong script – **cần đối chiếu**).
- `originUnitIds` ở từng mục, **suy ra tự động** từ chuỗi `originArea` (khớp tên không dấu). Mục không gắn được một đơn vị
  hiển thị ở nhóm "Chung / chưa phân định". Chưa rà soát thủ công.
- Phân vùng Bắc/Trung/Nam là **quy ước biên tập của dự án** (Lâm Đồng, Gia Lai, Đắk Lắk xếp vào Trung), ghi trong `data/regions.json`.
- 8 địa phương "nổi bật" là danh sách biên tập, không phải xếp hạng.
- Mọi hồ sơ đang ở trạng thái `needs_review` và được gắn nhãn trên giao diện. Trường rỗng không hiển thị.

## Chưa hoàn thành / hạn chế (nêu thẳng)

- **Ảnh:** bộ dữ liệu chưa có ảnh nào đã xác minh giấy phép (`image-manifest.json` rỗng). Giao diện dùng ảnh giữ chỗ (hình dạng địa giới thật
  hoặc biểu tượng) và ghi "Chưa có ảnh được cấp phép". Khi có ảnh, điền `image.file` (đường dẫn trong `assets/images/`) + thông tin ghi công
  trong hồ sơ tỉnh; giao diện sẽ tự dùng `<img>`.
- **Tagline** và **thông tin liên hệ** chưa có trong dữ liệu nên không được bịa; banner hiển thị loại đơn vị, vùng và đơn vị tiền thân; footer ghi chưa cấu hình kênh liên hệ.
- **Đăng nhập/đăng ký chỉ là mô phỏng** (localStorage), không có xác thực thực tế.
- Ranh giới giữa các tỉnh nhỏ ở đồng bằng Bắc Bộ khó chạm trên điện thoại; dùng nút +/− hoặc danh sách bên phải.
- Đã kiểm thử logic bằng môi trường giả lập (jsdom) cho cả 4 trang; **chưa kiểm tra thị giác trên trình duyệt thật** (bố cục Tailwind, popup sát mép, cảm ứng thật). Nên duyệt thủ công trên desktop và điện thoại.
