// Dữ liệu dự án → kết quả tính + cả bộ tờ vẽ (sơ đồ tổng, các tờ tủ đã tự ngắt) + nhãn.
// Dùng chung cho lệnh tao-bo-ban-ve.mjs (Node) và web app dien/app (trình duyệt).

import { tinhDuAn } from "./engine/cay-tu.mjs";
import { nhanHtml, xuatNhanExcel } from "./engine/nhan.mjs";
import { sangBoBanVe } from "./engine/sang-ban-ve.mjs";
import { SO_COT_TOI_DA, veSoDoTu } from "./template/mau-indust.mjs";
import { veSoDoTong } from "./template/so-do-tong.mjs";
import { taoDxf } from "./template/ve-dxf.mjs";
import { taoDxfR12 } from "./template/ve-dxf-r12.mjs";
import { taoSvg } from "./template/ve-svg.mjs";

export const MUC = { loi: "Lỗi", canhbao: "Cảnh báo", ghichu: "Ghi chú" };

/**
 * @param {object} duAn — { info, panels, circuits, quyTac } (docExcel)
 * @returns {{ kq, to: object[], soTheoTu: Map, nhanHtml: () => string, nhanExcel: (XLSX) => object }}
 *   Mỗi tờ: { loai: "tong"|"tu", ma, ten, thu, tong, du, tenFile, svg, dxf(), r12() }
 */
export function taoBoBanVe(duAn) {
  const kq = tinhDuAn(structuredClone(duAn));
  const bo = sangBoBanVe(kq, duAn.info, { toiDa: SO_COT_TOI_DA });
  for (const c of bo.canhBao) kq.canhBao.push({ muc: "canhbao", tu: c.tu, mach: "", noiDung: c.noiDung });
  const to = bo.to.map((x) => {
    const ve = x.loai === "tong" ? veSoDoTong : veSoDoTu;
    const svg = taoSvg();
    for (const w of ve(svg, x.du)) kq.canhBao.push({ muc: "ghichu", tu: x.loai === "tong" ? "" : x.ma, mach: "", noiDung: `Bố cục ${x.du.sheet.drawingNo}: ${w}` });
    return {
      ...x,
      tenFile: `${x.du.sheet.drawingNo}-${x.ma}`.replace(/[\\/:*?"<>|]/g, "-"),
      svg: svg.toString(),
      dxf: () => { const g = taoDxf(); ve(g, x.du); return g.toString(); },
      r12: () => { const g = taoDxfR12(); ve(g, x.du); return g.toString(); },
    };
  });
  return {
    kq, to, soTheoTu: bo.soTheoTu,
    nhanHtml: () => nhanHtml(kq, duAn.info),
    nhanExcel: (XLSX) => xuatNhanExcel(XLSX, kq, duAn.info),
  };
}

/** Danh sách lỗi/cảnh báo/ghi chú dạng văn bản (mỗi dòng một mục, phân cách bằng tab). */
export function vanBanCanhBao(kq) {
  return ["loi", "canhbao", "ghichu"]
    .flatMap((m) => kq.canhBao.filter((c) => c.muc === m).map((c) => `${MUC[m].toUpperCase()}\t${c.tu}\t${c.mach}\t${c.noiDung}`))
    .join("\n") + "\n";
}
