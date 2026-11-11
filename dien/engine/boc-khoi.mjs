// Bóc khối từ mặt bằng AutoCAD: đọc bảng DATAEXTRACTION (CSV / Excel), quy đổi tên block ra thiết bị,
// rồi áp vào dữ liệu dự án.
//
// Hai kiểu block (dùng lẫn trong một file được):
//  - Block CÓ thuộc tính MACH (và TU, CS): công suất từng mạch = Σ số lượng × W → ghi vào mạch,
//    mạch chưa có thì tạo mới (kèm cảnh báo cần chiều dài).
//  - Block CHỈ CÓ TÊN: không sửa mạch, chỉ đếm số lượng theo loại / layer / phòng để kỹ sư gán mạch.
// Block không có trong bảng quy đổi (và không có thuộc tính CS) được liệt kê riêng, không bị bỏ qua.
// Số lượng thiết bị (đèn, ổ cắm, công tắc…) lưu vào duAn.bocKhoi để BOQ thêm nhóm "Thiết bị điện".

import { QUY_DOI_BLOCK } from "./quy-doi-block.mjs";

const boDau = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
const khoaCot = (s) => boDau(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const so = (x) => {
  if (x === "" || x == null) return null;
  if (typeof x === "number") return x;
  const t = String(x).trim().replace(/\s*w$/i, "").replace(",", ".");
  return t === "" || Number.isNaN(Number(t)) ? null : Number(t);
};

// Tiêu đề cột chấp nhận (đã bỏ dấu, chữ thường, ký tự lạ thành dấu cách)
const COT = {
  sl: ["count", "so luong", "sl", "qty", "quantity"],
  ten: ["name", "block name", "ten", "ten block", "block"],
  layer: ["layer"],
  tu: ["tu", "panel", "ma tu"],
  mach: ["mach", "circuit", "ma lo", "ma mach"],
  w: ["cs", "cong suat", "watt", "w", "power"],
  phong: ["phong", "room"],
};

/** CSV đơn giản theo RFC 4180: tự nhận dấu phân cách , ; hoặc tab theo dòng đầu; hỗ trợ ngoặc kép. */
function docCsv(text) {
  text = text.replace(/^﻿/, "");
  const dau = text.split(/\r?\n/, 1)[0];
  const sep = [";", "\t", ","].map((c) => [c, dau.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], o = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { o += '"'; i++; }
      else if (c === '"') q = false;
      else o += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(o); o = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(o); rows.push(row); row = []; o = "";
    } else o += c;
  }
  if (o !== "" || row.length) { row.push(o); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
}

/** Byte đầu là ZIP (xlsx) hoặc OLE (xls) thì đọc bằng SheetJS; còn lại coi là CSV văn bản. */
function laExcel(u8) {
  return (u8[0] === 0x50 && u8[1] === 0x4b) || (u8[0] === 0xd0 && u8[1] === 0xcf);
}

/**
 * Đọc bảng DATAEXTRACTION.
 * @param {object} XLSX — SheetJS
 * @param {Uint8Array|ArrayBuffer|string} data — nội dung file (.csv / .xlsx / .xls)
 * @returns {{ dong: { ten, sl, tu, mach, w, phong, layer }[], cot: string[] }}
 */
export function docBocKhoi(XLSX, data) {
  let rows;
  if (typeof data === "string") rows = docCsv(data);
  else {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (laExcel(u8)) {
      const wb = XLSX.read(u8, { type: "array" });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    } else rows = docCsv(new TextDecoder("utf-8").decode(u8));
  }
  // Dòng tiêu đề: trong 10 dòng đầu, dòng có cả cột tên block và cột số lượng (DATAEXTRACTION có thể có dòng tiêu đề bảng ở trên)
  const viTri = (r) => Object.fromEntries(Object.entries(COT).map(([k, ds]) => [k, r.findIndex((x) => ds.includes(khoaCot(x)))]));
  const iDau = rows.slice(0, 10).findIndex((r) => { const v = viTri(r); return v.ten >= 0 && v.sl >= 0; });
  if (iDau < 0) {
    const v = viTri(rows[0] ?? []);
    const thieu = [v.ten < 0 && "tên block (Name / Tên block)", v.sl < 0 && "số lượng (Count / Số lượng)"].filter(Boolean);
    throw new Error(`File bóc khối thiếu cột ${thieu.join(" và ")}. Xuất lại DATAEXTRACTION có các cột này.`);
  }
  const v = viTri(rows[iDau]);
  const lay = (r, k) => (v[k] >= 0 ? String(r[v[k]] ?? "").trim() : "");
  const dong = [];
  for (const r of rows.slice(iDau + 1)) {
    const ten = lay(r, "ten");
    if (!ten || /^(tổng|tong|total)$/i.test(ten)) continue;
    dong.push({
      ten, sl: so(lay(r, "sl")) ?? 1, tu: lay(r, "tu"), mach: lay(r, "mach"),
      w: v.w >= 0 ? so(lay(r, "w")) : null, phong: lay(r, "phong"), layer: lay(r, "layer"),
    });
  }
  return { dong, cot: rows[iDau].map(String) };
}

/**
 * Đọc bảng quy đổi riêng từ Excel (sheet "Quy doi block", hoặc sheet đầu):
 * Mẫu tên block | Nhóm | Mô tả | Loại mạch | W | Tính công suất (Có/Không) | ĐVT
 */
export function docQuyDoi(XLSX, data) {
  const wb = XLSX.read(data instanceof Uint8Array || ArrayBuffer.isView(data) ? data : new Uint8Array(data), { type: "array" });
  const ws = wb.Sheets["Quy doi block"] ?? wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const iDau = rows.findIndex((r) => /^m[aẫ]u/i.test(boDau(r[0]).trim()));
  return rows.slice(iDau + 1).filter((r) => String(r[0]).trim()).map((r) => ({
    mau: String(r[0]).trim(), nhom: String(r[1] || "Thiết bị").trim(), moTa: String(r[2] || r[0]).trim(),
    loaiMach: String(r[3] || "").trim() || undefined, w: so(r[4]) ?? 0,
    tinhCongSuat: !/^(khong|no|0|false)$/i.test(boDau(r[5]).trim()), dvt: String(r[6] || "").trim() || undefined,
  }));
}

/** Biên dịch bảng quy đổi: "*" là ký tự đại diện, so khớp cả tên (bỏ dấu, không phân biệt hoa thường). */
function bienDich(quyDoi) {
  return quyDoi.map((q) => ({
    ...q,
    re: new RegExp(`^${boDau(q.mau).toUpperCase().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`),
  }));
}

/**
 * Áp bóc khối vào dữ liệu dự án (không sửa dữ liệu gốc).
 * @param {object} duAn — { info, panels, circuits, … }
 * @param {{ ten, sl, tu, mach, w, phong, layer }[]} dong — từ docBocKhoi
 * @param {{ quyDoi?: object[], tenFile?: string }} opt — quyDoi: bảng riêng đặt TRƯỚC bảng mẫu
 */
export function apDungBocKhoi(duAn, dong, { quyDoi = QUY_DOI_BLOCK, tenFile = "" } = {}) {
  const ra = structuredClone(duAn);
  const bang = bienDich(quyDoi);
  const timQuyDoi = (ten) => bang.find((q) => q.re.test(boDau(ten).toUpperCase()));
  const canhBao = [];
  const bao = (muc, tu, mach, noiDung) => canhBao.push({ muc, tu: tu || "", mach: mach || "", noiDung: `Bóc khối: ${noiDung}` });
  const maTu = new Set(ra.panels.map((p) => p.ma));
  const cungMa = (a, b) => String(a).trim().toUpperCase() === String(b).trim().toUpperCase();

  const theoMach = new Map();          // "tu|mach" → { tu, mach, thanhPhan: Map(moTa → { sl, w, loaiMach }) }
  const theoLoai = new Map();          // "nhom|moTa" → { nhom, moTa, dvt, sl }
  const theoNoi = new Map();           // "layer|phong|moTa" → { layer, phong, moTa, sl }
  const khongNhanDien = new Map();     // ten → { ten, sl, layer, coCs }
  let soDongMach = 0;

  for (const d of dong) {
    const q = timQuyDoi(d.ten);
    const moTa = q?.moTa ?? d.ten;
    if (!q) {
      const k = khongNhanDien.get(d.ten) ?? { ten: d.ten, sl: 0, layers: new Set(), coCs: d.w != null };
      k.sl += d.sl; if (d.layer) k.layers.add(d.layer);
      khongNhanDien.set(d.ten, k);
    }
    // Số lượng thiết bị (cho BOQ và báo cáo): block lạ có CS vẫn đếm, block lạ không CS thì chỉ nằm ở danh sách riêng
    if (q || d.w != null) {
      const k = `${q?.nhom ?? "Khác"}|${moTa}`;
      const t = theoLoai.get(k) ?? { nhom: q?.nhom ?? "Khác", moTa, dvt: q?.dvt ?? "cái", sl: 0 };
      t.sl += d.sl; theoLoai.set(k, t);
      const kn = `${d.layer}|${d.phong}|${moTa}`;
      const n = theoNoi.get(kn) ?? { layer: d.layer, phong: d.phong, moTa, sl: 0 };
      n.sl += d.sl; theoNoi.set(kn, n);
    }
    if (!d.mach) continue;
    soDongMach++;

    // Xác định tủ: thuộc tính TU; thiếu thì tìm tủ duy nhất có mạch mã này; dự án một tủ thì lấy tủ đó
    let tu = d.tu;
    if (tu && !maTu.has(tu)) { bao("loi", tu, d.mach, `block ${d.ten} ghi tủ "${tu}" không có trong dữ liệu`); continue; }
    if (!tu) {
      const tus = [...new Set(ra.circuits.filter((c) => cungMa(c.ma, d.mach)).map((c) => c.tu))];
      if (tus.length === 1) tu = tus[0];
      else if (tus.length > 1) { bao("loi", "", d.mach, `mã mạch ${d.mach} có ở nhiều tủ (${tus.join(", ")}) — block ${d.ten} cần thuộc tính TU`); continue; }
      else if (maTu.size === 1) tu = [...maTu][0];
      else { bao("loi", "", d.mach, `không xác định được tủ cho mạch ${d.mach} (block ${d.ten}) — thêm thuộc tính TU`); continue; }
    }
    const w = d.w ?? (q ? (q.tinhCongSuat === false ? 0 : q.w) : null);
    if (w == null) continue;           // block lạ không có CS: đã liệt kê ở "không nhận diện"
    const k = `${tu}|${d.mach.trim().toUpperCase()}`;
    const m = theoMach.get(k) ?? { tu, mach: d.mach.trim(), thanhPhan: new Map() };
    const tp = m.thanhPhan.get(moTa) ?? { sl: 0, w, loaiMach: q?.loaiMach };
    tp.sl += d.sl;
    m.thanhPhan.set(moTa, tp);
    theoMach.set(k, m);
  }

  // Ghi công suất vào mạch
  const ketQuaMach = [];
  for (const m of theoMach.values()) {
    const tp = [...m.thanhPhan.entries()];
    const P = tp.reduce((a, [, x]) => a + x.sl * x.w, 0);
    const moTaTp = tp.map(([moTa, x]) => `${x.sl} × ${moTa}${x.w ? ` ${x.w} W` : ""}`).join(" + ");
    const ghiChu = `bóc khối${tenFile ? ` (${tenFile})` : ""}: ${moTaTp}`;
    const c = ra.circuits.find((x) => x.tu === m.tu && cungMa(x.ma, m.mach));
    if (c) {
      const pCu = (c.soLuong || 1) * (c.congSuat || 0);
      if (P > 0) {
        Object.assign(c, { congSuat: P, soLuong: 1 });
        // Ghi chú "giả định" cũ không còn đúng khi đã có số liệu từ bản vẽ
        c.ghiChu = [ghiChu, ...String(c.ghiChu || "").split(";").map((s) => s.trim()).filter((s) => s && !/^giả định|^bóc khối/i.test(s))].join("; ");
      } else bao("canhbao", m.tu, m.mach, `chỉ có thiết bị không tính công suất (${moTaTp}) — giữ công suất cũ ${pCu} W`);
      ketQuaMach.push({ tu: m.tu, mach: c.ma, moi: false, pCu, pMoi: P > 0 ? P : pCu, thanhPhan: moTaTp });
    } else {
      // Mạch mới: loại mạch theo thành phần chiếm nhiều công suất nhất (hoặc nhiều số lượng nhất nếu cùng 0 W)
      const chinh = tp.slice().sort((a, b) => b[1].sl * b[1].w - a[1].sl * a[1].w || b[1].sl - a[1].sl)[0];
      ra.circuits.push({
        tu: m.tu, ma: m.mach, loai: chinh[1].loaiMach || "Chiếu sáng trong nhà",
        phuTai: tp.map(([moTa]) => moTa).join(", ").toUpperCase(), soLuong: 1, congSuat: P, ghiChu,
      });
      bao("canhbao", m.tu, m.mach, `tạo mạch mới ${m.mach} (${P} W) — cần nhập chiều dài, loại khu vực và kiểm lại loại mạch`);
      ketQuaMach.push({ tu: m.tu, mach: m.mach, moi: true, pCu: null, pMoi: P, thanhPhan: moTaTp });
    }
  }

  const dsKhong = [...khongNhanDien.values()].map((k) => ({ ten: k.ten, sl: k.sl, layer: [...k.layers].join(", "), coCs: k.coCs }));
  for (const k of dsKhong) {
    bao(k.coCs ? "ghichu" : "canhbao", "", "", `block "${k.ten}" (${k.sl} cái) không có trong bảng quy đổi${k.coCs ? " — vẫn tính theo thuộc tính CS" : " — chưa tính công suất, bổ sung vào bảng quy đổi"}`);
  }
  if (!soDongMach && dong.length) {
    bao("ghichu", "", "", "block không có thuộc tính MACH — chỉ đếm số lượng theo loại / layer / phòng, chưa sửa công suất mạch");
  }
  const dsLoai = [...theoLoai.values()].sort((a, b) => a.nhom.localeCompare(b.nhom, "vi") || a.moTa.localeCompare(b.moTa, "vi"));
  ra.bocKhoi = { nguon: tenFile, theoLoai: dsLoai };
  return {
    duAn: ra,
    baoCao: {
      tenFile, cheDo: soDongMach ? (soDongMach === dong.length ? "thuộc tính" : "thuộc tính + tên block") : "tên block",
      soDong: dong.length, theoMach: ketQuaMach, theoLoai: dsLoai,
      theoNoi: [...theoNoi.values()].sort((a, b) => `${a.layer}|${a.phong}`.localeCompare(`${b.layer}|${b.phong}`, "vi") || a.moTa.localeCompare(b.moTa, "vi")),
      khongNhanDien: dsKhong, canhBao,
    },
  };
}

/** Báo cáo bóc khối ra Excel: Theo mach, Theo loai (kèm theo layer / phòng), Khong nhan dien, Canh bao. */
export function xuatBaoCaoBocKhoi(XLSX, bc) {
  const wb = XLSX.utils.book_new();
  const sheet = (ten, aoa, rong) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = rong.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, ten);
  };
  const dau = [`Bóc khối${bc.tenFile ? `: ${bc.tenFile}` : ""} — ${bc.soDong} dòng, kiểu ${bc.cheDo}`];
  sheet("Theo mach", [dau, [], ["Tủ", "Mạch", "Mạch mới", "P cũ (W)", "P mới (W)", "Thành phần"],
    ...bc.theoMach.map((m) => [m.tu, m.mach, m.moi ? "Có" : "", m.pCu ?? "", m.pMoi, m.thanhPhan])], [8, 10, 9, 10, 10, 90]);
  sheet("Theo loai", [dau, [], ["Nhóm", "Thiết bị", "ĐVT", "Số lượng"], ...bc.theoLoai.map((t) => [t.nhom, t.moTa, t.dvt, t.sl]),
    [], ["Layer", "Phòng", "Thiết bị", "Số lượng"], ...bc.theoNoi.map((n) => [n.layer, n.phong, n.moTa, n.sl])], [16, 40, 8, 10]);
  sheet("Khong nhan dien", [dau, [], ["Tên block", "Số lượng", "Layer", "Có thuộc tính CS"],
    ...bc.khongNhanDien.map((k) => [k.ten, k.sl, k.layer, k.coCs ? "Có" : ""])], [30, 10, 30, 16]);
  sheet("Canh bao", [dau, [], ["Mức", "Tủ", "Mạch", "Nội dung"],
    ...bc.canhBao.map((c) => [({ loi: "LỖI", canhbao: "CẢNH BÁO", ghichu: "GHI CHÚ" })[c.muc], c.tu, c.mach, c.noiDung])], [10, 8, 10, 110]);
  return wb;
}
