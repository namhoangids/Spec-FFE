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

**Tủ (`panels`):** `ma`, `ten`, `capTu`, `maLoCap`, `datSauLo`, `soPha` (1|3), `lCap`, `kieuDi`, `phuongPhap`, `ik`, `ks`, `spd`.

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
