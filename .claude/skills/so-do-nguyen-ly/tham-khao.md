# Tra cứu cho agent vẽ sơ đồ nguyên lý

Bảng số liệu điển hình (W/m², số ổ cắm, BTU, công suất thiết bị, chiều dài mặc định): `dien/agent/phu-tai-dien-hinh.mjs`.

Bộ quy tắc chọn thiết bị và cáp: `dien/engine/quy-tac.mjs`. Bộ này đang **CHƯA DUYỆT**.

## 1. File mô tả công trình (`mo-ta.json`)

Chỉ cần ghi những gì đã biết. Trường nào bỏ trống thì bộ gợi ý tự giả định và ghi lại vào danh sách giả định.

```jsonc
{
  "duAn": {                        // khung tên — tùy chọn
    "ten": "BIỆT THỰ ANH TUẤN", "chuDauTu": "Mr. Tuấn", "diaChi": "Long Biên - Hà Nội",
    "congTy": "22 Thanh Cong, Ba Dinh, Ha Noi", "loaiCongTrinh": "Nhà ở / biệt thự",   // hoặc "Căn hộ"
    "maDuAn": "", "ngay": "", "tyLe": "1:50", "thietKe": "", "kiemTra": "", "nguoiVe": "", "giamDoc": "",
    "soBanVeDau": "E.601", "soBanVeTong": "E.600"
  },
  "nguon": { "soPha": 3, "ik": 6, "chieuDaiCap": 25, "kieuDi": "Máng cáp" },   // kieuDi: "Ống" | "Máng cáp"
  "tuTong": { "ma": "T1", "tang": "T1" },   // tủ tổng đặt ở tầng nào (mặc định tầng đầu tiên)
  "dieuHoa": "cục bộ",                      // hoặc "VRV" → dàn lạnh gom theo tầng + tự thêm dàn nóng 3 pha
  "chieuCaoTang": 3.6,
  "duPhong": 2,                             // số CB dự phòng thêm vào mỗi tủ
  "tang": [
    {
      "ten": "T2",              // tên tầng; số trong tên dùng cho mã lộ (AC2-1, WH2…)
      "tuRieng": true,          // false → mạch tầng này nằm ở tủ tổng (hoặc tủ ghi trong "tu")
      "maTu": "T2", "tenTu": "T2", "capTu": "T1",   // mặc định: mã tủ = tên tầng, cấp từ tủ tổng
      "soPha": 1, "chieuDaiCap": 14,
      "rem": true,              // có rèm điện → thêm mạch R2
      "phong": [
        { "loai": "phòng ngủ", "ten": "P.NGỦ MASTER", "dienTich": 28 },
        { "loai": "wc", "ten": "WC MASTER", "tam": true },
        { "loai": "bếp", "bepTu": true, "bepTuW": 7200 },
        { "loai": "phòng khách", "dieuHoa": true, "btu": 24000, "oCam": 8 }
      ]
    }
  ],
  "thietBi": [
    { "loai": "thang máy", "tang": "T1", "congSuat": 5500, "soPha": 3 },
    { "loai": "bơm", "tang": "T1" },
    { "loai": "sạc xe điện", "tang": "T1", "congSuat": 7400 },
    { "ten": "MÁY SƯỞI KHĂN", "loaiMach": "Khu ướt (WC, bình nóng lạnh)", "khuVuc": "Ướt (WC, tắm)", "congSuat": 300, "tang": "T2" }
  ]
}
```

**Trường riêng của một phòng** (chỉ cần khi khác mặc định): `dienTich`, `oCam` (số ổ), `dieuHoa` (có/không), `btu`, `dieuHoaW`, `tam` (WC có tắm thì có bình nóng lạnh), `bepTu`, `bepTuW`, `binhNongLanhW`, `mayGiat`.

**Trường của thiết bị riêng:** `loai` (bảng § 2), `ten`, `congSuat` (W), `soPha`, `tang` hoặc `tu`, `khuVuc`, `loaiMach`, `phuTai`, `L`.

