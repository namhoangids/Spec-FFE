// Thuyết minh tính toán → Word (.docx), từ nội dung do noiDungThuyetMinh (thuyet-minh.mjs) dựng.
// Thư viện `docx` được truyền vào (như xuatExcel nhận XLSX) để chạy được cả trên Node lẫn trình duyệt:
//   Node:        const doc = thuyetMinhDocx(docx, nd); await docx.Packer.toBuffer(doc)
//   Trình duyệt: await docx.Packer.toBlob(thuyetMinhDocx(docx, nd))

const FONT = "Times New Roman";
const XANH_THAN = "22333B";
// A4 theo DXA (1 cm = 567). Trang ngang: docx tự đảo chiều khi đặt orientation LANDSCAPE.
const A4 = { width: 11906, height: 16838 };
const LE = {
  doc: { top: 1134, bottom: 1021, left: 1418, right: 851 },       // 2 / 1,8 / 2,5 / 1,5 cm
  ngang: { top: 851, bottom: 851, left: 1021, right: 851 },
};
const RONG = { doc: A4.width - LE.doc.left - LE.doc.right, ngang: A4.height - LE.ngang.left - LE.ngang.right };

/**
 * @param {object} docx — thư viện docx (npm)
 * @param {{ tieuDe: string, tenDuAn: string, khoi: object[] }} nd
 * @returns {import("docx").Document}
 */
