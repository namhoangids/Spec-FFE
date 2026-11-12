# Công cụ sơ đồ nguyên lý tủ điện & điện nhẹ

Phương án tổng thể: [`docs/phuong-an-so-do-nguyen-ly-tu-dien-dien-nhe.md`](../docs/phuong-an-so-do-nguyen-ly-tu-dien-dien-nhe.md).

**Trạng thái:** GĐ1 xong; GĐ2 đợt 1 xong (10/11/2026); thêm thuyết minh tính toán, khung BOQ, bóc khối, **dự án chung trên web**, ngắn mạch, **điện nhẹ đợt 1 + 2** (11/11/2026) và **bóc khối điện nhẹ** (12/11/2026). Nhập phụ tải vào Excel (hoặc sửa thẳng trên web), công cụ tự tính rồi vẽ **cả bộ**:
- tờ **sơ đồ cấp điện tổng** E.600;
- mỗi tủ một tờ theo template E.601; tủ quá 18 lộ **tự ngắt thêm tờ**;
- **nhãn tủ, nhãn cáp**;
- **thuyết minh tính toán**: file Word sửa được và trang HTML in ra PDF, cùng một nội dung;
- **BOQ điện**: khối lượng thiết bị, vỏ tủ và phụ kiện, dây/cáp, ống; có sẵn khung đơn giá (chờ bảng giá Schneider);
- **bóc khối từ mặt bằng AutoCAD** (DATAEXTRACTION): công suất mạch và số lượng đèn, ổ cắm lấy từ bản vẽ; block điện nhẹ (ổ data, TV, AP, camera, chuông, đầu đọc, loa, phím KNX) tự điền bảng điện nhẹ theo phòng;
- **dự án chung của team** trên Firebase `measure-and-make` (cùng tài khoản app M&M): sửa bảng tủ, mạch ngay trên web, lưu có lịch sử phiên bản;
- **ngắn mạch theo tổng trở**: Ik3 max tại thanh cái từng tủ (chọn Icu), Ik1 min cuối từng mạch (kiểm tự cắt nguồn khi chạm vỏ), chọn lọc CB vùng ngắn mạch;
- **điện nhẹ** (mạng LAN / Wi-Fi, camera, IPTV, chuông cửa IP, kiểm soát ra vào, âm thanh 100 V, KNX): tờ E.700 sơ đồ trục, E.701 nguyên lý mạng, mặt đứng từng tủ rack, nguyên lý âm thanh, kiểm soát ra vào & chuông cửa, topology KNX; bảng đấu nối cổng, BOQ nhóm F; nguồn cho rack và ampli tự thành mạch trong tủ điện, actuator KNX tự vào tủ điện.

Kết quả xuất ra DXF, SVG và bảng tính. Bộ quy tắc **chưa duyệt**: kỹ sư điện cần chốt sheet `Quy tac`.

**Duyệt bộ quy tắc:** file `mau/bo-quy-tac.xlsx` gửi kỹ sư điện. File có 3 sheet:
- `Huong dan`: cách duyệt và các điểm nên soát trước (★);
- `Quy tac`:
  - A: các thông số chung, ngắn mạch, điện nhẹ, KNX;
  - B: quy tắc theo loại mạch;
  - C: dãy cỡ chuẩn và bảng tra (Iz, k2, vỏ tủ, ống, switch, NVR, actuator…);
  - D: các quy tắc còn nằm trong code;
  - mỗi dòng có cột "Nguồn gốc" (tiêu chuẩn / thông lệ / em giả định), "Ý kiến KS điện" và "Chốt";
- `Gia dinh agent`: số liệu agent dùng khi lập bản nháp.

Sheet `Quy tac` sinh từ `engine/danh-muc-quy-tac.mjs`, cùng một mẫu với sheet `Quy tac` của file nhập liệu, và công cụ đọc lại được cả bảng tra. Kỹ sư sửa giá trị và đánh ✔; khi mọi dòng đã chốt, file đó được ghi là ĐÃ DUYỆT. Sau khi duyệt, giá trị chốt được đưa vào `engine/quy-tac.mjs` (phiên bản 1.0).

## AI Agent vẽ sơ đồ (skill Claude Code)

