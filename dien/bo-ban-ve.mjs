// Dữ liệu dự án → kết quả tính + cả bộ tờ vẽ (sơ đồ tổng, các tờ tủ đã tự ngắt) + nhãn.
// Dùng chung cho lệnh tao-bo-ban-ve.mjs (Node) và web app dien/app (trình duyệt).

import { tinhDuAn } from "./engine/cay-tu.mjs";
import { coDienNhe, sangDienNhe, tinhDienNhe } from "./engine/dien-nhe.mjs";
import { xuatDienNheExcel } from "./engine/dien-nhe-excel.mjs";
import { taoQuyTac } from "./engine/quy-tac.mjs";
import { veDienNhe } from "./template/dien-nhe.mjs";
import { tinhBoq, xuatBoqExcel } from "./engine/boq.mjs";
import { nhanHtml, xuatNhanExcel } from "./engine/nhan.mjs";
import { sangBoBanVe } from "./engine/sang-ban-ve.mjs";
import { noiDungThuyetMinh, thuyetMinhHtml } from "./engine/thuyet-minh.mjs";
import { thuyetMinhDocx } from "./engine/thuyet-minh-docx.mjs";
import { SO_COT_TOI_DA, veSoDoTu } from "./template/mau-indust.mjs";
import { veSoDoTong } from "./template/so-do-tong.mjs";
import { taoDxf } from "./template/ve-dxf.mjs";
import { taoDxfR12 } from "./template/ve-dxf-r12.mjs";
import { taoSvg } from "./template/ve-svg.mjs";

export const MUC = { loi: "Lỗi", canhbao: "Cảnh báo", ghichu: "Ghi chú" };

/**
 * @param {object} duAn — { info, panels, circuits, quyTac } (docExcel)
 * @returns {{ kq, to: object[], soTheoTu: Map, nhanHtml: () => string, nhanExcel: (XLSX) => object,
 *   thuyetMinh: () => object, thuyetMinhHtml: () => string, thuyetMinhDocx: (docx) => object,
 *   boq: (opt) => object, boqExcel: (XLSX, opt) => object }}
 *   Mỗi tờ: { loai: "tong"|"tu", ma, ten, thu, tong, du, tenFile, svg, dxf(), r12() }
 */
export function taoBoBanVe(duAn) {
  const vao = structuredClone(duAn);
  // Điện nhẹ tính trước: nguồn cho tủ rack thành mạch trong tủ điện cấp, rồi mới tính cả hệ điện
  const dn = coDienNhe(vao.dienNhe, vao.circuits) ? tinhDienNhe(vao.dienNhe || {}, taoQuyTac(vao.quyTac || {}), { panels: vao.panels, circuits: vao.circuits }) : null;
  if (dn) {
    vao.circuits = [...vao.circuits, ...dn.machThem];
    // Thiết bị KNX (actuator, nguồn bus, giao diện IP) vào tủ điện: tính vào số module, cỡ vỏ tủ
    for (const p of vao.panels) { const x = dn.thietBiTu.get(p.ma); if (x) p.thietBiThem = [...(p.thietBiThem || []), ...x]; }
  }
  const kq = tinhDuAn(vao);
  const bo = sangBoBanVe(kq, duAn.info, { toiDa: SO_COT_TOI_DA });
  for (const c of bo.canhBao) kq.canhBao.push({ muc: "canhbao", tu: c.tu, mach: "", noiDung: c.noiDung });
  if (dn) {
    kq.dienNhe = dn;
    kq.canhBao.push(...dn.canhBao);
    const toDn = sangDienNhe(dn, kq, duAn.info || {});
    dn.soTheoRack = toDn.soTheoRack;
    // Mạch nguồn rack: ghi số tờ tủ rack vào ghi chú (tham chiếu chéo)
    for (const t of kq.tu) for (const m of t.mach) if (m.nguon?.tuDienNhe) m.nguon.ghiChu = `${m.nguon.ghiChu} — xem ${toDn.soTheoRack.get(m.nguon.tuDienNhe)}`;
    bo.to.push(...toDn.to);
  }
  const to = bo.to.map((x) => {
    const ve = x.loai === "tong" ? veSoDoTong : x.loai === "dn" ? veDienNhe : veSoDoTu;
    const svg = taoSvg();
    for (const w of ve(svg, x.du)) kq.canhBao.push({ muc: "ghichu", tu: x.loai === "tu" ? x.ma : "", mach: "", noiDung: `Bố cục ${x.du.sheet.drawingNo}: ${w}` });
    return {
      ...x,
      tenFile: `${x.du.sheet.drawingNo}-${x.ma}`.replace(/[\\/:*?"<>|]/g, "-"),
      svg: svg.toString(),
      dxf: () => { const g = taoDxf(); ve(g, x.du); return g.toString(); },
      r12: () => { const g = taoDxfR12(); ve(g, x.du); return g.toString(); },
    };
  });
  // Thuyết minh dựng lúc gọi (không dựng sẵn) để lấy cả các cảnh báo bổ sung sau khi tính, ví dụ lỗi đọc file
  const thuyetMinh = () => noiDungThuyetMinh(kq, duAn.info, { soTheoTu: bo.soTheoTu });
  return {
    kq, to, soTheoTu: bo.soTheoTu, dienNhe: dn,
    /** Điện nhẹ ra Excel (Tong hop rack, Dau noi, Thiet bi, Canh bao); null khi dự án không có điện nhẹ */
    dienNheExcel: (XLSX) => (dn ? xuatDienNheExcel(XLSX, dn, kq, duAn.info) : null),
    nhanHtml: () => nhanHtml(kq, duAn.info),
    nhanExcel: (XLSX) => xuatNhanExcel(XLSX, kq, duAn.info),
    thuyetMinh,
    thuyetMinhHtml: () => thuyetMinhHtml(thuyetMinh()),
    /** docx: thư viện npm "docx" — đóng gói bằng docx.Packer.toBuffer (Node) / toBlob (trình duyệt) */
    thuyetMinhDocx: (docx) => thuyetMinhDocx(docx, thuyetMinh()),
    /** BOQ điện: khối lượng thiết bị, phụ kiện, dây/cáp, ống. opt: { haoHut } (%) */
    boq: (opt) => tinhBoq(kq, { bocKhoi: duAn.bocKhoi, ...opt }),
    /** BOQ ra Excel (sheet BOQ, Bang gia, Chi tiet). opt: { haoHut, bangGia } — bangGia từ engine/boq.mjs docBangGia */
    boqExcel: (XLSX, { haoHut, bangGia } = {}) => xuatBoqExcel(XLSX, tinhBoq(kq, { haoHut, bocKhoi: duAn.bocKhoi }), duAn.info, { bangGia }),
  };
}

/** Danh sách lỗi/cảnh báo/ghi chú dạng văn bản (mỗi dòng một mục, phân cách bằng tab). */
export function vanBanCanhBao(kq) {
  return ["loi", "canhbao", "ghichu"]
    .flatMap((m) => kq.canhBao.filter((c) => c.muc === m).map((c) => `${MUC[m].toUpperCase()}\t${c.tu}\t${c.mach}\t${c.noiDung}`))
    .join("\n") + "\n";
}