## 2. Loại phòng và thiết bị riêng nhận được

**Loại phòng.** Ghi gần đúng là được, ví dụ "P. ngủ master", "WC chung", "ban công":

| Loại phòng | Ghi chú |
|---|---|
| `phòng khách`, `phòng ngủ`, `phòng ăn`, `phòng làm việc`, `phòng giải trí` | Có điều hòa |
| `bếp` | Có mạch bếp từ và ổ cắm bếp riêng |
| `wc` | Chiếu sáng và ổ cắm theo mạch khu ướt (RCBO). Có `tam` thì thêm bình nóng lạnh |
| `sảnh, hành lang`, `phòng thờ`, `kho`, `gara`, `phòng kỹ thuật` | |
| `giặt phơi` | Có mạch máy giặt |
| `ngoài nhà` | Gồm sân, vườn, ban công, sân thượng, cổng. Chiếu sáng và ổ cắm ngoài nhà (RCD 30 mA) |

**Thiết bị riêng:** thang máy, bơm, bơm bể bơi, dàn nóng (VRV), bình nóng lạnh trung tâm, lò nướng, cổng tự động, tủ điện nhẹ (rack/NVR/KNX), sạc xe điện, quạt hút. Thiết bị khác thì ghi `loaiMach` và `congSuat`.

## 3. Dữ liệu dự án (`du-an.json`) — để sửa tay sau khi anh xác nhận

**Tủ (`panels`):** `ma`, `ten`, `capTu`, `maLoCap`, `datSauLo`, `soPha` (1|3), `lCap`, `kieuDi`, `phuongPhap`, `ik`, `ks`, `spd`, và các ghi đè cấp tủ:

| Trường của tủ | Ví dụ | Tác dụng |
|---|---|---|
| `nguonDuPhong` | `{ "ten": "MÁY PHÁT DỰ PHÒNG TÒA NHÀ", "tenChinh": "NGUỒN LƯỚI (TỦ TẦNG)" }` | E.600 vẽ 2 nguồn vào khung ATS trước CB tổng; ATS mặc định 4P (3 pha) / 2P, dòng = CB tổng. Thêm `ats`, `cap` nếu muốn ghi khác |
| `ghiDeNhomRcd` | `{ "RC1": { "thietBi": "RCBO 1P+N 40A 30mA", "lyDo": "…" } }` | Ghi đè RCBO của nhóm `nhomRcd`. Công cụ báo ΣIb, ΣIb×Kđt; LỖI nếu ΣIb×Kđt > In hoặc có MCB trong nhóm lớn hơn RCBO |
| `ghiDeCbTong` | `{ "thietBi": "MCB 4P 63A C", "lyDo": "…" }` | Ghi đè CB tổng. Vẫn kiểm Icu, dòng pha và tỷ số chọn lọc (cảnh báo nếu < 1,6) |

**Mạch (`circuits`):** `tu`, `ma`, `loai`, `phuTai`, `khuVuc`, `soLuong`, `congSuat` (W/đơn vị), `cos`, `soPha` (1|3), `pha` ("A"/"B"/"C" để khóa pha), `L`, `nhomOng`, `nhomRcd`, `ghiDeThietBi`, `ghiDeCap`, `ghiDeOng`, `lyDo`, `ghiChu`.

| Trường | Giá trị |
|---|---|
| `loai` | Chiếu sáng trong nhà · Chiếu sáng ngoài nhà · Ổ cắm thông thường · Khu ướt (WC, bình nóng lạnh) · Bếp từ, lò nướng · Điều hòa · Động cơ (bơm, quạt) · Thiết bị điện nhẹ (rack, NVR, KNX) · Dự phòng |
| `khuVuc` | Khô · Ướt (WC, tắm) · Ngoài nhà · Bếp. Ướt và ngoài nhà bắt buộc RCD 30 mA |
| `ghiDeThietBi` | `MCB 1P 20A`, `RCBO 1P+N 25A 30mA`, `MCB 3P 32A C 6kA`, `MCCB 3P 100A` |
| `ghiDeCap` | `Cu/PVC 2(1x4)mm2 + E(1x4)mm2` (luôn có dây E) |
| `nhomRcd` | Cùng mã → dùng chung 1 RCBO, như bản mẫu. Công cụ sẽ cảnh báo |