Trong Claude Code mở repo này, anh mô tả nhu cầu hoặc gửi ảnh/PDF mặt bằng. Có thể gõ `/so-do-nguyen-ly` hoặc nói thẳng, ví dụ "vẽ sơ đồ nguyên lý cho biệt thự 4 tầng…". Agent sẽ:
1. hỏi vài điểm chính;
2. gợi ý danh sách tủ và mạch, kèm các giả định;
3. chạy công cụ ra cả bộ bản vẽ, bảng tính, nhãn, thuyết minh và file Excel;
4. sửa tiếp theo lời anh.

| File | Nội dung |
|---|---|
| [`.claude/skills/so-do-nguyen-ly/SKILL.md`](../.claude/skills/so-do-nguyen-ly/SKILL.md) | Quy trình của agent |
| [`.claude/skills/so-do-nguyen-ly/tham-khao.md`](../.claude/skills/so-do-nguyen-ly/tham-khao.md) | Dạng file mô tả, loại phòng, cách sửa lỗi |
| `agent/goi-y-dau-vao.mjs` | Mô tả công trình (tầng, phòng, thiết bị) → danh sách tủ và mạch. Tự chia mạch, ước phụ tải, ghi "giả định" |
| `agent/phu-tai-dien-hinh.mjs` | Bảng phụ tải điển hình (W/m², số ổ cắm, BTU điều hòa, công suất thiết bị, chiều dài) — kỹ sư sửa được |
| `agent/xem-truoc.mjs` | Chụp các tờ SVG thành PNG để xem nhanh |
| `agent/vi-du/` | Ví dụ mô tả: biệt thự 4 tầng; căn hộ đọc từ ảnh mặt bằng |
| `agent/huong-dan-api-key.md` | Hướng dẫn tạo API key, chỉ cần khi muốn làm khung chat trên web |

Skill có trong mọi phiên Claude Code mở repo **sau khi PR được merge vào main**. Trước đó chỉ có trong phiên mở nhánh `claude/tu-dien-so-do-nguyen-ly-4ynx0d`.

## Dùng thế nào

**Web app:** mở `/dien/app/` trên bản triển khai Vercel của repo (gõ `/dien` cũng được, trang `dien/index.html` tự chuyển sang). Trang gốc `/` là app FF&E, không phải app này. Có thể tải file Excel lên (hoặc `du-an.json` của agent / lệnh tạo bộ), bấm "Chạy ví dụ HDMON", hoặc mở dự án chung của team. Các bước tiếp theo:

1. Xem cây tờ. Đầu tiên là sơ đồ tổng E.600, sau đó là các tờ tủ; tủ nhiều tờ hiện (1/2), (2/2).
2. Xem bản vẽ từng tờ, bảng tính từng mạch và danh sách lỗi/cảnh báo.
3. Tải xuống:
   - từng tờ: DXF 2007, DXF R12 hoặc SVG;
   - cả bộ ZIP: gồm bảng tính Excel, nhãn, thuyết minh, BOQ và JSON dự án.
4. Bấm **In nhãn** để mở trang in danh mục mạch dán cánh tủ và nhãn cáp. Bấm **Nhãn Excel** để tải bảng nhãn cho máy in nhãn.
5. Bấm **Thuyết minh Word** để tải thuyết minh tính toán (`.docx`), hoặc **Xem thuyết minh** để mở trang in (In / Lưu PDF). Nội dung:
   1. căn cứ thiết kế;
   2. nguồn điện và giải pháp cấp điện;
   3. phương pháp tính, ghi kèm tham số của bộ quy tắc;
   4. tổng hợp phụ tải;
   5. tính toán chi tiết từng tủ: bảng từng mạch đặt trang ngang, lý do tăng tiết diện;
   6. kiểm tra và kết luận: lỗi, cảnh báo, ghi đè có lý do, giả định, ô ký.
6. Bấm **BOQ Excel** để tải bảng khối lượng vật tư điện. File có 3 sheet:
   - `BOQ`: 4 nhóm — thiết bị đóng cắt; vỏ tủ và phụ kiện (SPD, đèn báo pha, đồng hồ + CT, ATS); dây và cáp; ống, máng. Dây, cáp, ống đã cộng hao hụt 5%;
   - `Bang gia`: mỗi dòng BOQ một khóa. Điền mã hàng, đơn giá, chiết khấu vào đây thì sheet BOQ tự tra giá và tính thành tiền, tổng cộng;
   - `Chi tiet`: từng tủ, từng mạch đóng góp vào mỗi dòng BOQ, để kiểm lại khối lượng.
