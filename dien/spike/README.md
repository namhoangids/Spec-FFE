# Thử xuất DXF tiếng Việt (GĐ0)

Mục đích: kiểm tra trên **AutoCAD của team** rằng file DXF do công cụ web tạo ra mở được, hiển thị đúng tiếng Việt, và block có thuộc tính sửa được. Phải qua bước này trước khi làm phần xuất bản vẽ ở GĐ1.

## Các file

| File | Cách tạo | Ghi chú |
|---|---|---|
| `thu-tieng-viet-R2007-utf8.dxf` | Thư viện JavaScript `@tarikjabiri/dxf` 2.10.0, định dạng AutoCAD 2007 (AC1021), chữ UTF-8 | **Phương án chính** |
| `thu-tieng-viet-R12-unicode.dxf` | Bộ ghi R12 tự viết, không cần thư viện; chữ có dấu ghi dạng `\U+XXXX` | Phương án dự phòng. Một số phần mềm xem DXF không phải AutoCAD sẽ hiện nguyên chuỗi `\U+...` |
| `xem-truoc-R2007.png` | Ảnh xem trước file R2007 | Để so sánh với những gì AutoCAD hiển thị |
| `tao-dxf-thu.mjs` | Script tạo 2 file trên | `npm install && node tao-dxf-thu.mjs` |

Nội dung hai file giống nhau:

- Khung A3 và khung tên tạm.
- Đoạn sơ đồ tủ DB-T1: thanh cái, CB tổng Q0, 4 mạch ra.
- Block `MCB_1P` có 4 thuộc tính: `MA_MACH`, `THIET_BI`, `CAP`, `PHU_TAI`.
- Ghi chú, và 3 dòng kiểm tra toàn bộ dấu tiếng Việt (chữ hoa, chữ thường, ký hiệu kỹ thuật).

Tên layer (`E-FRAM`, `E-BUSB`, `E-WIRE`, `E-SYMB`, `E-TEXT`), tên block và khung tên đều là **tạm**. Khi có chuẩn công ty sẽ thay.

## Cách thử (mỗi file làm một lượt)

1. Mở AutoCAD → `OPEN` → chọn kiểu file **DXF (*.dxf)** → mở file. Ghi lại phiên bản AutoCAD (ví dụ AutoCAD 2021).
2. So với `xem-truoc-R2007.png`: tiêu đề, khung tên, ghi chú và 3 dòng kiểm tra có hiện **đúng toàn bộ dấu** không? Có ký tự nào thành `?`, ô vuông hay `\U+...` không?
3. Nhấp đúp vào một ký hiệu CB, ví dụ mạch C04. Cửa sổ *Enhanced Attribute Editor* phải hiện 4 thuộc tính có chữ tiếng Việt. Thử sửa giá trị `PHU_TAI` rồi bấm OK.
4. Gõ `LAYER`: kiểm tra có đủ 5 layer `E-*`.
5. Gõ `AUDIT` → `Y`: ghi lại số lỗi (mong đợi 0).
6. `SAVEAS` → lưu thành **DWG**, đóng lại rồi mở file DWG đó, kiểm tra lại bước 2.
7. (Không bắt buộc) `DATAEXTRACTION` → chọn block `MCB_1P` → xuất ra Excel, kiểm tra chữ tiếng Việt trong Excel.

## Gửi lại kết quả

- Phiên bản AutoCAD.
- File nào đạt (R2007 / R12 / cả hai), kèm ảnh chụp màn hình nếu có lỗi.
- Font chữ team đang dùng trong bản vẽ (nếu không phải Arial).

## Ghi chú kỹ thuật

- Thư viện `@tarikjabiri/dxf` 2.10.0 có lỗi khi gắn thuộc tính cho block: hàm `addAttrib()` ghi một `SEQEND` sau **mỗi** thuộc tính, nên block có nhiều thuộc tính bị hỏng. Script đã tự ghi đúng chuẩn DXF: `INSERT` → các `ATTRIB` → một `SEQEND`. Công cụ chính thức cũng phải làm như vậy, hoặc chuyển sang bộ ghi tự viết.
- Hai file đã được kiểm tra bằng `ezdxf` 1.4.5: đọc lại được, `audit` 0 lỗi, chữ tiếng Việt và giá trị thuộc tính khớp từng ký tự. Bước này không thay được việc mở thử trên AutoCAD.
