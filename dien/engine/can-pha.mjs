// Cân pha cho các mạch 1 pha (mục 6.5): sắp theo công suất biểu kiến giảm dần, gán vào
// pha đang nhẹ nhất. Mạch đã khóa pha giữ nguyên; tải 3 pha chia đều 3 pha.

export const PHA = ["A", "B", "C"];

/**
 * @param {Array<{soPha:1|3, va:number, pha?:string, vaPha?:{A,B,C}}>} mach — sửa trực tiếp `pha`
 * @returns {{A:number,B:number,C:number}} công suất biểu kiến từng pha (VA, chưa nhân Ks)
 */
export function canPha(mach) {
  const tai = { A: 0, B: 0, C: 0 };
  for (const m of mach) {
    if (m.soPha === 3) {
      for (const p of PHA) tai[p] += m.vaPha ? m.vaPha[p] : m.va / 3;
      m.pha = "ABC";
    } else if (m.pha && PHA.includes(m.pha)) {
      tai[m.pha] += m.va;
      m.khoaPha = true;
    }
  }
  const tuDo = mach.filter((m) => m.soPha !== 3 && !m.khoaPha).sort((a, b) => b.va - a.va);
  for (const m of tuDo) {
    const p = PHA.reduce((best, x) => (tai[x] < tai[best] ? x : best), "A");
    m.pha = p;
    tai[p] += m.va;
  }
  return tai;
}

/** Độ lệch pha (%) = (Smax − Smin) / Smax. */
export function doLechPha(tai) {
  const v = PHA.map((p) => tai[p]);
  const max = Math.max(...v);
  return max > 0 ? ((max - Math.min(...v)) / max) * 100 : 0;
}