7. Bấm **Nạp bóc khối…** để nạp bảng DATAEXTRACTION (`.xlsx` / `.csv`) từ mặt bằng điện AutoCAD:
   - block có thuộc tính `TU`, `MACH`, `CS`: công suất từng mạch tính lại theo số lượng × W, mạch chưa có thì tạo mới;
   - block chỉ có tên: đếm số lượng theo loại / layer / phòng;
   - block điện nhẹ (thuộc tính `TANG`, `PHONG`, `RACK`, `VUNG`, `CS` cho loa): đếm theo phòng và điền vào bảng điện nhẹ; không sửa mạch điện. Loại nào có trên mặt bằng thì thay số cũ, loại khác và chiều dài, rack giữ nguyên; phòng mới cần nhập chiều dài cáp;
   - block lạ được liệt kê trong mục Kiểm tra; nút **Báo cáo bóc khối** tải `boc-khoi.xlsx` (có sheet `Dien nhe` ghi số cũ → mới); BOQ có thêm nhóm thiết bị điện (thiết bị điện nhẹ tính ở nhóm F, không đếm hai lần).
   Cách chuẩn hóa block và các bước xuất: `.claude/skills/so-do-nguyen-ly/tham-khao.md` § 8. File thử: `mau/vi-du-boc-khoi/`.
8. Chế độ **Nhập liệu** (cạnh Bản vẽ / Bảng tính / Kiểm tra): sửa khung tên, bảng tủ và bảng mạch của tủ đang chọn ngay trên web.
   - Sửa ô rồi bấm Tab / Enter: bản vẽ, bảng tính, thuyết minh, BOQ tính lại ngay; dòng có lỗi tô màu.
   - Thêm / xóa / nhân bản / di chuyển mạch; thêm, xóa tủ; đổi mã tủ thì mạch và tủ con đi theo.
   - Bắt đầu từ file Excel, ví dụ, JSON của agent, hoặc nút **Dự án trống** (1 tủ).
9. **Dự án chung của team** (cần đăng nhập bằng tài khoản app M&M Báo giá / FF&E):
   - màn đầu có danh sách dự án trên server: tên, chủ đầu tư, số tủ/mạch, bản mấy, ai lưu lúc nào; có ô tìm;
   - dự án đang mở (từ Excel, ví dụ, dự án trống) → **Lưu lên server**; sau đó nút **Lưu** (Ctrl+S) sáng lên khi có thay đổi, kèm ô ghi chú lần lưu;
   - mỗi lần lưu tăng số bản và chép bản cũ vào **Lịch sử**; khôi phục được bản bất kỳ (bản hiện tại vào lịch sử trước);
   - người khác vừa lưu trước anh → app **không ghi đè**, hỏi: mở bản mới của họ, hoặc vẫn lưu đè (bản của họ vẫn nằm trong Lịch sử);
   - rời trang khi chưa lưu thì trình duyệt hỏi lại. Tính toán vẫn chạy trên trình duyệt; dữ liệu chỉ lên server khi bấm Lưu.
10. **Gắn công trình chung với app Dự toán / FF&E** (cùng Firebase, app điện chỉ đọc hai danh sách này):
   - danh sách công trình = `baogia/main.projects` (app Dự toán) + `ffe_projects` (app FF&E), ghép theo tên như app FF&E (một công trình mang hai mã khác nhau vẫn là một dòng);
   - khi **Lưu lên server** chọn công trình (gợi ý theo tên dự án); dự án đang mở thì bấm **Gắn công trình / Đổi công trình** trên thanh dự án. Khung tên chỉ điền ô đang trống (tên dự án, chủ đầu tư);
   - thanh dự án có nút **Mở FF&E ↗** mở thẳng bảng kê FF&E của công trình (`FFE_URL` trong `app/firebase-config.mjs`; công trình chỉ có bên Dự toán thì FF&E tự tạo bảng kê rỗng khi mở);
   - danh sách dự án ghi công trình, tìm được theo tên công trình; nút **Theo công trình…** mở sơ đồ điện của công trình (chưa có thì tạo dự án trống gắn công trình đó);
   - link `…/dien/app/?congTrinh=<mã Dự toán | mã FF&E | tên>` làm việc tương tự — app khác có thể trỏ sang.

**Cài đặt Firebase cho dự án chung** (làm một lần, trên project `measure-and-make`):
- Firestore → Rules: cho phép người đã đăng nhập đọc/ghi collection `dien_projects` (nếu rule hiện tại chưa mở):
  ```
  match /dien_projects/{id} {
    allow read, write: if request.auth != null;
    match /history/{h} { allow read, write: if request.auth != null; }
  }
  ```
