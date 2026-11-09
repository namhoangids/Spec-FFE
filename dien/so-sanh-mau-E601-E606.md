# So sánh công cụ với bộ bản vẽ mẫu E.601–E.606 (dự án HDMON)

> Ngày 09/11/2026 · Bộ quy tắc **0.1 — CHƯA DUYỆT** · Gửi kỹ sư điện nội bộ xem và chốt các mục ở phần 3.

## Cách so sánh

Chưa có số liệu phụ tải thật của HDMON, nên công suất và chiều dài trong `mau/vi-du-HDMON.xlsx` là **số giả định**. Em so theo hai cách:

1. **Công cụ tự chọn theo quy tắc.** Chạy file ví dụ ra bộ 6 tờ trong `out/vi-du-HDMON/`: 0 lỗi, 0 cảnh báo.
2. **Nhập đúng lựa chọn của bản mẫu.** Thiết bị, cáp và nhóm RCBO của từng mạch trong bản mẫu được nhập vào công cụ dưới dạng ghi đè, rồi cho bộ kiểm tra chạy. Kết quả ở phần 1.

Phần lớn phát hiện **không phụ thuộc công suất giả định**: RCD, dây PE, và việc CB có bảo vệ được cáp hay không (In ≤ Iz′). Chỗ nào phụ thuộc công suất thì có ghi rõ.

## 1. Bộ kiểm tra chạy trên lựa chọn của bản mẫu

| # | Phát hiện | Mạch trong bản mẫu | Mức | Căn cứ / cách sửa |
|---|---|---|---|---|
| 1 | **RCBO 25 A trên cáp 2,5 mm².** Cáp Cu/PVC 2,5 mm² đi ống (B1) ở 35 °C chỉ chịu Iz′ = 24 × 0,94 = 22,6 A, nhỏ hơn 25 A, nên CB không bảo vệ được quá tải cho cáp | WH1 (T1), WH2 (T2), WH3-1, WH3-2 (T3), WH4-1, WH4-2 (T4), WH2 (T5): 7 mạch | 🔴 Lỗi | IEC 60364-4-43: Ib ≤ In ≤ Iz′. Bình 2,5 kW có Ib = 11,4 A, nên dùng RCBO 16 A với cáp 2,5 mm². Nếu muốn giữ 25 A thì phải lên cáp 4 mm² |
| 2 | **Chiếu sáng khu ướt / ngoài nhà dùng MCB, không có RCD 30 mA** | L1 chiếu sáng ngoài nhà (T1); L2 sảnh + WC (T2, T5); L3 sảnh + WC (T3, T4); L2 sân trước (T6): 6 mạch | 🔴 Lỗi | IEC 60364-7-701: mọi mạch trong khu vực có bồn tắm/vòi sen phải có RCD 30 mA; IEC 60364-4-41: mạch cấp thiết bị ngoài nhà cũng phải có |
| 3 | **Mạch không có dây PE**, ví dụ `Cu/PVC 2(1x1,5)mm2` | Chiếu sáng L1–L3 cả 6 tờ, rèm R1 và nguồn tủ bơm (T1): 16 mạch | 🟡 Cảnh báo | IEC 60364-5-54: mọi mạch cần dây bảo vệ (đèn cấp I, vỏ kim loại). Công cụ luôn kéo E cùng tiết diện dây pha |
| 4 | **Một RCBO 32 A 30 mA dùng chung cho S1 + S2** | Cả 6 tờ | 🟡 Cảnh báo | Đây là cách làm chủ đích của bản mẫu. Quy tắc trong phương án yêu cầu RCBO riêng cho từng mạch ổ cắm: chạm đất ở một mạch không làm mất điện mạch còn lại, và dòng rò nền không cộng dồn. Công cụ vẫn cho ghi đè qua cột "Nhóm RCD" và ghi cảnh báo kèm lý do |
| 5 | **Bếp từ dùng MCB 16 A, cáp 2,5 mm²** | S2 (T5) | 🔴 Lỗi *(phụ thuộc công suất)* | Với bếp từ 4 kW (giả định) Ib = 19,1 A > 16 A. Bếp từ đôi thường 3,5–7,2 kW, cần công suất thật |
| 6 | **Cáp 1,5 mm² cho rèm và nguồn tủ bơm** | R1, TB (T1) | 🔴 Lỗi *(theo quy tắc nội bộ)* | Quy tắc đang đặt tiết diện tối thiểu cho "Động cơ" là 2,5 mm². Động cơ rèm rất nhỏ, nên kỹ sư cần quyết định có hạ xuống 1,5 mm² cho loại này không (mục 3) |
| 7 | **CB tổng 32 A với mạch ra 25 A** | T2 | 🟡 Cảnh báo | Tỷ số 32 / 25 = 1,28 < 1,6, nên có rủi ro mất chọn lọc. Cần kiểm tra theo bảng phối hợp Schneider |

## 2. Khác biệt cách thể hiện giữa bản mẫu và công cụ

