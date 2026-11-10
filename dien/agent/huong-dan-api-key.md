# Hướng dẫn tạo API key Anthropic (để dành cho khung chat trên web)

> **Hiện chưa cần.** Agent đang chạy dưới dạng skill trong Claude Code (`.claude/skills/so-do-nguyen-ly`), dùng gói Claude anh đang có. API key chỉ cần khi muốn đưa agent thành **khung chat trong web app** `/dien/app` cho cả team dùng qua trình duyệt.

## 1. Tạo tài khoản và key

1. Vào **https://platform.claude.com** và đăng ký bằng email công ty. Tài khoản này tách riêng với gói Claude cá nhân.
2. Vào **Settings → Billing**, thêm thẻ và nạp tiền trả trước. Nên đặt thêm giới hạn chi tiêu theo tháng (**Limits**).
3. Vào **Settings → API Keys**, chọn **Create Key**, đặt tên ví dụ `spec-ffe-so-do`, rồi sao chép key (bắt đầu bằng `sk-ant-`).
   - Key chỉ hiện **một lần**. Lưu vào trình quản lý mật khẩu.
   - Không dán key vào chat, vào code hay vào file trong repo.

## 2. Đặt key trên Vercel

1. Vercel → dự án **spec-ffe** → **Settings → Environment Variables**.
2. Thêm biến `ANTHROPIC_API_KEY`, giá trị là key vừa tạo, chọn môi trường **Production** và **Preview**.
3. **Redeploy** để biến có hiệu lực.

Key chỉ nằm phía máy chủ (Vercel Function), trình duyệt của người dùng không thấy key.

## 3. Chi phí ước tính

Một lượt vẽ trọn bộ gồm hỏi đáp, gợi ý đầu vào, tính và sửa vài lần. Ước khoảng vài chục nghìn token vào và vài nghìn token ra. Với Claude Opus 5.5 (4 USD / 1 triệu token vào, 20 USD / 1 triệu token ra), mỗi lượt khoảng **0,2–0,5 USD**.

Đây là ước tính sơ bộ. Chi phí thật tùy độ dài hội thoại và số lần sửa, theo dõi trong trang **Usage** của platform.claude.com.

## 4. Khi có key

Báo em để làm tiếp phần khung chat. Phần chat dùng lại nguyên:
- file mô tả công trình;
- bộ gợi ý đầu vào `dien/agent/goi-y-dau-vao.mjs`;
- lõi tính toán và template.

Chỉ cần thêm phần giao diện chat và một hàm máy chủ gọi Claude.
