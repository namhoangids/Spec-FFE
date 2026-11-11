// Kho dự án dùng chung của team: Firestore (project measure-and-make, cùng tài khoản app M&M / FF&E).
//
//   dien_projects/{id}            { ten, project, client, soTu, soMach, duAnJson, phienBan, createdAt/By, updatedAt/By }
//   dien_projects/{id}/history/*  bản trước mỗi lần ghi đè: { ...bản cũ, _archivedAt, ghiChu }
//
// Dữ liệu dự án (info, panels, circuits, quyTac, bocKhoi) lưu thành MỘT chuỗi JSON (duAnJson): Firestore không nhận
// mảng lồng mảng và giá trị undefined, còn chuỗi JSON thì giữ nguyên đúng dữ liệu công cụ dùng. Một dự án vài trăm
// mạch chỉ khoảng 100 KB, dưới giới hạn 1 MB của một document.
//
// Lưu có kiểm tra phiên bản: nếu trên server đã có bản mới hơn bản đang mở (người khác vừa lưu) thì KHÔNG ghi đè,
// ném LoiXungDot để giao diện hỏi lại. Bản bị ghi đè luôn được chép vào history trước.
//
// Hai bản cài đặt cùng giao diện: Firebase (thật) và bộ nhớ (?kho=thu — cho test Playwright, không cần mạng).

import { FIREBASE_CONFIG, FIREBASE_SDK } from "./firebase-config.mjs";

const COL = "dien_projects";

export class LoiXungDot extends Error {
  constructor(server) {
    super(`Dự án vừa được ${server.updatedBy || "người khác"} lưu (phiên bản ${server.phienBan}) sau khi anh mở — chưa ghi đè.`);
    this.server = server;
  }
}

/** Bỏ phần không cần lưu (lỗi đọc file của lần nạp Excel) và tóm tắt để hiện danh sách. */
function dongGoi(ten, duAn) {
  const { loiDoc, ...gon } = duAn;
  return {
    ten, project: duAn.info?.project || "", client: duAn.info?.client || "",
    soTu: duAn.panels?.length || 0, soMach: duAn.circuits?.length || 0,
    duAnJson: JSON.stringify(gon),
  };
}
const moGoi = (d) => ({ ...JSON.parse(d.duAnJson || "{}"), loiDoc: [] });
const ngay = (x) => (x?.toDate ? x.toDate() : x instanceof Date ? x : x ? new Date(x) : null);
const tomTat = (id, d) => ({ id, ten: d.ten, project: d.project, client: d.client, soTu: d.soTu, soMach: d.soMach,
  phienBan: d.phienBan, updatedAt: ngay(d.updatedAt), updatedBy: d.updatedBy || "" });

// ================================================================================================
// Firebase
// ================================================================================================
function napScript(src) {
  return new Promise((ok, loi) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = Object.assign(document.createElement("script"), { src, async: false });
    s.onload = () => ok();
    s.onerror = () => loi(new Error(`Không tải được ${src.split("/").pop()} — kiểm tra kết nối mạng.`));
    document.head.append(s);
  });
}

