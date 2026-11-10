# Công cụ sơ đồ nguyên lý tủ điện & điện nhẹ

Phương án tổng thể: [`docs/phuong-an-so-do-nguyen-ly-tu-dien-dien-nhe.md`](../docs/phuong-an-so-do-nguyen-ly-tu-dien-dien-nhe.md).

**Trạng thái:** GĐ1 xong; GĐ2 đợt 1 xong (10/11/2026). Nhập phụ tải vào Excel, công cụ tự tính rồi vẽ **cả bộ**:
- tờ **sơ đồ cấp điện tổng** E.600;
- mỗi tủ một tờ theo template E.601; tủ quá 18 lộ **tự ngắt thêm tờ**;
- **nhãn tủ, nhãn cáp**.

Kết quả xuất ra DXF, SVG và bảng tính. Bộ quy tắc **chưa duyệt**: kỹ sư điện cần chốt sheet `Quy tac`.

## Dùng thế nào

**Web app:** mở `/dien/app/` trên bản triển khai Vercel của repo. Có thể tải file Excel lên, hoặc bấm "Chạy ví dụ HDMON". Các bước tiếp theo:

1. Xem cây tờ. Đầu tiên là sơ đồ tổng E.600, sau đó là các tờ tủ; tủ nhiều tờ hiện (1/2), (2/2).
2. Xem bản vẽ từng tờ, bảng tính từng mạch và danh sách lỗi/cảnh báo.
3. Tải xuống:
   - từng tờ: DXF 2007, DXF R12 hoặc SVG;
   - cả bộ ZIP: gồm bảng tính Excel, nhãn và JSON dự án.
4. Bấm **In nhãn** để mở trang in danh mục mạch dán cánh tủ và nhãn cáp. Bấm **Nhãn Excel** để tải bảng nhãn cho máy in nhãn.
5. Mọi tính toán chạy trên trình duyệt, không gửi dữ liệu đi đâu.

**Dòng lệnh:**

```bash
cd dien && npm install
node tao-bo-ban-ve.mjs mau/vi-du-HDMON.xlsx            # → out/vi-du-HDMON/
npm test                                               # 29 test lõi tính toán
npm run kiem-tra-app                                   # test web app bằng Playwright
python3 mau/tao_mau_nhap_lieu.py                       # tạo lại 2 file Excel mẫu
```

## Thư mục

| Thư mục / file | Nội dung |
|---|---|
| `mau/nhap-lieu-tu-dien.xlsx` | **File Excel nhập liệu v2**, ví dụ là tủ DB-T1 trong phương án (mục 7) |
| `mau/vi-du-HDMON.xlsx` | Ví dụ dựng theo bộ mẫu E.601–E.606: T1 cấp cho T2–T6. **Công suất và chiều dài là số giả định** |
| `mau/tao_mau_nhap_lieu.py` | Script tạo 2 file Excel trên |
| `engine/` | **Lõi tính toán** (JavaScript thuần, chạy được cả trên Node và trình duyệt), xem bảng dưới |
| `bo-ban-ve.mjs` | Phần dùng chung: dữ liệu dự án → kết quả tính → sơ đồ tổng + các tờ tủ (SVG/DXF) + nhãn |
| `tao-bo-ban-ve.mjs` | Lệnh tạo cả bộ: Excel → `E.600-TONG.*`, `E.601-T1.dxf`, `E.601-T1-R12.dxf`, `E.601-T1.svg`… + `bang-tinh.xlsx`, `nhan.xlsx`, `nhan-tu.html`, `du-an.json`, `canh-bao.txt` |
| `out/vi-du-HDMON/` | Bộ 7 tờ (E.600–E.606) và các file nhãn, tạo từ file ví dụ HDMON. ezdxf audit 0 lỗi |
| `app/` | Web app MVP (`index.html`, `app.mjs`) và test Playwright `kiem-tra-app.mjs` |
| `template/` | Template trình bày theo mẫu E.601. Từ dữ liệu tờ vẽ xuất DXF + SVG, cho tờ tủ (`mau-indust.mjs`) và tờ sơ đồ tổng (`so-do-tong.mjs`). Xem [`template/README.md`](template/README.md) |
| `so-sanh-mau-E601-E606.md` | **Báo cáo so sánh** lựa chọn của bản mẫu với quy tắc. Có các mục cần kỹ sư điện chốt |
| `spike/` | File DXF thử tiếng Việt để mở trên AutoCAD |

