// Đổi kết quả tính (tinhDuAn) sang dữ liệu tờ vẽ của template dien/template (veSoDoTu),
// ghi chữ theo đúng kiểu của bản vẽ mẫu E.601: "Cu/PVC 2(1x2,5)mm2 + E(1x2,5)mm2", "ỐNG PVC  Ø 20"…

const so = (x, d = 2) => Number(x).toFixed(d).replace(".", ",");
const tietDien = (s) => String(s).replace(".", ",");

/** Chữ cáp của một mạch hoặc cáp cấp tủ. */
export function chuCap(cap, { soPha = 1, dongCo = false } = {}) {
  if (!cap?.s) return "";
  const s = tietDien(cap.s), pe = tietDien(cap.pe ?? cap.s);
  if (cap.kieu === "nhieuLoi") {
    return `Cu/XLPE/PVC (${cap.soLoi ?? (soPha === 3 ? 4 : 2)}x${s})mm2 + E(1x${pe})mm2`;
  }
  const n = soPha === 3 ? (dongCo ? 3 : 4) : 2;
  return `Cu/PVC ${n}(1x${s})mm2 + E(1x${pe})mm2`;
}

/** Thiết bị → 4 dòng nhãn của ký hiệu aptomat. RCBO/RCCB ghi dòng rò ở dòng 4 như mẫu. */
export function chuThietBi(tb) {
  if (!tb) return { type: "", poles: "", rating: "", breaking: "" };
  const ro = tb.loai === "RCBO" || tb.loai === "RCCB";
  return {
    type: tb.loai,
    poles: tb.soCuc,
    rating: `${tb.in}A`,
    breaking: ro ? `${tb.idn ?? 30}mA` : tb.icu != null ? `${tb.icu}kA` : "",
  };
}

/** "E.601" + 2 → "E.603" (giữ số chữ số). */
export function soBanVe(dau = "E.601", i = 0) {
  const m = String(dau).match(/^(.*?)(\d+)$/);
  if (!m) return `${dau}-${i + 1}`;
  return m[1] + String(Number(m[2]) + i).padStart(m[2].length, "0");
}

const hoa = (s) => String(s ?? "").toLocaleUpperCase("vi");

/** Thông tin khung tên chung của mọi tờ. */
function khungTen(info, drawingNo, title) {
  return {
    drawingNo, title,
    companyInfo: info.companyInfo ?? "",
    client: info.client ?? "",
    address: info.address ?? "",
    project: info.project ?? "",
    date: info.date ?? "",
    scale: info.scale ?? "",
    director: info.director ?? "",
    design: info.design ?? "",
    checkBy: info.checkBy ?? "",
    madeBy: info.madeBy ?? "",
    projectNo: info.projectNo ?? "",
  };
}

const chuCapMach = (m) => (m.ghiDe?.cap && m.cap?.ghiDe ? m.ghiDe.cap : chuCap(m.cap, { soPha: m.soPha, dongCo: m.kieu?.dongCo }));
const tenVoTu = (t) => (t.module?.voTu ? `TỦ ĐIỆN ${t.module.voTu} MODULE` : "TỦ ĐIỆN");

/**
 * Dữ liệu một tờ của tủ.
 * @param {object} t — một tủ trong kq.tu
 * @param {object} info — duAn.info (khung tên)
 * @param {object} [o] — { drawingNo, phan: chỉ số mạch trên tờ này, thu, tong, truoc, sau }
 */
export function sangToTu(t, info = {}, o = {}) {
  const { drawingNo = soBanVe(info.soBanVeDau || "E.601", 0), phan = null, thu = 0, tong = 1, truoc = null, sau = null } = o;
  const chiSo = phan ?? t.mach.map((_, i) => i);
  const dau = thu === 0;
  const sheet = khungTen(info, drawingNo, `SƠ ĐỒ NGUYÊN LÝ ĐIỆN ${hoa(t.ten)}${tong > 1 ? ` (${thu + 1}/${tong})` : ""}`);
  const panel = {
    name: tenVoTu(t),
    supplyCable: dau ? [chuCap(t.capNguon, { soPha: t.soPha }), t.capNguon ? t.ongNguon || "" : ""] : [],
    incomer: dau ? chuThietBi(t.cbTong) : null,
    loadText: dau ? [`Pđ=${so(t.pd)} kW, Kđt=${so(t.ks)}`, `Ptt=${so(t.ptt)} kW`] : [],
  };
  const mach = chiSo.map((i) => t.mach[i]);
  const ma = new Set(mach.map((m) => m.ma));
  const circuits = mach.map((m) => ({
    code: m.ma,
    device: chuThietBi(m.thietBi),
    cable: chuCapMach(m),
    conduit: m.ong || "",
    phase: m.soPha === 3 ? "ABC" : m.pha || "",
    load: hoa(m.phuTai),
    power: m.P > 0 ? so(m.P / 1000) : m.kieu?.duPhong ? "—" : "",
  }));
  const groups = (t.nhomRcd || []).filter((g) => g.mach.every((x) => ma.has(x)))
    .map((g) => ({ device: chuThietBi(g.thietBi), circuits: g.mach }));
  const du = { sheet, panel, groups, circuits };
  if (truoc || sau) du.noiTiep = { truoc, sau };
  return du;
}