- Authentication → Settings → Authorized domains: thêm `spec-ffe.vercel.app`. Nếu API key có giới hạn theo trang web (Google Cloud → Credentials) thì thêm `https://spec-ffe.vercel.app/*`.
- Cấu hình nằm ở `app/firebase-config.mjs` (API key web của Firebase là công khai; bảo mật nằm ở rule và đăng nhập).
- Dữ liệu: `dien_projects/{id}` giữ tên, tóm tắt, `congTrinh` (liên kết công trình chung), `phienBan`, `updatedBy/At` và toàn bộ dữ liệu dự án dạng chuỗi JSON `duAnJson`; `dien_projects/{id}/history` giữ các bản cũ.
- Gắn công trình cần quyền **đọc** `baogia/main` và `ffe_projects` cho người đã đăng nhập — app FF&E đang đọc hai chỗ này bằng cùng tài khoản nên thường đã có. Không đọc được thì danh sách dự án báo lỗi, các phần khác vẫn chạy.
- Test tự động chạy với `?kho=thu` (kho trong bộ nhớ, đăng nhập bằng mật khẩu `thu`), không chạm Firebase.

**Điện nhẹ đợt 1 — mạng LAN / Wi-Fi, camera, tủ rack** (`engine/dien-nhe.mjs`, `template/dien-nhe.mjs`):
- **Đầu vào:**
  - sheet `Dien nhe`: mỗi dòng một phòng, gồm tầng, số ổ data, AP Wi-Fi, camera trong/ngoài, tủ rack phục vụ, chiều dài cáp TB;
  - sheet `Tu rack`: mã rack, tầng, tủ điện cấp nguồn, mã lộ có sẵn (trống thì công cụ tự thêm), L cáp nguồn, L trục về rack trung tâm, rack trung tâm;
  - trong JSON: `dienNhe: { phong, rack }`. Số tờ đầu ở ô `SO_BV_DN` (mặc định E.700).
- **Tính theo §8 của phương án, từng rack:**
  - ổ data đi switch thường, AP và camera đi switch PoE; số cổng có 20% dự phòng; ngân sách PoE = (AP 20 W + camera 10 W) × 1,2;
  - patch panel 24 cổng, kèm thanh quản lý cáp;
  - rack trung tâm có router, kệ modem, switch lõi; đầu ghi NVR (kênh, dung lượng = bitrate × ngày lưu, ổ 8 TB);
  - cỡ tủ = ΣU × 1,3; UPS = ΣW / 0,9 × 1,25;
  - mã cổng `<Tầng>-<Rack>-PP<n>-<cổng>` (TIA-606); cảnh báo khi Cat6 dài quá 90 m; trục dài quá 90 m thì dùng cáp quang.
- **Nguồn rack:** tự thêm mạch `DNn` "CẤP NGUỒN TỦ RACK Rx" (tải × 1,25) vào tủ điện cấp. Mạch này được chọn CB, cáp, tính ngắn mạch như mọi mạch khác. Hai bên ghi tham chiếu chéo.
- **Kết quả:**
  - tờ E.700 / E.701 / E.702…;
  - `dien-nhe.xlsx` (Tong hop, Thiet bi rack, Dau noi, Canh bao);
  - BOQ nhóm F (thiết bị rack, AP, camera, ổ data, cáp Cat6 tính theo mét có hao hụt, patch cord, trục);
  - thuyết minh mục 06 (mục kiểm tra thành 07);
  - web app có cây tờ E.7xx, bảng thiết bị rack / đấu nối cổng.

**Điện nhẹ đợt 2 — IPTV, chuông cửa IP, kiểm soát ra vào, âm thanh 100 V, KNX** (cùng các file trên):
- **Đầu vào:** các cột còn lại của sheet `Dien nhe` (ổ TV, cửa ACS, nút gọi chuông ngoài / màn hình chuông trong, số loa, W/loa, vùng âm thanh, thiết bị KNX tại phòng) và cột mới **`Điều khiển KNX`** ở sheet `Mach` (`Bật/tắt` | `Dimmer` | `Rèm`).
- **IPTV, chuông cửa:** đều đi mạng IP. Ổ TV là link Cat6 vào switch thường; nút gọi ngoài trời (PoE 6 W) và màn hình trong nhà (PoE 8 W) vào switch PoE. Có mã cổng, patch panel, BOQ như ổ data.
- **Kiểm soát ra vào (ACS):**
  - bộ điều khiển chọn cỡ 4 / 2 / 1 cửa, mỗi bộ một link Cat6 và nguồn 12 V kèm ắc quy (≈ 40 W, tính vào tải UPS), lắp cạnh tủ rack;
  - mỗi cửa: đầu đọc, khóa điện, nút exit, công tắc cửa, nút khẩn; cáp từng cửa theo chiều dài;
  - liên động báo cháy chỉ ghi chú (điểm giao tiếp).
