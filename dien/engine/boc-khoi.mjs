// Bóc khối từ mặt bằng AutoCAD: đọc bảng DATAEXTRACTION (CSV / Excel), quy đổi tên block ra thiết bị,
// rồi áp vào dữ liệu dự án.
//
// Hai kiểu block (dùng lẫn trong một file được):
//  - Block CÓ thuộc tính MACH (và TU, CS): công suất từng mạch = Σ số lượng × W → ghi vào mạch,
//    mạch chưa có thì tạo mới (kèm cảnh báo cần chiều dài).
//  - Block CHỈ CÓ TÊN: không sửa mạch, chỉ đếm số lượng theo loại / layer / phòng để kỹ sư gán mạch.
// Block không có trong bảng quy đổi (và không có thuộc tính CS) được liệt kê riêng, không bị bỏ qua.
// Số lượng thiết bị (đèn, ổ cắm, công tắc…) lưu vào duAn.bocKhoi để BOQ thêm nhóm "Thiết bị điện".
// Block điện nhẹ (nhóm "Điện nhẹ", có trường dn trong bảng quy đổi) không sửa mạch: số lượng được điền vào
// bảng điện nhẹ theo phòng (duAn.dienNhe.phong) theo thuộc tính TANG / PHONG (thiếu PHONG thì lấy layer),
// kèm RACK, VUNG (vùng âm thanh) nếu có; loa lấy công suất tap từ CS.

import { QUY_DOI_BLOCK, TRUONG_DIEN_NHE } from "./quy-doi-block.mjs";

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
  tang: ["tang", "floor", "level"],
  rack: ["rack", "tu rack"],
  vung: ["vung", "vung am thanh", "zone"],
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
      ...(v.tang >= 0 && lay(r, "tang") ? { tang: lay(r, "tang") } : {}),
      ...(v.rack >= 0 && lay(r, "rack") ? { rack: lay(r, "rack") } : {}),
      ...(v.vung >= 0 && lay(r, "vung") ? { vung: lay(r, "vung") } : {}),
    });
  }
  return { dong, cot: rows[iDau].map(String) };
}

