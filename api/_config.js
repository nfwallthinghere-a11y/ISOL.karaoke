'use strict';
/*
 * Cấu hình ghi thẳng vào code — dùng thay cho biến môi trường trên Vercel nếu muốn.
 *
 * File này chỉ chạy ở MÁY CHỦ, trình duyệt không bao giờ tải được nó, nên khoá bí mật
 * để ở đây không lộ ra cho người vào phòng. Nhưng nó NẰM TRONG REPO: ai xem được repo
 * là xem được khoá. Dán khoá vào đây thì repo phải để chế độ Private.
 *
 * Thứ tự ưu tiên: biến môi trường trên Vercel > file này. Đặt cả hai thì biến môi trường thắng,
 * nên có thể để sẵn giá trị thử ở đây rồi ghi đè khi chạy thật.
 *
 * TUYỆT ĐỐI KHÔNG dán mấy khoá này vào index.html: file đó gửi thẳng tới trình duyệt.
 */
module.exports = {
  /* Kho bài hát — chỉ là link sheet đã chia sẻ công khai, không phải bí mật */
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/1vG34NBLiQJJKD0Z_a2atMlGsL0u5Y_27-ZeCtH9jbaA/edit?usp=sharing',

  /* Lưu donate vào Google Sheet qua Apps Script */
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwvnmYzzpMBN62cL4oo3iPHVQPmgjBZYxk0qEWv2pX6DE8DlKRyrp1gnPE_YVLqbC7V/exec',
  GAS_SECRET: '',         // <<< ĐIỀN NỐT: đúng chuỗi SECRET trong Script properties.
                          // Chưa có dòng này thì donate không ghi được vào Sheet.

  /* Tuỳ chọn */
  ADMIN_KEY: '',          // khoá gọi API duyệt donate
  IP_SALT: '',            // muối băm IP người donate
  YT_API_KEY: '',         // tự tìm video karaoke theo tên

  /* TURN riêng khi mạng hay chặn P2P */
  TURN_URL: '',
  TURN_USERNAME: '',
  TURN_CREDENTIAL: '',

  /* PeerServer riêng thay máy chủ tín hiệu công cộng */
  PEER_HOST: '', PEER_PORT: '', PEER_PATH: '', PEER_KEY: '', PEER_SECURE: '',

  /* Lưu bền bảng xếp hạng + phòng (Vercel KV / Upstash) */
  KV_REST_API_URL: '',
  KV_REST_API_TOKEN: '',
};
