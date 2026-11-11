// Dữ liệu ví dụ DB-T1 (mục 7 của phương án) — số liệu giả định.
// MDB là tủ gốc (không có chiều dài cáp nguồn), DB-T1 cấp từ MDB bằng cáp dài 30 m, Ik 6 kA.

export const DB_T1 = {
  info: { loaiCongTrinh: "Nhà ở / biệt thự", ikNguon: 6 },
  panels: [
    { ma: "MDB", ten: "MDB", soPha: 3, ik: 6 },
    { ma: "DB-T1", ten: "DB-T1", capTu: "MDB", maLoCap: "S1", soPha: 3, lCap: 30, kieuDi: "Ống", ik: 6 },
  ],
  circuits: [
    { tu: "DB-T1", ma: "C01", loai: "Chiếu sáng trong nhà", phuTai: "Chiếu sáng P.khách, sảnh", congSuat: 450, L: 25 },
    { tu: "DB-T1", ma: "C02", loai: "Chiếu sáng trong nhà", phuTai: "Chiếu sáng bếp, P.ăn, hành lang", congSuat: 350, L: 30 },
    { tu: "DB-T1", ma: "C03", loai: "Chiếu sáng ngoài nhà", phuTai: "Chiếu sáng sân vườn", khuVuc: "Ngoài nhà", congSuat: 600, L: 40 },
    { tu: "DB-T1", ma: "C04", loai: "Ổ cắm thông thường", phuTai: "Ổ cắm P.khách, sảnh", congSuat: 1800, L: 25 },
    { tu: "DB-T1", ma: "C05", loai: "Ổ cắm thông thường", phuTai: "Ổ cắm bếp", congSuat: 3000, cos: 0.9, khuVuc: "Bếp", L: 15 },
    { tu: "DB-T1", ma: "C06", loai: "Bếp từ, lò nướng", phuTai: "Bếp từ", congSuat: 4000, khuVuc: "Bếp", L: 12 },
    { tu: "DB-T1", ma: "C07", loai: "Khu ướt (WC, bình nóng lạnh)", phuTai: "Bình nóng lạnh WC1", khuVuc: "Ướt (WC, tắm)", congSuat: 2500, L: 20 },
    { tu: "DB-T1", ma: "C08", loai: "Khu ướt (WC, bình nóng lạnh)", phuTai: "Ổ cắm WC1", khuVuc: "Ướt (WC, tắm)", congSuat: 1400, cos: 0.95, L: 20 },
    { tu: "DB-T1", ma: "C09", loai: "Điều hòa", phuTai: "Điều hòa P.khách 24.000 BTU", congSuat: 2400, L: 18 },
    { tu: "DB-T1", ma: "C10", loai: "Điều hòa", phuTai: "Điều hòa P.ăn 18.000 BTU", congSuat: 1700, L: 15 },
    { tu: "DB-T1", ma: "C11", loai: "Động cơ (bơm, quạt)", phuTai: "Bơm tăng áp 3 pha 1,5 kW", congSuat: 1500, soPha: 3, L: 20 },
    { tu: "DB-T1", ma: "DP1", loai: "Dự phòng", phuTai: "DỰ PHÒNG" },
    { tu: "DB-T1", ma: "DP2", loai: "Dự phòng", phuTai: "DỰ PHÒNG", ghiDeThietBi: "MCB 1P 20A", lyDo: "Dự phòng cho ổ cắm bếp" },
  ],
};
