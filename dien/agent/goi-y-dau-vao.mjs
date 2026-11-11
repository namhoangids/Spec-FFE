// Bộ gợi ý đầu vào: "mô tả công trình" (JSON gọn: tầng, phòng, thiết bị) → dữ liệu dự án
// (info, panels, circuits — đúng dạng docExcel() trả về), chạy thẳng được bằng tinhDuAn().
//
//   node agent/goi-y-dau-vao.mjs <mo-ta.json> [du-an.json]
//
// Phần "hiểu" (đọc lời mô tả, mặt bằng) do agent làm; file này chỉ chia mạch và ước phụ tải theo
// thư viện phu-tai-dien-hinh.mjs. Mọi số tự suy ra đều ghi "giả định" để kỹ sư rà lại.
// Dạng file mô tả: xem .claude/skills/so-do-nguyen-ly/tham-khao.md và agent/vi-du/mo-ta-biet-thu.json.

import {
  CHIEU_DAI, DIEN_NHE, DIEN_NHE_PHONG, DIEU_HOA, DU_PHONG_MOI_TU, GOM, LOAI_PHONG, PO_O_CAM, THIET_BI_PHONG, THIET_BI_RIENG, VRV,
} from "./phu-tai-dien-hinh.mjs";

const VIET_TAT = {
  "phòng khách": "P.KHÁCH", "phòng ngủ": "P.NGỦ", "phòng ăn": "P.ĂN", "bếp": "BẾP", "wc": "WC",
  "sảnh, hành lang": "SẢNH", "phòng làm việc": "P.LÀM VIỆC", "phòng thờ": "P.THỜ", "phòng giải trí": "P.GIẢI TRÍ",
  "giặt phơi": "GIẶT PHƠI", "kho": "KHO", "gara": "GARA", "phòng kỹ thuật": "P.KỸ THUẬT", "ngoài nhà": "SÂN VƯỜN",
  "ban công": "BAN CÔNG",
};
const NGUONG_GOI_Y_3_PHA = 10;   // kW tải đặt của tủ tầng 1 pha, vượt thì gợi ý cân nhắc 3 pha
const NGUONG_GOI_Y_NGUON_3_PHA = 15;   // kW tải đặt cả công trình khi nguồn 1 pha, vượt thì gợi ý nguồn 3 pha
const hoa = (s) => String(s ?? "").toLocaleUpperCase("vi");
const thuong = (s) => String(s ?? "").toLocaleLowerCase("vi").trim();
const so = (x, d = 1) => Number(x).toFixed(d).replace(".", ",").replace(/,0+$/, "");
const lamTron = (x, buoc = 10) => Math.max(buoc, Math.round(x / buoc) * buoc);
// AC2-1, AC2-2 (theo tầng) · AC1, AC2 (không có số tầng) · AC2 / AC (chỉ một mạch)
const maTheoTang = (tienTo, n, k, tong) => (tong > 1 ? (n ? `${tienTo}${n}-${k + 1}` : `${tienTo}${k + 1}`) : `${tienTo}${n}`);

/** Nhận loại phòng từ tên/loại tự do ("P. ngủ master", "WC chung"…). */
export function nhanLoaiPhong(s) {
  return khopTuKhoa(s, LOAI_PHONG);
}

// Chọn mục có từ khóa khớp dài nhất ("bơm hồ bơi" → bơm bể bơi, không phải bơm)
function khopTuKhoa(s, bang) {
  const t = thuong(s);
  if (bang[t]) return t;
  let tot = null, dai = 0;
  for (const [loai, d] of Object.entries(bang)) {
    for (const k of d.tuKhoa) if (t.includes(k) && k.length > dai) { tot = loai; dai = k.length; }
  }
  return tot;
}

/** Nhận loại thiết bị riêng. */
export function nhanThietBi(s) {
  return khopTuKhoa(s, THIET_BI_RIENG);
}

// Số tầng dùng trong mã lộ (AC2-1, WH3…): chỉ khi tên tầng dạng "T2", "Tầng 3", "3"; căn hộ / tên khác → ""
const soTang = (ten) => (String(ten).trim().match(/^(?:t|tầng\s*)?(\d+)$/i) || [])[1] ?? "";