**Quy ước mã lộ:**

| Mã | Mạch |
|---|---|
| `L1…` | Chiếu sáng |
| `S1…` | Ổ cắm; lộ cấp tủ con cũng dùng `S…` nối tiếp |
| `AC<tầng>-n` | Điều hòa |
| `WH<tầng>-n` | Bình nóng lạnh |
| `BT` | Bếp từ |
| `MG` | Máy giặt |
| `R<tầng>` | Rèm |
| `TM` | Thang máy |
| `B` | Bơm |
| `ACT` | Dàn nóng |
| `DP1…` | Dự phòng |

## 4. Đọc `out/canh-bao.txt`

Mỗi dòng gồm: mức, tủ, mạch, nội dung.
- **LỖI** chặn phát hành.
- **CẢNH BÁO** cần kỹ sư xem.
- **GHI CHÚ** để biết.

**Lỗi hay gặp và cách sửa:**

| Thông báo | Cách sửa |
|---|---|
| `In = … lớn hơn Iz′ …` | CB lớn hơn sức chịu của cáp. Tăng tiết diện (`ghiDeCap`) hoặc bỏ ghi đè CB để công cụ tự chọn |
| `Sụt áp cộng dồn … vượt giới hạn` | Mạch quá dài. Kiểm lại `L`; tách mạch; đặt thêm tủ gần hơn; hoặc tăng tiết diện |
| `Thiếu RCD 30 mA` | Mạch ở khu ướt / ngoài nhà / ổ cắm bị ghi đè thành MCB. Bỏ ghi đè, hoặc gom vào `nhomRcd` có lý do |
| `Icu … nhỏ hơn Ik` | Ik tại tủ lớn hơn khả năng cắt. Kiểm lại Ik (`nguon.ik` / `ik` của tủ); cần thì ghi đè thiết bị có Icu cao hơn |
| `Ib … lớn hơn In` | Công suất ghi đè quá lớn so với CB. Bỏ ghi đè CB |
| `Tiết diện … nhỏ hơn tối thiểu` | Cáp ghi đè nhỏ hơn mức tối thiểu của loại mạch. Tăng tiết diện |
| `CB cấp … nhỏ hơn CB tổng của …` | Lộ cấp tủ con bị ghi đè nhỏ. Bỏ ghi đè |
| Cảnh báo `Lệch pha …` | Khóa pha (`pha`) cho vài mạch lớn để chia đều |
| Cảnh báo `… vượt vỏ lớn nhất` | Tủ quá nhiều thiết bị. Tách thành 2 tủ |
| Cảnh báo `CB tổng được nâng … chọn lọc` | Bình thường; kỹ sư xác nhận theo bảng phối hợp Schneider |
| Cảnh báo `Thiếu chiều dài` / `Thiếu Ik` | Bổ sung `L` / `ik` nếu anh có số liệu |
| Gợi ý `cân nhắc tủ 3 pha` | Hỏi anh. Nếu đổi thì sửa `soPha` của tầng trong `mo-ta.json` (hoặc của tủ trong `du-an.json`) |

## 5. Đọc mặt bằng

- **Nhận phòng:** theo chữ ghi trên bản vẽ. "WC", "VS", "Toilet" là WC; có bồn tắm hay vòi sen thì `tam: true`.
- **Diện tích:** ghi trong phòng thì dùng luôn. Có kích thước trục thì tính. Không có thì bỏ trống để dùng mặc định.
- **Ban công, lô gia, sân, sân thượng** → `ngoài nhà`. **Thang máy** trên mặt bằng → thêm vào `thietBi`.
- **Một tầng nhiều trang** → gộp vào một mục `tang`.
- **Không chắc** (ví dụ phòng không ghi tên) → liệt kê cho anh và hỏi lại trong cùng lượt với các câu chính.