/**
 * Đọc bảng quy đổi riêng từ Excel (sheet "Quy doi block", hoặc sheet đầu):
 * Mẫu tên block | Nhóm | Mô tả | Loại mạch | W | Tính công suất (Có/Không) | ĐVT | Trường điện nhẹ (data, tv, ap, …)
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
    ...(TRUONG_DIEN_NHE.find((f) => f.toLowerCase() === String(r[7] ?? "").trim().toLowerCase())
      ? { dn: TRUONG_DIEN_NHE.find((f) => f.toLowerCase() === String(r[7]).trim().toLowerCase()), nhom: "Điện nhẹ", tinhCongSuat: false } : {}),
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
  const chuan = (x) => boDau(x).trim().toUpperCase().replace(/\s+/g, " ");

  // --- Điện nhẹ: tầng của một phòng khi block không có thuộc tính TANG ---------------------------------
  const phongCo = (ra.dienNhe?.phong || []).filter((p) => p && (p.phong || p.tang));
  const tangCo = [...new Set(phongCo.map((p) => p.tang).filter(Boolean))];
  function timTang(phong) {
    const p = phongCo.find((x) => chuan(x.phong) === chuan(phong) && x.tang);
    if (p) return { tang: p.tang, cach: "" };
    if (tangCo.length === 1) return { tang: tangCo[0], cach: "tầng duy nhất của bảng điện nhẹ" };
    if (ra.panels.length === 1) return { tang: ra.panels[0].ma, cach: "mã tủ (dự án một tủ)" };
    return { tang: "T1", cach: "mặc định" };
  }
  function themDienNhe(d, q) {
    const phong = d.phong || d.layer || "(chưa rõ phòng)";
    const t = d.tang ? { tang: d.tang, cach: "" } : timTang(phong);
    const k = `${chuan(t.tang)}|${chuan(phong)}`;
    const x = dnPhong.get(k) ?? { tang: t.tang, phong, dem: {}, wLoa: 0, csLoa: 0, cachTang: t.cach };
    x.dem[q.dn] = (x.dem[q.dn] || 0) + d.sl;
    if (q.dn === "loa" && d.w != null) { x.wLoa += d.w * d.sl; x.csLoa += d.sl; }
    if (d.rack) x.rack = d.rack;
    if (d.vung) x.vung = d.vung;
    dnPhong.set(k, x);
  }

  const theoMach = new Map();          // "tu|mach" → { tu, mach, thanhPhan: Map(moTa → { sl, w, loaiMach }) }
  const theoLoai = new Map();          // "nhom|moTa" → { nhom, moTa, dvt, sl }
  const theoNoi = new Map();           // "layer|phong|moTa" → { layer, phong, moTa, sl }
  const khongNhanDien = new Map();     // ten → { ten, sl, layer, coCs }
  const dnPhong = new Map();           // "tầng|phòng" (đã chuẩn hóa) → { tang, phong, dem: {trường: sl}, wLoa, rack, vung, tuTang }
  let soDongMach = 0, soDongDn = 0;

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
    if (q?.nhom === "Điện nhẹ") {
      soDongDn++;
      if (q.dn) themDienNhe(d, q);
      continue;                        // block điện nhẹ không sửa mạch điện (bỏ qua MACH nếu có)
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
  if (!soDongMach && dong.length > soDongDn) {
    bao("ghichu", "", "", "block không có thuộc tính MACH — chỉ đếm số lượng theo loại / layer / phòng, chưa sửa công suất mạch");
  }
  const dienNhe = gopDienNhe(ra, dnPhong, { tenFile, bao, chuan });
  const dsLoai = [...theoLoai.values()].sort((a, b) => a.nhom.localeCompare(b.nhom, "vi") || a.moTa.localeCompare(b.moTa, "vi"));
  ra.bocKhoi = { nguon: tenFile, theoLoai: dsLoai };
  return {
    duAn: ra,
    baoCao: {
      tenFile, cheDo: [soDongMach && "thuộc tính", dong.length - soDongMach - soDongDn > 0 && "tên block", soDongDn && "điện nhẹ"].filter(Boolean).join(" + ") || "tên block",
      soDong: dong.length, theoMach: ketQuaMach, theoLoai: dsLoai, dienNhe,
      theoNoi: [...theoNoi.values()].sort((a, b) => `${a.layer}|${a.phong}`.localeCompare(`${b.layer}|${b.phong}`, "vi") || a.moTa.localeCompare(b.moTa, "vi")),
      khongNhanDien: dsKhong, canhBao,
    },
  };
}

/**
 * Gộp số lượng điện nhẹ bóc được vào ra.dienNhe.phong.
 *  - "Loại có trên mặt bằng" = các trường có ít nhất 1 block trong file. Với phòng có trên mặt bằng, các trường
 *    đó lấy theo số bóc được (0 nếu phòng không có block loại ấy); các trường khác, L, rack, vungAm giữ nguyên.
 *  - Phòng mới: thêm dòng (cần nhập chiều dài cáp). Phòng cũ không có trên mặt bằng: giữ số cũ, cảnh báo.
 * @returns {{ truong: string[], phong: { tang, phong, moi, truoc, sau }[], soMoi, soCapNhat } | null}
 */
