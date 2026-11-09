// Dữ liệu dự án → kết quả tính + từng tờ vẽ (SVG, DXF 2007, DXF R12).
// Dùng chung cho lệnh tao-bo-ban-ve.mjs (Node) và web app dien/app (trình duyệt).

import { tinhDuAn } from "./engine/cay-tu.mjs";
import { sangBoBanVe } from "./engine/sang-ban-ve.mjs";
import { veSoDoTu } from "./template/mau-indust.mjs";
import { taoDxf } from "./template/ve-dxf.mjs";
import { taoDxfR12 } from "./template/ve-dxf-r12.mjs";
import { taoSvg } from "./template/ve-svg.mjs";

export const MUC = { loi: "Lỗi", canhbao: "Cảnh báo", ghichu: "Ghi chú" };

/**
 * @param {object} duAn — { info, panels, circuits, quyTac } (docExcel)
 * @returns {{ kq, to: Array<{ ma, ten, du, tenFile, svg: string, dxf: () => string, r12: () => string }> }}
 */
export function taoBoBanVe(duAn) {
  const kq = tinhDuAn(structuredClone(duAn));
  const to = sangBoBanVe(kq, duAn.info).map(({ ma, ten, du }) => {
    const svg = taoSvg();
    for (const w of veSoDoTu(svg, du)) kq.canhBao.push({ muc: "ghichu", tu: ma, mach: "", noiDung: `Bố cục: ${w}` });
    return {
      ma, ten, du,
      tenFile: `${du.sheet.drawingNo}-${ma}`.replace(/[\\/:*?"<>|]/g, "-"),
      svg: svg.toString(),
      dxf: () => { const g = taoDxf(); veSoDoTu(g, du); return g.toString(); },
      r12: () => { const g = taoDxfR12(); veSoDoTu(g, du); return g.toString(); },
    };
  });
  return { kq, to };
}

/** Danh sách lỗi/cảnh báo/ghi chú dạng văn bản (mỗi dòng một mục, phân cách bằng tab). */
export function vanBanCanhBao(kq) {
  return ["loi", "canhbao", "ghichu"]
    .flatMap((m) => kq.canhBao.filter((c) => c.muc === m).map((c) => `${MUC[m].toUpperCase()}\t${c.tu}\t${c.mach}\t${c.noiDung}`))
    .join("\n") + "\n";
}