- **Âm thanh 100 V:** gom loa theo cột vùng; ≤ 6 vùng và vừa cỡ thì dùng 1 ampli mixer chọn vùng, không thì mỗi vùng một ampli; ampli ≥ 1,25 × Σ công suất tap loa (cỡ 60 / 120 / 240 / 360 / 480 / 650 W). Ampli đặt ở rack, cấp nguồn bằng **mạch riêng** `DNn` "CẤP NGUỒN AMPLI ÂM THANH" (không qua UPS, ≈ 1,5 × công suất ra). Cáp loa chống cháy 2 × 1,5 = L + 4 m × số loa.
- **KNX:**
  - mỗi mạch đánh dấu là 1 kênh (rèm: số kênh = số lượng); mỗi tủ cộng 20% dự phòng rồi chọn actuator bật/tắt 4/8/12, dimmer 2/4, rèm 4/8 kênh;
  - **actuator nằm trong tủ điện của mạch**, module tính vào vỏ tủ; vượt vỏ thì cảnh báo và gợi ý tách tủ KNX riêng;
  - tủ gốc có nguồn bus (160 / 320 / 640 mA ≥ 1,2 × Σ 10 mA/thiết bị) và giao diện IP;
  - số line: mỗi line ≤ 64 thiết bị, dòng bus không vượt nguồn 640 mA, dây bus ≤ 1000 m; nhiều line thì mỗi line một IP router;
  - phím bấm / cảm biến lấy từ cột KNX của từng phòng; cáp bus J-Y(St)Y 2×2×0,8.
- **Kết quả thêm:** tờ nguyên lý âm thanh, kiểm soát ra vào & chuông cửa, topology KNX (chỉ ra khi hệ đó có dữ liệu); `dien-nhe.xlsx` thêm sheet `Am thanh`, `ACS chuong`, `KNX`; BOQ nhóm F thêm ampli, loa, cáp loa, bộ điều khiển và thiết bị cửa, chuông, ổ TV, actuator, phím KNX, cáp bus; thuyết minh mục 06 có các tiểu mục từng hệ.
- **Nhập liệu trên web:** ở tờ E.7xx, chế độ Nhập liệu sửa bảng phòng và bảng tủ rack (thêm / xóa dòng; đổi mã rack thì các phòng đi theo; không xóa được rack còn phòng). Bảng mạch có cột KNX.
  - Danh sách tờ chia hai nhánh **Tủ điện** (E.6xx) và **Điện nhẹ** (E.7xx). Trên điện thoại, danh sách này là ô chọn "Tờ bản vẽ" có hai nhóm như vậy.
  - Từ nhập liệu của tủ, nút "Nhập liệu điện nhẹ →" mở bảng điện nhẹ.
  - Dự án chưa có điện nhẹ: bấm "+ Thêm điện nhẹ" (trong nhánh Điện nhẹ, trong ô chọn tờ, hoặc cuối trang nhập liệu tủ). Công cụ thêm một rack và một phòng mẫu, rồi mở ngay bảng nhập.
- **Agent:** trong mô tả công trình thêm `"dienNhe": true` (hoặc `{ "tang": "T1", "acs": true }`) và `"knx": true`. Agent gợi ý số ổ data / TV / AP / camera / loa / chuông / cửa ACS theo loại phòng và diện tích (ghi "giả định"), đặt 1 rack ở tầng có tủ tổng; KNX thì đánh dấu mạch chiếu sáng, rèm và thêm phím ở từng phòng.
- **Bóc khối điện nhẹ (12/11/2026):** block ổ data / TV / AP / camera / chuông / đầu đọc ACS / loa / phím KNX trên mặt bằng tự điền bảng điện nhẹ theo phòng (xem mục web app bước 7 và tham-khao § 8). Ví dụ: `node tao-bo-ban-ve.mjs du-an/can-ho-3pn-3-pha/du-an.json out/x --boc-khoi mau/vi-du-boc-khoi/boc-khoi-dien-nhe.csv`.
- **Đợt sau:** gắn hãng thiết bị khi team chốt.

