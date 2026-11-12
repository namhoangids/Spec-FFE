// Bảng quy đổi tên block AutoCAD → loại thiết bị, dùng khi bóc khối (engine/boc-khoi.mjs).
// ĐÂY LÀ BẢNG MẪU: tên block lấy theo cách đặt tên hay gặp, chưa phải thư viện block của công ty.
// Khi team chuẩn hóa thư viện block (GĐ0), sửa trực tiếp bảng dưới đây — không cần sửa code —
// hoặc nạp bảng riêng từ Excel (sheet "Quy doi block": Mẫu tên block | Nhóm | Mô tả | Loại mạch | W | Tính công suất | ĐVT |
// Trường điện nhẹ).
//
//  mau          tên block; "*" khớp mọi chuỗi (không phân biệt hoa thường, bỏ dấu)
//  nhom         Đèn | Ổ cắm | Công tắc | Thiết bị
//  moTa         mô tả đưa vào BOQ nhóm E (thiết bị điện)
//  loaiMach     loại mạch theo engine/quy-tac.mjs (dùng khi bóc khối tạo mạch mới)
//  w            công suất mỗi cái (W) — số giả định, thuộc tính CS trên block luôn được ưu tiên
//  tinhCongSuat false: chỉ đếm số lượng (công tắc, hộp nối…), không cộng vào công suất mạch
//  dvt          đơn vị trong BOQ (mặc định "cái")
//  dn           (nhóm "Điện nhẹ") trường của bảng điện nhẹ theo phòng mà block này được đếm vào:
//               data | tv | ap | camTrong | camNgoai | chuongNgoai | chuongTrong | acs | loa | knx.
//               Block điện nhẹ không sửa mạch điện; số lượng điền vào duAn.dienNhe.phong theo (TANG, PHONG).
//               Loa: thuộc tính CS = công suất tap (W). Đầu đọc ACS: 1 block = 1 cửa kiểm soát.

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

  // --- Điện nhẹ (mẫu cụ thể đặt trước mẫu chung) -----------------------------------------------
  ...[
    ["DATA*", "data", "Ổ data RJ45 Cat6"], ["O_DATA*", "data", "Ổ data RJ45 Cat6"], ["RJ45*", "data", "Ổ data RJ45 Cat6"],
    ["O_TV*", "tv", "Ổ TV (IPTV)"], ["IPTV*", "tv", "Ổ TV (IPTV)"], ["TV*", "tv", "Ổ TV (IPTV)"],
    ["AP_*", "ap", "Bộ phát Wi-Fi (AP)"], ["WIFI*", "ap", "Bộ phát Wi-Fi (AP)"], ["WAP*", "ap", "Bộ phát Wi-Fi (AP)"],
    ["CAM_NGOAI*", "camNgoai", "Camera ngoài trời"], ["CAM_OUT*", "camNgoai", "Camera ngoài trời"],
    ["CAM_*", "camTrong", "Camera trong nhà"], ["CAMERA*", "camTrong", "Camera trong nhà"], ["CCTV*", "camTrong", "Camera trong nhà"],
    ["NUT_GOI*", "chuongNgoai", "Nút gọi chuông cửa (ngoài trời)"], ["CHUONG_NGOAI*", "chuongNgoai", "Nút gọi chuông cửa (ngoài trời)"],
    ["DOORBELL*", "chuongNgoai", "Nút gọi chuông cửa (ngoài trời)"],
    ["MH_CHUONG*", "chuongTrong", "Màn hình chuông cửa"], ["CHUONG*", "chuongTrong", "Màn hình chuông cửa"], ["INTERCOM*", "chuongTrong", "Màn hình chuông cửa"],
    ["ACS_KHOA*", null, "Khóa điện cửa kiểm soát"], ["ACS_EXIT*", null, "Nút exit cửa kiểm soát"], ["EXIT*", null, "Nút exit cửa kiểm soát"],
    ["DAU_DOC*", "acs", "Đầu đọc thẻ (cửa kiểm soát)"], ["READER*", "acs", "Đầu đọc thẻ (cửa kiểm soát)"], ["ACS*", "acs", "Đầu đọc thẻ (cửa kiểm soát)"],
    ["LOA*", "loa", "Loa 100 V"], ["SPEAKER*", "loa", "Loa 100 V"],
    ["PHIM_KNX*", "knx", "Phím bấm / cảm biến KNX"], ["KNX*", "knx", "Phím bấm / cảm biến KNX"],
  ].map(([mau, dn, moTa]) => ({ mau, nhom: "Điện nhẹ", moTa, dn: dn ?? undefined, w: 0, tinhCongSuat: false })),
];

/** Các trường điện nhẹ nhận từ bóc khối (theo thứ tự cột sheet Dien nhe) */
export const TRUONG_DIEN_NHE = ["data", "tv", "ap", "camTrong", "camNgoai", "chuongNgoai", "chuongTrong", "acs", "loa", "knx"];
