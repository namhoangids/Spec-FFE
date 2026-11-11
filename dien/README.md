# Công cụ sơ đồ nguyên lý tủ điện & điện nhẹ

Phương án tổng thể: [`docs/phuong-an-so-do-nguyen-ly-tu-dien-dien-nhe.md`](../docs/phuong-an-so-do-nguyen-ly-tu-dien-dien-nhe.md).

**Trạng thái:** GĐ1 xong; GĐ2 đợt 1 xong (10/11/2026); thêm thuyết minh tính toán và khung BOQ (11/11/2026). Nhập phụ tải vào Excel, công cụ tự tính rồi vẽ **cả bộ**:
- tờ **sơ đồ cấp điện tổng** E.600;
- mỗi tủ một tờ theo template E.601; tủ quá 18 lộ **tự ngắt thêm tờ**;
- **nhãn tủ, nhãn cáp**;
- **thuyết minh tính toán**: file Word sửa được và trang HTML in ra PDF, cùng một nội dung;
- **BOQ điện**: khối lượng thiết bị, vỏ tủ và phụ kiện, dây/cáp, ống; có sẵn khung đơn giá (chờ bảng giá Schneider);
- **bóc khối từ mặt bằng AutoCAD** (DATAEXTRACTION): công suất mạch và số lượng đèn, ổ cắm lấy từ bản vẽ.

Kết quả xuất ra DXF, SVG và bảng tính. Bộ quy tắc **chưa duyệt**: kỹ sư điện cần chốt sheet `Quy tac`.

## AI Agent vẽ sơ đồ (skill Claude Code)

Trong Claude Code mở repo này, anh mô tả nhu cầu hoặc gửi ảnh/PDF mặt bằng. Có thể gõ `/so-do-nguyen-ly` hoặc nói thẳng, ví dụ "vẽ sơ đồ nguyên lý cho biệt thự 4 tầng…". Agent sẽ:
1. hỏi vài điểm chính;
2. gợi ý danh sách tủ và mạch, kèm các giả định;
3. chạy công cụ ra cả bộ bản vẽ, bảng tính, nhãn, thuyết minh và file Excel;
4. sửa tiếp theo lời anh.

| File | Nội dung |
|---|---|
| [`.claude/skills/so-do-nguyen-ly/SKILL.md`](../.claude/skills/so-do-nguyen-ly/SKILL.md) | Quy trình của agent |
| [`.claude/skills/so-do-nguyen-ly/tham-khao.md`](../.claude/skills/so-do-nguyen-ly/tham-khao.md) | Dạng file mô tả, loại phòng, cách sửa lỗi |
| `agent/goi-y-dau-vao.mjs` | Mô tả công trình (tầng, phòng, thiết bị) → danh sách tủ và mạch. Tự chia mạch, ước phụ tải, ghi "giả định" |
| `agent/phu-tai-dien-hinh.mjs` | Bảng phụ tải điển hình (W/m², số ổ cắm, BTU điều hòa, công suất thiết bị, chiều dài) — kỹ sư sửa được |
| `agent/xem-truoc.mjs` | Chụp các tờ SVG thành PNG để xem nhanh |
| `agent/vi-du/` | Ví dụ mô tả: biệt thự 4 tầng; căn hộ đọc từ ảnh mặt bằng |
| `agent/huong-dan-api-key.md` | Hướng dẫn tạo API key, chỉ cần khi muốn làm khung chat trên web |

Skill có trong mọi phiên Claude Code mở repo **sau khi PR được merge vào main**. Trước đó chỉ có trong phiên mở nhánh `claude/tu-dien-so-do-nguyen-ly-4ynx0d`.

## Dùng thế nào

**Web app:** mở `/dien/app/` trên bản triển khai Vercel của repo (gõ `/dien` cũng được, trang `dien/index.html` tự chuyển sang). Trang gốc `/` là app FF&E, không phải app này. Có thể tải file Excel lên, hoặc bấm "Chạy ví dụ HDMON". Các bước tiếp theo:

1. Xem cây tờ. Đầu tiên là sơ đồ tổng E.600, sau đó là các tờ tủ; tủ nhiều tờ hiện (1/2), (2/2).
2. Xem bản vẽ từng tờ, bảng tính từng mạch và danh sách lỗi/cảnh báo.
3. Tải xuống:
   - từng tờ: DXF 2007, DXF R12 hoặc SVG;
   - cả bộ ZIP: gồm bảng tính Excel, nhãn, thuyết minh, BOQ và JSON dự án.
4. Bấm **In nhãn** để mở trang in danh mục mạch dán cánh tủ và nhãn cáp. Bấm **Nhãn Excel** để tải bảng nhãn cho máy in nhãn.
5. Bấm **Thuyết minh Word** để tải thuyết minh tính toán (`.docx`), hoặc **Xem thuyết minh** để mở trang in (In / Lưu PDF). Nội dung:
   1. căn cứ thiết kế;
   2. nguồn điện và giải pháp cấp điện;
   3. phương pháp tính, ghi kèm tham số của bộ quy tắc;
   4. tổng hợp phụ tải;
   5. tính toán chi tiết từng tủ: bảng từng mạch đặt trang ngang, lý do tăng tiết diện;
   6. kiểm tra và kết luận: lỗi, cảnh báo, ghi đè có lý do, giả định, ô ký.
6. Bấm **BOQ Excel** để tải bảng khối lượng vật tư điện. File có 3 sheet:
   - `BOQ`: 4 nhóm — thiết bị đóng cắt; vỏ tủ và phụ kiện (SPD, đèn báo pha, đồng hồ + CT, ATS); dây và cáp; ống, máng. Dây, cáp, ống đã cộng hao hụt 5%;
   - `Bang gia`: mỗi dòng BOQ một khóa. Điền mã hàng, đơn giá, chiết khấu vào đây thì sheet BOQ tự tra giá và tính thành tiền, tổng cộng;
   - `Chi tiet`: từng tủ, từng mạch đóng góp vào mỗi dòng BOQ, để kiểm lại khối lượng.
7. Bấm **Nạp bóc khối…** để nạp bảng DATAEXTRACTION (`.xlsx` / `.csv`) từ mặt bằng điện AutoCAD:
   - block có thuộc tính `TU`, `MACH`, `CS`: công suất từng mạch tính lại theo số lượng × W, mạch chưa có thì tạo mới;
   - block chỉ có tên: đếm số lượng theo loại / layer / phòng;
   - block lạ được liệt kê trong mục Kiểm tra; nút **Báo cáo bóc khối** tải `boc-khoi.xlsx`; BOQ có thêm nhóm thiết bị điện.
   Cách chuẩn hóa block và các bước xuất: `.claude/skills/so-do-nguyen-ly/tham-khao.md` § 8. File thử: `mau/vi-du-boc-khoi/`.
8. Mọi tính toán chạy trên trình duyệt, không gửi dữ liệu đi đâu.

**Dòng lệnh:**