**Ngắn mạch, tự cắt nguồn, chọn lọc** (`engine/ngan-mach.mjs`, phương pháp tổng trở IEC 60909-0 rút gọn):
- **Nguồn:** Ik tại điểm đấu (sheet `Du an`, ô `IK_NGUON`; trống thì 6 kA và cảnh báo). Công trình có trạm riêng thì khai `MBA_KVA` (+ `MBA_UK`), công cụ tính Ik từ máy biến áp. Tủ có ô `Ik tại tủ` thì dùng số đó.
- **Ik3 max tại thanh cái từng tủ** giảm dần theo tổng trở cáp cấp (R = ρ20·L/S, X = λ·L), dùng để chọn và kiểm Icu. Tủ 1 pha tính sự cố pha – trung tính. Công cụ tính 2 lượt: lượt 1 chọn cáp, lượt 2 chọn lại Icu theo Ik vừa tính.
- **Ik1 min cuối từng mạch** (vòng pha – PE, ρ = 1,25·ρ20). Với sơ đồ TN (mặc định TN-S, ô `NOI_DAT`):
  - Ik1 min ≥ ngưỡng cắt từ của CB (B 5·In, C 10·In, D 20·In; MCCB 10·In +20%) thì đạt;
  - không đạt mà mạch có RCD thì RCD đảm nhận (ghi chú);
  - không có RCD thì **cảnh báo kèm đề xuất**: tiết diện đạt, MCB đường cong B, hoặc RCBO.
- **Sơ đồ TT:** mạch nào không có RCD thì cảnh báo.
- **Chọn lọc vùng ngắn mạch:** Ik3 tại thanh cái tủ so với ngưỡng cắt từ cận dưới của CB tổng và của lộ cấp ở tủ trên → toàn phần, hoặc một phần tới Is. Giới hạn thực tra bảng phối hợp của hãng.
- **MCCB chỉnh định:** ghi đè thiết bị kèm `Im=…A` (ví dụ `MCCB 3P 160A 25kA Im=1000A`). Hệ số mặc định nằm ở sheet `Quy tac`, ô `IM_MCCB`.
- **Kết quả:**
  - bảng tính có sheet `Ngan mach` (tổng trở, Ik3 max, Ik1 min, ngưỡng cắt từ, tự cắt nguồn, đề xuất), cột Ik ở `Tong hop` và các sheet tủ;
  - thuyết minh có mục 3.4, cột Ik ở mục 4–5, tổng kết tự cắt nguồn ở mục 6.4;
  - E.600 có cột `Ik (kA)`; web app hiện Ik3 / Ik1 ở đầu tờ tủ và cột Ik1 cuối mạch.

**Dòng lệnh:**

```bash
cd dien && npm install
node tao-bo-ban-ve.mjs mau/vi-du-HDMON.xlsx            # → out/vi-du-HDMON/
node tao-bo-ban-ve.mjs du-an.json                       # đầu vào JSON (dữ liệu dự án) cũng được
node tao-bo-ban-ve.mjs du-an.json out/x --bang-gia bang-gia.xlsx --hao-hut 5   # BOQ có giá (sheet "Bang gia")
node tao-bo-ban-ve.mjs du-an/can-ho-3pn-3-pha/du-an.json out/x --boc-khoi mau/vi-du-boc-khoi/boc-khoi-thuoc-tinh.csv   # bóc khối AutoCAD
node agent/goi-y-dau-vao.mjs agent/vi-du/mo-ta-biet-thu.json /tmp/du-an.json   # gợi ý đầu vào từ mô tả
python3 mau/tao_mau_nhap_lieu.py --tu-json du-an.json nhap-lieu.xlsx           # dữ liệu dự án → Excel nhập liệu
npm test                                               # 82 test
npm run kiem-tra-app                                   # test web app bằng Playwright
python3 mau/tao_mau_nhap_lieu.py                       # tạo lại 2 file Excel mẫu + bo-quy-tac.xlsx (cần node)
```

## Thư mục