/** Một tủ trên một tờ (giữ cho mã cũ và test): tờ thứ i của bộ, đủ mọi mạch. */
export function sangBanVe(t, info = {}, i = 0) {
  return sangToTu(t, info, { drawingNo: soBanVe(info.soBanVeDau || "E.601", i) });
}

/**
 * Chia các mạch của tủ thành từng tờ, tối đa `toiDa` lộ mỗi tờ, giữ nguyên thứ tự, số lộ các tờ gần đều nhau.
 * Các mạch chung một nhóm RCBO (và mọi cột nằm giữa chúng) luôn ở cùng một tờ.
 * @returns {{ phan: number[][], canhBao: string[] }}
 */
export function chiaTo(mach, nhomRcd = [], toiDa = 18) {
  const n = mach.length;
  const canhBao = [];
  if (n <= toiDa) return { phan: [mach.map((_, i) => i)], canhBao };
  // Khoảng cột của từng nhóm, gộp các khoảng chồng nhau
  const viTri = new Map(mach.map((m, i) => [m.ma, i]));
  const khoang = (nhomRcd || []).map((g) => {
    const idx = g.mach.map((x) => viTri.get(x)).filter((x) => x != null);
    return idx.length ? [Math.min(...idx), Math.max(...idx), g.ma] : null;
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  const gop = [];
  for (const k of khoang) {
    const cuoi = gop.at(-1);
    if (cuoi && k[0] <= cuoi[1]) { cuoi[1] = Math.max(cuoi[1], k[1]); cuoi[2] += `, ${k[2]}`; } else gop.push([...k]);
  }
  // Đơn vị không tách được: một khoảng nhóm, hoặc một mạch lẻ
  const donVi = [];
  for (let i = 0, j = 0; i < n;) {
    if (j < gop.length && gop[j][0] === i) {
      const [a, b, ten] = gop[j++];
      if (b - a + 1 > toiDa) canhBao.push(`Nhóm RCD ${ten} trải ${b - a + 1} lộ, quá ${toiDa} lộ/tờ — giữ trên một tờ, cột sẽ bị co`);
      donVi.push(Array.from({ length: b - a + 1 }, (_, k) => a + k));
      i = b + 1;
    } else {
      donVi.push([i++]);
    }
  }
  // Chia đều các tờ (20 lộ → 10 + 10, không phải 18 + 2); nếu chia đều làm tăng số tờ thì xếp đầy theo toiDa
  const xep = (tran) => {
    const phan = [];
    let hienTai = [];
    for (const u of donVi) {
      if (hienTai.length && hienTai.length + u.length > tran) { phan.push(hienTai); hienTai = []; }
      hienTai = hienTai.concat(u);
    }
    if (hienTai.length) phan.push(hienTai);
    return phan;
  };
  const day = xep(toiDa);
  const deu = xep(Math.ceil(n / day.length));
  return { phan: deu.length <= day.length ? deu : day, canhBao };
}

/** Số bản vẽ của tờ sơ đồ tổng: theo SO_BV_TONG, hoặc liền trước tờ tủ đầu (E.601 → E.600). */
export function soBanVeTong(info = {}) {
  if (info.soBanVeTong) return String(info.soBanVeTong);
  const dau = info.soBanVeDau || "E.601";
  const m = String(dau).match(/^(.*?)(\d+)$/);
  return m && Number(m[2]) > 0 ? soBanVe(dau, -1) : `${dau}-TONG`;
}

/**
 * Cả bộ tờ vẽ: tờ sơ đồ tổng (nếu có) rồi các tờ tủ theo thứ tự (tủ gốc trước), tủ nhiều mạch tự ngắt tờ.
 * @param {object} [o] — { toiDa = 18, coTong = true }
 * @returns {{ to: object[], soTheoTu: Map<string,string[]>, canhBao: {tu,noiDung}[] }}
 */
export function sangBoBanVe(kq, info = {}, o = {}) {
  const { toiDa = 18, coTong = true } = o;
  const canhBao = [];
  const soTheoTu = new Map();
  const dau = info.soBanVeDau || "E.601";
  let k = 0;
  const ke = kq.tu.map((t) => {
    const { phan, canhBao: cb } = chiaTo(t.mach, t.nhomRcd, toiDa);
    for (const s of cb) canhBao.push({ tu: t.ma, noiDung: s });
    const so = phan.map(() => soBanVe(dau, k++));
    soTheoTu.set(t.ma, so);
    return { t, phan, so };
  });
  const to = [];
  if (coTong) {
    const drawingNo = soBanVeTong(info);
    to.push({ loai: "tong", ma: "TONG", ten: "Sơ đồ cấp điện tổng", du: sangSoDoTong(kq, info, { drawingNo, soTheoTu }) });
  }
  for (const { t, phan, so } of ke) {
    phan.forEach((chiSo, thu) => to.push({
      loai: "tu", ma: t.ma, ten: t.ten, thu, tong: phan.length,
      du: sangToTu(t, info, { drawingNo: so[thu], phan: chiSo, thu, tong: phan.length, truoc: so[thu - 1] ?? null, sau: so[thu + 1] ?? null }),
    }));
  }
  return { to, soTheoTu, canhBao };
}

/**
 * Dữ liệu tờ sơ đồ nguyên lý cấp điện tổng (cây tủ) cho template/so-do-tong.mjs.
 * @param {object} [o] — { drawingNo, soTheoTu: Map mã tủ → số bản vẽ }
 */
export function sangSoDoTong(kq, info = {}, o = {}) {
  const { drawingNo = soBanVeTong(info), soTheoTu = new Map() } = o;
  const theoMa = new Map(kq.tu.map((t) => [t.ma, t]));
  const loCap = new Map();   // mã tủ con → mạch lộ cấp ở tủ trên
  for (const t of kq.tu) for (const m of t.mach) if (m.laCapTuCon) loCap.set(m.tuCon, m);
  const soTo = (ma) => {
    const s = soTheoTu.get(ma) || [];
    return s.length > 1 ? `${s[0]}–${s.at(-1)}` : s[0] || "";
  };
  const nut = (t) => {
    const m = loCap.get(t.ma);
    return {
      ma: t.ma,
      ten: hoa(t.ten),
      voTu: tenVoTu(t),
      soPha: t.soPha === 3 ? "3P+N+PE" : "1P+N+PE",
      incomer: chuThietBi(t.cbTong),
      ptt: `Ptt=${so(t.ptt)} kW`,
      soBanVe: soTo(t.ma),
      feeder: m ? {
        code: m.ma, device: chuThietBi(m.thietBi), cable: chuCap(m.cap, { soPha: m.soPha }),
        conduit: m.ong || "", phase: m.soPha === 3 ? "ABC" : m.pha || "",
        // Dạng ghi ngắn khi đoạn cáp trên sơ đồ không đủ chỗ (bảng tổng hợp vẫn ghi đầy đủ)
        cableNgan: m.cap?.s ? `${m.cap.soLoi ?? (m.soPha === 3 ? 4 : 2)}x${tietDien(m.cap.s)} + E${tietDien(m.cap.pe ?? m.cap.s)}` : "",
        conduitNgan: m.cap?.mang ? "MÁNG CÁP" : m.cap?.ong ? `Ø ${m.cap.ong}` : "",
      } : null,
      children: t.con.map((c) => nut(theoMa.get(c))),
    };
  };
  const goc = kq.tu.filter((t) => !t.cha);
  const nguon = goc.map((g) => ({
    ma: g.ma,
    cable: chuCap(g.capNguon, { soPha: g.soPha }),
    conduit: g.capNguon ? g.ongNguon || "" : "",
    chuaCoL: !!g.capNguon?.chuaCoL,
    // Nguồn dự phòng qua ATS: { ten, ats } — ATS mặc định 4P/2P theo số pha, dòng = CB tổng
    duPhong: g.nguonDuPhong ? {
      ten: hoa(g.nguonDuPhong.ten || "MÁY PHÁT DỰ PHÒNG"),
      chinh: hoa(g.nguonDuPhong.tenChinh || "NGUỒN LƯỚI"),
      ats: g.nguonDuPhong.ats || `ATS ${g.soPha === 3 ? "4P" : "2P"} ${g.cbTong?.in ?? ""}A`,
      cable: g.nguonDuPhong.cap || chuCap(g.capNguon, { soPha: g.soPha }),
    } : null,
  }));
  const bang = kq.tu.map((t) => ({
    ten: hoa(t.ten),
    capTu: t.cha ? `${hoa(theoMa.get(t.cha)?.ten ?? t.cha)} / ${loCap.get(t.ma)?.ma ?? ""}` : t.nguonDuPhong ? "ATS (LƯỚI/DP)" : "NGUỒN",
    soPha: t.soPha === 3 ? "3P" : "1P",
    pd: so(t.pd), ks: so(t.ks), ptt: so(t.ptt), itt: so(t.itt, 1),
    cbTong: (({ type, poles, rating, breaking }) => `${type} ${poles} ${rating} ${breaking}`)(chuThietBi(t.cbTong)),
    capCap: chuCap(t.capNguon, { soPha: t.soPha }) || "—",
    du: !t.cha && t.capNguon?.chuaCoL ? "—" : so(t.duBus),
    ik: t.ikTinh != null ? so(t.ikTinh, 1) : "—",
    soBanVe: soTo(t.ma),
  }));
  return {
    sheet: khungTen(info, drawingNo, "SƠ ĐỒ NGUYÊN LÝ CẤP ĐIỆN TỔNG"),
    nguon, nodes: goc.map(nut), bang,
  };
}
