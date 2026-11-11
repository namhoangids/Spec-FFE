// Bảng quy đổi tên block AutoCAD → loại thiết bị, dùng khi bóc khối (engine/boc-khoi.mjs).
// ĐÂY LÀ BẢNG MẪU: tên block lấy theo cách đặt tên hay gặp, chưa phải thư viện block của công ty.
// Khi team chuẩn hóa thư viện block (GĐ0), sửa trực tiếp bảng dưới đây — không cần sửa code —
// hoặc nạp bảng riêng từ Excel (sheet "Quy doi block": Mẫu tên block | Nhóm | Mô tả | Loại mạch | W | Tính công suất).
//
//  mau          tên block; "*" khớp mọi chuỗi (không phân biệt hoa thường, bỏ dấu)
//  nhom         Đèn | Ổ cắm | Công tắc | Thiết bị
//  moTa         mô tả đưa vào BOQ nhóm E (thiết bị điện)
//  loaiMach     loại mạch theo engine/quy-tac.mjs (dùng khi bóc khối tạo mạch mới)
//  w            công suất mỗi cái (W) — số giả định, thuộc tính CS trên block luôn được ưu tiên
//  tinhCongSuat false: chỉ đếm số lượng (công tắc, hộp nối…), không cộng vào công suất mạch
//  dvt          đơn vị trong BOQ (mặc định "cái")

export const QUY_DOI_BLOCK = [
  { mau: "DEN_DL*", nhom: "Đèn", moTa: "Đèn downlight LED âm trần", loaiMach: "Chiếu sáng trong nhà", w: 9 },
  { mau: "DOWNLIGHT*", nhom: "Đèn", moTa: "Đèn downlight LED âm trần", loaiMach: "Chiếu sáng trong nhà", w: 9 },
  { mau: "DEN_SPOT*", nhom: "Đèn", moTa: "Đèn spotlight LED âm trần", loaiMach: "Chiếu sáng trong nhà", w: 7 },
  { mau: "DEN_OP*", nhom: "Đèn", moTa: "Đèn ốp trần LED", loaiMach: "Chiếu sáng trong nhà", w: 24 },
  { mau: "DEN_HAT*", nhom: "Đèn", moTa: "Đèn hắt LED dây", dvt: "m", loaiMach: "Chiếu sáng trong nhà", w: 10 },   // 1 block = 1 m
  { mau: "DEN_TUONG*", nhom: "Đèn", moTa: "Đèn gắn tường", loaiMach: "Chiếu sáng trong nhà", w: 12 },
  { mau: "DEN_GUONG*", nhom: "Đèn", moTa: "Đèn gương WC", loaiMach: "Chiếu sáng trong nhà", w: 12 },
  { mau: "DEN_NGOAI*", nhom: "Đèn", moTa: "Đèn sân vườn / ngoài nhà", loaiMach: "Chiếu sáng ngoài nhà", w: 15 },
  { mau: "OCAM_DOI*", nhom: "Ổ cắm", moTa: "Ổ cắm đôi 3 chấu 16A", loaiMach: "Ổ cắm thông thường", w: 200 },
  { mau: "OCAM_DON*", nhom: "Ổ cắm", moTa: "Ổ cắm đơn 3 chấu 16A", loaiMach: "Ổ cắm thông thường", w: 200 },
  { mau: "OCAM_NUOC*", nhom: "Ổ cắm", moTa: "Ổ cắm chống nước IP44", loaiMach: "Ổ cắm thông thường", w: 200 },
  { mau: "OCAM*", nhom: "Ổ cắm", moTa: "Ổ cắm (chưa rõ loại)", loaiMach: "Ổ cắm thông thường", w: 200 },
  { mau: "CT_*", nhom: "Công tắc", moTa: "Công tắc", loaiMach: "Chiếu sáng trong nhà", w: 0, tinhCongSuat: false },
  { mau: "CONGTAC*", nhom: "Công tắc", moTa: "Công tắc", loaiMach: "Chiếu sáng trong nhà", w: 0, tinhCongSuat: false },
  { mau: "QUAT_HUT*", nhom: "Thiết bị", moTa: "Quạt hút WC", loaiMach: "Động cơ (bơm, quạt)", w: 30 },
  { mau: "DH_*", nhom: "Thiết bị", moTa: "Điểm cấp điện điều hòa", loaiMach: "Điều hòa", w: 1100 },
  { mau: "BNL*", nhom: "Thiết bị", moTa: "Điểm cấp điện bình nóng lạnh", loaiMach: "Khu ướt (WC, bình nóng lạnh)", w: 2500 },
];
