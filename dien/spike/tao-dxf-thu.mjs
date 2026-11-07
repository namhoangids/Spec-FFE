// Tạo 2 file DXF thử hiển thị tiếng Việt + block có thuộc tính (GĐ0).
//
//   cd dien/spike && npm install && node tao-dxf-thu.mjs
//
// Kết quả:
//   thu-tieng-viet-R2007-utf8.dxf    — thư viện @tarikjabiri/dxf, DXF AC1021, chữ UTF-8
//   thu-tieng-viet-R12-unicode.dxf   — bộ ghi R12 tự viết (không cần thư viện), chữ \U+XXXX
//
// Hai file có cùng nội dung: khung A3 + khung tên tạm, đoạn sơ đồ tủ DB-T1 (thanh cái,
// CB tổng, 4 mạch ra dùng block MCB có thuộc tính), dòng kiểm tra toàn bộ dấu tiếng Việt.
// Tên layer, block, khung tên ở đây là TẠM — sẽ thay bằng chuẩn công ty.

import { writeFileSync } from "node:fs";
import { Attrib, DxfWriter, point3d, SeqEnd } from "@tarikjabiri/dxf";

// ---------------------------------------------------------------------------
// Nội dung chung
// ---------------------------------------------------------------------------
const STYLE = "VN-ARIAL";
const FONT_FILE = "arial.ttf";

const LAYERS = [
  ["E-FRAM", 7], // khung, khung tên
  ["E-BUSB", 5], // thanh cái
  ["E-WIRE", 3], // dây
  ["E-SYMB", 1], // ký hiệu thiết bị
  ["E-TEXT", 7], // chữ
];

const KIEM_TRA = [
  "Kiểm tra dấu (HOA): ÀÁẢÃẠ ĂẰẮẲẴẶ ÂẦẤẨẪẬ Đ ÈÉẺẼẸ ÊỀẾỂỄỆ ÌÍỈĨỊ ÒÓỎÕỌ ÔỒỐỔỖỘ ƠỜỚỞỠỢ ÙÚỦŨỤ ƯỪỨỬỮỰ ỲÝỶỸỴ",
  "Kiểm tra dấu (thường): àáảãạ ăằắẳẵặ âầấẩẫậ đ èéẻẽẹ êềếểễệ ìíỉĩị òóỏõọ ôồốổỗộ ơờớởỡợ ùúủũụ ưừứửữự ỳýỷỹỵ",
  "Ký hiệu kỹ thuật: Ω  mm²  cosφ  ΔU  ≥  ≤  ×  ·  √3  °C  —  “ngoặc kép”",
];

const GHI_CHU = [
  "GHI CHÚ:",
  "1. Toàn bộ thiết bị đóng cắt dùng hãng Schneider (dòng sản phẩm chốt ở GĐ0).",
  "2. Mạch ổ cắm, khu ướt, ngoài nhà dùng RCBO 30 mA.",
  "3. File thử — tên layer, block, khung tên sẽ thay theo chuẩn công ty.",
];

// Mạch ra (lấy từ ví dụ tủ DB-T1 trong tài liệu phương án)
const MACH = [
  { MA_MACH: "C01", THIET_BI: "MCB 1P 10A C", CAP: "Cu/PVC 2×1,5+E1,5", PHU_TAI: "Chiếu sáng P.khách, sảnh" },
  { MA_MACH: "C03", THIET_BI: "RCBO 1P+N 10A 30mA", CAP: "Cu/PVC 2×1,5+E1,5", PHU_TAI: "Chiếu sáng sân vườn" },
  { MA_MACH: "C04", THIET_BI: "RCBO 1P+N 16A 30mA", CAP: "Cu/PVC 2×2,5+E2,5", PHU_TAI: "Ổ cắm P.khách, sảnh" },
  { MA_MACH: "C07", THIET_BI: "RCBO 1P+N 16A 30mA", CAP: "Cu/PVC 2×2,5+E2,5", PHU_TAI: "Bình nóng lạnh WC1" },
];
const CB_TONG = { MA_MACH: "Q0", THIET_BI: "MCB 3P 40A C 10kA", CAP: "Cu/XLPE/PVC 4×6+E6", PHU_TAI: "Cấp từ MDB/F03" };
// Vị trí riêng cho thuộc tính của CB tổng (nằm trên thanh cái nên dời chữ sang phải): [dx, dy, xoay]
const VI_TRI_CB_TONG = { THIET_BI: [6, -18, 0], CAP: [6, -22.5, 0], PHU_TAI: [6, -27, 0] };

