"""Tạo file Excel nhập liệu (v2) cho công cụ sơ đồ nguyên lý tủ điện & điện nhẹ.

Chạy:  python3 dien/mau/tao_mau_nhap_lieu.py
       python3 dien/mau/tao_mau_nhap_lieu.py --tu-json du-an.json [ra.xlsx]   (dữ liệu dự án JSON → Excel)
Ghi ra (cùng thư mục với script):
  - nhap-lieu-tu-dien.xlsx : file mẫu để nhập, ví dụ là tủ DB-T1 trong tài liệu phương án (mục 7)
  - vi-du-HDMON.xlsx       : ví dụ dựng theo cấu trúc bộ bản vẽ mẫu E.601–E.606 (dự án HDMON);
                             công suất và chiều dài là SỐ GIẢ ĐỊNH

Công cụ đọc file theo TÊN SHEET và TIÊU ĐỀ CỘT (dien/engine/doc-excel.mjs), không theo vị trí cột.
Các giá trị trong sheet "Quy tac" là MẶC ĐỊNH ĐỀ XUẤT, chờ kỹ sư điện nội bộ duyệt (GĐ0).
"""
import os

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
F_BOLD = Font(name=FONT, size=10, bold=True)
FILL_HEAD = PatternFill("solid", fgColor=C_HEAD)
FILL_INPUT = PatternFill("solid", fgColor=C_INPUT)
FILL_CALC = PatternFill("solid", fgColor=C_CALC)
FILL_REVIEW = PatternFill("solid", fgColor=C_REVIEW)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)