function gopDienNhe(ra, dnPhong, { tenFile, bao, chuan }) {
  if (!dnPhong.size) return null;
  const truong = TRUONG_DIEN_NHE.filter((f) => [...dnPhong.values()].some((x) => x.dem[f] > 0));
  ra.dienNhe ||= { phong: [], rack: [] };
  ra.dienNhe.phong ||= [];
  const ds = ra.dienNhe.phong;
  const nhan = `bóc khối${tenFile ? ` (${tenFile})` : ""}`;
  const ketQua = [];
  const daGap = new Set();
  const thieuTang = new Map();
  for (const x of dnPhong.values()) {
    let p = ds.find((r) => chuan(r.tang) === chuan(x.tang) && chuan(r.phong) === chuan(x.phong));
    const moi = !p;
    const truoc = Object.fromEntries(truong.map((f) => [f, p ? Number(p[f]) || 0 : 0]));
    if (moi) { p = { tang: x.tang, phong: x.phong }; ds.push(p); }
    daGap.add(p);
    for (const f of truong) p[f] = x.dem[f] || 0;
    if (truong.includes("loa")) {
      if (x.csLoa) {
        p.loaW = Math.round((x.wLoa / x.csLoa) * 10) / 10;   // tap TB của các loa có CS
        if (x.csLoa !== x.dem.loa) bao("ghichu", x.rack ?? "", x.phong, `điện nhẹ: ${x.phong} chỉ ${x.csLoa}/${x.dem.loa} loa có thuộc tính CS — công suất tap lấy trung bình các loa có CS`);
      }
      if (!p.loa) delete p.loaW;
    }
    if (x.rack) p.rack = x.rack;
    if (x.vung) p.vungAm = x.vung;
    p.ghiChu = [nhan, ...String(p.ghiChu || "").split(";").map((s) => s.trim()).filter((s) => s && !/^giả định|^bóc khối/i.test(s))].join("; ");
    if (x.cachTang) thieuTang.set(x.cachTang, [...(thieuTang.get(x.cachTang) || []), x.phong]);
    if (moi) bao("canhbao", p.rack ?? "", x.phong, `điện nhẹ: thêm phòng ${x.phong} (tầng ${x.tang}) — cần nhập chiều dài cáp ngang L${p.rack ? "" : " và tủ rack phục vụ"}`);
    ketQua.push({ tang: p.tang, phong: p.phong, moi, truoc, sau: Object.fromEntries(truong.map((f) => [f, p[f]])) });
  }
  for (const p of ds) {
    if (daGap.has(p) || !truong.some((f) => Number(p[f]) > 0)) continue;
    bao("canhbao", p.rack ?? "", p.phong, `điện nhẹ: phòng ${p.phong} (tầng ${p.tang ?? "?"}) có ${truong.filter((f) => Number(p[f]) > 0).map((f) => `${p[f]} ${f}`).join(", ")} nhưng không có block nào trên mặt bằng — giữ số cũ; kiểm lại bản vẽ hoặc sửa bảng điện nhẹ`);
  }
  for (const [cach, ds2] of thieuTang) bao("ghichu", "", "", `điện nhẹ: block thiếu thuộc tính TANG — lấy tầng theo ${cach} cho ${ds2.join(", ")}`);
  if (!(ra.dienNhe.rack || []).length) bao("ghichu", "", "", "điện nhẹ: chưa khai tủ rack — công cụ tự dựng rack R1 ở tầng của phòng đầu tiên, cấp nguồn từ tủ gốc; khai sheet Tu rack nếu khác");
  return { truong, phong: ketQua, soMoi: ketQua.filter((x) => x.moi).length, soCapNhat: ketQua.filter((x) => !x.moi).length };
}

/** Báo cáo bóc khối ra Excel: Theo mach, Theo loai (kèm theo layer / phòng), Dien nhe, Khong nhan dien, Canh bao. */
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
  if (bc.dienNhe) {
    const TEN = { data: "Ổ data", tv: "Ổ TV", ap: "AP", camTrong: "Camera trong", camNgoai: "Camera ngoài", chuongNgoai: "Nút gọi chuông",
      chuongTrong: "Màn hình chuông", acs: "Cửa ACS", loa: "Loa", knx: "Phím KNX" };
    const f = bc.dienNhe.truong;
    sheet("Dien nhe", [dau, ["Loại có trên mặt bằng thay số cũ; loại khác, chiều dài, rack giữ nguyên. Ô ghi \"cũ → mới\"."], [],
      ["Tầng", "Phòng", "Phòng mới", ...f.map((x) => TEN[x] ?? x)],
      ...bc.dienNhe.phong.map((p) => [p.tang, p.phong, p.moi ? "Có" : "", ...f.map((x) => (p.moi || p.truoc[x] === p.sau[x] ? p.sau[x] : `${p.truoc[x]} → ${p.sau[x]}`))])],
    [8, 26, 10, ...f.map(() => 12)]);
  }
  sheet("Khong nhan dien", [dau, [], ["Tên block", "Số lượng", "Layer", "Có thuộc tính CS"],
    ...bc.khongNhanDien.map((k) => [k.ten, k.sl, k.layer, k.coCs ? "Có" : ""])], [30, 10, 30, 16]);
  sheet("Canh bao", [dau, [], ["Mức", "Tủ", "Mạch", "Nội dung"],
    ...bc.canhBao.map((c) => [({ loi: "LỖI", canhbao: "CẢNH BÁO", ghichu: "GHI CHÚ" })[c.muc], c.tu, c.mach, c.noiDung])], [10, 8, 10, 110]);
  return wb;
}