// Block MCB: điểm gốc (0,0) là điểm nối lên thanh cái, thân thiết bị đi xuống.
const BLOCK_MCB = {
  name: "MCB_1P",
  lines: [
    [[0, 0], [0, -12]],
    [[0, -12], [-4.5, -20]],          // tiếp điểm
    [[-1.5, -10.5], [1.5, -13.5]],    // dấu × của aptomat
    [[-1.5, -13.5], [1.5, -10.5]],
    [[0, -20], [0, -32]],
  ],
  circles: [[[0, -33], 1]],
  attdefs: [
    // tag, prompt, mặc định, x, y, cao, xoay
    ["MA_MACH", "Mã mạch", "C00", 2.5, -6, 2.5, 0],
    ["THIET_BI", "Thiết bị bảo vệ", "MCB 1P 16A C", -19, -40, 2.0, 0],
    ["CAP", "Cáp", "Cu/PVC 2×2,5+E2,5", -19, -44.5, 2.0, 0],
    ["PHU_TAI", "Phụ tải", "Phụ tải", 1, -100, 2.5, 90],
  ],
};

const X0 = 50, BUS_Y = 200, PITCH = 45;
const busEnd = X0 + PITCH * (MACH.length + 1);

// ---------------------------------------------------------------------------
// Ghi bằng thư viện (DXF R2007, UTF-8)
// ---------------------------------------------------------------------------
function ghiR2007(path) {
  const dxf = new DxfWriter();
  for (const [n, c] of LAYERS) dxf.addLayer(n, c, "CONTINUOUS");
  const style = dxf.tables.addStyle(STYLE);
  style.fontFileName = FONT_FILE;

  const t = (layer) => ({ layerName: layer });
  const text = (owner, x, y, h, s, opt = {}) => {
    const e = owner.addText(point3d(x, y), h, s, { layerName: "E-TEXT", ...opt });
    e.textStyle = STYLE;
    return e;
  };

  // Block MCB
  const blk = dxf.addBlock(BLOCK_MCB.name);
  for (const [a, b] of BLOCK_MCB.lines) blk.addLine(point3d(...a), point3d(...b), t("E-SYMB"));
  for (const [c, r] of BLOCK_MCB.circles) blk.addCircle(point3d(...c), r, t("E-SYMB"));
  for (const [tag, , def, x, y, h, rot] of BLOCK_MCB.attdefs) {
    const a = blk.addAttdef(point3d(x, y), h, tag, def, { layerName: "E-TEXT", rotation: rot });
    a.textStyle = STYLE;
  }

  const ms = dxf.modelSpace;
  // Khung A3 + khung tên tạm
  ms.addRectangle(point3d(0, 297), point3d(420, 0), t("E-FRAM"));
  ms.addRectangle(point3d(10, 287), point3d(410, 10), t("E-FRAM"));
  ms.addRectangle(point3d(270, 50), point3d(410, 10), t("E-FRAM"));
  ms.addLine(point3d(270, 30), point3d(410, 30), t("E-FRAM"));
  text(ms, 274, 42, 3, "KHUNG TÊN TẠM — CÔNG TY");
  text(ms, 274, 35, 2.5, "Dự án: Biệt thự mẫu");
  text(ms, 274, 22, 3.5, "SƠ ĐỒ NGUYÊN LÝ TỦ ĐIỆN DB-T1");
  text(ms, 274, 14, 2.5, "Bản vẽ: E-201 · Rev A · Tỷ lệ: —");

  // Tiêu đề
  text(ms, 20, 272, 5, "SƠ ĐỒ NGUYÊN LÝ TỦ ĐIỆN DB-T1 — TẦNG 1");
  text(ms, 20, 264, 2.5, "3P+N+PE 380/220V · Âm tường IP40 · Vỏ 36 module · Cấp từ MDB/F03 · Cu/XLPE/PVC 4×6+E6 · L = 30 m");

  // CB tổng (chèn phía trên thanh cái), thanh cái
  insertWithAttribs(ms, X0, BUS_Y + 40, CB_TONG, VI_TRI_CB_TONG);
  ms.addLine(point3d(X0, BUS_Y + 7), point3d(X0, BUS_Y), t("E-WIRE"));
  ms.addLine(point3d(X0 - 10, BUS_Y), point3d(busEnd, BUS_Y), t("E-BUSB"));
  ms.addLine(point3d(X0 - 10, BUS_Y - 1.2), point3d(busEnd, BUS_Y - 1.2), t("E-BUSB"));
  text(ms, busEnd + 3, BUS_Y - 1, 2.5, "THANH CÁI 3P+N");

  // Mạch ra
  MACH.forEach((m, i) => insertWithAttribs(ms, X0 + PITCH * (i + 1), BUS_Y, m));

  // Ghi chú (MTEXT) và dòng kiểm tra (TEXT)
  const mt = ms.addMText(point3d(20, 88), 2.5, GHI_CHU.join("\\P"), { layerName: "E-TEXT", width: 230 });
  mt.textStyle = STYLE;
  KIEM_TRA.forEach((s, i) => text(ms, 20, 60 - i * 7, 2.5, s));

  writeFileSync(path, dxf.stringify(), "utf8");

  // Không dùng owner.addAttrib() của thư viện: bản 2.10.0 ghi một SEQEND sau MỖI thuộc tính,
  // làm hỏng block có nhiều thuộc tính. Ở đây tự ghi đúng chuẩn DXF:
  // INSERT (66=1) → các ATTRIB (owner = INSERT) → một SEQEND (owner = INSERT).
  function insertWithAttribs(owner, x, y, values, viTri = {}) {
    const ins = owner.addInsert(BLOCK_MCB.name, point3d(x, y), t("E-SYMB"));
    ins.attributesFollowFlag = 1;
    for (const [tag, , , ddx, ddy, h, drot] of BLOCK_MCB.attdefs) {
      const [dx, dy, rot] = viTri[tag] ?? [ddx, ddy, drot];
      const a = owner.addEntity(new Attrib(point3d(x + dx, y + dy), h, tag, values[tag],
        { layerName: "E-TEXT", rotation: rot }));
      a.textStyle = STYLE;
      a.ownerBlockRecord = ins.handle;
    }
    const end = owner.addEntity(new SeqEnd());
    end.ownerBlockRecord = ins.handle;
    end.layerName = "E-SYMB";
    return ins;
  }
}