async function khoFirebase() {
  for (const f of ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"]) await napScript(`${FIREBASE_SDK}/${f}`);
  const fb = window.firebase;
  const app = fb.apps.length ? fb.app() : fb.initializeApp(FIREBASE_CONFIG);
  const auth = app.auth();
  const db = app.firestore();
  const now = () => fb.firestore.FieldValue.serverTimestamp();
  const email = () => auth.currentUser?.email || null;
  const ref = (id) => db.collection(COL).doc(id);

  return {
    loai: "firebase",
    nguoiDung: () => (auth.currentUser ? { email: auth.currentUser.email } : null),
    ngheNguoiDung: (cb) => auth.onAuthStateChanged((u) => cb(u ? { email: u.email } : null)),
    dangNhap: (e, p) => auth.signInWithEmailAndPassword(e, p),
    dangXuat: () => auth.signOut(),
    ngheDanhSach: (cb, loi) => db.collection(COL).orderBy("updatedAt", "desc").onSnapshot(
      (snap) => cb(snap.docs.map((d) => tomTat(d.id, d.data()))), loi),
    async mo(id) {
      const s = await ref(id).get();
      if (!s.exists) throw new Error("Dự án không còn trên server.");
      return { ...tomTat(id, s.data()), duAn: moGoi(s.data()) };
    },
    async taoMoi(ten, duAn) {
      const r = db.collection(COL).doc();
      await r.set({ ...dongGoi(ten, duAn), phienBan: 1, createdAt: now(), createdBy: email(), updatedAt: now(), updatedBy: email() });
      return { id: r.id, phienBan: 1 };
    },
    async luu(id, duAn, { ten, ghiChu = "", phienBanDangMo, ep = false } = {}) {
      return db.runTransaction(async (tx) => {
        const s = await tx.get(ref(id));
        if (!s.exists) throw new Error("Dự án không còn trên server.");
        const cu = s.data();
        if (!ep && cu.phienBan !== phienBanDangMo) throw new LoiXungDot(tomTat(id, cu));
        tx.set(ref(id).collection("history").doc(), { ...cu, _archivedAt: now(), ghiChuLuu: ghiChu });
        const phienBan = (cu.phienBan || 0) + 1;
        tx.set(ref(id), { ...cu, ...dongGoi(ten ?? cu.ten, duAn), phienBan, ghiChu, updatedAt: now(), updatedBy: email() });
        return { phienBan };
      });
    },
    async doiTen(id, ten) { await ref(id).update({ ten, updatedAt: now(), updatedBy: email() }); },
    async lichSu(id) {
      const snap = await ref(id).collection("history").orderBy("_archivedAt", "desc").limit(30).get();
      return snap.docs.map((d) => ({ hid: d.id, phienBan: d.data().phienBan, luc: ngay(d.data().updatedAt), boi: d.data().updatedBy || "",
        ghiChu: d.data().ghiChu || "", soMach: d.data().soMach }));
    },
    async khoiPhuc(id, hid) {
      const h = await ref(id).collection("history").doc(hid).get();
      if (!h.exists) throw new Error("Không còn bản lịch sử này.");
      return db.runTransaction(async (tx) => {
        const s = await tx.get(ref(id));
        const cu = s.data();
        tx.set(ref(id).collection("history").doc(), { ...cu, _archivedAt: now(), ghiChuLuu: `trước khi khôi phục bản ${h.data().phienBan}` });
        const { _archivedAt, ghiChuLuu, ...ban } = h.data();
        const phienBan = (cu.phienBan || 0) + 1;
        tx.set(ref(id), { ...ban, phienBan, ghiChu: `khôi phục bản ${ban.phienBan}`, createdAt: cu.createdAt ?? null, createdBy: cu.createdBy ?? null, updatedAt: now(), updatedBy: email() });
        return { phienBan };
      });
    },
    async xoa(id) { await ref(id).delete(); },
  };
}

// ================================================================================================
// Bộ nhớ (?kho=thu) — cùng giao diện, cho test tự động; window.__khoThu cho test giả lập người khác lưu
// ================================================================================================
function khoBoNho() {
  const ds = new Map();                      // id → { data, history: [] }
  const nghe = new Set(), ngheU = new Set();
  let user = null, dem = 0;
  const now = () => new Date(Date.now() + dem++);   // tăng dần để thứ tự ổn định
  const bao = () => { const v = [...ds.entries()].map(([id, x]) => tomTat(id, x.data)).sort((a, b) => b.updatedAt - a.updatedAt); for (const cb of nghe) cb(v); };
  const kho = {
    loai: "thu",
    nguoiDung: () => user,
    ngheNguoiDung: (cb) => { ngheU.add(cb); setTimeout(() => cb(user)); return () => ngheU.delete(cb); },
    async dangNhap(e, p) {
      if (!e || p !== "thu") throw Object.assign(new Error("Sai email hoặc mật khẩu"), { code: "auth/invalid-credential" });
      user = { email: e }; for (const cb of ngheU) cb(user);
    },
    async dangXuat() { user = null; for (const cb of ngheU) cb(null); },
    ngheDanhSach: (cb) => { nghe.add(cb); setTimeout(bao); return () => nghe.delete(cb); },
    async mo(id) {
      const x = ds.get(id);
      if (!x) throw new Error("Dự án không còn trên server.");
      return { ...tomTat(id, x.data), duAn: moGoi(x.data) };
    },
    async taoMoi(ten, duAn) {
      const id = `p${ds.size + 1}`;
      ds.set(id, { data: { ...dongGoi(ten, duAn), phienBan: 1, createdBy: user?.email, updatedAt: now(), updatedBy: user?.email }, history: [] });
      bao();
      return { id, phienBan: 1 };
    },
    async luu(id, duAn, { ten, ghiChu = "", phienBanDangMo, ep = false } = {}) {
      const x = ds.get(id);
      if (!ep && x.data.phienBan !== phienBanDangMo) throw new LoiXungDot(tomTat(id, x.data));
      x.history.unshift({ hid: `h${x.history.length + 1}`, ...x.data, _archivedAt: now() });
      x.data = { ...x.data, ...dongGoi(ten ?? x.data.ten, duAn), phienBan: x.data.phienBan + 1, ghiChu, updatedAt: now(), updatedBy: user?.email };
      bao();
      return { phienBan: x.data.phienBan };
    },
    async doiTen(id, ten) { const x = ds.get(id); x.data = { ...x.data, ten, updatedAt: now() }; bao(); },
    async lichSu(id) {
      return ds.get(id).history.map((h) => ({ hid: h.hid, phienBan: h.phienBan, luc: h.updatedAt, boi: h.updatedBy || "", ghiChu: h.ghiChu || "", soMach: h.soMach }));
    },
    async khoiPhuc(id, hid) {
      const x = ds.get(id);
      const h = x.history.find((y) => y.hid === hid);
      x.history.unshift({ hid: `h${x.history.length + 1}`, ...x.data, _archivedAt: now() });
      const { hid: _h, _archivedAt, ...ban } = h;
      x.data = { ...ban, phienBan: x.data.phienBan + 1, ghiChu: `khôi phục bản ${ban.phienBan}`, updatedAt: now(), updatedBy: user?.email };
      bao();
      return { phienBan: x.data.phienBan };
    },
    async xoa(id) { ds.delete(id); bao(); },
  };
  // Giả lập người khác lưu (test xung đột)
  window.__khoThu = {
    luuThay: (id, sua) => {
      const x = ds.get(id);
      const duAn = sua(moGoi(x.data));
      x.history.unshift({ hid: `h${x.history.length + 1}`, ...x.data, _archivedAt: now() });
      x.data = { ...x.data, ...dongGoi(x.data.ten, duAn), phienBan: x.data.phienBan + 1, updatedAt: now(), updatedBy: "nguoi.khac@vi.du" };
      bao();
    },
  };
  return kho;
}

/** ?kho=thu → kho bộ nhớ (test); còn lại → Firebase (SDK nạp lúc gọi, lỗi mạng thì ném lỗi để giao diện báo). */
export async function taoKho(loai = new URLSearchParams(location.search).get("kho")) {
  return loai === "thu" ? khoBoNho() : khoFirebase();
}

/** Thông báo lỗi Firebase Auth dễ hiểu */
export function loiDangNhap(e) {
  const c = e?.code || "";
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return "Sai email hoặc mật khẩu.";
  if (/too-many-requests/.test(c)) return "Đăng nhập sai nhiều lần — thử lại sau ít phút.";
  if (/network/.test(c)) return "Không kết nối được máy chủ — kiểm tra mạng.";
  return e?.message || String(e);
}
