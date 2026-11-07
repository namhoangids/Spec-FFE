"""Tạo file Excel nhập liệu mẫu cho công cụ sơ đồ nguyên lý tủ điện & điện nhẹ.

Chạy:  python3 dien/mau/tao_mau_nhap_lieu.py  [đường_dẫn_xuất.xlsx]
Mặc định ghi ra dien/mau/nhap-lieu-tu-dien.xlsx (cùng thư mục với script).

Các giá trị trong sheet "Quy tac" là MẶC ĐỊNH ĐỀ XUẤT, chờ kỹ sư điện nội bộ duyệt (GĐ0).
"""
import os
import sys

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

FONT = "Arial"
C_HEAD = "33506C"     # nền tiêu đề (màu accent-deep của app FF&E)
C_INPUT = "FFF2CC"    # nền ô cần nhập
C_CALC = "EDEDED"     # nền cột công thức
C_REVIEW = "E2EFDA"   # nền cột dành cho kỹ sư điện góp ý / chốt
BLUE = "0000FF"       # chữ: giá trị nhập (ví dụ)

thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
F_BASE = Font(name=FONT, size=10)
F_INPUT = Font(name=FONT, size=10, color=BLUE)
F_HEAD = Font(name=FONT, size=10, bold=True, color="FFFFFF")
F_TITLE = Font(name=FONT, size=14, bold=True, color=C_HEAD)
F_SUB = Font(name=FONT, size=11, bold=True, color=C_HEAD)
F_NOTE = Font(name=FONT, size=9, italic=True, color="595959")
FILL_HEAD = PatternFill("solid", fgColor=C_HEAD)
FILL_INPUT = PatternFill("solid", fgColor=C_INPUT)
FILL_CALC = PatternFill("solid", fgColor=C_CALC)
FILL_REVIEW = PatternFill("solid", fgColor=C_REVIEW)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)

# ---------------------------------------------------------------------------
# Danh mục (dùng cho danh sách chọn)
# ---------------------------------------------------------------------------
LOAI_CONG_TRINH = ["Nhà ở / biệt thự", "Căn hộ"]
LOAI_MACH = [
    "Chiếu sáng trong nhà",
    "Chiếu sáng ngoài nhà",
    "Ổ cắm thông thường",
    "Khu ướt (WC, bình nóng lạnh)",
    "Bếp từ, lò nướng",
    "Điều hòa",
    "Động cơ (bơm, quạt)",
    "Thiết bị điện nhẹ (rack, NVR, KNX)",
    "Dự phòng",
]
LOAI_KHU_VUC = ["Khô", "Ướt (WC, tắm)", "Ngoài nhà", "Bếp"]
SO_PHA_TU = ["1P+N+PE", "3P+N+PE"]
SO_PHA_MACH = ["1P", "3P"]
PHA = ["L1", "L2", "L3"]
NOI_DAT = ["TN-S", "TN-C-S", "TT"]
LOAI_CAP = ["Cu/PVC", "Cu/XLPE/PVC"]
KIEU_LAP = ["Âm tường", "Nổi tường", "Đặt sàn"]
CO_KHONG = ["Theo quy tắc", "Có", "Không"]
PP_LAP_DAT = [
    ("A1", "Dây đơn trong ống, trong tường cách nhiệt"),
    ("A2", "Cáp nhiều lõi trong ống, trong tường cách nhiệt"),
    ("B1", "Dây đơn / cáp một lõi trong ống, âm hoặc nổi tường"),
    ("B2", "Cáp nhiều lõi trong ống, âm hoặc nổi tường"),
    ("C", "Cáp đi trực tiếp trên tường / trần"),
    ("D", "Cáp chôn đất trong ống"),
    ("E", "Cáp nhiều lõi trên máng/khay đục lỗ, không khí tự do"),
    ("F", "Cáp một lõi trên máng/khay đục lỗ, không khí tự do"),
]
DINH_MUC_CB = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250]