export function thuyetMinhDocx(docx, nd) {
  const {
    AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, LevelFormat, PageBreak, PageNumber,
    PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
  } = docx;

  const run = (x, o = {}) => (typeof x === "string" ? new TextRun({ text: x, ...o }) : new TextRun({ text: x.b, bold: true, ...o }));
  const runs = (noi, o) => noi.filter((x) => x !== "" && x != null).map((x) => run(x, o));
  const vien = (mau = "444444", day = 4) => ({ style: BorderStyle.SINGLE, size: day, color: mau });
  const khongVien = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const tatVien = { top: khongVien, bottom: khongVien, left: khongVien, right: khongVien, insideHorizontal: khongVien, insideVertical: khongVien };

  /** Bảng có tiêu đề cột lặp lại ở mỗi trang; độ rộng theo DXA (cột và ô đều khai báo). */
  function bang(k, huong) {
    const rong = RONG[huong];
    const tong = k.cot.reduce((a, c) => a + (c.rong || 1), 0);
    const w = k.cot.map((c) => Math.floor(((c.rong || 1) / tong) * rong));
    w[w.length - 1] += rong - w.reduce((a, b) => a + b, 0);
    const co = huong === "ngang" ? 18 : 20;   // 9 pt trang ngang, 10 pt trang dọc
    const o = (text, i, dau) => new TableCell({
      width: { size: w[i], type: WidthType.DXA },
      margins: { top: 30, bottom: 30, left: 60, right: 60 },
      verticalAlign: dau ? VerticalAlign.CENTER : VerticalAlign.TOP,
      shading: dau ? { type: ShadingType.CLEAR, fill: "ECEAE6", color: "auto" } : undefined,
      children: [new Paragraph({
        alignment: !dau && k.cot[i]?.so ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: 240 },
        children: [new TextRun({ text: String(text ?? ""), bold: dau, size: co })],
      })],
    });
    return new Table({
      width: { size: rong, type: WidthType.DXA },
      columnWidths: w,
      borders: { top: vien(), bottom: vien(), left: vien(), right: vien(), insideHorizontal: vien(), insideVertical: vien() },
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: k.cot.map((c, i) => o(c.ten, i, true)) }),
        ...k.dong.map((d) => new TableRow({ cantSplit: true, children: k.cot.map((_, i) => o(d[i], i, false)) })),
      ],
    });
  }

  function thongTin(k) {
    const w = [Math.round(RONG.doc * 0.34), RONG.doc - Math.round(RONG.doc * 0.34)];
    return new Table({
      width: { size: RONG.doc, type: WidthType.DXA }, columnWidths: w, borders: tatVien,
      rows: k.dong.map(([a, b]) => new TableRow({
        children: [a, b].map((t, i) => new TableCell({
          width: { size: w[i], type: WidthType.DXA }, borders: tatVien,
          children: [new Paragraph({ spacing: { before: 20, after: 20 }, children: [new TextRun({ text: t, bold: i === 1 })] })],
        })),
      })),
    });
  }

  function kyTen(k) {
    const w = Array(k.o.length).fill(Math.floor(RONG.doc / k.o.length));
    w[w.length - 1] += RONG.doc - w.reduce((a, b) => a + b, 0);
    const o = (text, i, dam, sau) => new TableCell({
      width: { size: w[i], type: WidthType.DXA }, borders: tatVien,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: sau }, children: [new TextRun({ text, bold: dam })] })],
    });
    return new Table({
      width: { size: RONG.doc, type: WidthType.DXA }, columnWidths: w, borders: tatVien,
      rows: [
        new TableRow({ children: k.o.map(([cd], i) => o(cd, i, true, 1300)) }),
        new TableRow({ children: k.o.map(([, ten], i) => o(ten || "", i, true, 0)) }),
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
        c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 60 }, children: [new TextRun({ text: k.text, bold: true, size: 34, color: XANH_THAN })] }));
        c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 480 }, children: [new TextRun({ text: k.phu, bold: true, size: 28, color: XANH_THAN })] }));
        break;
      case "thongTin": c.push(thongTin(k)); break;
      case "khung":
        c.push(new Paragraph({
          spacing: { before: 360, after: 240 },
          border: { top: vien("A5514B", 8), bottom: vien("A5514B", 8), left: vien("A5514B", 8), right: vien("A5514B", 8) },
          shading: { type: ShadingType.CLEAR, fill: "F8ECEB", color: "auto" },
          children: runs(k.noi),
        }));
        break;
      case "muc":
        c.push(new Paragraph({ heading: k.cap === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, children: [new TextRun(k.text)] }));
        break;
      case "doan":
        c.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, keepNext: !!k.giu, spacing: { after: 100 }, children: runs(k.noi) }));
        break;
      case "danhSach":
        for (const m of k.muc) c.push(new Paragraph({ numbering: { reference: "gach", level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 }, children: runs(m) }));
        break;
      case "bang":
        c.push(bang(k, cur.huong));
        c.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [] }));   // khoảng cách sau bảng
        break;
      case "ngatTrang": c.push(new Paragraph({ children: [new PageBreak()] })); break;
      case "kyTen":
        c.push(new Paragraph({ spacing: { before: 360, after: 0 }, children: [] }));
        c.push(kyTen(k));
        break;
    }
  }

  const header = new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `${nd.tieuDe}${nd.tenDuAn ? ` — ${nd.tenDuAn}` : ""}`, size: 18, italics: true, color: "6F7C84" })],
    })],
  });
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ["Trang ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 20 })],
    })],
  });

  return new Document({
    creator: "Indust — công cụ sơ đồ nguyên lý tủ điện",
    title: `${nd.tieuDe}${nd.tenDuAn ? ` — ${nd.tenDuAn}` : ""}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: 26 }, paragraph: { spacing: { line: 288 } } },
        heading1: { run: { font: FONT, size: 27, bold: true, color: XANH_THAN }, paragraph: { spacing: { before: 300, after: 120 }, keepNext: true, keepLines: true } },
        heading2: { run: { font: FONT, size: 26, bold: true, italics: true, color: XANH_THAN }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, keepLines: true } },
      },
    },
    numbering: {
      config: [{
        reference: "gach",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } } } }],
      }],
    },
    sections: sections.map((s) => ({
      properties: {
        page: {
          size: s.huong === "ngang" ? { ...A4, orientation: PageOrientation.LANDSCAPE } : { ...A4 },
          margin: { ...LE[s.huong], header: 425, footer: 425 },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children: s.children,
    })),
  });
}