## 6. Quy tắc chọn tiết diện dây dẫn

Công cụ làm theo đúng trình tự này (`engine/mach.mjs` → `chonCap`). Em dùng để **giải thích** và **soát**, không tự tính thay.

1. **Dòng làm việc** Ib = P / (220·cosφ) (1 pha) · Ib = P / (√3·380·cosφ) (3 pha). cosφ theo loại mạch: chiếu sáng 0,9; ổ cắm 0,85; khu ướt 1,0; bếp từ 0,95; điều hòa 0,9; động cơ 0,8.
2. **CB:** In ≥ 1,25·Ib, lấy cấp chuẩn 6–10–16–20–25–32–40–50–63–80–100 A, không nhỏ hơn In tối thiểu của loại mạch (chiếu sáng 10 A, ổ cắm / khu ướt / bếp / điều hòa 16 A).
3. **Tiết diện tối thiểu** theo loại mạch: chiếu sáng 1,5 mm²; ổ cắm, bình nóng lạnh, bếp, điều hòa, động cơ 2,5 mm².
4. **Dòng cho phép** Iz′ = Iz(bảng IEC 60364-5-52) × k1 × k2 ≥ In:
   - Mạch nhánh: dây đơn Cu/PVC luồn ống âm tường, phương pháp **B1**; 1 pha = 2 dây mang tải, 3 pha = 3 dây.
   - Cáp cấp tủ: Cu/XLPE/PVC nhiều lõi, B1 (hoặc theo `phuongPhap`).
   - k1 (35 °C) = 0,94 PVC / 0,96 XLPE. k2 (nhiều mạch chung ống, `nhomOng`) = 1 / 0,8 / 0,7 / 0,65 cho 1 / 2 / 3 / 4 mạch.
   - Mốc nhớ nhanh (PVC B1, 1 pha, ×0,94): 1,5 → 16,4 A · 2,5 → 22,6 · 4 → 30,1 · 6 → 38,5 · 10 → 53,6 · 16 → 71,4. (3 pha: 2,5 → 19,7 · 4 → 26,3 · 6 → 33,8 · 10 → 47,0.)
5. **Sụt áp cộng dồn** từ nguồn tới cuối mạch ≤ 5 % (chiếu sáng ≤ 3 %; tới thanh cái tủ ≤ 2 %). ΔU = 2·Ib·L·(ρ/S·cosφ + λ·sinφ)/Uf (1 pha), ρ = 0,0225 Ω·mm²/m.
6. **Chọn S nhỏ nhất** thỏa cả 3, 4, 5. **PE** = S khi S ≤ 16; 16 khi S = 25–35; S/2 khi lớn hơn.
7. **Ghi trên bản vẽ:** `Cu/PVC 2(1x2,5)mm2 + E(1x2,5)mm2` (1 pha), `Cu/PVC 4(1x4)mm2 + E(1x4)mm2` (3 pha có N), cáp nguồn `Cu/XLPE/PVC (4x10)mm2 + E(1x10)mm2`.

**Điểm hay gặp khi soát:**
- CB 40 A trên 1 pha → dây 6 mm² chỉ đạt 38,5 A → **phải 10 mm²** (ví dụ bếp từ 7,2 kW).
- CB 20 A trên 3 pha → 2,5 mm² chỉ đạt 19,7 A → **4 mm²** (ví dụ dàn nóng VRV 8–10 kW).
- Hạ CB để giảm cáp là hợp lệ nếu In vẫn ≥ Ib; luôn ghi `lyDo` và báo anh việc mất hệ số 1,25.
- Nhiều mạch chung một ống (`nhomOng` > 1) làm giảm Iz′ — hỏi anh nếu mặt bằng đi chung ống.
- Điều hòa ghi theo BTU: kW lạnh = BTU / 3412; kW điện ≈ kW lạnh / 3,5 (COP). Luôn ghi "kiểm theo catalogue".

## 7. Quy tắc chọn ống luồn dây