/**
 * @param {object} moTa — mô tả công trình
 * @returns {{ duAn: {info, panels, circuits}, giaDinh: string[], canhBao: string[] }}
 */
export function goiYDauVao(moTa) {
  const giaDinh = [];
  const canhBao = [];
  const da = moTa.duAn || {};
  const nguon = moTa.nguon || {};
  const tang = moTa.tang || [];
  if (!tang.length) throw new Error("Mô tả chưa có tầng nào (mục tang)");
  const dieuHoaVrv = /vrv|vrf|trung tâm/i.test(moTa.dieuHoa || "");
  const ccTang = moTa.chieuCaoTang ?? CHIEU_DAI.chieuCaoTang;
  if (moTa.chieuCaoTang == null) giaDinh.push(`Chiều cao tầng ${so(ccTang)} m`);

  // --- Thông tin dự án / khung tên --------------------------------------------
  const info = {
    project: da.ten ?? "", client: da.chuDauTu ?? "", address: da.diaChi ?? "", companyInfo: da.congTy ?? "",
    loaiCongTrinh: da.loaiCongTrinh ?? "Nhà ở / biệt thự", projectNo: da.maDuAn ?? "", date: da.ngay ?? "",
    scale: da.tyLe ?? "", design: da.thietKe ?? "", checkBy: da.kiemTra ?? "", madeBy: da.nguoiVe ?? "",
    director: da.giamDoc ?? "", soBanVeDau: da.soBanVeDau ?? "E.601",
    ...(da.soBanVeTong ? { soBanVeTong: da.soBanVeTong } : {}),
    ...(nguon.ik ? { ikNguon: nguon.ik } : {}),
  };
  if (!nguon.ik) giaDinh.push("Chưa có Ik tại điểm đấu nối — công cụ dùng 6 kA và ghi cảnh báo");

  // --- Tủ điện ---------------------------------------------------------------------
  const tangGoc = moTa.tuTong?.tang ?? tang[0].ten;
  const iGoc = Math.max(0, tang.findIndex((t) => t.ten === tangGoc));
  const maGoc = moTa.tuTong?.ma ?? tang[iGoc].ten;
  const panels = [];
  const tuCuaTang = new Map();
  const goc = {
    ma: maGoc, ten: moTa.tuTong?.ten ?? maGoc, viTri: `Tầng ${tangGoc}`, soPha: nguon.soPha === 1 ? 1 : 3,
    kieuDi: nguon.kieuDi ?? "Ống", spd: "Theo quy tắc", ...(nguon.ik ? { ik: nguon.ik } : {}),
    ...(nguon.chieuDaiCap ? { lCap: nguon.chieuDaiCap } : {}),
  };
  if (nguon.soPha == null) giaDinh.push(`Nguồn ${goc.soPha} pha`);
  if (!nguon.chieuDaiCap) giaDinh.push(`Chưa có chiều dài cáp từ công tơ tới tủ ${maGoc} — cáp nguồn chọn theo dòng, chưa kiểm sụt áp`);
  panels.push(goc);
  tang.forEach((t, i) => {
    if (i === iGoc) { tuCuaTang.set(t.ten, maGoc); return; }
    if (t.tuRieng === false) { tuCuaTang.set(t.ten, t.tu ?? maGoc); return; }
    const ma = t.maTu ?? t.ten;
    const capTu = t.capTu ?? maGoc;
    const lCap = t.chieuDaiCap ?? lamTron(Math.abs(i - iGoc) * ccTang + CHIEU_DAI.ngangToiTu, 1);
    if (t.chieuDaiCap == null) giaDinh.push(`Cáp cấp tủ ${ma}: ${lCap} m (chênh ${Math.abs(i - iGoc)} tầng × ${so(ccTang)} m + ${CHIEU_DAI.ngangToiTu} m ngang)`);
    if (t.soPha == null) giaDinh.push(`Tủ ${ma} 1 pha`);
    panels.push({ ma, ten: t.tenTu ?? ma, viTri: `Tầng ${t.ten}`, capTu, soPha: t.soPha === 3 ? 3 : 1, lCap, kieuDi: "Ống" });
    tuCuaTang.set(t.ten, ma);
  });

  // --- Mạch ------------------------------------------------------------------------
  const theoTu = new Map(panels.map((p) => [p.ma, []]));
  const demMa = new Map();          // tủ → bộ đếm theo tiền tố
  const maMoi = (tu, tienTo) => {
    const d = demMa.get(tu) || {};
    d[tienTo] = (d[tienTo] || 0) + 1;
    demMa.set(tu, d);
    return `${tienTo}${d[tienTo]}`;
  };
  const them = (tu, c) => theoTu.get(tu).push({ tu, khuVuc: "Khô", soPha: 1, ...c });
  // Tên mạch gom: liệt kê phòng; dài quá thì giữ các phòng đầu và ghi "+n PHÒNG"
  const tenGop = (dau, phongs) => {
    const ten = `${dau} ${phongs.map((p) => p.tenHien).join(", ")}`;
    if (ten.length <= GOM.tenMax) return ten;
    for (let k = phongs.length - 1; k >= 1; k--) {
      const t = `${dau} ${phongs.slice(0, k).map((p) => p.tenHien).join(", ")} +${phongs.length - k} PHÒNG`;
      if (t.length <= GOM.tenMax || k === 1) return t;
    }
    return ten;
  };
  const dai = (co, n) => co + CHIEU_DAI.themMoiPhong * Math.max(0, n - 1);
  let tongBtuVrv = 0;
  const dienTichGiaDinh = [];
  const phongTheoTang = [];   // cho bộ gợi ý điện nhẹ

  tang.forEach((t) => {
    const tu = tuCuaTang.get(t.ten);
    const n = soTang(t.ten);
    const demLoai = {};
    const phongs = (t.phong || []).map((p) => {
      const loai = nhanLoaiPhong(p.loai ?? p.ten);
      if (!loai) { canhBao.push(`Tầng ${t.ten}: không nhận ra loại phòng "${p.loai ?? p.ten}" — tạm tính như phòng ngủ`); }
      const L = LOAI_PHONG[loai ?? "phòng ngủ"];
      demLoai[loai] = (demLoai[loai] || 0) + 1;
      // Không có tên: dùng cách gọi của người dùng ("sân thượng"), trùng tên chuẩn thì dùng viết tắt (P.NGỦ)
      const goi = p.loai && thuong(p.loai) !== loai ? hoa(p.loai) : VIET_TAT[loai ?? "phòng ngủ"];
      const tenHien = hoa(p.ten ?? goi);
      return { ...p, loai: loai ?? "phòng ngủ", L, tenHien, dt: p.dienTich ?? L.dienTich, dtGiaDinh: p.dienTich == null };
    });
    // Đặt tên trùng (2 phòng ngủ không tên) → thêm số
    const daDem = {};
    for (const p of phongs) {
      if (p.ten) continue;
      if ((demLoai[p.loai] || 0) > 1) { daDem[p.loai] = (daDem[p.loai] || 0) + 1; p.tenHien = `${p.tenHien} ${n}-${daDem[p.loai]}`; }
    }
    for (const p of phongs) if (p.dtGiaDinh) dienTichGiaDinh.push(`${p.tenHien} (${t.ten}) ${p.dt} m²`);
    phongTheoTang.push({ tang: t.ten, i: tang.indexOf(t), phongs });

    // Chiếu sáng: khô gom theo nhóm; WC gom 1 mạch khu ướt; ngoài nhà riêng
    const gomDen = (ds, loaiMach, khuVuc, dau) => {
      let nhom = [], w = 0;
      const xa = () => {
        if (!nhom.length) return;
        const cs = nhom.reduce((a, p) => a + lamTron(p.dt * p.L.den), 0);
        them(tu, {
          ma: maMoi(tu, "L"), loai: loaiMach, khuVuc, phuTai: tenGop(dau, nhom), congSuat: cs,
          L: khuVuc === "Ngoài nhà" ? CHIEU_DAI.ngoaiNha : dai(CHIEU_DAI.den, nhom.length),
          ghiChu: `giả định: ${nhom.map((p) => `${so(p.dt, 0)} m²×${p.L.den} W/m²`).join(" + ")}`,
        });
        nhom = []; w = 0;
      };
      for (const p of ds) {
        const wp = lamTron(p.dt * p.L.den);
        if (nhom.length && (w + wp > GOM.denMax || nhom.length >= GOM.denPhongMax)) xa();
        nhom.push(p); w += wp;
      }
      xa();
    };
    gomDen(phongs.filter((p) => p.L.nhom === "kho"), "Chiếu sáng trong nhà", "Khô", "CHIẾU SÁNG");
    gomDen(phongs.filter((p) => p.L.nhom === "uot"), "Chiếu sáng trong nhà", "Ướt (WC, tắm)", "CHIẾU SÁNG");
    gomDen(phongs.filter((p) => p.L.nhom === "ngoai"), "Chiếu sáng ngoài nhà", "Ngoài nhà", "CHIẾU SÁNG");

    // Ổ cắm: khô gom theo nhóm; WC gom 1 mạch; ngoài nhà riêng
    const gomOCam = (ds, khuVuc) => {
      let nhom = [], w = 0;
      const xa = () => {
        if (!nhom.length) return;
        const soO = nhom.reduce((a, p) => a + (p.oCam ?? p.L.oCam), 0);
        them(tu, {
          ma: maMoi(tu, "S"), loai: "Ổ cắm thông thường", khuVuc, phuTai: tenGop("Ổ CẮM", nhom),
          soLuong: soO, congSuat: PO_O_CAM, L: khuVuc === "Ngoài nhà" ? CHIEU_DAI.ngoaiNha : dai(CHIEU_DAI.oCam, nhom.length),
          ghiChu: `giả định: ${soO} ổ × ${PO_O_CAM} W`,
        });
        nhom = []; w = 0;
      };
      for (const p of ds) {
        const wp = (p.oCam ?? p.L.oCam) * PO_O_CAM;
        if (!wp) continue;
        if (nhom.length && (w + wp > GOM.oCamMax || nhom.length >= GOM.oCamPhongMax)) xa();
        nhom.push(p); w += wp;
      }
      xa();
    };
    gomOCam(phongs.filter((p) => p.L.nhom === "kho"), "Khô");
    gomOCam(phongs.filter((p) => p.L.nhom === "uot"), "Ướt (WC, tắm)");
    gomOCam(phongs.filter((p) => p.L.nhom === "ngoai"), "Ngoài nhà");

    // Bếp: bếp từ + ổ cắm bếp riêng
    for (const p of phongs.filter((x) => x.L.bep)) {
      if (p.bepTu !== false) {
        const w = p.bepTuW ?? THIET_BI_PHONG.bepTu.w;
        them(tu, { ma: maMoi(tu, "BT"), loai: "Bếp từ, lò nướng", khuVuc: "Bếp", phuTai: `${THIET_BI_PHONG.bepTu.ten} ${p.tenHien === "BẾP" ? "" : p.tenHien}`.trim(), congSuat: w, L: CHIEU_DAI.bep, ghiChu: p.bepTuW ? "" : `giả định: bếp từ ${so(w / 1000)} kW` });
      }
      them(tu, { ma: maMoi(tu, "S"), loai: "Ổ cắm thông thường", khuVuc: "Bếp", phuTai: THIET_BI_PHONG.oCamBep.ten, congSuat: THIET_BI_PHONG.oCamBep.w, cos: THIET_BI_PHONG.oCamBep.cos, L: CHIEU_DAI.bep, ghiChu: "giả định: tủ lạnh, lò vi sóng, máy rửa bát 3 kW" });
    }

    // Điều hòa
    const coDH = phongs.filter((p) => p.dieuHoa ?? p.L.dieuHoa);
    if (dieuHoaVrv) {
      if (coDH.length) {
        tongBtuVrv += coDH.reduce((a, p) => a + (p.btu ?? DIEU_HOA.find((d) => p.dt <= d.dienTichMax).btu), 0);
        them(tu, { ma: `AC${n}`, loai: "Điều hòa", phuTai: `CẤP ĐIỆN DÀN LẠNH ĐIỀU HOÀ${n ? ` T${n}` : ""}`, soLuong: coDH.length, congSuat: VRV.danLanhW, L: CHIEU_DAI.dieuHoa, ghiChu: `giả định: ${coDH.length} dàn lạnh × ${VRV.danLanhW} W` });
      }
    } else {
      coDH.forEach((p, k) => {
        const d = p.btu ? DIEU_HOA.find((x) => p.btu <= x.btu) ?? DIEU_HOA.at(-1) : DIEU_HOA.find((x) => p.dt <= x.dienTichMax);
        const btu = p.btu ?? d.btu;
        them(tu, {
          ma: maTheoTang("AC", n, k, coDH.length), loai: "Điều hòa",
          phuTai: `ĐIỀU HOÀ ${p.tenHien} ${btu.toLocaleString("vi")} BTU`, congSuat: p.dieuHoaW ?? d.w, L: CHIEU_DAI.dieuHoa,
          ghiChu: `giả định: ${btu.toLocaleString("vi")} BTU ~ ${so(d.w / 1000)} kW${p.btu ? "" : ` theo ${so(p.dt, 0)} m²`}`,
        });
      });
    }

    // Bình nóng lạnh: mỗi WC có tắm
    const wcTam = phongs.filter((p) => p.L.nhom === "uot" && (p.tam ?? p.L.tam));
    wcTam.forEach((p, k) => them(tu, {
      ma: maTheoTang("WH", n, k, wcTam.length), loai: "Khu ướt (WC, bình nóng lạnh)", khuVuc: "Ướt (WC, tắm)",
      phuTai: `${THIET_BI_PHONG.binhNongLanh.ten} ${p.tenHien}`, congSuat: p.binhNongLanhW ?? THIET_BI_PHONG.binhNongLanh.w,
      L: CHIEU_DAI.binhNongLanh, ghiChu: p.binhNongLanhW ? "" : "giả định: 2,5 kW",
    }));

    // Máy giặt
    for (const p of phongs.filter((x) => x.L.mayGiat || x.mayGiat)) {
      const ten = /GIẶT/.test(p.tenHien) ? THIET_BI_PHONG.mayGiat.ten : `${THIET_BI_PHONG.mayGiat.ten} ${p.tenHien}`;
      them(tu, { ma: maMoi(tu, "MG"), loai: "Ổ cắm thông thường", phuTai: ten, congSuat: THIET_BI_PHONG.mayGiat.w, L: CHIEU_DAI.mayGiat, ghiChu: "giả định: 2 kW" });
    }

    // Rèm điện theo tầng
    if (t.rem) them(tu, { ma: `R${n}`, loai: "Động cơ (bơm, quạt)", phuTai: `${THIET_BI_PHONG.remTang.ten}${n ? ` T${n}` : ""}`, congSuat: THIET_BI_PHONG.remTang.w, L: CHIEU_DAI.rem, ghiChu: "giả định: động cơ rèm 200 W" });
  });
  if (dienTichGiaDinh.length) giaDinh.push(`Diện tích phòng (không có số liệu): ${dienTichGiaDinh.join("; ")}`);

  // --- Thiết bị riêng --------------------------------------------------------------
  const tb = [...(moTa.thietBi || [])];
  if (dieuHoaVrv && tongBtuVrv && !tb.some((x) => nhanThietBi(x.loai ?? x.ten) === "dàn nóng")) {
    const w = lamTron(((tongBtuVrv / 3412) / VRV.heSoDanNong) * 1000, 100);
    tb.push({ loai: "dàn nóng", congSuat: w, _tuDong: true });
    giaDinh.push(`Dàn nóng VRV ${so(w / 1000)} kW 3 pha (tổng ${tongBtuVrv.toLocaleString("vi")} BTU / hệ số ${VRV.heSoDanNong})`);
  }
  const demTb = {};
  for (const x of tb) {
    const loai = nhanThietBi(x.loai ?? x.ten);
    if (!loai && !x.loaiMach) { canhBao.push(`Không nhận ra thiết bị "${x.loai ?? x.ten}" — bỏ qua, cần khai báo loaiMach và công suất`); continue; }
    const d = THIET_BI_RIENG[loai] || { w: 1000, soPha: 1, loaiMach: x.loaiMach, ma: "TB", ten: hoa(x.ten ?? x.loai) };
    let tu = x.tu ?? (x.tang ? tuCuaTang.get(x.tang) : null) ?? maGoc;
    const soPha = x.soPha ?? d.soPha;
    if (soPha === 3 && panels.find((p) => p.ma === tu)?.soPha !== 3) {
      if (goc.soPha === 3) { canhBao.push(`${d.ten} 3 pha không đặt được ở tủ ${tu} (1 pha) — chuyển về tủ ${maGoc}`); tu = maGoc; } else canhBao.push(`${d.ten} 3 pha nhưng nguồn 1 pha`);
    }
    demTb[d.ma] = (demTb[d.ma] || 0) + 1;
    const nCung = tb.filter((y) => (THIET_BI_RIENG[nhanThietBi(y.loai ?? y.ten)]?.ma ?? "TB") === d.ma).length;
    them(tu, {
      ma: nCung > 1 ? `${d.ma}${demTb[d.ma]}` : d.ma, loai: x.loaiMach ?? d.loaiMach, khuVuc: x.khuVuc ?? d.khuVuc ?? "Khô",
      phuTai: hoa(x.phuTai ?? `CẤP ĐIỆN ${x.ten ? hoa(x.ten) : d.ten}`), congSuat: x.congSuat ?? d.w, soPha, L: x.L ?? CHIEU_DAI.thietBi,
      ghiChu: x._tuDong ? "giả định: dàn nóng VRV" : x.congSuat ? "" : `giả định: ${so((d.w) / 1000)} kW`,
    });
    if (!x.congSuat) giaDinh.push(`${d.ten}: ${so(d.w / 1000)} kW ${soPha} pha`);
  }

  // --- Lộ cấp tủ con (đặt sau mạch cuối của tủ trên) và CB dự phòng -----------------
  const soDp = moTa.duPhong ?? DU_PHONG_MOI_TU;
  for (const p of panels) {
    if (!p.capTu) continue;
    const cha = theoTu.get(p.capTu);
    const truoc = panels.filter((x) => x.capTu === p.capTu && x.maLoCap);
    p.maLoCap = maMoi(p.capTu, "S");
    p.datSauLo = truoc.length ? truoc.at(-1).maLoCap : cha.at(-1)?.ma;
  }
  for (const p of panels) for (let k = 1; k <= soDp; k++) them(p.ma, { ma: `DP${k}`, loai: "Dự phòng", phuTai: "DỰ PHÒNG" });
  if (soDp) giaDinh.push(`Mỗi tủ thêm ${soDp} CB dự phòng`);
  giaDinh.push(`Ổ cắm ${PO_O_CAM} W/ổ; chiếu sáng ${Math.min(...Object.values(LOAI_PHONG).map((x) => x.den))}–${Math.max(...Object.values(LOAI_PHONG).map((x) => x.den))} W/m²; chiều dài mạch nhánh ${CHIEU_DAI.bep}–${CHIEU_DAI.ngoaiNha} m`);

  // Tiền tố chỉ có một mạch trong tủ thì bỏ số: BT1 → BT, MG1 → MG
  for (const ds of theoTu.values()) {
    for (const tienTo of ["BT", "MG"]) {
      const cung = ds.filter((c) => new RegExp(`^${tienTo}\\d+$`).test(c.ma));
      if (cung.length === 1) cung[0].ma = tienTo;
    }
  }
  const circuits = [...theoTu.values()].flat();
  // Tủ / nguồn 1 pha mà tải lớn: gợi ý cân nhắc 3 pha (không tự đổi — đây là quyết định thiết kế)
  const tongKw = circuits.reduce((a, c) => a + (c.soLuong || 1) * (c.congSuat || 0), 0) / 1000;
  if (goc.soPha === 1 && tongKw > NGUONG_GOI_Y_NGUON_3_PHA) {
    canhBao.push(/căn hộ/i.test(info.loaiCongTrinh)
      ? `Căn hộ có tổng tải đặt ≈ ${so(tongKw)} kW — kiểm tra công suất tòa nhà cấp cho căn hộ và hệ số Kđt (đang theo quy tắc, chưa chốt); bớt tải đặt nếu cần`
      : `Cả công trình dùng nguồn 1 pha nhưng tổng tải đặt ≈ ${so(tongKw)} kW — CB tổng sẽ rất lớn; cân nhắc nguồn 3 pha (đăng ký với điện lực)`);
  }
  for (const p of panels) {
    if (!p.capTu) continue;
    const t = tang.find((x) => (x.maTu ?? x.ten) === p.ma);
    const kw = circuits.filter((c) => c.tu === p.ma).reduce((a, c) => a + (c.soLuong || 1) * (c.congSuat || 0), 0) / 1000;
    if (p.soPha === 1 && t && t.soPha == null && kw > NGUONG_GOI_Y_3_PHA) {
      canhBao.push(`Tủ ${p.ma} 1 pha nhưng tổng tải đặt ≈ ${so(kw)} kW — cân nhắc tủ 3 pha`);
    }
  }
  const dienNhe = goiYDienNhe(moTa, phongTheoTang, { tangGoc, iGoc, ccTang, tuRack: tuCuaTang.get(tangGoc) ?? maGoc, circuits, giaDinh });
  return { duAn: { info, panels, circuits, ...(dienNhe ? { dienNhe } : {}) }, giaDinh, canhBao };
}

