STEAMBUSINESS — WEBSITE TƯƠNG TÁC KHÔNG CẦN POWER BI SERVICE
==========================================================

QUAN TRỌNG
Đây là website tái dựng bằng JavaScript/ECharts dựa vào file dự án Power BI
SteamBusiness.Report.rar và SteamBusiness.SemanticModel.rar, KHÔNG phải việc
chạy trực tiếp file .pbix/.pbip trên web, và KHÔNG đảm bảo pixel-perfect hoặc
hoạt động DAX 100% giống Power BI Desktop.

NHỮNG GÌ ĐÃ ĐỐI CHIẾU VỚI DỰ ÁN POWER BI GỐC
- Sáu trang báo cáo: Tổng quan kinh doanh; Giá & thương mại; Thị trường &
  tương tác; Phân cấp danh mục; Bản đồ nhà phát hành; Hàm ý quản trị.
- Trang hỗ trợ chi tiết quốc gia từ bản Power BI được mở qua trang bản đồ.
- Phân cấp nhà phát hành → nhà phát triển → trò chơi.
- Bộ lọc năm phát hành, thể loại CHÍNH, nhóm giá và quốc gia nhà phát hành.
- Bảy nhóm giá đúng theo nguồn Power Query: Miễn phí, <£5, £5–9.99,
  £10–19.99, £20–29.99, £30–59.99, £60+.
- Định nghĩa chỉ số quan trọng: số trò chơi, lượt sở hữu ước tính,
  tỷ lệ đánh giá tích cực có trọng số, giá trị gộp và hai cận giá trị gộp,
  trung vị giá trò chơi trả phí, trung vị thời gian chơi theo trò chơi,
  độ bao phủ ánh xạ địa lý và tỷ trọng 10 trò chơi đứng đầu.
- Tông xanh sáng theo dự án.

CÁCH UPLOAD NETLIFY (KHÔNG CẦN GITHUB)
1. Giải nén ZIP; thư mục SteamBusiness_Web chứa index.html, app.js, style.css,
   thư mục data.
2. Truy cập https://app.netlify.com/drop và đăng nhập Netlify.
3. Kéo CẢ THƯ MỤC SteamBusiness_Web vào Netlify Drop.
4. Nhận link *.netlify.app, mở kiểm tra các biểu đồ và bộ lọc trước khi gửi giáo viên.

QUAN TRỌNG VỀ DỮ LIỆU
- Website lần lượt thử tải data/steam.csv trong chính website, sau đó thử
  bản CSV công khai đã sử dụng trong Power BI:
  https://raw.githubusercontent.com/jsngn/steam-machine-learning/master/steam.csv
  và một CDN dự phòng cho cùng repository.
- File CSV nguồn 27.075 trò chơi KHÔNG nằm trong gói ZIP này vì chưa tải được
  nguồn ở môi trường tạo website. Hai file RAR được tải lên chứa CẤU TRÚC
  mô hình và cache nhị phân, không phải tệp CSV thô phục vụ chạy JS trực tiếp.
- Để giáo viên mở link là thấy số liệu một cách ổn định, hãy TẢI CSV này về,
  đặt nó trong thư mục SteamBusiness_Web/data/steam.csv rồi upload lại lên Netlify.
  Nếu không, trang vẫn có cơ chế tải CSV từ nguồn công khai nhưng có thể lỗi
  nếu nguồn bị chặn, thay đổi hoặc gặp sự cố.
- Chức năng “Nạp CSV” trên website chỉ nạp vào trình duyệt hiện tại,
  KHÔNG tự đưa dữ liệu lên Netlify cho giáo viên.
- Không có dữ liệu giả hoặc mock đi kèm gói triển khai.
- Thư viện ECharts tải từ CDN: cần có kết nối Internet.

GIỚI HẠN PHƯƠNG PHÁP
- Chỉ tiêu giá trị gộp = giá (GBP) × trung điểm khoảng lượt sở hữu, không phải
  doanh thu/lợi nhuận thực tế. Năm phát hành không phải năm bán hàng.
- Tỷ lệ tích cực = tổng đánh giá tích cực / tổng đánh giá (trong phạm vi lọc).
- Địa lý dựa trên nhà phát hành đầu tiên khớp chính xác bảng ánh xạ;
  không phải địa lý người chơi. Bảng ánh xạ còn cần xác minh tài liệu nguồn.
- Dữ liệu là ảnh chụp lịch sử khoảng năm 2019, không đại diện cho thị trường 2026.
- Website không biên dịch hoặc chạy DAX. Một số điểm khác biệt với Power BI
  Desktop có thể còn tồn tại, đặc biệt với mô hình bộ lọc phức tạp và tooltip.

KIỂM THỬ
- Đã kiểm thử sáu trang, bộ lọc thể loại/quốc gia, mở chi tiết quốc gia,
  phân cấp 3 cấp và các chỉ số bằng CSV THỬ có 49 dòng; không có lỗi JavaScript.
- Chưa đối chiếu trên toàn bộ 27.075 dòng CSV thực tế hoặc chạy render ECharts
  đầy đủ trong môi trường này. Bắt buộc kiểm tra sau khi đưa lên Netlify.
