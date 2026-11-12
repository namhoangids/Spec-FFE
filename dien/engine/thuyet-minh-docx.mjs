// Thuyết minh tính toán → Word (.docx), từ nội dung do noiDungThuyetMinh (thuyet-minh.mjs) dựng.
// Trình bày theo mẫu văn bản Indust Design (như "Yêu cầu bàn giao mặt bằng"):
//   Arial; cam #F15A22, xanh than #22333B, xám nâu #6E6156; khối thông tin 3 × 2 (dòng 2 nền #F5F4F1);
//   kẻ cam mỏng dưới khối thông tin; dòng "Cách dùng —"; đề mục 01–06 có vạch cam bên trái;
//   bảng dùng Table Style thật của Word (băng màu xen kẽ #F7F7F5 / trắng, tự đúng khi thêm/xoá dòng);
//   chân trang Word thật "Indust Design | … | Working Document" lặp mọi trang.
// Thư viện `docx` được truyền vào (như xuatExcel nhận XLSX) để chạy được cả trên Node lẫn trình duyệt:
//   Node:        const doc = thuyetMinhDocx(docx, nd); await docx.Packer.toBuffer(doc)
//   Trình duyệt: await docx.Packer.toBlob(thuyetMinhDocx(docx, nd))

const FONT = "Arial";
const CAM = "F15A22", THAN = "22333B", XAM = "6E6156", NEN = "F5F4F1", BANG = "F7F7F5";
// A4 theo DXA (1 cm = 567). Trang ngang: docx tự đảo chiều khi đặt orientation LANDSCAPE.
const A4 = { width: 11906, height: 16838 };
const LE = {
  doc: { top: 1021, bottom: 1021, left: 1134, right: 907 },       // 1,8 / 1,8 / 2,0 / 1,6 cm
  ngang: { top: 794, bottom: 907, left: 907, right: 794 },
};
const RONG = { doc: A4.width - LE.doc.left - LE.doc.right, ngang: A4.height - LE.ngang.left - LE.ngang.right };

// Table Style "Indust Bang": không viền, dòng tiêu đề chữ đậm xanh than + gạch cam, băng màu xen kẽ
const STYLE_BANG = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="table" w:styleId="IndustBang">
    <w:name w:val="Indust Bang"/>
    <w:basedOn w:val="TableNormal"/>
    <w:uiPriority w:val="99"/>
    <w:tblPr>
      <w:tblStyleRowBandSize w:val="1"/>
      <w:tblStyleColBandSize w:val="1"/>
      <w:tblBorders>
        <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>
    </w:tblPr>
    <w:tblStylePr w:type="firstRow">
      <w:rPr><w:b/><w:color w:val="${THAN}"/></w:rPr>
      <w:tcPr>
        <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="${CAM}"/></w:tcBorders>
        <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
      </w:tcPr>
    </w:tblStylePr>
    <w:tblStylePr w:type="band1Horz">
      <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${BANG}"/></w:tcPr>
    </w:tblStylePr>
    <w:tblStylePr w:type="band2Horz">
      <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>
    </w:tblStylePr>
  </w:style>