/**
 * Điện nhẹ theo bảng điển hình (mô tả có "dienNhe": true | { tang, acs }) và KNX ("knx": true: mạch chiếu sáng bật/tắt,
 * mạch rèm điều khiển rèm, phím / cảm biến theo phòng). Mọi số ghi "giả định".
 */
function goiYDienNhe(moTa, phongTheoTang, { tangGoc, iGoc, ccTang, tuRack, circuits, giaDinh }) {
  const coDn = !!moTa.dienNhe, coKnx = !!moTa.knx;
  if (!coDn && !coKnx) return null;
  const cfg = typeof moTa.dienNhe === "object" ? moTa.dienNhe : {};
  const rackTang = cfg.tang ?? tangGoc;
  const iRack = Math.max(0, phongTheoTang.findIndex((x) => x.tang === rackTang));
  const phong = [];
  let daCoCong = false;
  for (const { tang: ten, i, phongs } of phongTheoTang) {
    const dong = phongs.map((p) => {
      const b = DIEN_NHE_PHONG[p.loai] || {};
      const ngoai = p.L.nhom === "ngoai";
      const d = { tang: ten, phong: p.tenHien, ghiChu: "giả định" };
      if (coDn) {
        for (const k of ["data", "tv", "ap", "camTrong", "camNgoai", "loa"]) d[k] = b[k] || 0;
        if (d.loa) { d.loaW = ngoai ? DIEN_NHE.loaWNgoai : DIEN_NHE.loaW; d.vungAm = `Vùng ${ten}${ngoai ? " ngoài" : ""}`; }
        d.rack = "R1";
        d.L = Math.round(Math.abs(i - iRack) * ccTang + (ngoai ? DIEN_NHE.lNgoai : DIEN_NHE.lNgang));
      }
      if (coKnx) d.knx = b.knx || 0;
      return { d, p, ngoai };
    });
    if (coDn) {
      // Mỗi tầng đủ AP theo diện tích trong nhà
      const trong = dong.filter((x) => !x.ngoai);
      const can = Math.ceil(trong.reduce((a, x) => a + (x.p.dt || 0), 0) / DIEN_NHE.apM2);
      const co = trong.reduce((a, x) => a + x.d.ap, 0);
      if (trong.length && co < Math.max(1, can)) {
        const lon = [...trong].sort((a, b) => (b.p.dt || 0) - (a.p.dt || 0))[0];
        lon.d.ap += Math.max(1, can) - co;
      }
      // Màn hình chuông ở phòng khách / sảnh; nút gọi + cửa ACS ở cổng tầng gốc
      const khach = dong.find((x) => x.p.loai === "phòng khách") || dong.find((x) => x.p.loai === "sảnh, hành lang");
      if (khach) khach.d.chuongTrong = 1;
      if (ten === tangGoc && !daCoCong) {
        const cong = dong.find((x) => x.ngoai) || khach || dong[0];
        if (cong) { cong.d.chuongNgoai = 1; if (cfg.acs !== false) cong.d.acs = 1; daCoCong = true; }
      }
    }
    for (const { d } of dong) {
      if (["data", "tv", "ap", "camTrong", "camNgoai", "loa", "chuongNgoai", "chuongTrong", "acs", "knx"].some((k) => d[k] > 0)) phong.push(d);
    }
  }
  if (coKnx) {
    let n = 0;
    for (const c of circuits) {
      if (/^Chiếu sáng/.test(c.loai)) { c.knx = "Bật/tắt"; n++; } else if (/RÈM/.test(c.phuTai || "")) { c.knx = "Rèm"; n++; }
    }
    giaDinh.push(`KNX: ${n} mạch chiếu sáng / rèm điều khiển bằng actuator trong tủ; phím bấm / cảm biến theo loại phòng`);
  }
  if (coDn) {
    giaDinh.push(`Điện nhẹ theo bảng điển hình (agent/phu-tai-dien-hinh.mjs): ổ data, ổ TV IPTV, AP (≥ 1 / ${DIEN_NHE.apM2} m² mỗi tầng), camera, loa 100 V; ` +
      `1 rack R1 ở tầng ${rackTang}, cấp nguồn từ tủ ${tuRack}; chiều dài cáp = chênh tầng × ${so(ccTang)} m + ${DIEN_NHE.lNgang} m (ngoài nhà ${DIEN_NHE.lNgoai} m)`);
  }
  return { phong, rack: coDn ? [{ ma: "R1", tang: rackTang, viTri: "phòng kỹ thuật / gầm cầu thang (giả định)", capTu: tuRack, lNguon: DIEN_NHE.lNguonRack, trungTam: true, ghiChu: "giả định" }] : [] };
}