| Nội dung | Bản mẫu | Công cụ | Ghi chú |
|---|---|---|---|
| Tủ tầng T2–T6 | CB tổng ghi **MCB 3P 32A**, nhưng mọi mạch cùng một pha, và lộ cấp ở T1 là MCB 3P đi với cáp **2 lõi** `2(1x6)` | Ví dụ khai tủ **1 pha**: CB tổng MCB **2P** (cắt cả dây N), lộ cấp MCB 2P, cáp 2 lõi | Bản mẫu chưa nhất quán. Nếu tủ thật là 3 pha thì khai `3P+N+PE`: công cụ tự cân pha trong tủ và chọn cáp 4 lõi |
| Dây PE của cáp cấp | `(4x6) + E(1x4)`, `(4x16) + E(1x10)` | PE = dây pha khi S ≤ 16 mm² (IEC 60364-5-54 bảng 54.2) | PE nhỏ hơn vẫn được phép nếu tính theo công thức đoạn nhiệt (543.1.2). Công cụ chưa làm phần này (GĐ4) |
| Ký hiệu cáp cấp | `Cu.XPLE/PVC`, `Cu/PVC/XLPE` | Thống nhất `Cu/XLPE/PVC` | |
| Dòng 4 của nhãn RCBO | RCBO riêng ghi Icu (`6kA`); RCBO nhóm ghi `30mA` | Mọi RCBO ghi `30mA`; Icu có trong bảng tính | Ký hiệu chỉ có 4 dòng nhãn |
| Pđ / Kđt / Ptt | Cả 6 tờ cùng ghi `Pđ=23.84 kW, Kđt=0.5, Ptt=11,92 kW` (chép từ T1) | Tính riêng từng tủ. Với tủ tổng: Kđt mạch cuối 0,7 + hệ số đồng thời giữa 5 tủ con 0,8 | |
| CB tổng T1 | MCCB 4P 63A 15kA | MCCB 4P 100A 15kA *(theo tải giả định 53 kW)* | Phụ thuộc công suất thật |
| Vỏ tủ | 24 module cho T2–T5, 18 module cho T6 | Đếm module của thiết bị + 20% dự phòng: T2 18, T3 24, T4 24, T5 18, T6 18 | Khi RCBO riêng từng mạch, mỗi RCBO 1P+N chiếm 2 module |
| Nhãn lộ cấp tủ con | T1 lộ S9 ghi `CẤP ĐIỆN T7`, trong khi tờ E.606 là T6 | Tự sinh `CẤP ĐIỆN <tên tủ con>` từ cây tủ | Công cụ tránh được lỗi chép |
| Mã lộ, tên phụ tải | T4 ghi `P. NGỦ 3-1`, `ĐIỀU HOÀ T3-1`; T5 dùng `AC2/WH2/R2` trùng mã với T2 | Nhập riêng theo từng tủ trong Excel | Lỗi chép do sao tờ |
| Ống luồn | Ø20 cho mạch nhánh, Ø32 cho lộ cấp | Ø20 cho mạch nhánh (quy tắc ống tối thiểu 20 mm lấy theo mẫu); lộ cấp chọn theo hệ số lấp đầy 40%, được Ø32–40 | |
| Đèn báo pha, SPD | Không vẽ | Tính vào số module (đèn báo pha tủ 3 pha, SPD loại 2 ở tủ tổng), **chưa vẽ** ký hiệu | Template cần thêm ký hiệu SPD nếu công ty dùng |

## 3. Các mục cần kỹ sư điện chốt

1. **RCBO riêng từng mạch hay cho nhóm như bản mẫu.** Nhóm thì rẻ hơn và ít module hơn; riêng thì an toàn và đúng tinh thần IEC hơn.
2. **Dây PE của cáp cấp:** theo bảng (PE = S khi S ≤ 16 mm²) hay tính theo công thức đoạn nhiệt.
3. **Tiết diện tối thiểu cho động cơ nhỏ** (rèm, quạt hút): 1,5 hay 2,5 mm².
4. **Tủ tầng 1 pha hay 3 pha** (để thống nhất CB tổng, lộ cấp và cáp cấp).
5. **Tỷ số chọn lọc 1,6** dùng sơ bộ, hay tra theo bảng phối hợp Schneider.
6. **Phân bổ sụt áp tới thanh cái mỗi tủ: 2%**, để mạch chiếu sáng còn 1% và mạch khác còn 3%.
7. **Kđt:** 0,7 cho mạch cuối và bảng 1 / 0,9 / 0,8 / 0,7 / 0,6 theo số tủ con. Hoặc theo cách khác.
8. **Bình nóng lạnh:** dùng RCBO 16 A với cáp 2,5 mm², hay 25 A với cáp 4 mm².

## Chạy lại

```bash
cd dien && npm install
node tao-bo-ban-ve.mjs mau/vi-du-HDMON.xlsx out/vi-du-HDMON   # cách 1
```

Khi có số liệu phụ tải thật của HDMON, chỉ cần thay công suất và chiều dài trong `vi-du-HDMON.xlsx` rồi chạy lại, kết quả so sánh sẽ cập nhật theo.