| Thư mục / file | Nội dung |
|---|---|
| `mau/nhap-lieu-tu-dien.xlsx` | **File Excel nhập liệu v2**, ví dụ là tủ DB-T1 trong phương án (mục 7) |
| `mau/vi-du-HDMON.xlsx` | Ví dụ dựng theo bộ mẫu E.601–E.606: T1 cấp cho T2–T6. **Công suất và chiều dài là số giả định** |
| `mau/bo-quy-tac.xlsx` | **Bộ quy tắc để kỹ sư điện duyệt**: thông số, loại mạch, bảng tra, quy tắc trong code, giả định của agent |
| `mau/tao_mau_nhap_lieu.py` | Script tạo 2 file Excel trên |
| `engine/` | **Lõi tính toán** (JavaScript thuần, chạy được cả trên Node và trình duyệt), xem bảng dưới |
| `bo-ban-ve.mjs` | Phần dùng chung: dữ liệu dự án → kết quả tính → sơ đồ tổng + các tờ tủ (SVG/DXF) + nhãn |
| `tao-bo-ban-ve.mjs` | Lệnh tạo cả bộ: Excel → `E.600-TONG.*`, `E.601-T1.dxf`, `E.601-T1-R12.dxf`, `E.601-T1.svg`… + `bang-tinh.xlsx`, `nhan.xlsx`, `nhan-tu.html`, `thuyet-minh.docx`, `thuyet-minh.html`, `du-an.json`, `canh-bao.txt` |
| `out/vi-du-HDMON/` | Bộ 7 tờ (E.600–E.606) và các file nhãn, tạo từ file ví dụ HDMON. ezdxf audit 0 lỗi |
| `app/` | Web app (`index.html`, `app.mjs`), chế độ Nhập liệu (`nhap-lieu.mjs`), kho dự án chung Firebase / bộ nhớ (`kho.mjs`, `firebase-config.mjs`) và test Playwright `kiem-tra-app.mjs` |
| `template/` | Template trình bày theo mẫu E.601. Từ dữ liệu tờ vẽ xuất DXF + SVG, cho tờ tủ (`mau-indust.mjs`), tờ sơ đồ tổng (`so-do-tong.mjs`) và tờ điện nhẹ E.7xx (`dien-nhe.mjs`). Xem [`template/README.md`](template/README.md) |
| `so-sanh-mau-E601-E606.md` | **Báo cáo so sánh** lựa chọn của bản mẫu với quy tắc. Có các mục cần kỹ sư điện chốt |
| `spike/` | File DXF thử tiếng Việt để mở trên AutoCAD |

## Lõi tính toán `engine/`