</w:styles>`;

/**
 * @param {object} docx — thư viện docx (npm)
 * @param {{ tieuDe: string, tenDuAn: string, chanTrang: string, khoi: object[] }} nd
 * @returns {import("docx").Document}
 */
export function thuyetMinhDocx(docx, nd) {
  const {
    AlignmentType, BorderStyle, Document, Footer, HeadingLevel, LevelFormat, PageBreak, PageNumber,
    PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
  } = docx;

  const run = (x, o = {}) => (typeof x === "string" ? new TextRun({ text: x, ...o }) : new TextRun({ text: x.b, ...o, bold: true }));
  const runs = (noi, o) => noi.filter((x) => x !== "" && x != null).map((x) => run(x, o));
  const khong = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const tatVien = { top: khong, bottom: khong, left: khong, right: khong, insideHorizontal: khong, insideVertical: khong };
  const tatVienO = { top: khong, bottom: khong, left: khong, right: khong };
  const chia = (rong, tiLe) => {
    const tong = tiLe.reduce((a, b) => a + b, 0);
    const w = tiLe.map((x) => Math.floor((x / tong) * rong));
    w[w.length - 1] += rong - w.reduce((a, b) => a + b, 0);
    return w;
  };

  /** Bảng số liệu: Table Style "IndustBang" (băng màu do Word tự vẽ, không tô tay từng ô); tiêu đề cột lặp lại mỗi trang. */
  function bang(k, huong) {
    const rong = RONG[huong];
    const w = chia(rong, k.cot.map((c) => c.rong || 1));
    const co = huong === "ngang" ? 17 : 18;   // 8,5 pt trang ngang, 9 pt trang dọc
    const o = (text, i, dau) => new TableCell({
      width: { size: w[i], type: WidthType.DXA },
      verticalAlign: dau ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
      children: [new Paragraph({
        alignment: k.cot[i]?.so ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: 240 },
        children: [new TextRun({ text: String(text ?? ""), size: co })],
      })],
    });
    return new Table({
      style: "IndustBang",
      tableLook: { firstRow: true, lastRow: false, firstColumn: false, lastColumn: false, noHBand: false, noVBand: true },
      width: { size: rong, type: WidthType.DXA },
      columnWidths: w,
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: k.cot.map((c, i) => o(c.ten, i, true)) }),
        ...k.dong.map((d) => new TableRow({ cantSplit: true, children: k.cot.map((_, i) => o(d[i], i, false)) })),
      ],
    });
  }

  /** Khối thông tin dự án 3 cột × 2 dòng: nhãn nhỏ đậm xám, giá trị xanh than; dòng 2 nền xám ấm. */
  function thongTin(k) {
    const w = chia(RONG.doc, [1, 1, 1]);
    const o = ([nhan, gt], i, nen) => new TableCell({
      width: { size: w[i], type: WidthType.DXA }, borders: tatVienO,
      shading: nen ? { type: ShadingType.CLEAR, fill: NEN, color: "auto" } : undefined,
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [
        new Paragraph({ spacing: { before: 0, after: 30 }, children: [new TextRun({ text: nhan, bold: true, size: 15, color: XAM, characterSpacing: 10 })] }),
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: gt, size: 19, color: THAN })] }),
      ],
    });
    return new Table({
      width: { size: RONG.doc, type: WidthType.DXA }, columnWidths: w, borders: tatVien,
      rows: [
        new TableRow({ children: k.o.slice(0, 3).map((x, i) => o(x, i, false)) }),
        new TableRow({ children: k.o.slice(3, 6).map((x, i) => o(x, i, true)) }),
      ],
    });
  }

  function kyTen(k) {
    const w = chia(RONG.doc, k.o.map(() => 1));
    const o = (text, i, nhan) => new TableCell({
      width: { size: w[i], type: WidthType.DXA }, borders: tatVienO,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { before: 0, after: nhan ? 1300 : 0 },
        children: [new TextRun(nhan ? { text, bold: true, size: 16, color: XAM, characterSpacing: 10 } : { text, bold: true })],
      })],
    });
    return new Table({
      width: { size: RONG.doc, type: WidthType.DXA }, columnWidths: w, borders: tatVien,
      rows: [
        new TableRow({ children: k.o.map(([cd], i) => o(cd, i, true)) }),
        new TableRow({ children: k.o.map(([, ten], i) => o(ten || "", i, false)) }),
      ],
    });
  }

  // Gom khối thành các section theo hướng giấy
  const sections = [];
  let cur = null;
  const moi = (huong) => { cur = { huong, children: [] }; sections.push(cur); };
  for (const k of nd.khoi) {
    if (k.loai === "trang") { moi(k.huong); continue; }
    if (!cur) moi("doc");
    const c = cur.children;
    switch (k.loai) {
      case "tieuDe":
        c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, children: [new TextRun({ text: k.text, bold: true, size: 33, color: THAN })] }));
        c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 }, children: [new TextRun({ text: k.phu, size: 19, color: XAM, characterSpacing: 20 })] }));
        break;
      case "thongTin":
        c.push(thongTin(k));
        // Kẻ cam mỏng ngăn khối thông tin với nội dung chính
        c.push(new Paragraph({ spacing: { before: 0, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: CAM, space: 1 } }, children: [] }));
        break;
      case "cachDung":
        c.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED, spacing: { before: 60, after: 240 },
          children: [new TextRun({ text: "Cách dùng — ", bold: true, color: CAM, size: 18 }), ...runs(k.noi, { italics: true, color: XAM, size: 18 })],
        }));
        break;
      case "muc":
        c.push(k.cap === 1
          ? new Paragraph({
            heading: HeadingLevel.HEADING_1,
            border: { left: { style: BorderStyle.SINGLE, size: 32, color: CAM, space: 8 } },
            children: [new TextRun({ text: `${k.so ?? ""}  `, color: CAM }), new TextRun(k.text)],
          })
          : new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(k.text)] }));
        break;
      case "doan":
        c.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, keepNext: !!k.giu, spacing: { after: 100 }, children: runs(k.noi) }));
        break;
      case "danhSach":
        for (const m of k.muc) c.push(new Paragraph({ numbering: { reference: "cham", level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 }, children: runs(m) }));
        break;
      case "bang":
        c.push(bang(k, cur.huong));
        c.push(new Paragraph({ spacing: { before: 0, after: 100 }, children: [] }));   // khoảng cách sau bảng
        break;
      case "ngatTrang": c.push(new Paragraph({ children: [new PageBreak()] })); break;
      case "kyTen":
        c.push(new Paragraph({ spacing: { before: 480, after: 0 }, children: [] }));
        c.push(kyTen(k));
        break;
    }
  }

  // Chân trang Word thật, lặp mọi trang: kẻ mảnh phía trên, căn giữa, chữ nhỏ xám
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D5D0C8", space: 4 } },
      children: [new TextRun({ children: [`${nd.chanTrang || ""}  ·  Trang `, PageNumber.CURRENT, "/", PageNumber.TOTAL_PAGES], size: 15, color: XAM })],
    })],
  });

  return new Document({
    creator: "Indust Design",
    title: `${nd.tieuDe}${nd.tenDuAn ? ` — ${nd.tenDuAn}` : ""}`,
    externalStyles: STYLE_BANG,
    styles: {
      default: {
        document: { run: { font: FONT, size: 20, color: THAN }, paragraph: { spacing: { line: 276 } } },
        heading1: { run: { font: FONT, size: 26, bold: true, color: THAN }, paragraph: { spacing: { before: 320, after: 140 }, keepNext: true, keepLines: true } },
        heading2: { run: { font: FONT, size: 21, bold: true, color: THAN }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, keepLines: true } },
      },
    },
    numbering: {
      config: [{
        reference: "cham",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 240 } }, run: { color: CAM } },
        }],
      }],
    },
    sections: sections.map((s) => ({
      properties: {
        page: {
          size: s.huong === "ngang" ? { ...A4, orientation: PageOrientation.LANDSCAPE } : { ...A4 },
          margin: { ...LE[s.huong], header: 425, footer: 425 },
        },
      },
      footers: { default: footer },
      children: s.children,
    })),
  });
}