// --- Dòng lệnh ------------------------------------------------------------------------
import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { mkdirSync, readFileSync, writeFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const [vao, ra] = process.argv.slice(2);
  if (!vao) { console.error("Cách dùng: node agent/goi-y-dau-vao.mjs <mo-ta.json> [du-an.json]"); process.exit(1); }
  const { duAn, giaDinh, canhBao } = goiYDauVao(JSON.parse(readFileSync(vao, "utf8")));
  const fileRa = ra || join(dirname(vao), "du-an.json");
  mkdirSync(dirname(fileRa), { recursive: true });
  writeFileSync(fileRa, JSON.stringify(duAn, null, 2), "utf8");
  console.log(`✔ ${duAn.panels.length} tủ, ${duAn.circuits.length} mạch → ${fileRa}\n`);
  for (const p of duAn.panels) {
    const ds = duAn.circuits.filter((c) => c.tu === p.ma);
    const kw = ds.reduce((a, c) => a + (c.soLuong || 1) * (c.congSuat || 0), 0) / 1000;
    console.log(`TỦ ${p.ma}${p.capTu ? ` ← ${p.capTu}/${p.maLoCap}` : " (gốc)"} · ${p.soPha} pha · ${ds.length} lộ · Pđ ≈ ${so(kw, 2)} kW`);
    for (const c of ds) console.log(`   ${c.ma.padEnd(6)} ${c.phuTai.padEnd(42)} ${c.congSuat ? `${(c.soLuong || 1) * c.congSuat} W` : ""}${c.soPha === 3 ? " 3P" : ""}`);
  }
  console.log("\nGIẢ ĐỊNH:");
  for (const s of giaDinh) console.log(` - ${s}`);
  if (canhBao.length) { console.log("\nCẦN XEM:"); for (const s of canhBao) console.log(` - ${s}`); }
}