## Lõi tính toán `engine/`

| File | Việc làm (theo mục 6 của phương án) |
|---|---|
| `quy-tac.mjs` | Bộ quy tắc mặc định (**chưa duyệt**): Uf/Ud, ρ, λ, k1 ở 35 °C, giới hạn ΔU (5% / chiếu sáng 3% / tới thanh cái tủ 2%), Kđt, hệ số chọn In 1,25, tỷ số chọn lọc 1,6, bảng Iz IEC 60364-5-52, k2, định mức CB, module, vỏ tủ, ống |
| `mach.mjs` | Ib → CB/RCBO (theo loại mạch **và** loại khu vực) → cáp (Iz′, ΔU cộng dồn, tiết diện tối thiểu, PE) → ống; đọc thiết bị/cáp ghi đè |
| `can-pha.mjs` | Cân pha A/B/C, giữ mạch đã khóa pha |
| `tu.mjs` | Tổng hợp tủ (Pđ, Kđt, Ptt, dòng từng pha), CB tổng, đếm module, chọn vỏ |
| `cay-tu.mjs` | Tính cả cây tủ: từ tủ lá lên tủ gốc (tải, thiết bị), rồi từ gốc xuống (cáp, sụt áp cộng dồn) |
| `kiem-tra.mjs` | Lỗi / cảnh báo / ghi chú theo mục 6.8 |
| `doc-excel.mjs` | Đọc file Excel theo tên sheet và tiêu đề cột, kể cả sheet `Quy tac` |
| `sang-ban-ve.mjs` | Kết quả → dữ liệu tờ vẽ, ghi chữ theo kiểu bản mẫu (`Cu/PVC 2(1x2,5)mm2 + E(1x2,5)mm2`, `ỐNG PVC  Ø 20`, `Pđ=… kW, Kđt=…`). Có thêm:<br>• tự ngắt tờ (`chiaTo`: nhóm RCBO không bị tách giữa hai tờ);<br>• đánh số tờ;<br>• dữ liệu sơ đồ tổng (`sangSoDoTong`) |
| `nhan.mjs` | Danh mục mạch dán cánh tủ và nhãn cáp (mỗi cáp 2 bản). Xuất Excel và trang HTML in |
| `xuat-excel.mjs` | Bảng tính: sheet Tong hop, mỗi tủ một sheet, Canh bao, Quy tac |
| `tests/` | Tái lập đúng ví dụ DB-T1 (mục 7: CB tổng 40 A, cáp cấp 4×6, ΔU lớn nhất 2,95%, lệch pha 1,8%, vỏ 36 module) và các ca kiểm tra |

## Quy ước nhập liệu chính

- **Du an:** điền các trường khung tên. `SO_BV_DAU` là số tờ tủ đầu (E.601). `SO_BV_TONG` là số tờ sơ đồ tổng; để trống thì lấy số liền trước tờ tủ đầu (E.600).
- **Tu dien:** mỗi dòng là một tủ; tủ quá 18 lộ tự ngắt thêm tờ. "Cấp từ tủ" dựng cây tủ. Công cụ tự tạo lộ cấp tủ con ở tủ trên: mã lấy theo cột "Mã lộ cấp", vị trí theo cột "Đặt sau lộ".
- **Mach:** mỗi dòng là một lộ ra, ghi mã lộ (`L1`, `S1`, `AC1`, `WH1`…) và chữ phụ tải như trên bản vẽ. Để trống Pha thì công cụ tự cân pha.
- **Loại khu vực** `Ướt (WC, tắm)` hoặc `Ngoài nhà` bắt buộc RCD 30 mA cho mọi mạch trong khu vực đó.
- **Ghi đè** thiết bị, cáp, ống, hoặc **nhóm RCD** (một RCBO cho nhiều mạch như bản mẫu): luôn ghi lý do. Công cụ vẫn kiểm tra giá trị ghi đè và đưa vào danh sách cảnh báo/ghi chú.
