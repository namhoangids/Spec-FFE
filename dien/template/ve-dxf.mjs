// Bộ vẽ DXF (AutoCAD 2007, UTF-8) dùng thư viện @tarikjabiri/dxf 2.10.0.
// Đơn vị mm, trục y hướng lên.
//
// Hai lỗi của thư viện cần né (đã ghi trong dien/spike/README.md):
//  1. addAttrib() ghi một SEQEND sau MỖI thuộc tính → tự ghi INSERT → các ATTRIB → một SEQEND.
//  2. ATTRIB/ATTDEF ghi căn dọc vào mã 73 (đúng phải là 74) → thuộc tính chỉ dùng căn ngang,
//     căn dọc được quy đổi thành vị trí đường chân chữ.

import {
  Attrib, DxfWriter, HatchBoundaryPaths, HatchPolylineBoundary, LWPolylineFlags,
  SeqEnd, TrueColor, Units, point3d,
} from "@tarikjabiri/dxf";
import { FONT, LAYERS } from "./mau-indust.mjs";

const HA = { left: 0, center: 1, right: 2 };
// Làm tròn toạ độ / kích thước 3 chữ số thập phân (0,001 mm) cho file DXF gọn, dễ đọc
const r3 = (v) => Math.round(v * 1000) / 1000;
const pt = (x, y) => point3d(r3(x), r3(y));
const VA = { baseline: 0, bottom: 1, middle: 2, top: 3 };
const STYLE = { normal: "IND-ARIAL", bold: "IND-ARIAL-DAM" };

export function taoDxf() {
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);
  // AutoCAD luôn ghi $DWGCODEPAGE; thiếu biến này một số trình đọc (ezdxf recover…) không nhận ra
  // file R2007 là UTF-8.
  dxf.setVariable("$DWGCODEPAGE", { 3: "ANSI_1252" });
  for (const [, [name, aci, [r, gg, b]]] of Object.entries(LAYERS)) {
    const layer = dxf.addLayer(name, aci, "CONTINUOUS");
    layer.trueColor = TrueColor.fromRGB(r, gg, b);
  }
  dxf.tables.addStyle(STYLE.normal).fontFileName = FONT.normal;
  dxf.tables.addStyle(STYLE.bold).fontFileName = FONT.bold;

  const blocks = new Map();
  let owner = dxf.modelSpace;
  const ly = (k) => ({ layerName: LAYERS[k][0] });

  const g = {
    line(layer, x1, y1, x2, y2) {
      owner.addLine(pt(x1, y1), pt(x2, y2), ly(layer));
    },
    rect(layer, x0, y0, x1, y1) {
      g.poly(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);
    },
    poly(layer, pts, closed) {
      owner.addLWPolyline(pts.map(([x, y]) => ({ point: { x: r3(x), y: r3(y) } })),
        { ...ly(layer), flags: closed ? LWPolylineFlags.Closed : LWPolylineFlags.None });
    },
    fill(layer, pts) {
      const paths = new HatchBoundaryPaths();
      paths.addPolylineBoundary(new HatchPolylineBoundary(pts.map(([x, y]) => ({ x: r3(x), y: r3(y) }))));
      owner.addHatch(paths, { name: "SOLID" }, ly(layer));
    },
    circle(layer, x, y, r, opt = {}) {
      if (opt.fill) {
        const pts = Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * 2 * Math.PI;
          return [x + r * Math.cos(a), y + r * Math.sin(a)];
        });
        g.fill(layer, pts);
      }
      owner.addCircle(pt(x, y), r3(r), ly(layer));
    },
    text(layer, x, y, h, s, opt = {}) {
      if (s == null || s === "") return;
      const ha = HA[opt.ha || "left"], va = VA[opt.va || "baseline"];
      const aligned = ha !== 0 || va !== 0;
      const t = owner.addText(pt(x, y), r3(h), String(s), {
        ...ly(layer),
        rotation: opt.rot || undefined,
        horizontalAlignment: aligned ? ha : undefined,
        verticalAlignment: aligned ? va : undefined,
        secondAlignmentPoint: aligned ? pt(x, y) : undefined,
        relativeXScaleFactor: opt.wf && opt.wf !== 1 ? opt.wf : undefined,
      });
      t.textStyle = opt.bold ? STYLE.bold : STYLE.normal;
    },
    mtext(layer, x, y, h, s, width) {
      const t = owner.addMText(pt(x, y), r3(h), String(s).replace(/\n/g, "\\P"), { ...ly(layer), width: r3(width) });
      t.textStyle = STYLE.normal;
    },
    defineBlock(name, build, attdefs = []) {
      if (blocks.has(name)) return;
      const blk = dxf.addBlock(name);
      const prev = owner;
      owner = blk;
      build(g);
      for (const a of attdefs) {
        const p = attrPos(a, a.dx, a.dy);
        const ad = blk.addAttdef(p.pos, r3(a.h), a.tag, "", {
          ...ly(a.layer), rotation: a.rot || undefined,
          horizontalAlignment: p.ha || undefined, secondAlignmentPoint: p.ha ? p.pos : undefined,
        });
        ad.textStyle = a.bold ? STYLE.bold : STYLE.normal;
      }
      owner = prev;
      blocks.set(name, attdefs);
    },
    insert(name, x, y, values = {}) {
      const attdefs = blocks.get(name);
      if (!attdefs) throw new Error(`Chưa định nghĩa block ${name}`);
      const ins = owner.addInsert(name, pt(x, y), ly("LINE"));
      if (!attdefs.length) return ins;
      ins.attributesFollowFlag = 1;
      for (const a of attdefs) {
        const p = attrPos(a, x + a.dx, y + a.dy);
        const v = values[a.tag];
        const at = owner.addEntity(new Attrib(p.pos, r3(a.h), a.tag, v == null ? "" : String(v), {
          ...ly(a.layer), rotation: a.rot || undefined,
          horizontalAlignment: p.ha || undefined, secondAlignmentPoint: p.ha ? p.pos : undefined,
        }));
        at.textStyle = a.bold ? STYLE.bold : STYLE.normal;
        at.ownerBlockRecord = ins.handle;
      }
      const end = owner.addEntity(new SeqEnd());
      end.ownerBlockRecord = ins.handle;
      end.layerName = LAYERS.LINE[0];
      return ins;
    },
    toString() {
      return dxf.stringify();
    },
  };
  return g;
}

// Thuộc tính: chỉ căn ngang; căn dọc quy về đường chân chữ (xem lỗi số 2 ở đầu file)
function attrPos(a, x, y) {
  const shift = { middle: -a.h / 2, top: -a.h, bottom: 0.21 * a.h, baseline: 0 }[a.va || "baseline"];
  const rad = ((a.rot || 0) * Math.PI) / 180;
  return { pos: pt(x - Math.sin(rad) * shift, y + Math.cos(rad) * shift), ha: HA[a.ha || "left"] };
}
