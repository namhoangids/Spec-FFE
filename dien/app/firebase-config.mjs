// Cấu hình Firebase của project "measure-and-make" — dùng chung với app M&M Báo giá và FF&E (cùng tài khoản đăng nhập).
// Cấu hình web của Firebase là công khai theo thiết kế (đã có trong mã nguồn app M&M trên GitHub Pages);
// bảo mật nằm ở Firestore rules: chỉ tài khoản đã đăng nhập mới đọc/ghi được collection dien_projects.
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA_Y6PO-kZdxJWguNreckXSLmv0uuhnIhg",
    authDomain: "measure-and-make.firebaseapp.com",
    projectId: "measure-and-make",
    storageBucket: "measure-and-make.firebasestorage.app",
    messagingSenderId: "479798101633",
    appId: "1:479798101633:web:fb6f03e3bbac6cf6842f80"
  };

// Phiên bản SDK compat, cùng bản app M&M đang dùng
export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.13.2";
