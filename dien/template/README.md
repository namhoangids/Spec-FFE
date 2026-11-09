# Template sơ đồ nguyên lý tủ điện — theo mẫu Indust (E.601)

Template tự vẽ tờ **sơ đồ nguyên lý tủ điện** theo đúng bố cục bản vẽ mẫu của công ty
(`6.E601 Co Dien.pdf`, tờ E.601 "SƠ ĐỒ NGUYÊN LÝ ĐIỆN T1", dự án MR. TUẤN - HDMON).
Đầu vào là một file dữ liệu JSON, đầu ra gồm:

- `out/<tên>.dxf`: định dạng AutoCAD 2007, màu RGB đúng như mẫu. Mở bằng AutoCAD rồi lưu DWG. Ký hiệu CB và khung tên là block có thuộc tính, sửa được.
- `out/<tên>-R12.dxf`: bản gọn (khoảng 2/3 số dòng), tạo bằng bộ ghi tự viết không cần thư viện. Màu dùng màu AutoCAD chuẩn (ACI) gần nhất; nền tô bằng SOLID; ghi chú nhiều dòng tách thành từng dòng chữ. Đây là bản em chép lên Dropbox.
- `out/<tên>.svg`: xem nhanh trên trình duyệt.

> Giai đoạn này chỉ bám **hình thức trình bày** của mẫu, **chưa xét đúng sai kỹ thuật**.
> Dữ liệu ví dụ chép nguyên văn từ bản mẫu.

## Cách chạy

```bash
cd dien/template
npm install
node tao-ban-ve.mjs du-lieu/E601-T1.json du-lieu/E602-T2.json
```

| File | Vai trò |
|---|---|
| `mau-indust.mjs` | **Template**: thông số bố cục, màu, cỡ chữ, layer, block; hàm `veSoDoTu()` dựng tờ vẽ từ dữ liệu |
| `do-rong-chu.mjs` | Ước lượng độ rộng chữ Arial như AutoCAD hiển thị, dùng để tự co chữ hoặc xuống dòng |
| `ve-dxf.mjs` | Bộ xuất DXF (AutoCAD 2007, UTF-8), dùng thư viện `@tarikjabiri/dxf` |
| `ve-dxf-r12.mjs` | Bộ xuất DXF R12 tự viết, không cần thư viện (màu ACI, chữ `\U+XXXX`) |
| `ve-svg.mjs` | Bộ xuất SVG (xem trước) |
| `tao-ban-ve.mjs` | Lệnh tạo bản vẽ từ file JSON |
| `du-lieu/E601-T1.json` | Dữ liệu tờ E.601, chép đúng bản mẫu (15 mạch) |
| `du-lieu/E602-T2.json` | Dữ liệu tờ E.602 lấy từ phần chữ của PDF (7 mạch). Thứ tự cột là suy luận vì không có ảnh tờ này |

## Bố cục lấy từ mẫu

Toạ độ trong `mau-indust.mjs` ghi theo **pixel của ảnh mẫu** (1156 × 807 px) để dễ đối chiếu,
rồi đổi sang mm trên khổ A3 ngang theo tỷ lệ 1 px = 0,3633 mm.

| Thành phần | Theo mẫu |
|---|---|
| Khổ giấy | A3 ngang; khung tên dọc bên phải; ô số bản vẽ (E.601) nền xám ở góc dưới |
| Tiêu đề | Dấu "+" xanh ngọc, chữ đậm đen `SƠ ĐỒ NGUYÊN LÝ ĐIỆN …` |
| Cột nhãn trái | CẤP NGUỒN TỔNG / TỦ ĐIỆN (APTOMAT TỔNG, APTOMAT LỘ RA) / LỘ RA / CÁP ĐIỆN/LẮP ĐẶT / PHA / PHỤ TẢI |
| Cáp nguồn | 2 dòng ghi chú (cáp, máng/ống) + mũi tên chỉ vào đường cấp nguồn |
| Vỏ tủ | Khung chữ nhật, tên `TỦ ĐIỆN xx MODULE`, dòng `Pđ, Kđt` và `Ptt` |
| CB tổng | Nằm ở **cột giữa**, đường cấp nguồn đi từ trên xuống thanh cái |
| RCBO nhóm | Đặt trên cột của mạch cuối nhóm; thanh cái nhánh nối các mạch trong nhóm (như S1, S2 trong mẫu) |
| Mạch ra | Mỗi mạch một cột, bước 12,1 mm. Ký hiệu CB (chấm đặc + lưỡi dao + vòng hở) và 4 dòng nhãn: loại / số cực / dòng định mức / dòng cắt |
| Hàng LỘ RA | Mã mạch đặt bên phải đường dây |
| Hàng cáp | 2 dòng chữ dọc: cáp bên trái, ống bên phải đường dây |
| Hàng PHA | Ô nền xám, chữ pha (A/B/C/ABC) và mũi tên đỏ |
| Hàng PHỤ TẢI | Ô nền xám, tên phụ tải chữ dọc giữa ô |
| Tiếp địa | Vòng tròn trên cạnh phải vỏ tủ → đường ra ngoài → ký hiệu tiếp địa + chữ `TIẾP ĐỊA` |
| Màu | Đường dây xanh đậm RGB(40,79,128); chữ thông số đỏ cam RGB(232,86,42); ô xám RGB(238,238,238); mũi tên pha đỏ |

**Cỡ chữ** quy đổi về Arial bằng cách đo độ dài từng loại chữ trên mẫu. Đa số là 2,0 mm. Riêng chữ cáp trong cột cao 2,0 mm nhưng hệ số rộng 0,85, vì chữ trên mẫu hẹp hơn Arial.