def style_header(ws, row, ncol, height=32):
    for c in range(1, ncol + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = F_HEAD
        cell.fill = FILL_HEAD
        cell.alignment = CENTER
        cell.border = BORDER
    ws.row_dimensions[row].height = height


def set_widths(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def put(ws, row, col, value, font=F_BASE, fill=None, align=None, fmt=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = font
    cell.border = BORDER
    if fill:
        cell.fill = fill
    cell.alignment = align or Alignment(vertical="top", wrap_text=True)
    if fmt:
        cell.number_format = fmt
    return cell


def add_list_validation(ws, rng, source, allow_blank=True):
    dv = DataValidation(type="list", formula1=source, allow_blank=allow_blank)
    dv.error = "Chọn giá trị trong danh sách"
    dv.errorTitle = "Giá trị không hợp lệ"
    ws.add_data_validation(dv)
    dv.add(rng)


def build(path):
    wb = Workbook()

    # -----------------------------------------------------------------------
    # Danh muc
    # -----------------------------------------------------------------------
    dm = wb.active
    dm.title = "Danh muc"
    lists = [
        ("Loại công trình", LOAI_CONG_TRINH),
        ("Loại mạch", LOAI_MACH),
        ("Loại khu vực", LOAI_KHU_VUC),
        ("Số pha tủ", SO_PHA_TU),
        ("Số pha mạch", SO_PHA_MACH),
        ("Pha", PHA),
        ("Sơ đồ nối đất", NOI_DAT),
        ("Loại cáp", LOAI_CAP),
        ("Kiểu lắp", KIEU_LAP),
        ("Có / Không", CO_KHONG),
        ("Phương pháp lắp đặt", [k for k, _ in PP_LAP_DAT]),
        ("Mô tả phương pháp", [v for _, v in PP_LAP_DAT]),
        ("Định mức CB (A)", DINH_MUC_CB),
    ]
    ref = {}
    for col, (name, values) in enumerate(lists, start=1):
        put(dm, 1, col, name)
        for r, v in enumerate(values, start=2):
            put(dm, r, col, v)
        letter = get_column_letter(col)
        ref[name] = f"='Danh muc'!${letter}$2:${letter}${len(values) + 1}"
    style_header(dm, 1, len(lists))
    set_widths(dm, [18, 34, 16, 12, 12, 8, 14, 14, 12, 14, 12, 52, 14])
    dm.freeze_panes = "A2"

    # -----------------------------------------------------------------------
    # Quy tac
    # -----------------------------------------------------------------------
    qt = wb.create_sheet("Quy tac")
    qt["A1"] = "BỘ QUY TẮC MẶC ĐỊNH — CHỜ KỸ SƯ ĐIỆN NỘI BỘ DUYỆT (GĐ0)"
    qt["A1"].font = F_TITLE
    qt["A2"] = ("Giá trị trong cột 'Đề xuất' là mặc định do công cụ đề xuất. Kỹ sư điện ghi ý kiến "
                "và đánh dấu cột 'Chốt'. Công cụ chỉ dùng bộ quy tắc sau khi được chốt.")
    qt["A2"].font = F_NOTE

    # Bảng A — thông số chung
    qt["A4"] = "A. Thông số chung"
    qt["A4"].font = F_SUB
    head_a = ["Mã", "Tham số", "Đề xuất", "Đơn vị", "Căn cứ / ghi chú", "Ý kiến KS điện", "Chốt (✔)"]
    for c, h in enumerate(head_a, start=1):
        qt.cell(row=5, column=c, value=h)
    style_header(qt, 5, len(head_a))
    params = [
        ("UF", "Điện áp pha Uf", 220, "V", "Lưới hạ áp Việt Nam (có thể chọn 230)"),
        ("UD", "Điện áp dây Ud", 380, "V", "Có thể chọn 400"),
        ("RHO", "Điện trở suất đồng ρ (ở nhiệt độ làm việc)", 0.0225, "Ω·mm²/m", "Dùng tính sụt áp"),
        ("LAMBDA", "Điện kháng đơn vị dây λ", 0.08, "mΩ/m", "Dùng tính sụt áp"),
        ("T_MT", "Nhiệt độ môi trường thiết kế", 35, "°C", "Khí hậu Việt Nam"),
        ("K1_PVC", "Hệ số nhiệt độ k1 — cách điện PVC", 0.94, "", "IEC 60364-5-52, bảng B.52.14, 35 °C"),
        ("K1_XLPE", "Hệ số nhiệt độ k1 — cách điện XLPE", 0.96, "", "IEC 60364-5-52, bảng B.52.14, 35 °C"),
        ("DU_MAX", "Sụt áp cộng dồn tối đa (từ nguồn)", 5, "%", "Đề xuất nội bộ"),
        ("DU_CS", "Sụt áp tối đa — mạch chiếu sáng", 3, "%", "Đề xuất nội bộ, có thể bỏ"),
        ("KS_NHA", "Ks — hồ sơ nhà ở / biệt thự", 0.7, "", "Hoặc dùng bảng Ks theo số mạch (mục 6.3)"),
        ("KS_CANHO", "Ks — hồ sơ căn hộ", 0.7, "", "Kỹ sư chốt"),
        ("K_IN", "Hệ số chọn In mạch nhánh (In ≥ k·Ib)", 1.25, "", "Đề xuất nội bộ"),
        ("K_CHONLOC", "Tỷ số chọn lọc sơ bộ (In tổng ≥ k·In mạch ra lớn nhất)", 1.6, "",
         "Sơ bộ; kiểm tra lại theo bảng phối hợp Schneider"),
        ("LECH_PHA", "Độ lệch pha tối đa (Smax − Smin)/Smax", 15, "%", "Vượt thì cảnh báo"),
        ("DP_VO", "Chỗ trống dự phòng trong vỏ tủ", 20, "%", "Tính trên tổng module"),
        ("DP_CB", "Số CB dự phòng tối thiểu mỗi tủ", 2, "cái", "Đề xuất nội bộ"),
        ("CT_NGUONG", "Ngưỡng In tổng dùng đồng hồ đa năng + CT", 63, "A", "Đề xuất nội bộ"),
        ("SPD_KC", "Khoảng cách tới SPD tủ tổng để thêm SPD tủ con", 10, "m", "Tham chiếu IEC 60364-5-53"),
        ("IK_CANHO", "Ik mặc định tủ căn hộ (khi chưa có số liệu tòa nhà)", 6, "kA", "Giá trị gắn cờ, phải xác nhận"),
        ("LAP_DAY", "Hệ số lấp đầy ống tối đa", 40, "%", "Chọn đường kính ống"),
        ("L_CANHBAO", "Chiều dài mạch cần kiểm tra lại", 50, "m", "Cảnh báo"),
        ("IB_IN", "Ngưỡng cảnh báo Ib/In", 90, "%", "Cảnh báo"),
        # Điện nhẹ
        ("ELV_DP_CONG", "Điện nhẹ — dự phòng cổng switch", 20, "%", ""),
        ("ELV_POE_AP", "Điện nhẹ — công suất PoE mỗi AP", 20, "W", "Thường 15–25 W, theo thiết bị chọn"),
        ("ELV_POE_CAM", "Điện nhẹ — công suất PoE mỗi camera", 10, "W", "Thường 5–13 W, theo thiết bị chọn"),
        ("ELV_POE_K", "Điện nhẹ — hệ số dự trữ ngân sách PoE", 1.2, "", ""),
        ("ELV_CAT6", "Điện nhẹ — chiều dài tối đa cáp Cat6 (link cố định)", 90, "m", "TIA-568"),
        ("ELV_BITRATE", "CCTV — bitrate mỗi camera", 4, "Mbps", "4 MP, H.265"),
        ("ELV_NGAY_LUU", "CCTV — số ngày lưu", 30, "ngày", ""),
        ("ELV_AMPLI_K", "Âm thanh — hệ số công suất ampli", 1.25, "", "Ampli ≥ k · Σ công suất tap loa"),
        ("ELV_RACK_K", "Tủ rack — hệ số dự phòng U", 1.3, "", ""),
        ("ELV_UPS_K", "UPS — hệ số dự phòng", 1.25, "", "VA ≥ ΣW / PF · k"),
        ("KNX_MAX", "KNX — số thiết bị tối đa mỗi đoạn line", 64, "thiết bị", "Theo chuẩn KNX"),
    ]
    row = 6
    param_row = {}
    for code, name, val, unit, note in params:
        put(qt, row, 1, code)
        put(qt, row, 2, name)
        put(qt, row, 3, val, font=F_INPUT, fill=FILL_INPUT)
        put(qt, row, 4, unit)
        put(qt, row, 5, note)
        put(qt, row, 6, None, fill=FILL_REVIEW)
        put(qt, row, 7, None, fill=FILL_REVIEW, align=CENTER)
        param_row[code] = row
        row += 1

    # Bảng B — theo loại mạch
    row += 1
    qt.cell(row=row, column=1, value="B. Quy tắc theo loại mạch").font = F_SUB
    row += 1
    head_b = ["Loại mạch", "cosφ", "Hệ số chọn In", "In tối thiểu (A)", "Đường cong",
              "RCD", "Tiết diện tối thiểu Cu (mm²)", "Dòng sản phẩm Schneider (KS chốt)",
              "Ý kiến KS điện", "Chốt (✔)"]
    for c, h in enumerate(head_b, start=1):
        qt.cell(row=row, column=c, value=h)
    style_header(qt, row, len(head_b))
    rules_head_row = row
    rules = [
        ("Chiếu sáng trong nhà", 0.90, 1.25, 10, "C", "Không (khu ướt: 30 mA)", 1.5),
        ("Chiếu sáng ngoài nhà", 0.90, 1.25, 10, "C", "30 mA", 1.5),
        ("Ổ cắm thông thường", 0.85, 1.25, 16, "C", "30 mA", 2.5),
        ("Khu ướt (WC, bình nóng lạnh)", 1.00, 1.25, 16, "C", "30 mA", 2.5),
        ("Bếp từ, lò nướng", 0.95, 1.25, 16, "C", "30 mA", 2.5),
        ("Điều hòa", 0.90, 1.25, 16, "C", "Tùy chọn", 2.5),
        ("Động cơ (bơm, quạt)", 0.80, 1.25, 10, "C hoặc D", "Không", 2.5),
        ("Thiết bị điện nhẹ (rack, NVR, KNX)", 0.90, 1.25, 10, "C", "Tùy chọn", 1.5),
        ("Dự phòng", None, None, None, "C", "—", None),
    ]
    assert [r[0] for r in rules] == LOAI_MACH
    row += 1
    rules_first = row
    for rule in rules:
        for c, v in enumerate(rule, start=1):
            if c == 1:
                put(qt, row, c, v)
            else:
                put(qt, row, c, v, font=F_INPUT, fill=FILL_INPUT,
                    fmt="0.00" if c in (2, 3) else None)
        put(qt, row, 8, None, fill=FILL_INPUT)
        put(qt, row, 9, None, fill=FILL_REVIEW)
        put(qt, row, 10, None, fill=FILL_REVIEW, align=CENTER)
        row += 1
    rules_last = row - 1
    row += 1
    qt.cell(row=row, column=1, value=(
        "Căn cứ RCD 30 mA: IEC 60364-4-41 (ổ cắm, thiết bị ngoài nhà) và IEC 60364-7-701 "
        "(mọi mạch trong khu vực có bồn tắm/vòi sen). Công cụ áp theo cả loại mạch lẫn 'Loại khu vực' "
        "trong sheet Mach.")).font = F_NOTE
    set_widths(qt, [30, 46, 14, 12, 40, 28, 30, 30, 28, 10])
    qt.freeze_panes = "A6"

    # Tham chiếu dùng trong công thức
    rng_loai = f"'Quy tac'!$A${rules_first}:$A${rules_last}"
    rng_cos = f"'Quy tac'!$B${rules_first}:$B${rules_last}"

    # -----------------------------------------------------------------------
    # Du an
    # -----------------------------------------------------------------------
    da = wb.create_sheet("Du an", 0)
    da["A1"] = "THÔNG TIN DỰ ÁN & NGUỒN"
    da["A1"].font = F_TITLE
    for c, h in enumerate(["Mã", "Thông tin", "Giá trị", "Ghi chú"], start=1):
        da.cell(row=3, column=c, value=h)
    style_header(da, 3, 4)
    project = [
        ("MA_DA", "Mã dự án", "VD-2026-01", ""),
        ("TEN_DA", "Tên dự án", "Biệt thự mẫu", ""),
        ("DIA_CHI", "Địa chỉ", "Hà Nội", ""),
        ("LOAI_CT", "Loại công trình", "Nhà ở / biệt thự", "Chọn trong danh sách — quyết định hồ sơ quy tắc"),
        ("CHU_TRI", "Chủ trì thiết kế điện", "", "Kỹ sư điện nội bộ"),
        ("KIEM_TRA", "Người kiểm tra", "", ""),
        ("REV", "Revision", "A", ""),
        ("UF", "Điện áp pha Uf (V)", 220, "Để trống thì lấy theo sheet Quy tac"),
        ("UD", "Điện áp dây Ud (V)", 380, "Để trống thì lấy theo sheet Quy tac"),
        ("NOI_DAT", "Sơ đồ nối đất", "TN-S", ""),
        ("IK_NGUON", "Ik tại điểm đấu nối (kA)", 10, "Lấy từ điện lực / tòa nhà; giá trị ví dụ"),
        ("T_MT", "Nhiệt độ môi trường (°C)", 35, ""),
        ("DU_MAX", "Sụt áp cộng dồn tối đa (%)", 5, ""),
        ("BANG_GIA", "Bảng giá Schneider áp dụng", "", "Tên/ngày bảng giá, dùng cho BOQ"),
        ("CHIET_KHAU", "Chiết khấu (%)", "", "Dùng cho BOQ"),
    ]
    da_row = {}
    for i, (code, name, val, note) in enumerate(project, start=4):
        put(da, i, 1, code)
        put(da, i, 2, name)
        put(da, i, 3, val if val != "" else None, font=F_INPUT, fill=FILL_INPUT)
        put(da, i, 4, note, font=F_NOTE)
        da_row[code] = i
    add_list_validation(da, f"C{da_row['LOAI_CT']}", ref["Loại công trình"])
    add_list_validation(da, f"C{da_row['NOI_DAT']}", ref["Sơ đồ nối đất"])
    set_widths(da, [14, 34, 26, 52])
    uf = f"'Du an'!$C${da_row['UF']}"
    ud = f"'Du an'!$C${da_row['UD']}"

    # -----------------------------------------------------------------------
    # Tu dien
    # -----------------------------------------------------------------------
    td = wb.create_sheet("Tu dien", 1)
    head_td = ["Mã tủ", "Tên / vị trí", "Cấp từ tủ", "Mạch cấp ở tủ trên", "Số pha",
               "Chiều dài cáp cấp (m)", "Phương pháp lắp đặt", "Loại cáp cấp", "Kiểu lắp", "IP",
               "Ik tại tủ (kA)", "Ks (trống = theo quy tắc)", "SPD", "Ghi chú"]
    for c, h in enumerate(head_td, start=1):
        td.cell(row=1, column=c, value=h)
    style_header(td, 1, len(head_td), height=42)
    panels = [
        ["MDB", "Tủ điện tổng – phòng kỹ thuật tầng 1", "Công tơ EVN", "", "3P+N+PE", 15, "D",
         "Cu/XLPE/PVC", "Nổi tường", "IP54", 10, "", "Có", "Mạch cấp tủ con do công cụ tự tạo"],
        ["DB-T1", "Tủ điện tầng 1 – gầm cầu thang", "MDB", "F03", "3P+N+PE", 30, "B1",
         "Cu/XLPE/PVC", "Âm tường", "IP40", 6, 0.7, "Theo quy tắc", "Ví dụ trong tài liệu phương án, mục 7"],
    ]
    for r, p in enumerate(panels, start=2):
        for c, v in enumerate(p, start=1):
            put(td, r, c, v if v != "" else None, font=F_INPUT, fill=FILL_INPUT)
    last = 200
    add_list_validation(td, f"E2:E{last}", ref["Số pha tủ"])
    add_list_validation(td, f"G2:G{last}", ref["Phương pháp lắp đặt"])
    add_list_validation(td, f"H2:H{last}", ref["Loại cáp"])
    add_list_validation(td, f"I2:I{last}", ref["Kiểu lắp"])
    add_list_validation(td, f"M2:M{last}", ref["Có / Không"])
    set_widths(td, [10, 34, 12, 12, 11, 12, 12, 14, 12, 7, 10, 12, 13, 36])
    td.freeze_panes = "B2"
    td.auto_filter.ref = f"A1:{get_column_letter(len(head_td))}1"

    # -----------------------------------------------------------------------
    # Mach
    # -----------------------------------------------------------------------
    mc = wb.create_sheet("Mach", 2)
    head_mc = ["Mã tủ", "Mã mạch", "Loại mạch", "Mô tả phụ tải", "Phòng / khu vực", "Loại khu vực",
               "Số lượng", "Công suất / đv (W)", "P (W)", "cosφ (trống = mặc định)", "cosφ áp dụng",
               "Số pha", "Pha (trống = tự cân)", "Chiều dài (m)", "Số mạch chung ống",
               "Ghi đè thiết bị", "Ghi đè cáp", "Lý do ghi đè", "Ib tham khảo (A)", "Ghi chú"]
    for c, h in enumerate(head_mc, start=1):
        mc.cell(row=1, column=c, value=h)
    style_header(mc, 1, len(head_mc), height=42)
    circuits = [
        # tủ, mạch, loại, mô tả, phòng, khu vực, SL, W/đv, cosφ, số pha, pha, L, chung ống, ghi đè TB, ghi đè cáp, lý do
        ["DB-T1", "C01", "Chiếu sáng trong nhà", "Chiếu sáng P.khách, sảnh", "P.khách, sảnh", "Khô", 1, 450, None, "1P", None, 25, 1],
        ["DB-T1", "C02", "Chiếu sáng trong nhà", "Chiếu sáng bếp, P.ăn, hành lang", "Bếp, P.ăn, hành lang", "Bếp", 1, 350, None, "1P", None, 30, 1],
        ["DB-T1", "C03", "Chiếu sáng ngoài nhà", "Chiếu sáng sân vườn, ngoài nhà", "Sân vườn", "Ngoài nhà", 1, 600, None, "1P", None, 40, 1],
        ["DB-T1", "C04", "Ổ cắm thông thường", "Ổ cắm P.khách, sảnh", "P.khách, sảnh", "Khô", 8, 225, None, "1P", None, 25, 1],
        ["DB-T1", "C05", "Ổ cắm thông thường", "Ổ cắm bếp (tủ lạnh, lò vi sóng, máy rửa bát)", "Bếp", "Bếp", 1, 3000, 0.9, "1P", None, 15, 1],
        ["DB-T1", "C06", "Bếp từ, lò nướng", "Bếp từ", "Bếp", "Bếp", 1, 4000, None, "1P", None, 12, 1],
        ["DB-T1", "C07", "Khu ướt (WC, bình nóng lạnh)", "Bình nóng lạnh WC1", "WC1", "Ướt (WC, tắm)", 1, 2500, None, "1P", None, 20, 1],
        ["DB-T1", "C08", "Ổ cắm thông thường", "Ổ cắm WC1 (washlet, máy sấy tóc)", "WC1", "Ướt (WC, tắm)", 1, 1400, 0.95, "1P", None, 20, 1],
        ["DB-T1", "C09", "Điều hòa", "Điều hòa P.khách 24.000 BTU", "P.khách", "Khô", 1, 2400, None, "1P", None, 18, 1],
        ["DB-T1", "C10", "Điều hòa", "Điều hòa P.ăn 18.000 BTU", "P.ăn", "Khô", 1, 1700, None, "1P", None, 15, 1],
        ["DB-T1", "C11", "Động cơ (bơm, quạt)", "Bơm tăng áp 3 pha 1,5 kW", "Phòng kỹ thuật", "Khô", 1, 1500, None, "3P", None, 20, 1],
        ["DB-T1", "DP1", "Dự phòng", "Dự phòng", None, None, None, None, None, "1P", None, None, None, "MCB 1P 16A C", None, "CB dự phòng lắp sẵn"],
        ["DB-T1", "DP2", "Dự phòng", "Dự phòng", None, None, None, None, None, "1P", None, None, None, "MCB 1P 20A C", None, "CB dự phòng lắp sẵn"],
    ]
    input_cols = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 17, 18, 20]
    first_data, n_rows = 2, 200
    for i in range(n_rows):
        r = first_data + i
        data = circuits[i] if i < len(circuits) else None
        vals = {}
        if data:
            keys = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 16, 17, 18]
            for k, v in zip(keys, data):
                vals[k] = v
        for c in input_cols:
            v = vals.get(c)
            put(mc, r, c, v, font=F_INPUT, fill=FILL_INPUT,
                fmt="0.00" if c == 10 else None)
        # P (W) = Số lượng × Công suất / đv
        put(mc, r, 9, f'=IF(OR(G{r}="",H{r}=""),"",G{r}*H{r})', fill=FILL_CALC, fmt="#,##0")
        # cosφ áp dụng = nhập tay, nếu trống lấy mặc định theo loại mạch
        put(mc, r, 11,
            f'=IF(J{r}<>"",J{r},IF(C{r}="","",IF(N(IFERROR(INDEX({rng_cos},MATCH(C{r},{rng_loai},0)),0))=0,"",'
            f'INDEX({rng_cos},MATCH(C{r},{rng_loai},0)))))',
            fill=FILL_CALC, fmt="0.00")
        # Ib tham khảo
        put(mc, r, 19,
            f'=IF(OR(I{r}="",K{r}="",K{r}=0),"",IF(L{r}="3P",I{r}/(SQRT(3)*{ud}*K{r}),I{r}/({uf}*K{r})))',
            fill=FILL_CALC, fmt="0.0")
    last = first_data + n_rows - 1
    add_list_validation(mc, f"C2:C{last}", ref["Loại mạch"])
    add_list_validation(mc, f"F2:F{last}", ref["Loại khu vực"])
    add_list_validation(mc, f"L2:L{last}", ref["Số pha mạch"])
    add_list_validation(mc, f"M2:M{last}", ref["Pha"])
    mc.cell(row=1, column=19).comment = Comment(
        "Chỉ để tham khảo khi nhập liệu. Công cụ tự tính lại Ib, chọn CB, cáp, RCD theo bộ quy tắc đã chốt.",
        "Công cụ")
    mc.cell(row=1, column=15).comment = Comment(
        "Số mạch đi chung một ống/máng — dùng để tính hệ số nhóm k2. Mặc định 1 (mỗi mạch một ống).",
        "Công cụ")
    set_widths(mc, [8, 8, 30, 40, 20, 14, 8, 11, 9, 11, 9, 7, 9, 9, 9, 18, 16, 22, 10, 24])
    mc.freeze_panes = "E2"
    mc.auto_filter.ref = f"A1:{get_column_letter(len(head_mc))}1"

    # -----------------------------------------------------------------------
    # Dien nhe
    # -----------------------------------------------------------------------
    dn = wb.create_sheet("Dien nhe", 3)
    head_dn = ["Tầng", "Phòng / khu vực", "Ổ data", "Ổ TV", "AP Wi-Fi", "Camera trong nhà",
               "Camera ngoài trời", "Cửa kiểm soát (ACS)", "Nút gọi chuông cửa (ngoài)",
               "Màn hình chuông cửa (trong)", "Loa (số lượng)", "Công suất tap mỗi loa (W)",
               "Vùng âm thanh", "Thiết bị KNX (số lượng)", "Tủ rack phục vụ", "Ghi chú"]
    for c, h in enumerate(head_dn, start=1):
        dn.cell(row=1, column=c, value=h)
    style_header(dn, 1, len(head_dn), height=48)
    elv = [
        ["T1", "Sảnh", 0, 0, 1, 1, 0, 1, 1, 0, 2, 6, "Vùng 1", 4, "R1", ""],
        ["T1", "P.khách", 2, 1, 1, 0, 0, 0, 0, 1, 4, 6, "Vùng 1", 8, "R1", ""],
        ["T1", "Bếp, P.ăn", 1, 1, 0, 0, 0, 0, 0, 0, 2, 6, "Vùng 2", 6, "R1", ""],
        ["T1", "Sân vườn, cổng", 0, 0, 1, 0, 4, 0, 0, 0, 4, 10, "Vùng 3", 2, "R1", "AP và loa loại ngoài trời"],
        ["T2", "P.ngủ master", 2, 1, 1, 0, 0, 0, 0, 1, 2, 6, "Vùng 4", 6, "R1", ""],
        ["T2", "Hành lang, sảnh thang", 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, None, 2, "R1", ""],
    ]
    n_elv = 60
    for i in range(n_elv):
        r = 2 + i
        data = elv[i] if i < len(elv) else None
        for c in range(1, len(head_dn) + 1):
            v = data[c - 1] if data else None
            put(dn, r, c, v if v != "" else None, font=F_INPUT, fill=FILL_INPUT,
                align=CENTER if 3 <= c <= 12 or c == 14 else None)
    tot = 2 + n_elv
    put(dn, tot, 1, "Tổng", font=Font(name=FONT, size=10, bold=True), fill=FILL_CALC)
    put(dn, tot, 2, None, fill=FILL_CALC)
    for c in list(range(3, 12)) + [14]:
        L = get_column_letter(c)
        put(dn, tot, c, f"=SUM({L}2:{L}{tot - 1})", font=Font(name=FONT, size=10, bold=True),
            fill=FILL_CALC, align=CENTER)
    put(dn, tot, 12, None, fill=FILL_CALC)
    put(dn, tot + 1, 1, "Tổng công suất loa (W)", font=Font(name=FONT, size=10, bold=True), fill=FILL_CALC)
    put(dn, tot + 1, 2, None, fill=FILL_CALC)
    put(dn, tot + 1, 3, f"=SUMPRODUCT(K2:K{tot - 1},L2:L{tot - 1})",
        font=Font(name=FONT, size=10, bold=True), fill=FILL_CALC, align=CENTER)
    dn.merge_cells(start_row=tot, start_column=1, end_row=tot, end_column=2)
    dn.merge_cells(start_row=tot + 1, start_column=1, end_row=tot + 1, end_column=2)
    set_widths(dn, [6, 24, 8, 7, 8, 10, 10, 11, 12, 12, 9, 11, 11, 11, 10, 28])
    dn.freeze_panes = "C2"

    # -----------------------------------------------------------------------
    # Huong dan
    # -----------------------------------------------------------------------
    hd = wb.create_sheet("Huong dan", 0)
    hd["A1"] = "FILE NHẬP LIỆU — SƠ ĐỒ NGUYÊN LÝ TỦ ĐIỆN & ĐIỆN NHẸ"
    hd["A1"].font = F_TITLE
    hd["A2"] = "Bản nháp GĐ0 · dùng cho công cụ web (phương án B) · hồ sơ quy tắc: nhà ở/biệt thự, căn hộ · thiết bị Schneider"
    hd["A2"].font = F_NOTE
    lines = [
        ("Quy ước màu", None),
        ("Ô nền vàng, chữ xanh", "Ô cần nhập. Giá trị đang có là ví dụ (tủ DB-T1 trong tài liệu phương án) — sửa hoặc xóa khi dùng cho dự án thật."),
        ("Ô nền xám", "Công thức, không nhập. Chỉ để tham khảo khi nhập liệu."),
        ("Ô nền xanh lá", "Dành cho kỹ sư điện góp ý và chốt (sheet Quy tac)."),
        ("Các sheet", None),
        ("Du an", "Thông tin dự án và nguồn điện. Loại công trình quyết định hồ sơ quy tắc được dùng."),
        ("Tu dien", "Mỗi dòng là một tủ. Cột 'Cấp từ tủ' và 'Mạch cấp ở tủ trên' dựng cây tủ; công cụ tự tạo mạch cấp tủ con ở tủ trên."),
        ("Mach", "Mỗi dòng là một mạch nhánh. Bắt buộc: Mã tủ, Loại mạch, Mô tả, Công suất, Chiều dài. Để trống cột Pha thì công cụ tự cân pha."),
        ("Dien nhe", "Số lượng thiết bị điện nhẹ theo tầng/phòng. Công cụ tự tính switch, PoE, NVR, ampli, rack, KNX."),
        ("Quy tac", "Bộ quy tắc mặc định đề xuất. Kỹ sư điện nội bộ ghi ý kiến và chốt trước khi công cụ được dùng."),
        ("Danh muc", "Các danh sách chọn. Không đổi tên cột hay thứ tự sheet."),
        ("Lưu ý", None),
        ("1", "Không đổi tên sheet và tiêu đề cột — công cụ đọc file theo đúng tên này."),
        ("2", "Loại khu vực 'Ướt (WC, tắm)' hoặc 'Ngoài nhà' sẽ bắt buộc RCD 30 mA cho mọi mạch thuộc khu vực đó."),
        ("3", "Cột 'Ghi đè thiết bị' / 'Ghi đè cáp' chỉ dùng khi cần khác kết quả công cụ; luôn ghi lý do."),
        ("4", "Ib trong sheet Mach chỉ là số tham khảo. Công cụ tự tính lại toàn bộ theo bộ quy tắc đã chốt."),
    ]
    r = 4
    for k, v in lines:
        if v is None:
            hd.cell(row=r, column=1, value=k).font = F_SUB
            r += 1
            continue
        a = put(hd, r, 1, k)
        b = put(hd, r, 2, v)
        if k == "Ô nền vàng, chữ xanh":
            a.fill, a.font = FILL_INPUT, F_INPUT
        elif k == "Ô nền xám":
            a.fill = FILL_CALC
        elif k == "Ô nền xanh lá":
            a.fill = FILL_REVIEW
        r += 1
    set_widths(hd, [24, 110])

    for ws in wb.worksheets:
        ws.sheet_view.zoomScale = 100
        ws.page_setup.orientation = "landscape"
        ws.page_setup.paperSize = ws.PAPERSIZE_A4
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
    wb.active = 0
    wb.save(path)
    return path


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "nhap-lieu-tu-dien.xlsx")
    print(build(out))
