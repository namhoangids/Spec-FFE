// Công trình dùng chung giữa các app M&M: app Dự toán (Báo giá) giữ danh sách công trình ở `baogia/main.projects`,
// app FF&E giữ bảng kê ở `ffe_projects/{id}`. Cùng một công trình có thể mang hai mã khác nhau ở hai nơi
// (ví dụ "hado" bên Dự toán, "hado-charm-villas" bên FF&E), nên ghép theo TÊN đã chuẩn hóa — đúng cách app FF&E
// đang làm (mergedProjects). App điện chỉ ĐỌC hai danh sách này, không ghi.
// Module thuần (không DOM, không Firebase) để test được bằng node.

/** Chuẩn hóa tên như slugifyVi của app FF&E: bỏ dấu, chữ thường, ký tự lạ thành "-" */
export const slug = (s) => String(s || "").replace(/đ/g, "d").replace(/Đ/g, "D")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/**
 * Ghép danh sách công trình của app Dự toán và danh sách bảng kê FF&E.
 * @param {{ id, name, client?, type? }[]} master — baogia/main.projects
 * @param {{ id, name, itemCount?, rooms? }[]} ffe — ffe_projects
 * @returns {{ key, ten, client, loai, masterId, ffeId, soHangMuc, phong }[]} sắp theo tên
 */
export function ghepCongTrinh(master = [], ffe = []) {
  const m = new Map();
  for (const p of ffe) {
    if (!p?.id) continue;
    const ten = p.name || p.id, key = slug(ten);
    m.set(key, { key, ten, client: "", loai: "", masterId: null, ffeId: p.id, soHangMuc: p.itemCount || 0, phong: p.rooms || [] });
  }
  for (const p of master) {
    if (!p?.id || !p.name) continue;
    const key = slug(p.name), hit = m.get(key);
    if (hit) Object.assign(hit, { masterId: p.id, client: p.client || "", loai: p.type || "" });
    else m.set(key, { key, ten: p.name, client: p.client || "", loai: p.type || "", masterId: p.id, ffeId: null, soHangMuc: 0, phong: [] });
  }
  return [...m.values()].sort((a, b) => a.ten.localeCompare(b.ten, "vi"));
}

/** Tìm công trình theo mã (Dự toán hoặc FF&E), khóa, hoặc tên */
export function timCongTrinh(ds, x) {
  if (!x) return null;
  const s = String(x).trim();
  return ds.find((c) => c.masterId === s || c.ffeId === s || c.key === s) || ds.find((c) => c.key === slug(s)) || null;
}

/** Liên kết đã lưu ở dự án điện có trỏ tới công trình `ct` không (khớp mã nào cũng được, hoặc khóa tên) */
export function cungCongTrinh(lienKet, ct) {
  if (!lienKet || !ct) return false;
  return (lienKet.ffeId && lienKet.ffeId === ct.ffeId) || (lienKet.masterId && lienKet.masterId === ct.masterId) || lienKet.key === ct.key;
}

/** Link mở bảng kê FF&E của công trình. FF&E tự tạo bảng kê rỗng khi mở bằng mã của app Dự toán. */
export function linkFfe(lienKet, url) {
  const id = lienKet?.ffeId || lienKet?.masterId;
  return url && id ? `${url}#/${encodeURIComponent(id)}/schedule` : null;
}

/**
 * Gắn dự án điện với công trình (null = bỏ gắn). Khung tên chỉ điền ô đang trống (tên dự án, chủ đầu tư).
 * @returns {{ duAn, daDien: string[] }} — duAn mới (không sửa bản gốc), daDien: các ô khung tên vừa điền
 */
export function ganCongTrinh(duAn, ct) {
  const ra = { ...duAn, info: { ...(duAn.info || {}) } };
  if (!ct) { delete ra.congTrinh; return { duAn: ra, daDien: [] }; }
  ra.congTrinh = { key: ct.key, ten: ct.ten, client: ct.client || "", masterId: ct.masterId || null, ffeId: ct.ffeId || null };
  const daDien = [];
  if (!String(ra.info.project || "").trim() && ct.ten) { ra.info.project = ct.ten; daDien.push("tên dự án"); }
  if (!String(ra.info.client || "").trim() && ct.client) { ra.info.client = ct.client; daDien.push("chủ đầu tư"); }
  return { duAn: ra, daDien };
}