## Quy tắc tự xử lý khi dữ liệu thay đổi

| Tình huống | Template xử lý |
|---|---|
| Ít hoặc nhiều mạch | Vỏ tủ, thanh cái, ô pha và ô phụ tải co giãn theo số cột. Quá 17 mạch thì co bước cột cho vừa A3 và cảnh báo |
| CB tổng trùng cột RCBO nhóm | Tự dời sang cột gần giữa nhất còn trống. Có thể chỉ định bằng `panel.incomerColumn` |
| Ghi chú cáp nguồn không đủ chỗ bên trái | Tự chuyển sang bên phải đường cấp nguồn, mũi tên quay chiều |
| Tên phụ tải dài | Thu nhỏ tối đa 15% như mẫu; dài hơn nữa thì xuống 2 dòng; vẫn dài thì thu nhỏ tiếp và cảnh báo |
| Chữ cáp hoặc mã mạch dài quá chỗ | Thu nhỏ (không dưới 1,3 mm) và cảnh báo |

## Dữ liệu đầu vào (JSON)

```json
{
  "sheet":  { "drawingNo": "E.601", "title": "SƠ ĐỒ NGUYÊN LÝ ĐIỆN T1", "client": "...", "address": "...",
              "project": "...", "date": "...", "scale": "1:50", "companyInfo": "..." },
  "panel":  { "name": "TỦ ĐIỆN 24 MODULE",
              "supplyCable": ["Cu.XPLE/PVC (4x16)mm2 + E(1x10)mm", "MÁNG CÁP/ỐNG  Ø 40"],
              "incomer": { "type": "MCCB", "poles": "4P", "rating": "63A", "breaking": "15kA" },
              "loadText": ["Pđ=23.84 kW, Kđt=0.5", "Ptt=11,92 kW"] },
  "groups": [ { "device": { "type": "RCBO", "poles": "1P+N", "rating": "32A", "breaking": "30mA" },
                "circuits": ["S1", "S2"] } ],
  "circuits": [ { "code": "L1", "device": { "type": "MCB", "poles": "1P", "rating": "10A", "breaking": "6kA" },
                  "cable": "Cu/PVC 2(1x1,5)mm2", "conduit": "ỐNG PVC  Ø 20", "phase": "A",
                  "load": "CHIẾU SÁNG NGOÀI NHÀ" } ]
}
```

Ở GĐ1, dữ liệu này sẽ do lõi tính toán sinh ra từ file Excel nhập liệu. File Excel mẫu sẽ được chỉnh theo quy ước của bản vẽ mẫu: pha A/B/C, mã mạch L/S/AC/WH/R…, nhóm RCBO.

## Trong DXF

- **Block có thuộc tính**:
  - `IND_CB` (aptomat): `LOAI`, `SO_CUC`, `DONG_DM`, `DONG_CAT`.
  - `IND_KHUNG_TEN_GIATRI` (các trường thay đổi theo từng tờ): `CHU_DAU_TU`, `DIA_CHI`, `DU_AN`, `NGAY`, `TY_LE`, `TEN_BAN_VE`, `SO_BAN_VE`…
  - Trong AutoCAD, nhấp đúp vào block để sửa.
- **Block không thuộc tính**: `IND_PHA_MUITEN` (mũi tên pha), `IND_TIEP_DIA` (tiếp địa).
- **Layer** `IND-*`, màu theo layer. Bản 2007 có màu RGB đúng như mẫu; bản R12 dùng màu ACI: đường dây 154 (xanh navy), chữ 20 (đỏ cam), ô nền 254 (xám), mũi tên 1 (đỏ).
- **Hàng PHA và PHỤ TẢI** vẽ bằng một nền chung và lưới kẻ dùng chung, không có nét trùng.
- **Kiểu chữ**: `IND-ARIAL` (arial.ttf) và `IND-ARIAL-DAM` (arialbd.ttf).

## Phần còn tạm — chờ file DWG của công ty

| Phần | Hiện tại | Khi có DWG |
|---|---|---|
| Logo "Indust interior" | Chữ thay thế | Thay bằng block logo thật |
| Khung tên | Dựng lại theo ảnh | Dùng đúng block khung tên công ty, giữ tên thuộc tính |
| Tên layer, kiểu chữ | `IND-*`, Arial | Đổi theo chuẩn layer và font của công ty |
| Kích thước | Đo từ ảnh (sai số khoảng ±0,5 mm) | Lấy đúng toạ độ từ DWG |

## Đã kiểm tra

- ezdxf 1.4.5 đọc lại cả 4 file DXF (2007 và R12, tờ T1 và T2): `audit` 0 lỗi; thuộc tính block và khung tên đúng từng ký tự tiếng Việt.
- Đặt bản SVG cạnh ảnh mẫu E.601 ở cùng kích thước: bố cục, vị trí và độ dài chữ khớp.
- **Chưa mở trên AutoCAD.** Cần team mở `out/E601-T1.dxf` để so với bản gốc.

## Hai lỗi của thư viện DXF đã né

1. `addAttrib()` ghi `SEQEND` sau mỗi thuộc tính. Template tự ghi `INSERT` → các `ATTRIB` → một `SEQEND`.
2. Căn dọc của `ATTRIB`/`ATTDEF` bị ghi vào mã 73, đúng ra phải là 74. Template chỉ dùng căn ngang cho thuộc tính, còn căn dọc được quy đổi thành vị trí đường chân chữ.
