// In ra JSON (stdout) danh mục bộ quy tắc + giá trị hiện tại + số liệu giả định của agent,
// để mau/tao_mau_nhap_lieu.py dựng sheet "Quy tac" và file mau/bo-quy-tac.xlsx (không gõ số liệu hai nơi).
//   node mau/xuat-danh-muc-quy-tac.mjs [du-an.json]   — có du-an.json thì lấy quyTac ghi đè của dự án
import { readFileSync } from "node:fs";

import * as A from "../agent/phu-tai-dien-hinh.mjs";
import { BANG, NGUON, NHOM, THAM_SO, TRONG_CODE, giaTriHienThi } from "../engine/danh-muc-quy-tac.mjs";
import { QUY_TAC, taoQuyTac } from "../engine/quy-tac.mjs";

const duAn = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], "utf8")) : {};
const rule = taoQuyTac(duAn.quyTac || {});
const so = (x) => (x === Infinity ? null : x);
const RCD = { "30mA": "30 mA", khong: "Không", tuy_chon: "Tùy chọn" };

const giaDinh = [
  {
    ten: "Loại phòng — số liệu mặc định", nguon: "GD",
    cot: ["Loại phòng", "Diện tích mặc định (m²)", "Chiếu sáng (W/m²)", "Số ổ cắm đôi", "Điều hòa", "Nhóm mạch"],
    dong: Object.entries(A.LOAI_PHONG).map(([k, v]) => [k, v.dienTich, v.den, v.oCam, v.dieuHoa ? "Có" : "", v.nhom]),
  },
  {
    ten: "Ổ cắm, gom mạch", nguon: "GD", cot: ["Thông số", "Giá trị", "Đơn vị"],
    dong: [
      ["Công suất mỗi ổ cắm đôi (đã tính hệ số sử dụng)", A.PO_O_CAM, "W"],
      ["Công suất tối đa mỗi mạch chiếu sáng", A.GOM.denMax, "W"],
      ["Số phòng tối đa mỗi mạch chiếu sáng", A.GOM.denPhongMax, "phòng"],
      ["Công suất tối đa mỗi mạch ổ cắm", A.GOM.oCamMax, "W"],
      ["Số phòng tối đa mỗi mạch ổ cắm", A.GOM.oCamPhongMax, "phòng"],
      ["Số CB dự phòng thêm vào mỗi tủ", A.DU_PHONG_MOI_TU, "cái"],
    ],
  },
  {
    ten: "Điều hòa cục bộ theo diện tích phòng", nguon: "GD", cot: ["Diện tích đến (m²) — trống = lớn hơn", "Công suất lạnh (BTU)", "Công suất điện (W)"],
    dong: A.DIEU_HOA.map((x) => [so(x.dienTichMax), x.btu, x.w]),
  },
  {
    ten: "Điều hòa VRV", nguon: "GD", cot: ["Thông số", "Giá trị", "Đơn vị"],
    dong: [["Công suất điện mỗi dàn lạnh", A.VRV.danLanhW, "W"], ["Hệ số dàn nóng: kW điện = Σ kW lạnh / hệ số", A.VRV.heSoDanNong, ""]],
  },
  {
    ten: "Thiết bị trong phòng", nguon: "GD", cot: ["Thiết bị", "Công suất (W)", "cosφ"],
    dong: Object.values(A.THIET_BI_PHONG).map((x) => [x.ten, x.w, x.cos ?? ""]),
  },
  {
    ten: "Thiết bị riêng (mục thietBi trong mô tả)", nguon: "GD", cot: ["Thiết bị", "Công suất (W)", "Số pha", "Loại mạch", "Loại khu vực", "Mã lộ"],
    dong: Object.entries(A.THIET_BI_RIENG).map(([k, x]) => [k, x.w, x.soPha, x.loaiMach, x.khuVuc ?? "", x.ma]),
  },
  {
    ten: "Chiều dài mạch khi chưa có số liệu", nguon: "GD", cot: ["Mạch", "Chiều dài (m)", ""],
    dong: [
      ["Chiếu sáng", A.CHIEU_DAI.den], ["Ổ cắm", A.CHIEU_DAI.oCam], ["Điều hòa", A.CHIEU_DAI.dieuHoa],
      ["Bình nóng lạnh", A.CHIEU_DAI.binhNongLanh], ["Bếp", A.CHIEU_DAI.bep], ["Máy giặt", A.CHIEU_DAI.mayGiat],
      ["Rèm", A.CHIEU_DAI.rem], ["Ngoài nhà", A.CHIEU_DAI.ngoaiNha], ["Thiết bị riêng", A.CHIEU_DAI.thietBi],
      ["Cộng thêm mỗi phòng khi mạch gom nhiều phòng", A.CHIEU_DAI.themMoiPhong],
      ["Chiều cao tầng (cáp cấp tủ tầng = chênh tầng × chiều cao + đoạn ngang)", A.CHIEU_DAI.chieuCaoTang],
      ["Đoạn ngang tới tủ tầng", A.CHIEU_DAI.ngangToiTu],
    ],
  },
  {
    ten: "Điện nhẹ theo loại phòng (khi mô tả có dienNhe / knx)", nguon: "GD",
    cot: ["Loại phòng", "Ổ data", "Ổ TV", "AP", "Camera trong", "Camera ngoài", "Loa", "Phím KNX"],
    dong: Object.entries(A.DIEN_NHE_PHONG).map(([k, v]) => [k, v.data ?? "", v.tv ?? "", v.ap ?? "", v.camTrong ?? "", v.camNgoai ?? "", v.loa ?? "", v.knx ?? ""]),
  },
  {
    ten: "Điện nhẹ — số liệu khác", nguon: "GD", cot: ["Thông số", "Giá trị", "Đơn vị"],
    dong: [
      ["Công suất tap loa trong nhà", A.DIEN_NHE.loaW, "W"], ["Công suất tap loa ngoài trời", A.DIEN_NHE.loaWNgoai, "W"],
      ["Diện tích sàn trong nhà mỗi AP", A.DIEN_NHE.apM2, "m²"], ["Cáp ngang từ trục tới phòng", A.DIEN_NHE.lNgang, "m"],
      ["Cáp ra khu ngoài nhà", A.DIEN_NHE.lNgoai, "m"], ["Cáp nguồn từ tủ điện tới tủ rack", A.DIEN_NHE.lNguonRack, "m"],
      ["Cổng tầng gốc: 1 nút gọi chuông + 1 cửa ACS; phòng khách / sảnh: 1 màn hình chuông", "", ""],
    ],
  },
];

const out = {
  trangThai: QUY_TAC.trangThai, phienBan: QUY_TAC.phienBan, nguon: NGUON, nhom: NHOM,
  thamSo: THAM_SO.map((x) => ({ nhom: x.nhom, ma: x.ma, ten: x.ten, giaTri: giaTriHienThi(x, rule), donVi: x.donVi, canCu: x.canCu, nguon: x.nguon, uuTien: !!x.uuTien })),
  loaiMach: Object.entries(rule.loaiMach).map(([ten, v]) => ({ ten, cos: v.cos, inMin: v.inMin, curve: v.curve, rcd: RCD[v.rcd] ?? v.rcd, sMin: v.sMin })),
  bang: BANG.map((b) => ({
    ma: b.ma, ten: b.ten, canCu: b.canCu, nguon: b.nguon, uuTien: !!b.uuTien, nhanCot: b.nhanCot,
    cot: typeof b.cot === "function" ? b.cot(rule) : b.cot, dong: b.dong(rule).map((r) => r.map(so)),
  })),
  trongCode: TRONG_CODE,
  giaDinh,
};
process.stdout.write(JSON.stringify(out));