Công cụ: `chonOng` trong `engine/mach.mjs`. Bảng diễn giải từng mạch: sheet **"Cap va ong"** trong `out/bang-tinh.xlsx`.

1. **Đếm dây trong ống:** 1 pha = 2 dây + PE = 3 dây; 3 pha có N = 4 dây + PE = 5 dây; cáp nhiều lõi = 1 cáp (+ PE rời nếu có).
2. **Đường kính ngoài** (kể cả cách điện), dây đơn Cu/PVC: 1,5 → Ø3,0 · 2,5 → Ø3,6 · 4 → Ø4,2 · 6 → Ø4,8 · 10 → Ø6,1 · 16 → Ø7,2 · 25 → Ø8,9 mm. Cáp 4 lõi Cu/XLPE/PVC: 4 → Ø12,8 · 6 → Ø14,0 · 10 → Ø16,6 · 16 → Ø19,6 · 25 → Ø23,8 mm.
3. **Ống PVC (Ø ngoài → Ø trong):** 16 → 12,2 · 20 → 15,8 · 25 → 20,6 · 32 → 26,6 · 40 → 34,4 · 50 → 43,2 mm.
4. **Hệ số lấp đầy** = Σ(π·d²/4) / (π·D_trong²/4) ≤ **40 %**. Chọn ống nhỏ nhất đạt; **không dùng ống nhỏ hơn Ø20** cho mạch nhánh.
5. **Quy tắc thi công (em tự soát sau khi chạy):** nếu lấp đầy **> 33 %**, hoặc ống có **≥ 5 dây**, hoặc tuyến dài / nhiều co → **đề xuất anh nâng 1 cỡ ống** bằng `ghiDeOng` (ví dụ `"ỐNG PVC  Ø 25"`, hai dấu cách trước Ø như công cụ) kèm `lyDo`. Không tự nâng khi anh chưa đồng ý.
6. **Mốc nhớ nhanh:** 3 dây 1,5–2,5 mm² → Ø20 (11–16 %); 3 dây 10 mm² → Ø25 (26 %); 5 dây 4 mm² → Ø20 đạt 35 % nhưng nên Ø25 (21 %); cáp 4x10 + E10 → Ø40 (26 %), cáp 4x16 + E16 → Ø40.
7. Cáp cấp đi máng (`kieuDi: "Máng cáp"`) thì không chọn ống, ghi "MÁNG CÁP".

## 8. Bóc khối từ mặt bằng AutoCAD (DATAEXTRACTION)

Code: `dien/engine/boc-khoi.mjs`. Bảng quy đổi tên block mẫu: `dien/engine/quy-doi-block.mjs`. File thử: `dien/mau/vi-du-boc-khoi/`.

**Chuẩn hóa block (đề xuất cho thư viện block của công ty):**

| Thuộc tính | Ý nghĩa | Ví dụ |
|---|---|---|
| `TU` | Mã tủ cấp điện | `T2`, `CH` |
| `MACH` | Mã lộ trên sơ đồ | `L1`, `S3`, `AC2-1` |
| `CS` | Công suất mỗi cái (W), bỏ trống thì lấy theo bảng quy đổi | `9`, `750` |
| `PHONG` | Phòng (không bắt buộc) | `P.KHÁCH` |

- Block **có** `MACH`: công suất mạch = Σ số lượng × W, ghi thẳng vào mạch. Thiếu `TU` thì công cụ tự tìm tủ duy nhất có mạch đó.
- Block **chỉ có tên**: chỉ đếm số lượng theo loại / layer / phòng (nên đặt layer theo phòng hoặc tầng), không sửa mạch.
- Block không có trong bảng quy đổi: công cụ liệt kê riêng trong `boc-khoi.xlsx` (sheet `Khong nhan dien`) và cảnh báo. Bổ sung vào `quy-doi-block.mjs` hoặc file `--quy-doi`.