# ---------------------------------------------------------------------------
# Danh mục (dùng cho danh sách chọn) — phải khớp dien/engine/quy-tac.mjs
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
PHA = ["A", "B", "C"]
NOI_DAT = ["TN-S", "TN-C-S", "TT"]
KIEU_DI = ["Ống", "Máng cáp"]
CO_KHONG = ["Theo quy tắc", "Có", "Không"]
PP_LAP_DAT = [
    ("A1", "Dây đơn trong ống, trong tường cách nhiệt"),
    ("A2", "Cáp nhiều lõi trong ống, trong tường cách nhiệt"),
    ("B1", "Dây đơn / cáp một lõi trong ống, âm hoặc nổi tường"),
    ("B2", "Cáp nhiều lõi trong ống, âm hoặc nổi tường"),
    ("C", "Cáp đi trực tiếp trên tường / trần"),
    ("E", "Cáp nhiều lõi trên máng/khay đục lỗ, không khí tự do"),
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


# ---------------------------------------------------------------------------
# Cấu trúc cột (tên cột là "khóa" để công cụ đọc — không đổi tên)
# ---------------------------------------------------------------------------
# (tiêu đề, độ rộng, ghi chú ô tiêu đề)
COT_TU = [
    ("Mã tủ", 8, "Mã duy nhất của tủ, ví dụ T1, T2, MDB."),
    ("Tên trên bản vẽ", 11, "Tên hiện trên bản vẽ: tiêu đề 'SƠ ĐỒ NGUYÊN LÝ ĐIỆN …' và nhãn 'CẤP ĐIỆN …' ở tủ trên. Trống = lấy Mã tủ."),
    ("Vị trí", 26, None),
    ("Cấp từ tủ", 9, "Mã tủ cấp nguồn cho tủ này. Trống = tủ gốc (cấp từ công tơ / nguồn)."),
    ("Mã lộ cấp", 9, "Mã lộ ra ở tủ trên cấp cho tủ này, ví dụ S5. Trống = công cụ đặt C-<mã tủ>."),
    ("Đặt sau lộ", 9, "Vị trí lộ cấp trên sơ đồ tủ trên: đặt ngay sau lộ có mã này. Trống = cuối tủ."),
    ("Số pha", 10, None),
    ("Chiều dài cáp cấp (m)", 10, "Tủ gốc: chiều dài cáp từ nguồn tới tủ (trống = sụt áp tính từ thanh cái tủ gốc)."),
    ("Kiểu đi cáp cấp", 10, None),
    ("Phương pháp lắp đặt", 10, "Phương pháp lắp đặt cáp cấp theo IEC 60364-5-52 (trống = B1)."),
    ("Ik tại tủ (kA)", 8, "Dòng ngắn mạch tại tủ. Trống = lấy theo tủ trên / Ik nguồn (sheet Du an)."),
    ("Kđt (trống = theo quy tắc)", 10, "Hệ số đồng thời của tủ. Trống = hồ sơ quy tắc (mạch cuối) và bảng hệ số theo số tủ con."),
    ("SPD", 12, None),
    ("Ghi chú", 30, None),
]
COT_MACH = [
    ("Mã tủ", 7, None),
    ("Mã lộ", 8, "Mã lộ trên bản vẽ: L1, S1, AC1, WH1, R1…"),
    ("Loại mạch", 28, "Quyết định cosφ, In tối thiểu, RCD, tiết diện tối thiểu (sheet Quy tac)."),
    ("Phụ tải (chữ trên bản vẽ)", 34, "Chữ hiện ở hàng PHỤ TẢI, ví dụ CẤP ĐIỆN Ổ CẮM, CAMERA, WIFI."),
    ("Loại khu vực", 13, "'Ướt (WC, tắm)' hoặc 'Ngoài nhà' → bắt buộc RCD 30 mA cho mọi mạch."),
    ("Số lượng", 7, "Trống = 1."),
    ("Công suất / đv (W)", 9, None),
    ("P (W)", 8, None),
    ("cosφ (trống = mặc định)", 9, None),
    ("cosφ áp dụng", 8, None),
    ("Số pha", 6, None),
    ("Pha (trống = tự cân)", 8, "Nhập A/B/C để khóa pha. Trống = công cụ tự cân pha."),
    ("Chiều dài (m)", 8, "Trống = dùng chiều dài mặc định và gắn cảnh báo."),
    ("Số mạch chung ống", 8, "Số mạch đi chung một ống/máng — dùng tính hệ số nhóm k2. Trống = 1."),
    ("Nhóm RCD (ghi đè)", 8, "GHI ĐÈ: các mạch cùng mã nhóm dùng chung 1 RCBO (như bản vẽ mẫu). Công cụ sẽ cảnh báo vì quy tắc yêu cầu RCBO riêng từng mạch."),
    ("Ghi đè thiết bị", 16, "Ví dụ: MCB 1P 20A · RCBO 1P+N 25A 30mA · MCB 3P 32A C 6kA. Trống = công cụ tự chọn."),
    ("Ghi đè cáp", 16, "Ví dụ: Cu/PVC 2(1x4)mm2. Công cụ vẫn kiểm Iz′ và sụt áp."),
    ("Ghi đè ống", 10, "Ví dụ: ỐNG PVC  Ø 25"),
    ("Lý do ghi đè", 22, "Bắt buộc khi có ghi đè — hiện trong danh sách ghi chú."),
    ("Điều khiển KNX", 10, "Bật/tắt · Dimmer · Rèm: mạch điều khiển bằng actuator KNX đặt trong tủ (1 kênh / mạch; rèm: số kênh = số lượng). "
                           "Công cụ chọn actuator, cộng module vào vỏ tủ. Trống = không KNX."),
    ("Ib tham khảo (A)", 8, "Chỉ để tham khảo. Công cụ tự tính lại Ib, chọn CB, cáp, RCD theo bộ quy tắc."),
    ("Ghi chú", 22, None),
]
COL = {}  # tên cột sheet Mach → chữ cột
for i, (h, _, _) in enumerate(COT_MACH, start=1):
    COL[h] = get_column_letter(i)

# Mã → (thông tin, ghi chú)
DU_AN = [
    ("MA_DA", "Số dự án (Project no)", ""),
    ("TEN_DA", "Tên dự án (Project)", "Hiện trong khung tên"),
    ("CHU_DAU_TU", "Chủ đầu tư (Client)", ""),
    ("DIA_CHI", "Địa chỉ công trình (Address)", ""),
    ("CONG_TY", "Thông tin công ty (Company info)", ""),
    ("LOAI_CT", "Loại công trình", "Chọn trong danh sách — quyết định hồ sơ quy tắc"),
    ("GIAM_DOC", "Giám đốc (Director)", ""),
    ("THIET_KE", "Thiết kế (Design)", "Kỹ sư điện chủ trì"),
    ("KIEM_TRA", "Kiểm tra (Check by)", ""),
    ("NGUOI_VE", "Người vẽ (Made by)", ""),
    ("NGAY", "Ngày (Date)", "Ghi đúng như muốn hiện trên khung tên"),
    ("TY_LE", "Tỷ lệ (Scale)", ""),
    ("SO_BV_TONG", "Số bản vẽ sơ đồ cấp điện tổng", "Trống = liền trước tờ tủ đầu (E.601 → E.600)"),
    ("SO_BV_DAU", "Số bản vẽ tờ tủ đầu tiên", "Các tờ sau tăng dần theo thứ tự tủ: E.601, E.602…; tủ nhiều mạch tự ngắt thêm tờ"),
    ("SO_BV_DN", "Số bản vẽ điện nhẹ (tờ đầu)", "Trống = E.700: E.700 sơ đồ trục, E.701 nguyên lý mạng & camera, E.702… tủ rack"),
    ("REV", "Revision", ""),
    ("UF", "Điện áp pha Uf (V)", "Trống = theo sheet Quy tac"),
    ("UD", "Điện áp dây Ud (V)", "Trống = theo sheet Quy tac"),
    ("NOI_DAT", "Sơ đồ nối đất", "Trống = TN-S. TN: kiểm Ik1 min cuối mạch ≥ ngưỡng cắt từ; TT: mạch phải có RCD"),
    ("IK_NGUON", "Ik tại điểm đấu nối (kA)", "Lấy từ điện lực / tòa nhà. Ik từng tủ tự tính theo tổng trở cáp"),
    ("MBA_KVA", "Máy biến áp riêng (kVA)", "Chỉ khi công trình có trạm riêng: Ik tính từ MBA thay cho Ik điểm đấu"),
    ("MBA_UK", "Uk máy biến áp (%)", "Trống = 4% (≤ 630 kVA) / 6% (lớn hơn)"),
    ("DU_MAX", "Sụt áp cộng dồn tối đa (%)", "Trống = theo sheet Quy tac"),
    ("BANG_GIA", "Bảng giá Schneider áp dụng", "Tên/ngày bảng giá, dùng cho BOQ (GĐ2)"),
    ("CHIET_KHAU", "Chiết khấu (%)", "Dùng cho BOQ (GĐ2)"),
]

QUY_TAC_A = [
    ("UF", "Điện áp pha Uf", 220, "V", "Lưới hạ áp Việt Nam (có thể chọn 230)"),
    ("UD", "Điện áp dây Ud", 380, "V", "Có thể chọn 400"),
    ("RHO", "Điện trở suất đồng ρ (ở nhiệt độ làm việc)", 0.0225, "Ω·mm²/m", "Dùng tính sụt áp"),
    ("LAMBDA", "Điện kháng đơn vị dây λ", 0.08, "mΩ/m", "Dùng tính sụt áp"),
    ("K1_PVC", "Hệ số nhiệt độ k1 — cách điện PVC", 0.94, "", "IEC 60364-5-52, bảng B.52.14, 35 °C"),
    ("K1_XLPE", "Hệ số nhiệt độ k1 — cách điện XLPE", 0.96, "", "IEC 60364-5-52, bảng B.52.14, 35 °C"),
    ("DU_MAX", "Sụt áp cộng dồn tối đa (từ nguồn)", 5, "%", "Đề xuất nội bộ"),
    ("DU_CS", "Sụt áp tối đa — mạch chiếu sáng", 3, "%", "Đề xuất nội bộ"),
    ("DU_TU", "Sụt áp cộng dồn tối đa tới thanh cái mỗi tủ", 2, "%",
     "Dùng chọn cáp cấp tủ, chừa phần cho mạch nhánh"),
    ("KS_NHA", "Kđt mạch cuối — hồ sơ nhà ở / biệt thự", 0.7, "", "Hoặc dùng bảng Ks theo số mạch (mục 6.3)"),
    ("KS_CANHO", "Kđt mạch cuối — hồ sơ căn hộ", 0.7, "", "Kỹ sư chốt"),
    ("K_IN", "Hệ số chọn In (In ≥ k·Ib)", 1.25, "", "Đề xuất nội bộ"),
    ("K_CHONLOC", "Tỷ số chọn lọc sơ bộ (In tổng ≥ k·In mạch ra lớn nhất)", 1.6, "",
     "Sơ bộ; kiểm tra lại theo bảng phối hợp Schneider"),
    ("IN_MCB_MAX", "In lớn nhất dùng MCB (lớn hơn dùng MCCB)", 63, "A", ""),
    ("LECH_PHA", "Độ lệch pha tối đa (Smax − Smin)/Smax", 15, "%", "Vượt thì cảnh báo"),
    ("DP_VO", "Chỗ trống dự phòng trong vỏ tủ", 20, "%", "Tính trên tổng module"),
    ("DP_CB", "Số CB dự phòng tối thiểu mỗi tủ", 2, "cái", "Thiếu thì ghi chú"),
    ("CT_NGUONG", "Ngưỡng In tổng dùng đồng hồ đa năng + CT", 63, "A", "Đề xuất nội bộ"),
    ("IK_MD", "Ik mặc định khi chưa có số liệu", 6, "kA", "Giá trị gắn cờ, phải xác nhận"),
    ("IM_MCCB", "Ngưỡng cắt từ MCCB (Im = k·In)", 10, "×In", "MCCB nhiệt–từ; MCCB chỉnh định thì ghi đè thiết bị \"Im=…A\""),
    ("L_MD", "Chiều dài mạch dùng khi thiếu số liệu", 20, "m", "Gắn cờ cảnh báo"),
    ("LAP_DAY", "Hệ số lấp đầy ống tối đa", 40, "%", "Chọn đường kính ống"),
    ("ONG_MIN", "Đường kính ống nhỏ nhất", 20, "mm", "Bản vẽ mẫu E.601 dùng Ø20 cho mạch nhánh"),
    ("L_CANHBAO", "Chiều dài mạch cần kiểm tra lại", 50, "m", "Cảnh báo"),
    ("IB_IN", "Ngưỡng cảnh báo Ib/In", 90, "%", "Cảnh báo"),
    # Điện nhẹ (GĐ3)
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
QUY_TAC_B = [
    # loại mạch, cosφ, In tối thiểu, đường cong, RCD, tiết diện tối thiểu
    ("Chiếu sáng trong nhà", 0.90, 10, "C", "Không (khu ướt: 30 mA)", 1.5),
    ("Chiếu sáng ngoài nhà", 0.90, 10, "C", "30 mA", 1.5),
    ("Ổ cắm thông thường", 0.85, 16, "C", "30 mA", 2.5),
    ("Khu ướt (WC, bình nóng lạnh)", 1.00, 16, "C", "30 mA", 2.5),
    ("Bếp từ, lò nướng", 0.95, 16, "C", "30 mA", 2.5),
    ("Điều hòa", 0.90, 16, "C", "Tùy chọn", 2.5),
    ("Động cơ (bơm, quạt)", 0.80, 10, "C", "Không", 2.5),
    ("Thiết bị điện nhẹ (rack, NVR, KNX)", 0.90, 10, "C", "Tùy chọn", 1.5),
    ("Dự phòng", 0.90, 16, "C", "Không", 2.5),
]
assert [r[0] for r in QUY_TAC_B] == LOAI_MACH


def build(path, du_lieu):
    wb = Workbook()

    # --- Danh muc --------------------------------------------------------------
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
        ("Kiểu đi cáp", KIEU_DI),
        ("SPD", CO_KHONG),
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
    set_widths(dm, [18, 34, 16, 12, 12, 8, 14, 12, 14, 12, 52, 14])
    dm.freeze_panes = "A2"

    # --- Quy tac ---------------------------------------------------------------
    qt = wb.create_sheet("Quy tac")
    qt["A1"] = "BỘ QUY TẮC MẶC ĐỊNH — CHỜ KỸ SƯ ĐIỆN NỘI BỘ DUYỆT (GĐ0)"
    qt["A1"].font = F_TITLE
    qt["A2"] = ("Công cụ đọc cột 'Đề xuất' của bảng A và các cột của bảng B khi tính. Kỹ sư điện ghi ý kiến "
                "và đánh dấu ✔ ở cột 'Chốt'; khi mọi dòng đã chốt, bảng tính ghi bộ quy tắc là ĐÃ DUYỆT.")
    qt["A2"].font = F_NOTE
    qt["A4"] = "A. Thông số chung"
    qt["A4"].font = F_SUB
    head_a = ["Mã", "Tham số", "Đề xuất", "Đơn vị", "Căn cứ / ghi chú", "Ý kiến KS điện", "Chốt (✔)"]
    for c, h in enumerate(head_a, start=1):
        qt.cell(row=5, column=c, value=h)
    style_header(qt, 5, len(head_a))
    row = 6
    qt_row = {}
    for code, name, val, unit, note in QUY_TAC_A:
        put(qt, row, 1, code)
        put(qt, row, 2, name)
        put(qt, row, 3, val, font=F_INPUT, fill=FILL_INPUT)
        put(qt, row, 4, unit)
        put(qt, row, 5, note)
        put(qt, row, 6, None, fill=FILL_REVIEW)
        put(qt, row, 7, None, fill=FILL_REVIEW, align=CENTER)
        qt_row[code] = row
        row += 1
    row += 1
    qt.cell(row=row, column=1, value="B. Quy tắc theo loại mạch").font = F_SUB
    row += 1
    head_b = ["Loại mạch", "cosφ", "In tối thiểu (A)", "Đường cong", "RCD",
              "Tiết diện tối thiểu Cu (mm²)", "Dòng sản phẩm Schneider (KS chốt)", "Ý kiến KS điện", "Chốt (✔)"]
    for c, h in enumerate(head_b, start=1):
        qt.cell(row=row, column=c, value=h)
    style_header(qt, row, len(head_b))
    row += 1
    rules_first = row
    for rule in QUY_TAC_B:
        for c, v in enumerate(rule, start=1):
            if c == 1:
                put(qt, row, c, v)
            else:
                put(qt, row, c, v, font=F_INPUT, fill=FILL_INPUT, fmt="0.00" if c == 2 else None)
        put(qt, row, 7, None, fill=FILL_INPUT)
        put(qt, row, 8, None, fill=FILL_REVIEW)
        put(qt, row, 9, None, fill=FILL_REVIEW, align=CENTER)
        row += 1
    rules_last = row - 1
    add_list_validation(qt, f"E{rules_first}:E{rules_last}", '"30 mA,Không,Không (khu ướt: 30 mA),Tùy chọn"')
    row += 1
    qt.cell(row=row, column=1, value=(
        "Căn cứ RCD 30 mA: IEC 60364-4-41 (ổ cắm, thiết bị ngoài nhà) và IEC 60364-7-701 "
        "(mọi mạch trong khu vực có bồn tắm/vòi sen). Công cụ áp theo cả loại mạch lẫn 'Loại khu vực' "
        "trong sheet Mach. Bảng Iz, hệ số nhóm k2, cỡ vỏ tủ, số module thiết bị: xem dien/engine/quy-tac.mjs.")).font = F_NOTE
    set_widths(qt, [30, 46, 14, 12, 40, 28, 30, 28, 10])
    qt.freeze_panes = "A6"
    rng_loai = f"'Quy tac'!$A${rules_first}:$A${rules_last}"
    rng_cos = f"'Quy tac'!$B${rules_first}:$B${rules_last}"

    # --- Du an -----------------------------------------------------------------
    da = wb.create_sheet("Du an", 0)
    da["A1"] = "THÔNG TIN DỰ ÁN & NGUỒN"
    da["A1"].font = F_TITLE
    for c, h in enumerate(["Mã", "Thông tin", "Giá trị", "Ghi chú"], start=1):
        da.cell(row=3, column=c, value=h)
    style_header(da, 3, 4)
    da_row = {}
    for i, (code, name, note) in enumerate(DU_AN, start=4):
        val = du_lieu["du_an"].get(code)
        put(da, i, 1, code)
        put(da, i, 2, name)
        put(da, i, 3, val, font=F_INPUT, fill=FILL_INPUT)
        put(da, i, 4, note, font=F_NOTE)
        da_row[code] = i
    add_list_validation(da, f"C{da_row['LOAI_CT']}", ref["Loại công trình"])
    add_list_validation(da, f"C{da_row['NOI_DAT']}", ref["Sơ đồ nối đất"])
    set_widths(da, [14, 34, 34, 52])
    uf = f"IF('Du an'!$C${da_row['UF']}=\"\",'Quy tac'!$C${qt_row['UF']},'Du an'!$C${da_row['UF']})"
    ud = f"IF('Du an'!$C${da_row['UD']}=\"\",'Quy tac'!$C${qt_row['UD']},'Du an'!$C${da_row['UD']})"

    # --- Tu dien ---------------------------------------------------------------
    td = wb.create_sheet("Tu dien", 1)
    for c, (h, _, cm) in enumerate(COT_TU, start=1):
        cell = td.cell(row=1, column=c, value=h)
        if cm:
            cell.comment = Comment(cm, "Công cụ")
    style_header(td, 1, len(COT_TU), height=42)
    n_tu = 60
    for i in range(n_tu):
        r = 2 + i
        data = du_lieu["tu"][i] if i < len(du_lieu["tu"]) else {}
        for c, (h, _, _) in enumerate(COT_TU, start=1):
            put(td, r, c, data.get(h), font=F_INPUT, fill=FILL_INPUT)
    last = 1 + n_tu
    add_list_validation(td, f"G2:G{last}", ref["Số pha tủ"])
    add_list_validation(td, f"I2:I{last}", ref["Kiểu đi cáp"])
    add_list_validation(td, f"J2:J{last}", ref["Phương pháp lắp đặt"])
    add_list_validation(td, f"M2:M{last}", ref["SPD"])
    set_widths(td, [w for _, w, _ in COT_TU])
    td.freeze_panes = "B2"

    # --- Mach ------------------------------------------------------------------
    mc = wb.create_sheet("Mach", 2)
    for c, (h, _, cm) in enumerate(COT_MACH, start=1):
        cell = mc.cell(row=1, column=c, value=h)
        if cm:
            cell.comment = Comment(cm, "Công cụ")
    style_header(mc, 1, len(COT_MACH), height=48)
    calc = {"P (W)", "cosφ áp dụng", "Ib tham khảo (A)"}
    n_rows = max(200, len(du_lieu["mach"]) + 50)
    k = {h: COL[h] for h in COL}
    for i in range(n_rows):
        r = 2 + i
        data = du_lieu["mach"][i] if i < len(du_lieu["mach"]) else {}
        for c, (h, _, _) in enumerate(COT_MACH, start=1):
            if h in calc:
                continue
            put(mc, r, c, data.get(h), font=F_INPUT, fill=FILL_INPUT,
                fmt="0.00" if h.startswith("cosφ") else None)
        sl, w, cos_n, loai, so_pha = (f"{k['Số lượng']}{r}", f"{k['Công suất / đv (W)']}{r}",
                                      f"{k['cosφ (trống = mặc định)']}{r}", f"{k['Loại mạch']}{r}", f"{k['Số pha']}{r}")
        p, cos_a = f"{k['P (W)']}{r}", f"{k['cosφ áp dụng']}{r}"
        put(mc, r, COT_MACH.index(("P (W)", 8, None)) + 1,
            f'=IF({w}="","",IF({sl}="",1,{sl})*{w})', fill=FILL_CALC, fmt="#,##0")
        put(mc, r, [h for h, _, _ in COT_MACH].index("cosφ áp dụng") + 1,
            f'=IF({cos_n}<>"",{cos_n},IF({loai}="","",IFERROR(INDEX({rng_cos},MATCH({loai},{rng_loai},0)),"")))',
            fill=FILL_CALC, fmt="0.00")
        put(mc, r, [h for h, _, _ in COT_MACH].index("Ib tham khảo (A)") + 1,
            f'=IF(OR({p}="",{cos_a}="",{cos_a}=0),"",IF({so_pha}="3P",{p}/(SQRT(3)*{ud}*{cos_a}),{p}/({uf}*{cos_a})))',
            fill=FILL_CALC, fmt="0.0")
    last = 1 + n_rows
    add_list_validation(mc, f"{k['Loại mạch']}2:{k['Loại mạch']}{last}", ref["Loại mạch"])
    add_list_validation(mc, f"{k['Loại khu vực']}2:{k['Loại khu vực']}{last}", ref["Loại khu vực"])
    add_list_validation(mc, f"{k['Số pha']}2:{k['Số pha']}{last}", ref["Số pha mạch"])
    add_list_validation(mc, f"{k['Pha (trống = tự cân)']}2:{k['Pha (trống = tự cân)']}{last}", ref["Pha"])
    add_list_validation(mc, f"{k['Điều khiển KNX']}2:{k['Điều khiển KNX']}{last}", '"Bật/tắt,Dimmer,Rèm"')
    set_widths(mc, [w for _, w, _ in COT_MACH])
    mc.freeze_panes = "C2"

    # --- Dien nhe (GĐ3) --------------------------------------------------------
    dn = wb.create_sheet("Dien nhe", 3)
    head_dn = ["Tầng", "Phòng / khu vực", "Ổ data", "Ổ TV", "AP Wi-Fi", "Camera trong nhà",
               "Camera ngoài trời", "Cửa kiểm soát (ACS)", "Nút gọi chuông cửa (ngoài)",
               "Màn hình chuông cửa (trong)", "Loa (số lượng)", "Công suất tap mỗi loa (W)",
               "Vùng âm thanh", "Thiết bị KNX (số lượng)", "Tủ rack phục vụ", "Chiều dài cáp TB (m)", "Ghi chú"]
    for c, h in enumerate(head_dn, start=1):
        dn.cell(row=1, column=c, value=h)
    style_header(dn, 1, len(head_dn), height=48)
    elv = du_lieu.get("dien_nhe", [])
    n_elv = 60
    for i in range(n_elv):
        r = 2 + i
        data = elv[i] if i < len(elv) else None
        for c in range(1, len(head_dn) + 1):
            v = data[c - 1] if data else None
            put(dn, r, c, v if v != "" else None, font=F_INPUT, fill=FILL_INPUT,
                align=CENTER if 3 <= c <= 12 or c in (14, 16) else None)
    tot = 2 + n_elv
    put(dn, tot, 1, "Tổng", font=F_BOLD, fill=FILL_CALC)
    put(dn, tot, 2, None, fill=FILL_CALC)
    for c in list(range(3, 12)) + [14]:
        L = get_column_letter(c)
        put(dn, tot, c, f"=SUM({L}2:{L}{tot - 1})", font=F_BOLD, fill=FILL_CALC, align=CENTER)
    put(dn, tot, 12, None, fill=FILL_CALC)
    put(dn, tot + 1, 1, "Tổng công suất loa (W)", font=F_BOLD, fill=FILL_CALC)
    put(dn, tot + 1, 2, None, fill=FILL_CALC)
    put(dn, tot + 1, 3, f"=SUMPRODUCT(K2:K{tot - 1},L2:L{tot - 1})", font=F_BOLD, fill=FILL_CALC, align=CENTER)
    dn.merge_cells(start_row=tot, start_column=1, end_row=tot, end_column=2)
    dn.merge_cells(start_row=tot + 1, start_column=1, end_row=tot + 1, end_column=2)
    set_widths(dn, [6, 24, 8, 7, 8, 10, 10, 11, 12, 12, 9, 11, 11, 11, 10, 10, 28])
    dn.freeze_panes = "C2"

    # --- Tu rack (điện nhẹ) ------------------------------------------------------
    rk = wb.create_sheet("Tu rack", 4)
    head_rk = ["Mã rack", "Tầng", "Vị trí", "Cấp nguồn từ tủ", "Mã lộ cấp nguồn (trống = tự thêm)", "Chiều dài cáp nguồn (m)",
               "Chiều dài trục tới rack trung tâm (m)", "Rack trung tâm", "Ghi chú"]
    for c, h in enumerate(head_rk, start=1):
        rk.cell(row=1, column=c, value=h)
    style_header(rk, 1, len(head_rk), height=48)
    racks = du_lieu.get("rack", [])
    for i in range(10):
        data = racks[i] if i < len(racks) else None
        for c in range(1, len(head_rk) + 1):
            v = data[c - 1] if data else None
            put(rk, 2 + i, c, v if v != "" else None, font=F_INPUT, fill=FILL_INPUT, align=CENTER if c in (2, 6, 7, 8) else None)
    add_list_validation(rk, "H2:H11", '"Có,Không"')
    set_widths(rk, [9, 7, 18, 12, 16, 12, 14, 10, 34])
    rk.freeze_panes = "B2"

    # --- Huong dan -------------------------------------------------------------
    hd = wb.create_sheet("Huong dan", 0)
    hd["A1"] = "FILE NHẬP LIỆU — SƠ ĐỒ NGUYÊN LÝ TỦ ĐIỆN & ĐIỆN NHẸ (v2)"
    hd["A1"].font = F_TITLE
    hd["A2"] = du_lieu["mo_ta"]
    hd["A2"].font = F_NOTE
    lines = [
        ("Quy ước màu", None),
        ("Ô nền vàng, chữ xanh", "Ô cần nhập. Giá trị đang có là ví dụ — sửa hoặc xóa khi dùng cho dự án thật."),
        ("Ô nền xám", "Công thức, không nhập. Chỉ để tham khảo khi nhập liệu."),
        ("Ô nền xanh lá", "Dành cho kỹ sư điện góp ý và chốt (sheet Quy tac)."),
        ("Các sheet", None),
        ("Du an", "Thông tin khung tên, số bản vẽ đầu tiên, nguồn điện. Loại công trình quyết định hồ sơ quy tắc."),
        ("Tu dien", "Mỗi dòng là một tủ = một tờ sơ đồ. 'Cấp từ tủ' dựng cây tủ; công cụ tự tạo lộ cấp tủ con ở tủ trên "
                    "(mã theo cột 'Mã lộ cấp', vị trí theo cột 'Đặt sau lộ')."),
        ("Mach", "Mỗi dòng là một lộ ra. Bắt buộc: Mã tủ, Mã lộ, Loại mạch, Phụ tải, Công suất, Chiều dài. "
                 "Để trống Pha thì công cụ tự cân pha."),
        ("Dien nhe", "Số lượng thiết bị điện nhẹ theo tầng/phòng và tủ rack phục vụ. Đợt 1 tính: ổ data, AP Wi-Fi, camera "
                     "(switch, PoE, patch panel, NVR, rack, UPS) và vẽ tờ E.7xx; TV, ACS, chuông cửa, loa, KNX làm ở đợt sau."),
        ("Tu rack", "Mỗi dòng một tủ rack: tầng đặt, tủ điện cấp nguồn (công cụ tự thêm mạch 'DNn' vào tủ đó nếu để trống mã lộ), "
                    "chiều dài trục về rack trung tâm (> 90 m thì dùng cáp quang)."),
        ("Quy tac", "Bộ quy tắc mặc định đề xuất. Công cụ dùng các giá trị trong sheet này khi tính."),
        ("Danh muc", "Các danh sách chọn."),
        ("Công cụ tự làm", None),
        ("1", "Tính Ib, chọn CB/RCBO (loại, số cực, In, đường cong, Icu), cáp (Iz′, sụt áp cộng dồn, tiết diện tối thiểu, PE), ống."),
        ("2", "Cân pha A/B/C; tổng hợp Pđ, Kđt, Ptt, dòng từng pha; chọn CB tổng, cáp cấp, đếm module và chọn vỏ tủ."),
        ("3", "Tính cả cây tủ: lộ cấp tủ con ≥ CB tổng tủ con, sụt áp cộng dồn từ nguồn xuống từng mạch."),
        ("4", "Xuất danh sách lỗi / cảnh báo / ghi chú, bảng tính và bộ bản vẽ DXF/SVG theo template E.601."),
        ("Lưu ý", None),
        ("1", "Không đổi tên sheet và tiêu đề cột — công cụ đọc file theo đúng tên này (thứ tự cột đổi được)."),
        ("2", "Loại khu vực 'Ướt (WC, tắm)' hoặc 'Ngoài nhà' bắt buộc RCD 30 mA cho mọi mạch thuộc khu vực đó."),
        ("3", "Các cột ghi đè chỉ dùng khi cần khác kết quả công cụ; luôn ghi lý do. Công cụ vẫn kiểm tra giá trị ghi đè."),
        ("4", "Ib trong sheet Mach chỉ là số tham khảo. Công cụ tự tính lại toàn bộ theo bộ quy tắc."),
    ]
    r = 4
    for key, v in lines:
        if v is None:
            hd.cell(row=r, column=1, value=key).font = F_SUB
            r += 1
            continue
        a = put(hd, r, 1, key)
        put(hd, r, 2, v)
        if key == "Ô nền vàng, chữ xanh":
            a.fill, a.font = FILL_INPUT, F_INPUT
        elif key == "Ô nền xám":
            a.fill = FILL_CALC
        elif key == "Ô nền xanh lá":
            a.fill = FILL_REVIEW
        r += 1
    set_widths(hd, [24, 110])

    for ws in wb.worksheets:
        ws.page_setup.orientation = "landscape"
        ws.page_setup.paperSize = ws.PAPERSIZE_A4
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
    wb.active = 0
    wb.save(path)
    return path


# ---------------------------------------------------------------------------
# Dữ liệu ví dụ
# ---------------------------------------------------------------------------
def tu(**kw):
    ten = {"ma": "Mã tủ", "ten": "Tên trên bản vẽ", "vi_tri": "Vị trí", "cap_tu": "Cấp từ tủ",
           "lo": "Mã lộ cấp", "sau": "Đặt sau lộ", "pha": "Số pha", "l": "Chiều dài cáp cấp (m)",
           "di": "Kiểu đi cáp cấp", "pp": "Phương pháp lắp đặt", "ik": "Ik tại tủ (kA)",
           "ks": "Kđt (trống = theo quy tắc)", "spd": "SPD", "gc": "Ghi chú"}
    return {ten[k]: v for k, v in kw.items()}


def mach(t, ma, loai, phu_tai, w, l, kv="Khô", sl=None, cos=None, pha3=False, **kw):
    d = {"Mã tủ": t, "Mã lộ": ma, "Loại mạch": loai, "Phụ tải (chữ trên bản vẽ)": phu_tai,
         "Loại khu vực": kv, "Số lượng": sl, "Công suất / đv (W)": w, "cosφ (trống = mặc định)": cos,
         "Số pha": "3P" if pha3 else "1P", "Chiều dài (m)": l}
    ten = {"pha": "Pha (trống = tự cân)", "chung": "Số mạch chung ống", "nhom": "Nhóm RCD (ghi đè)",
           "tb": "Ghi đè thiết bị", "cap": "Ghi đè cáp", "ong": "Ghi đè ống", "ly_do": "Lý do ghi đè",
           "gc": "Ghi chú", "knx": "Điều khiển KNX"}
    d.update({ten[k]: v for k, v in kw.items()})
    return d


DB_T1 = {
    "mo_ta": ("Mẫu nhập liệu v2 · ví dụ là tủ DB-T1 trong tài liệu phương án (mục 7), số liệu giả định · "
              "hồ sơ quy tắc: nhà ở/biệt thự, căn hộ · thiết bị Schneider"),
    "du_an": {
        "MA_DA": "VD-2026-01", "TEN_DA": "BIỆT THỰ MẪU", "CHU_DAU_TU": "", "DIA_CHI": "Hà Nội",
        "CONG_TY": "22 Thanh Cong, Ba Dinh, Ha Noi", "LOAI_CT": "Nhà ở / biệt thự", "NGAY": "09/11/2026",
        "TY_LE": "1:50", "SO_BV_DAU": "E.601", "REV": "A", "UF": 220, "UD": 380, "NOI_DAT": "TN-S",
        "IK_NGUON": 6, "DU_MAX": 5,
    },
    "tu": [
        tu(ma="MDB", ten="MDB", vi_tri="Tủ điện tổng – phòng kỹ thuật tầng 1", pha="3P+N+PE", di="Ống", ik=6,
           spd="Theo quy tắc", gc="Chưa có chiều dài cáp từ công tơ — sụt áp tính từ thanh cái MDB"),
        tu(ma="DB-T1", ten="DB-T1", vi_tri="Tủ điện tầng 1 – gầm cầu thang", cap_tu="MDB", lo="F01", pha="3P+N+PE",
           l=30, di="Ống", pp="B1", ik=6, gc="Ví dụ trong tài liệu phương án, mục 7"),
    ],
    "mach": [
        mach("DB-T1", "C01", "Chiếu sáng trong nhà", "CHIẾU SÁNG P.KHÁCH, SẢNH", 450, 25),
        mach("DB-T1", "C02", "Chiếu sáng trong nhà", "CHIẾU SÁNG BẾP, P.ĂN, HÀNH LANG", 350, 30),
        mach("DB-T1", "C03", "Chiếu sáng ngoài nhà", "CHIẾU SÁNG SÂN VƯỜN", 600, 40, kv="Ngoài nhà"),
        mach("DB-T1", "C04", "Ổ cắm thông thường", "Ổ CẮM P.KHÁCH, SẢNH", 225, 25, sl=8),
        mach("DB-T1", "C05", "Ổ cắm thông thường", "Ổ CẮM BẾP", 3000, 15, kv="Bếp", cos=0.9),
        mach("DB-T1", "C06", "Bếp từ, lò nướng", "BẾP TỪ", 4000, 12, kv="Bếp"),
        mach("DB-T1", "C07", "Khu ướt (WC, bình nóng lạnh)", "BÌNH NÓNG LẠNH WC1", 2500, 20, kv="Ướt (WC, tắm)"),
        mach("DB-T1", "C08", "Khu ướt (WC, bình nóng lạnh)", "Ổ CẮM WC1", 1400, 20, kv="Ướt (WC, tắm)", cos=0.95),
        mach("DB-T1", "C09", "Điều hòa", "ĐIỀU HÒA P.KHÁCH 24.000 BTU", 2400, 18),
        mach("DB-T1", "C10", "Điều hòa", "ĐIỀU HÒA P.ĂN 18.000 BTU", 1700, 15),
        mach("DB-T1", "C11", "Động cơ (bơm, quạt)", "BƠM TĂNG ÁP", 1500, 20, pha3=True),
        mach("DB-T1", "DP1", "Dự phòng", "DỰ PHÒNG", None, None),
        mach("DB-T1", "DP2", "Dự phòng", "DỰ PHÒNG", None, None, tb="MCB 1P 20A", ly_do="Dự phòng cho ổ cắm bếp"),
    ],
    "dien_nhe": [
        ["T1", "Sảnh", 0, 0, 1, 1, 0, 1, 1, 0, 2, 6, "Vùng 1", 4, "R1", 12, ""],
        ["T1", "P.khách", 2, 1, 1, 0, 0, 0, 0, 1, 4, 6, "Vùng 1", 8, "R1", 15, ""],
        ["T1", "Bếp, P.ăn", 1, 1, 0, 0, 0, 0, 0, 0, 2, 6, "Vùng 2", 6, "R1", 18, ""],
        ["T1", "Sân vườn, cổng", 0, 0, 1, 0, 4, 0, 0, 0, 4, 10, "Vùng 3", 2, "R1", 35, "AP và loa loại ngoài trời"],
    ],
    "rack": [["R1", "T1", "Gầm cầu thang", "DB-T1", "", 5, "", "Có", "Rack trung tâm"]],
}

# Ví dụ dựng theo cấu trúc bộ bản vẽ mẫu E.601–E.606 (dự án HDMON): tủ T1 ở tầng 1 cấp cho các tủ tầng
# T2–T6 (lộ S5–S9, đặt sau lộ thang máy TM). Tên lộ và chữ phụ tải lấy theo bản vẽ mẫu.
# Các tủ tầng trong mẫu có mọi mạch cùng một pha và cáp cấp 2 lõi → khai báo tủ 1 pha.
# CÔNG SUẤT VÀ CHIỀU DÀI LÀ SỐ GIẢ ĐỊNH — thay bằng số liệu thật của dự án khi có.
GD = "giả định"


def tang(t, so, ds):
    return [mach(t, *x[:5], **(x[5] if len(x) > 5 else {})) for x in ds]


HDMON = {
    "mo_ta": ("Ví dụ dựng theo cấu trúc bộ bản vẽ mẫu E.601–E.606 (dự án HDMON) · "
              "CÔNG SUẤT VÀ CHIỀU DÀI LÀ SỐ GIẢ ĐỊNH, chỉ để chạy thử công cụ"),
    "du_an": {
        "MA_DA": "", "TEN_DA": "MR. TUẤN - HDMON", "CHU_DAU_TU": "Mr. Tuấn", "DIA_CHI": "Long Biên - Hà Nội",
        "CONG_TY": "22 Thanh Cong, Ba Dinh, Ha Noi", "LOAI_CT": "Nhà ở / biệt thự", "NGAY": "November 09/11/2026",
        "TY_LE": "1:50", "SO_BV_DAU": "E.601", "REV": "A", "UF": 220, "UD": 380, "NOI_DAT": "TN-S",
        "IK_NGUON": 6, "DU_MAX": 5,
    },
    "tu": [
        tu(ma="T1", ten="T1", vi_tri="Tầng 1", pha="3P+N+PE", l=25, di="Máng cáp", pp="E", spd="Theo quy tắc",
           gc=f"Tủ gốc. Chiều dài cáp từ công tơ {GD}"),
        tu(ma="T2", ten="T2", vi_tri="Tầng 2", cap_tu="T1", lo="S5", sau="TM", pha="1P+N+PE", l=10, di="Ống", gc=GD),
        tu(ma="T3", ten="T3", vi_tri="Tầng 3", cap_tu="T1", lo="S6", sau="S5", pha="1P+N+PE", l=14, di="Ống", gc=GD),
        tu(ma="T4", ten="T4", vi_tri="Tầng 4", cap_tu="T1", lo="S7", sau="S6", pha="1P+N+PE", l=18, di="Ống", gc=GD),
        tu(ma="T5", ten="T5", vi_tri="Tầng 5", cap_tu="T1", lo="S8", sau="S7", pha="1P+N+PE", l=22, di="Ống", gc=GD),
        tu(ma="T6", ten="T6", vi_tri="Tầng 6", cap_tu="T1", lo="S9", sau="S8", pha="1P+N+PE", l=26, di="Ống", gc=GD),
    ],
    "mach": [
        *tang("T1", 1, [
            ("L1", "Chiếu sáng ngoài nhà", "CHIẾU SÁNG NGOÀI NHÀ", 500, 30, {"kv": "Ngoài nhà"}),
            ("L2", "Chiếu sáng trong nhà", "CHIẾU SÁNG TRONG NHÀ", 600, 25),
            ("S1", "Ổ cắm thông thường", "Ổ CẮM TRONG NHÀ , CAMERA, WIFI", 200, 25, {"sl": 10}),
            ("S2", "Ổ cắm thông thường", "Ổ CẮM ĐIỆN NGOÀI NHÀ", 1000, 30, {"kv": "Ngoài nhà"}),
            ("ACT", "Điều hòa", "CẤP ĐIỆN DÀN NÓNG ĐIỀU HOÀ", 12000, 15, {"pha3": True}),
            ("AC1", "Điều hòa", "CẤP ĐIỆN DÀN LẠNH ĐIỀU HOÀ T1", 100, 25, {"sl": 4}),
            ("WH1", "Khu ướt (WC, bình nóng lạnh)", "CẤP ĐIỆN BÌNH NÓNG LẠNH T1", 2500, 15, {"kv": "Ướt (WC, tắm)"}),
            ("TM", "Động cơ (bơm, quạt)", "CẤP ĐIỆN THANG MÁY", 5500, 20, {"pha3": True}),
            ("R1", "Động cơ (bơm, quạt)", "CẤP ĐIỆN RÈM", 300, 20),
            ("TB", "Động cơ (bơm, quạt)", "CẤP ĐIỆN NGUỒN TỦ BƠM", 1500, 15),
        ]),
        *tang("T2", 2, [
            ("L1", "Chiếu sáng trong nhà", "CẤP ĐIÊN CHIẾU SÁNG PHÒNG NGỦ", 400, 20),
            ("L2", "Chiếu sáng trong nhà", "CẤP ĐIỆN CHIẾU SÁNG SẢNH + WC", 300, 20, {"kv": "Ướt (WC, tắm)"}),
            ("S1", "Ổ cắm thông thường", "CẤP ĐIỆN Ổ CẮM, CAMERA, WIFI", 200, 20, {"sl": 8}),
            ("S2", "Ổ cắm thông thường", "CẤP ĐIỆN Ổ CẮM CLOSET", 800, 15),
            ("AC2", "Điều hòa", "CẤP ĐIỆN DÀN LẠNH ĐIỀU HOÀ T2", 100, 20, {"sl": 3}),
            ("WH2", "Khu ướt (WC, bình nóng lạnh)", "BÌNH NÓNG LẠNH WC", 2500, 15, {"kv": "Ướt (WC, tắm)"}),
            ("R2", "Động cơ (bơm, quạt)", "CẤP NGUỒN RÈM", 200, 20),
        ]),
        *[m for so in (3, 4) for m in tang(f"T{so}", so, [
            ("L1", "Chiếu sáng trong nhà", f"CẤP ĐIÊN CHIẾU SÁNG P. NGỦ {so}-1", 300, 18),
            ("L2", "Chiếu sáng trong nhà", f"CẤP ĐIỆN CHIẾU SÁNG P. NGỦ {so}-2", 300, 22),
            ("L3", "Chiếu sáng trong nhà", "CẤP ĐIỆN CHIẾU SÁNG SẢNH + WC", 250, 15, {"kv": "Ướt (WC, tắm)"}),
            ("S1", "Ổ cắm thông thường", f"CẤP ĐIỆN Ổ CẮM, CAMERA, WIFI {so}-1", 200, 18, {"sl": 6}),
            ("S2", "Ổ cắm thông thường", f"CẤP ĐIỆN Ổ CẮM, CAMERA, WIFI {so}-2", 200, 22, {"sl": 6}),
            (f"AC{so}-1", "Điều hòa", f"CẤP ĐIỆN DÀN LẠNH ĐIỀU HOÀ T{so}-1", 100, 18),
            (f"AC{so}-2", "Điều hòa", f"CẤP ĐIỆN DÀN LẠNH ĐIỀU HOÀ T{so}-2", 100, 22),
            (f"WH{so}-1", "Khu ướt (WC, bình nóng lạnh)", f"BÌNH NÓNG LẠNH WC{so}-1", 2500, 15, {"kv": "Ướt (WC, tắm)"}),
            (f"WH{so}-2", "Khu ướt (WC, bình nóng lạnh)", f"BÌNH NÓNG LẠNH WC{so}-2", 2500, 20, {"kv": "Ướt (WC, tắm)"}),
            (f"R{so}", "Động cơ (bơm, quạt)", "CẤP NGUỒN RÈM", 200, 20),
        ])],
        *tang("T5", 5, [
            ("L1", "Chiếu sáng trong nhà", "CẤP ĐIÊN CHIẾU SÁNG P.BẾP + ĂN", 400, 18),
            ("L2", "Chiếu sáng trong nhà", "CẤP ĐIỆN CHIẾU SÁNG SẢNH + WC", 250, 15, {"kv": "Ướt (WC, tắm)"}),
            ("S1", "Ổ cắm thông thường", "CẤP ĐIỆN Ổ CẮM, CAMERA, WIFI", 200, 18, {"sl": 8}),
            ("S2", "Bếp từ, lò nướng", "CẤP ĐIỆN BẾP TỪ", 4000, 12, {"kv": "Bếp"}),
            ("AC5", "Điều hòa", "CẤP ĐIỆN DÀN LẠNH ĐIỀU HOÀ T5", 100, 18, {"sl": 2}),
            ("WH5", "Khu ướt (WC, bình nóng lạnh)", "BÌNH NÓNG LẠNH WC T5", 2500, 15, {"kv": "Ướt (WC, tắm)"}),
            ("R5", "Động cơ (bơm, quạt)", "CẤP NGUỒN RÈM T5", 200, 18),
        ]),
        *tang("T6", 6, [
            ("L1", "Chiếu sáng trong nhà", "CẤP ĐIÊN CHIẾU SÁNG", 300, 18),
            ("L2", "Chiếu sáng ngoài nhà", "CẤP ĐIỆN SÂN TRƯỚC", 300, 20, {"kv": "Ngoài nhà"}),
            ("S1", "Ổ cắm thông thường", "CẤP ĐIỆN Ổ CẮM, CAMERA, WIFI", 200, 18, {"sl": 6}),
            ("S2", "Ổ cắm thông thường", "CẤP ĐIỆN Ổ CẮM NGOÀI TRỜI", 1000, 20, {"kv": "Ngoài nhà"}),
            ("S3", "Ổ cắm thông thường", "Ổ CẮM MÁY GIẶT, BƠM TĂNG ÁP", 2500, 15),
            ("AC6", "Điều hòa", "CẤP ĐIỆN DÀN LẠNH ĐIỀU HOÀ T6", 100, 18),
            ("R6", "Động cơ (bơm, quạt)", "CẤP NGUỒN RÈM T6", 200, 18),
            ("DP", "Dự phòng", "DỰ PHÒNG", None, None),
        ]),
    ],
    # Điện nhẹ (giả định): 1 rack ở T1, cáp ngang tính từ rack lên các tầng (≈ 3,6 m/tầng + tuyến ngang)
    # Cột: tầng, phòng, data, TV, AP, cam trong, cam ngoài, ACS, nút gọi, màn hình, loa, W/loa, vùng, KNX, rack, L, ghi chú
    "dien_nhe": [
        ["T1", "Sảnh, P.khách", 2, 1, 1, 1, 0, 0, 0, 1, 4, 6, "Vùng 1 – khách", 3, "R1", 15, GD],
        ["T1", "Bếp, P.ăn", 1, 0, 1, 0, 0, 0, 0, 0, 2, 6, "Vùng 2 – bếp", 2, "R1", 18, GD],
        ["T1", "Sân trước, cổng, gara", 0, 0, 0, 0, 3, 1, 1, 0, 2, 10, "Vùng 3 – sân", 1, "R1", 30, f"Camera, loa ngoài trời; cửa cổng có ACS — {GD}"],
        *[dong for k in range(2, 6) for dong in (
            [f"T{k}", "Các phòng ngủ", 2, 2, 0, 0, 0, 0, 0, 0, 0, None, "", 4, "R1", 14 + 5 * k, GD],
            [f"T{k}", "Sảnh tầng, hành lang", 0, 0, 1, 1, 0, 0, 0, 0, 0, None, "", 1, "R1", 12 + 5 * k, GD])],
        ["T6", "P.thờ, sân thượng", 1, 0, 1, 0, 1, 0, 0, 0, 2, 10, "Vùng 4 – sân thượng", 2, "R1", 45, GD],
    ],
    "rack": [["R1", "T1", "Phòng kỹ thuật T1", "T1", "", 8, "", "Có", f"Rack trung tâm — {GD}"]],
}

# KNX (giả định): mạch chiếu sáng điều khiển bật/tắt (L2 tủ T1: dimmer), mạch rèm điều khiển rèm
for _m in HDMON["mach"]:
    _ma = _m.get("Mã lộ") or ""
    if _ma.startswith("L"):
        _m["Điều khiển KNX"] = "Dimmer" if (_m["Mã tủ"], _ma) == ("T1", "L2") else "Bật/tắt"
    elif _ma.startswith("R"):
        _m["Điều khiển KNX"] = "Rèm"


# ---------------------------------------------------------------------------
# Dữ liệu dự án JSON (dạng engine/doc-excel.mjs trả về) → file Excel nhập liệu
# ---------------------------------------------------------------------------
_INFO_SANG_MA = {
    "projectNo": "MA_DA", "project": "TEN_DA", "client": "CHU_DAU_TU", "address": "DIA_CHI",
    "companyInfo": "CONG_TY", "loaiCongTrinh": "LOAI_CT", "director": "GIAM_DOC", "design": "THIET_KE",
    "checkBy": "KIEM_TRA", "madeBy": "NGUOI_VE", "date": "NGAY", "scale": "TY_LE", "soBanVeTong": "SO_BV_TONG",
    "soBanVeDau": "SO_BV_DAU", "rev": "REV", "uf": "UF", "ud": "UD", "noiDat": "NOI_DAT", "ikNguon": "IK_NGUON",
    "mbaKva": "MBA_KVA", "mbaUk": "MBA_UK", "soBanVeDienNhe": "SO_BV_DN",
    "duMax": "DU_MAX", "bangGia": "BANG_GIA", "chietKhau": "CHIET_KHAU",
}
_TU_SANG_COT = {
    "ma": "Mã tủ", "ten": "Tên trên bản vẽ", "viTri": "Vị trí", "capTu": "Cấp từ tủ", "maLoCap": "Mã lộ cấp",
    "datSauLo": "Đặt sau lộ", "lCap": "Chiều dài cáp cấp (m)", "kieuDi": "Kiểu đi cáp cấp",
    "phuongPhap": "Phương pháp lắp đặt", "ik": "Ik tại tủ (kA)", "ks": "Kđt (trống = theo quy tắc)", "spd": "SPD",
    "ghiChu": "Ghi chú",
}
_MACH_SANG_COT = {
    "tu": "Mã tủ", "ma": "Mã lộ", "loai": "Loại mạch", "phuTai": "Phụ tải (chữ trên bản vẽ)", "khuVuc": "Loại khu vực",
    "soLuong": "Số lượng", "congSuat": "Công suất / đv (W)", "cos": "cosφ (trống = mặc định)",
    "pha": "Pha (trống = tự cân)", "L": "Chiều dài (m)", "nhomOng": "Số mạch chung ống", "nhomRcd": "Nhóm RCD (ghi đè)",
    "ghiDeThietBi": "Ghi đè thiết bị", "ghiDeCap": "Ghi đè cáp", "ghiDeOng": "Ghi đè ống", "lyDo": "Lý do ghi đè", "knx": "Điều khiển KNX",
    "ghiChu": "Ghi chú",
}


_DN_COT = ["tang", "phong", "data", "tv", "ap", "camTrong", "camNgoai", "acs", "chuongNgoai", "chuongTrong", "loa", "loaW",
           "vungAm", "knx", "rack", "L", "ghiChu"]
_RACK_COT = ["ma", "tang", "viTri", "capTu", "maMach", "lNguon", "lTruc", "trungTam", "ghiChu"]


def tu_json(du_an):
    """Đổi dữ liệu dự án JSON sang dạng du_lieu của build(). Sheet Quy tac luôn ghi bộ mặc định."""
    info = du_an.get("info", {})
    tu = []
    for p in du_an.get("panels", []):
        d = {_TU_SANG_COT[k]: v for k, v in p.items() if k in _TU_SANG_COT and v not in (None, "")}
        d["Số pha"] = "1P+N+PE" if p.get("soPha") == 1 else "3P+N+PE"
        tu.append(d)
    mach = []
    for c in du_an.get("circuits", []):
        d = {_MACH_SANG_COT[k]: v for k, v in c.items() if k in _MACH_SANG_COT and v not in (None, "")}
        d["Số pha"] = "3P" if c.get("soPha") == 3 else "1P"
        mach.append(d)
    return {
        "mo_ta": f"Tạo từ dữ liệu dự án JSON — {info.get('project', '')} · số liệu ghi 'giả định' ở cột Ghi chú cần kỹ sư rà lại",
        "du_an": {_INFO_SANG_MA[k]: v for k, v in info.items() if k in _INFO_SANG_MA},
        "tu": tu,
        "mach": mach,
        "dien_nhe": [[p.get(k, "") if p.get(k) is not None else "" for k in _DN_COT] for p in (du_an.get("dienNhe") or {}).get("phong", [])],
        "rack": [[("Có" if r.get("trungTam") else "") if k == "trungTam" else (r.get(k) if r.get(k) is not None else "") for k in _RACK_COT]
                 for r in (du_an.get("dienNhe") or {}).get("rack", [])],
    }


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) >= 3 and sys.argv[1] == "--tu-json":
        # python3 tao_mau_nhap_lieu.py --tu-json du-an.json [ra.xlsx]
        vao = sys.argv[2]
        ra = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(vao)[0] + ".xlsx"
        with open(vao, encoding="utf-8") as f:
            print(build(ra, tu_json(json.load(f))))
    else:
        here = os.path.dirname(os.path.abspath(__file__))
        print(build(os.path.join(here, "nhap-lieu-tu-dien.xlsx"), DB_T1))
        print(build(os.path.join(here, "vi-du-HDMON.xlsx"), HDMON))
