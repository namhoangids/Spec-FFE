// Ước lượng độ rộng chữ Arial như AutoCAD hiển thị (chiều cao chữ = chiều cao chữ hoa).
// Bảng độ rộng ký tự ASCII theo số đo chuẩn của Arial (đơn vị 1/1000 em). Chữ tiếng Việt
// có dấu lấy theo chữ gốc (Ế → E, Đ → D). Sai số so với đo thực tế trên trình duyệt < 2%.

const REG = " 278!278\"355#556$556%889&667'191(333)333*389+584,278-333.278/278:278;278<584=584>584?556@1015[278\\278]278^469_556`333{334|260}334~584";
const BOLD = " 278!333\"474#556$556%889&722'238(333)333*389+584,278-333.278/278:333;333<584=584>584?611@975[333\\278]333^584_556`333{389|280}389~584";
const UP_R = [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611];
const LO_R = [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500];
const UP_B = [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611];
const LO_B = [556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500];
const SPECIAL = { "Ø": 778, "ø": 611, "×": 584, "·": 278, "—": 1000, "–": 556, "Ω": 768, "²": 333, "φ": 600, "Δ": 668, "≥": 549, "≤": 549, "°": 400, "√": 549, "“": 333, "”": 333, "Đ": 722, "đ": 556 };

const parse = (s) => {
  const m = new Map();
  for (let i = 0; i < s.length;) {
    const ch = s[i]; let j = i + 1; while (j < s.length && /[0-9]/.test(s[j])) j++;
    m.set(ch, +s.slice(i + 1, j)); i = j;
  }
  return m;
};
const PUNCT_R = parse(REG), PUNCT_B = parse(BOLD);

/** Độ rộng (mm) của chuỗi s ở chiều cao chữ h (mm) — Arial, hệ số rộng wf. */
export function doRongChu(s, h, { bold = false, wf = 1 } = {}) {
  let em = 0;
  for (const ch of String(s).normalize("NFC")) {
    if (SPECIAL[ch]) { em += SPECIAL[ch]; continue; }
    const base = ch.normalize("NFD")[0];
    const code = base.charCodeAt(0);
    if (code >= 65 && code <= 90) em += (bold ? UP_B : UP_R)[code - 65];
    else if (code >= 97 && code <= 122) em += (bold ? LO_B : LO_R)[code - 97];
    else if (code >= 48 && code <= 57) em += 556;
    else em += (bold ? PUNCT_B : PUNCT_R).get(base) ?? 556;
  }
  return (em / 1000) * (h / 0.716) * wf;
}