// ---------------------------------------------------------------------------
// Bộ ghi R12 tự viết (AC1009) — chữ ngoài ASCII mã hóa \U+XXXX
// ---------------------------------------------------------------------------
function ghiR12(path) {
  const out = [];
  const g = (code, value) => out.push(String(code), String(value));
  const num = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(+v.toFixed(6)));
  const enc = (s) => [...s].map((ch) => {
    const cp = ch.codePointAt(0);
    return cp < 128 ? ch : "\\U+" + cp.toString(16).toUpperCase().padStart(4, "0");
  }).join("");
  const pt = (base, x, y) => { g(base, num(x)); g(base + 10, num(y)); g(base + 20, "0.0"); };

  const line = (layer, a, b) => { g(0, "LINE"); g(8, layer); pt(10, ...a); pt(11, ...b); };
  const circle = (layer, c, r) => { g(0, "CIRCLE"); g(8, layer); pt(10, ...c); g(40, num(r)); };
  const rect = (layer, x1, y1, x2, y2) => {
    line(layer, [x1, y1], [x2, y1]); line(layer, [x2, y1], [x2, y2]);
    line(layer, [x2, y2], [x1, y2]); line(layer, [x1, y2], [x1, y1]);
  };
  const text = (x, y, h, s, rot = 0, layer = "E-TEXT") => {
    g(0, "TEXT"); g(8, layer); pt(10, x, y); g(40, num(h)); g(1, enc(s));
    if (rot) g(50, num(rot));
    g(7, STYLE);
  };

  // HEADER
  g(0, "SECTION"); g(2, "HEADER");
  g(9, "$ACADVER"); g(1, "AC1009");
  g(9, "$DWGCODEPAGE"); g(3, "ANSI_1258");
  g(9, "$INSBASE"); pt(10, 0, 0);
  g(9, "$EXTMIN"); pt(10, 0, 0);
  g(9, "$EXTMAX"); pt(10, 420, 297);
  g(9, "$LIMMIN"); g(10, "0.0"); g(20, "0.0");
  g(9, "$LIMMAX"); g(10, "420.0"); g(20, "297.0");
  g(9, "$TEXTSTYLE"); g(7, STYLE);
  g(9, "$CLAYER"); g(8, "0");
  g(0, "ENDSEC");

  // TABLES
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LTYPE"); g(70, 1);
  g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Solid line"); g(72, 65); g(73, 0); g(40, "0.0");
  g(0, "ENDTAB");
  g(0, "TABLE"); g(2, "LAYER"); g(70, LAYERS.length + 1);
  for (const [n, c] of [["0", 7], ...LAYERS]) {
    g(0, "LAYER"); g(2, n); g(70, 0); g(62, c); g(6, "CONTINUOUS");
  }
  g(0, "ENDTAB");
  g(0, "TABLE"); g(2, "STYLE"); g(70, 2);
  for (const [n, f] of [["STANDARD", "txt"], [STYLE, FONT_FILE]]) {
    g(0, "STYLE"); g(2, n); g(70, 0); g(40, "0.0"); g(41, "1.0"); g(50, "0.0"); g(71, 0);
    g(42, "2.5"); g(3, f); g(4, "");
  }
  g(0, "ENDTAB");
  g(0, "ENDSEC");

  // BLOCKS
  g(0, "SECTION"); g(2, "BLOCKS");
  g(0, "BLOCK"); g(8, "0"); g(2, BLOCK_MCB.name); g(70, 2); pt(10, 0, 0); g(3, BLOCK_MCB.name);
  for (const [a, b] of BLOCK_MCB.lines) line("E-SYMB", a, b);
  for (const [c, r] of BLOCK_MCB.circles) circle("E-SYMB", c, r);
  for (const [tag, prompt, def, x, y, h, rot] of BLOCK_MCB.attdefs) {
    g(0, "ATTDEF"); g(8, "E-TEXT"); pt(10, x, y); g(40, num(h)); g(1, enc(def));
    if (rot) g(50, num(rot));
    g(7, STYLE); g(3, enc(prompt)); g(2, tag); g(70, 0);
  }
  g(0, "ENDBLK"); g(8, "0");
  g(0, "ENDSEC");

  // ENTITIES
  g(0, "SECTION"); g(2, "ENTITIES");
  rect("E-FRAM", 0, 0, 420, 297);
  rect("E-FRAM", 10, 10, 410, 287);
  rect("E-FRAM", 270, 10, 410, 50);
  line("E-FRAM", [270, 30], [410, 30]);
  text(274, 42, 3, "KHUNG TÊN TẠM — CÔNG TY");
  text(274, 35, 2.5, "Dự án: Biệt thự mẫu");
  text(274, 22, 3.5, "SƠ ĐỒ NGUYÊN LÝ TỦ ĐIỆN DB-T1");
  text(274, 14, 2.5, "Bản vẽ: E-201 · Rev A · Tỷ lệ: —");
  text(20, 272, 5, "SƠ ĐỒ NGUYÊN LÝ TỦ ĐIỆN DB-T1 — TẦNG 1");
  text(20, 264, 2.5, "3P+N+PE 380/220V · Âm tường IP40 · Vỏ 36 module · Cấp từ MDB/F03 · Cu/XLPE/PVC 4×6+E6 · L = 30 m");

  const insert = (x, y, values, viTri = {}) => {
    g(0, "INSERT"); g(8, "E-SYMB"); g(66, 1); g(2, BLOCK_MCB.name); pt(10, x, y);
    for (const [tag, , , ddx, ddy, h, drot] of BLOCK_MCB.attdefs) {
      const [dx, dy, rot] = viTri[tag] ?? [ddx, ddy, drot];
      g(0, "ATTRIB"); g(8, "E-TEXT"); pt(10, x + dx, y + dy); g(40, num(h)); g(1, enc(values[tag]));
      g(2, tag); g(70, 0);
      if (rot) g(50, num(rot));
      g(7, STYLE);
    }
    g(0, "SEQEND"); g(8, "E-SYMB");
  };
  insert(X0, BUS_Y + 40, CB_TONG, VI_TRI_CB_TONG);
  line("E-WIRE", [X0, BUS_Y + 7], [X0, BUS_Y]);
  line("E-BUSB", [X0 - 10, BUS_Y], [busEnd, BUS_Y]);
  line("E-BUSB", [X0 - 10, BUS_Y - 1.2], [busEnd, BUS_Y - 1.2]);
  text(busEnd + 3, BUS_Y - 1, 2.5, "THANH CÁI 3P+N");
  MACH.forEach((m, i) => insert(X0 + PITCH * (i + 1), BUS_Y, m));
  GHI_CHU.forEach((s, i) => text(20, 88 - i * 4.5, 2.5, s));
  KIEM_TRA.forEach((s, i) => text(20, 60 - i * 7, 2.5, s));
  g(0, "ENDSEC");
  g(0, "EOF");

  // R12: chỉ còn ký tự ASCII sau khi mã hóa; dùng CRLF như AutoCAD.
  writeFileSync(path, out.join("\r\n") + "\r\n", "ascii");
}

ghiR2007("thu-tieng-viet-R2007-utf8.dxf");
ghiR12("thu-tieng-viet-R12-unicode.dxf");
console.log("Đã tạo: thu-tieng-viet-R2007-utf8.dxf, thu-tieng-viet-R12-unicode.dxf");