**Xuất trong AutoCAD:**
1. Gõ `DATAEXTRACTION` → Create a new data extraction → chọn bản vẽ mặt bằng điện.
2. Chỉ chọn **Blocks**, bỏ chọn non-blocks; chọn các block điện.
3. Thuộc tính: tick **Name**, **Count**, **Layer** và các thuộc tính `TU`, `MACH`, `CS`, `PHONG` (nếu block có).
4. Bật **Combine identical rows**; xuất ra **Excel (.xlsx)** — CSV của AutoCAD có thể hỏng dấu tiếng Việt.

**Chạy:**
```bash
node tao-bo-ban-ve.mjs du-an/<ma>/du-an.json du-an/<ma>/out --boc-khoi mat-bang.xlsx [--quy-doi quy-doi-cong-ty.xlsx]
```
- `out/du-an.json` là dữ liệu **đã** áp bóc khối; `out/boc-khoi.xlsx` ghi công suất mạch cũ → mới, số lượng theo loại, block lạ.
- Mạch mới tạo từ bóc khối chưa có chiều dài và loại khu vực — hỏi anh rồi sửa `du-an.json`.
- BOQ (`out/boq.xlsx`) có thêm nhóm **E. Thiết bị điện** (đèn, ổ cắm, công tắc) theo bóc khối.

## 9. Ngắn mạch, tự cắt nguồn, chọn lọc

Code: `dien/engine/ngan-mach.mjs`. Bảng chi tiết: sheet **"Ngan mach"** trong `out/bang-tinh.xlsx`.

**Đầu vào** (thêm vào `info` của `du-an.json` / sheet `Du an`):

| Trường | Ý nghĩa |
|---|---|
| `ikNguon` | Ik tại điểm đấu (kA), lấy từ điện lực / tòa nhà. Trống thì 6 kA và cảnh báo |
| `mbaKva`, `mbaUk` | Công trình có trạm riêng: công suất MBA (kVA), Uk (%; trống = 4 % ≤ 630 kVA, 6 % lớn hơn) |
| `noiDat` | `TN-S` (mặc định) · `TN-C-S` · `TT` |

Tủ có `ik` (kA) thì dùng số đó tại thanh cái tủ, không tính.

**Đọc kết quả:**
- **Ik3 max tại thanh cái** giảm dần theo cáp cấp. Công cụ đã chọn Icu theo số này. Nếu báo LỖI `Icu … nhỏ hơn Ik` thì ghi đè thiết bị có Icu đủ (ví dụ MCB 15 kA), hoặc hỏi anh về Ik nguồn.
- **CẢNH BÁO `Ik1 min cuối mạch … < ngưỡng cắt từ`** (sơ đồ TN, mạch không có RCD): CB có thể không tự cắt khi chạm vỏ. Đọc phần "Đề xuất" và hỏi anh chọn cách nào:
  1. tăng tiết diện tới cỡ đề xuất (`ghiDeCap` + `lyDo`);
  2. đổi MCB đường cong B (`ghiDeThietBi: "MCB 1P 10A B"`), chỉ khi tải không có dòng khởi động lớn;
  3. dùng RCBO 30 mA (`ghiDeThietBi: "RCBO 1P+N 10A 30mA"`);
  4. hoặc rút ngắn tuyến / đặt thêm tủ.
- **GHI CHÚ `nhờ RCD 30 mA`**: đạt nhờ RCD, chỉ cần nêu khi anh hỏi.
- **Sơ đồ TT:** cảnh báo các mạch chưa có RCD. Đề xuất RCBO từng mạch, hoặc RCD đầu tủ (cần kỹ sư chốt RA · IΔn ≤ 50 V).
- **GHI CHÚ `Chọn lọc ngắn mạch`**: "toàn phần" hoặc "một phần, tới Is ≈ …" là chọn lọc theo dòng (ngưỡng cắt từ). Nhà ở dùng MCB thường chỉ chọn lọc một phần. Đây là bình thường; nhắc kỹ sư tra bảng phối hợp Schneider nếu công trình yêu cầu chọn lọc toàn phần.
- **MCCB chỉnh định:** ghi `Im=…A` trong chuỗi thiết bị ghi đè (`MCCB 3P 160A 25kA Im=1000A`).