```bash
cd dien && npm install
node tao-bo-ban-ve.mjs mau/vi-du-HDMON.xlsx            # → out/vi-du-HDMON/
node tao-bo-ban-ve.mjs du-an.json                       # đầu vào JSON (dữ liệu dự án) cũng được
node tao-bo-ban-ve.mjs du-an.json out/x --bang-gia bang-gia.xlsx --hao-hut 5   # BOQ có giá (sheet "Bang gia")
node tao-bo-ban-ve.mjs du-an/can-ho-3pn-3-pha/du-an.json out/x --boc-khoi mau/vi-du-boc-khoi/boc-khoi-thuoc-tinh.csv   # bóc khối AutoCAD
node agent/goi-y-dau-vao.mjs agent/vi-du/mo-ta-biet-thu.json /tmp/du-an.json   # gợi ý đầu vào từ mô tả
python3 mau/tao_mau_nhap_lieu.py --tu-json du-an.json nhap-lieu.xlsx           # dữ liệu dự án → Excel nhập liệu
npm test                                               # 48 test
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
| `tao-bo-ban-ve.mjs` | Lệnh tạo cả bộ: Excel → `E.600-TONG.*`, `E.601-T1.dxf`, `E.601-T1-R12.dxf`, `E.601-T1.svg`… + `bang-tinh.xlsx`, `nhan.xlsx`, `nhan-tu.html`, `thuyet-minh.docx`, `thuyet-minh.html`, `du-an.json`, `canh-bao.txt` |
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
| `xuat-excel.mjs` | Bảng tính: sheet Tong hop, mỗi tủ một sheet, Cap va ong, Canh bao, Quy tac |
| `dien-giai.mjs` | Định dạng số và diễn giải cách chọn tiết diện / ống. Bảng tính và thuyết minh dùng chung |
| `thuyet-minh.mjs` | Thuyết minh tính toán: dựng nội dung một lần (`noiDungThuyetMinh`), xuất trang HTML in ra PDF (`thuyetMinhHtml`) cùng kiểu trình bày với bản Word |
| `boc-khoi.mjs` | Bóc khối AutoCAD: `docBocKhoi` đọc DATAEXTRACTION (.csv/.xlsx, nhận cột theo tiêu đề), `apDungBocKhoi` ghi công suất mạch / tạo mạch mới / đếm số lượng, báo block lạ; `xuatBaoCaoBocKhoi` ra `boc-khoi.xlsx` |
| `quy-doi-block.mjs` | Bảng quy đổi tên block → loại thiết bị, W (bảng mẫu, sửa theo thư viện block công ty; nạp bảng riêng bằng `--quy-doi`) |
| `boq.mjs` | BOQ điện: `tinhBoq` bóc khối lượng (không tính trùng cáp cấp tủ con, cộng hao hụt), `docBangGia` đọc bảng giá Excel, `xuatBoqExcel` ra file có công thức tra giá |
| `thuyet-minh-docx.mjs` | Xuất cùng nội dung ra Word bằng thư viện `docx`, trình bày theo mẫu văn bản Indust Design: Arial, cam `#F15A22` / xanh than `#22333B`, khối thông tin 3×2, đề mục có vạch cam, bảng dùng Table Style băng màu thật của Word, chân trang "Indust Design \| … \| Working Document" kèm số trang. Bảng rộng đặt trang ngang |
| `tests/` | Tái lập đúng ví dụ DB-T1 (mục 7: CB tổng 40 A, cáp cấp 4×6, ΔU lớn nhất 2,95%, lệch pha 1,8%, vỏ 36 module) và các ca kiểm tra |

## Quy ước nhập liệu chính

- **Du an:** điền các trường khung tên. `SO_BV_DAU` là số tờ tủ đầu (E.601). `SO_BV_TONG` là số tờ sơ đồ tổng; để trống thì lấy số liền trước tờ tủ đầu (E.600).
- **Tu dien:** mỗi dòng là một tủ; tủ quá 18 lộ tự ngắt thêm tờ. "Cấp từ tủ" dựng cây tủ. Công cụ tự tạo lộ cấp tủ con ở tủ trên: mã lấy theo cột "Mã lộ cấp", vị trí theo cột "Đặt sau lộ".
- **Mach:** mỗi dòng là một lộ ra, ghi mã lộ (`L1`, `S1`, `AC1`, `WH1`…) và chữ phụ tải như trên bản vẽ. Để trống Pha thì công cụ tự cân pha.
- **Loại khu vực** `Ướt (WC, tắm)` hoặc `Ngoài nhà` bắt buộc RCD 30 mA cho mọi mạch trong khu vực đó.
- **Ghi đè** thiết bị, cáp, ống, hoặc **nhóm RCD** (một RCBO cho nhiều mạch như bản mẫu): luôn ghi lý do. Công cụ vẫn kiểm tra giá trị ghi đè và đưa vào danh sách cảnh báo/ghi chú.