| File | Việc làm (theo mục 6 của phương án) |
|---|---|
| `danh-muc-quy-tac.mjs` | Danh mục bộ quy tắc: mã, tên, đơn vị, căn cứ, nguồn gốc từng thông số và bảng tra — dùng sinh sheet `Quy tac` và đọc lại |
| `quy-tac.mjs` | Bộ quy tắc mặc định (**chưa duyệt**): Uf/Ud, ρ, λ, k1 ở 35 °C, giới hạn ΔU (5% / chiếu sáng 3% / tới thanh cái tủ 2%), Kđt, hệ số chọn In 1,25, tỷ số chọn lọc 1,6, bảng Iz IEC 60364-5-52, k2, định mức CB, module, vỏ tủ, ống |
| `mach.mjs` | Ib → CB/RCBO (theo loại mạch **và** loại khu vực) → cáp (Iz′, ΔU cộng dồn, tiết diện tối thiểu, PE) → ống; đọc thiết bị/cáp ghi đè |
| `can-pha.mjs` | Cân pha A/B/C, giữ mạch đã khóa pha |
| `tu.mjs` | Tổng hợp tủ (Pđ, Kđt, Ptt, dòng từng pha), CB tổng, đếm module, chọn vỏ |
| `cay-tu.mjs` | Tính cả cây tủ: từ tủ lá lên tủ gốc (tải, thiết bị), rồi từ gốc xuống (cáp, sụt áp cộng dồn) |
| `kiem-tra.mjs` | Lỗi / cảnh báo / ghi chú theo mục 6.8 |
| `ngan-mach.mjs` | Ngắn mạch theo tổng trở: Ik3 max thanh cái, Ik1 min cuối mạch, tự cắt nguồn (TN/TT), chọn lọc vùng ngắn mạch |
| `dien-nhe.mjs`, `dien-nhe-excel.mjs` | Điện nhẹ: switch, PoE, patch panel, NVR, rack, UPS, mã cổng, IPTV, chuông IP, ACS, âm thanh 100 V, KNX (actuator vào tủ điện), nguồn rack / ampli vào tủ điện; dữ liệu tờ E.7xx; `dien-nhe.xlsx` |
| `doc-excel.mjs` | Đọc file Excel theo tên sheet và tiêu đề cột, kể cả sheet `Quy tac` |
| `sang-ban-ve.mjs` | Kết quả → dữ liệu tờ vẽ, ghi chữ theo kiểu bản mẫu (`Cu/PVC 2(1x2,5)mm2 + E(1x2,5)mm2`, `ỐNG PVC  Ø 20`, `Pđ=… kW, Kđt=…`). Có thêm:<br>• tự ngắt tờ (`chiaTo`: nhóm RCBO không bị tách giữa hai tờ);<br>• đánh số tờ;<br>• dữ liệu sơ đồ tổng (`sangSoDoTong`) |
| `nhan.mjs` | Danh mục mạch dán cánh tủ và nhãn cáp (mỗi cáp 2 bản). Xuất Excel và trang HTML in |
| `xuat-excel.mjs` | Bảng tính: sheet Tong hop, mỗi tủ một sheet, Cap va ong, Canh bao, Quy tac |
| `dien-giai.mjs` | Định dạng số và diễn giải cách chọn tiết diện / ống. Bảng tính và thuyết minh dùng chung |
| `thuyet-minh.mjs` | Thuyết minh tính toán: dựng nội dung một lần (`noiDungThuyetMinh`), xuất trang HTML in ra PDF (`thuyetMinhHtml`) cùng kiểu trình bày với bản Word |
| `boc-khoi.mjs` | Bóc khối AutoCAD: `docBocKhoi` đọc DATAEXTRACTION (.csv/.xlsx, nhận cột theo tiêu đề), `apDungBocKhoi` ghi công suất mạch / tạo mạch mới / đếm số lượng / điền bảng điện nhẹ theo phòng, báo block lạ; `xuatBaoCaoBocKhoi` ra `boc-khoi.xlsx` |
| `quy-doi-block.mjs` | Bảng quy đổi tên block → loại thiết bị, W (bảng mẫu, sửa theo thư viện block công ty; nạp bảng riêng bằng `--quy-doi`) |
| `boq.mjs` | BOQ điện: `tinhBoq` bóc khối lượng (không tính trùng cáp cấp tủ con, cộng hao hụt), `docBangGia` đọc bảng giá Excel, `xuatBoqExcel` ra file có công thức tra giá |
| `thuyet-minh-docx.mjs` | Xuất cùng nội dung ra Word bằng thư viện `docx`, trình bày theo mẫu văn bản Indust Design: Arial, cam `#F15A22` / xanh than `#22333B`, khối thông tin 3×2, đề mục có vạch cam, bảng dùng Table Style băng màu thật của Word, chân trang "Indust Design \| … \| Working Document" kèm số trang. Bảng rộng đặt trang ngang |
| `tests/` | Tái lập đúng ví dụ DB-T1 (mục 7: CB tổng 40 A, cáp cấp 4×6, ΔU lớn nhất 2,95%, lệch pha 1,8%, vỏ 36 module) và các ca kiểm tra |

## Quy ước nhập liệu chính

- **Du an:** điền các trường khung tên. `SO_BV_DAU` là số tờ tủ đầu (E.601). `SO_BV_TONG` là số tờ sơ đồ tổng; để trống thì lấy số liền trước tờ tủ đầu (E.600).
- **Tu dien:** mỗi dòng là một tủ; tủ quá 18 lộ tự ngắt thêm tờ. "Cấp từ tủ" dựng cây tủ. Công cụ tự tạo lộ cấp tủ con ở tủ trên: mã lấy theo cột "Mã lộ cấp", vị trí theo cột "Đặt sau lộ".
- **Mach:** mỗi dòng là một lộ ra, ghi mã lộ (`L1`, `S1`, `AC1`, `WH1`…) và chữ phụ tải như trên bản vẽ. Để trống Pha thì công cụ tự cân pha.
- **Loại khu vực** `Ướt (WC, tắm)` hoặc `Ngoài nhà` bắt buộc RCD 30 mA cho mọi mạch trong khu vực đó.
- **Ghi đè** thiết bị, cáp, ống, hoặc **nhóm RCD** (một RCBO cho nhiều mạch như bản mẫu): luôn ghi lý do. Công cụ vẫn kiểm tra giá trị ghi đè và đưa vào danh sách cảnh báo/ghi chú.
