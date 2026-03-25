# Xây dựng ứng dụng chat trực tuyến

Đây là đồ án môn học xây dựng ứng dụng web chat trực tuyến theo mô hình client-server, hỗ trợ nhắn tin theo thời gian thực và quản lý hệ thống bằng trang admin.

## Thông tin đồ án

- Tên đồ án: `Xây dựng ứng dụng chat trực tuyến`
- Tên ứng dụng: `ChatRealtime`
- Tác giả: `Nguyễn Ngọc Minh`
- Lớp: `TH29.23`

## Giới thiệu

`ChatRealtime` là một ứng dụng chat trực tuyến được xây dựng phục vụ mục đích học tập, demo và báo cáo đồ án. Hệ thống cho phép người dùng đăng ký tài khoản, đăng nhập, vào phòng chat, gửi và nhận tin nhắn theo thời gian thực. Bên cạnh đó, hệ thống còn có khu vực quản trị riêng để admin theo dõi phòng chat, người dùng và các thông tin tổng quan của hệ thống.

Đề tài được xây dựng theo hướng gọn nhẹ, dễ cài đặt, dễ demo nhưng vẫn thể hiện được những thành phần quan trọng của một phần mềm web thực tế như:

- xử lý xác thực đăng nhập
- quản lý phiên làm việc bằng cookie
- giao tiếp client-server
- realtime chat thông qua Socket.io
- lưu trữ dữ liệu bằng SQLite
- phân quyền `admin` và `user`

## Mục tiêu của đề tài

Đồ án hướng tới các mục tiêu chính sau:

- Xây dựng một ứng dụng chat web có thể hoạt động thực tế trên localhost.
- Áp dụng kiến thức về frontend, backend, cơ sở dữ liệu và lập trình theo sự kiện.
- Triển khai chức năng chat realtime giữa nhiều người dùng trong cùng một phòng.
- Lưu lịch sử tin nhắn để có thể tải lại khi người dùng vào lại phòng chat.
- Tạo khu vực admin để quản lý phòng chat và tài khoản người dùng.

## Công nghệ sử dụng

Hệ thống được xây dựng bằng các công nghệ chính sau:

- `Node.js`: xử lý backend và khởi tạo server.
- `Express`: định nghĩa route và xử lý request/response.
- `Socket.io`: hỗ trợ giao tiếp hai chiều và nhắn tin theo thời gian thực.
- `SQLite`: lưu trữ dữ liệu người dùng, phòng chat và tin nhắn.
- `HTML, CSS, JavaScript`: xây dựng giao diện người dùng và giao diện quản trị.
- `crypto.scrypt` của Node.js: băm mật khẩu trước khi lưu vào cơ sở dữ liệu.

## Chức năng chính

### 1. Chức năng người dùng

- Đăng ký tài khoản mới với các trường: họ và tên, username, email, mật khẩu.
- Tự động đăng nhập sau khi đăng ký thành công.
- Đăng nhập bằng `username` hoặc `email`.
- Đăng xuất tài khoản.
- Xem trang chủ, trang giới thiệu và trang tính năng.
- Vào phòng chat theo danh sách phòng có sẵn.
- Gửi và nhận tin nhắn theo thời gian thực.
- Tải lại lịch sử tin nhắn của từng phòng.
- Hỗ trợ chế độ `chat demo` không cần đăng ký thủ công.

### 2. Chức năng phòng chat

- Có bảng `rooms` để quản lý danh sách phòng chat.
- Hỗ trợ phòng mặc định `room-2-users`.
- Admin có thể tạo phòng mới.
- Admin có thể xóa phòng chat.
- Khi xóa phòng, tin nhắn trong phòng đó cũng được xóa theo.
- Nếu người dùng đang ở trong phòng bị xóa, hệ thống gửi sự kiện realtime để xử lý trên giao diện.

### 3. Chức năng quản trị

- Trang đăng nhập admin riêng.
- Dashboard quản trị hiển thị thống kê nhanh.
- Quản lý phòng chat bằng trang riêng.
- Quản lý user bằng trang riêng.
- Khóa và mở khóa tài khoản.
- Xóa tài khoản người dùng.
- Đổi quyền `user` thành `admin` và ngược lại.
- Theo dõi trạng thái `online/offline`.
- Hiển thị phòng hiện tại của user nếu có.
- Phân trang danh sách user, mỗi trang 10 dòng.

## Giao diện trong hệ thống

Ứng dụng hiện có các trang giao diện chính sau:

- `/` : Trang chủ
- `/gioi-thieu` : Trang giới thiệu
- `/tinh-nang` : Trang tính năng
- `/dang-nhap` : Đăng nhập người dùng
- `/dang-ky` : Đăng ký tài khoản
- `/chat` : Khu vực phòng chat
- `/demo-chat` : Đăng nhập nhanh bằng tài khoản demo
- `/admin/login` : Đăng nhập admin
- `/admin/dashboard` : Dashboard quản trị
- `/admin/rooms-page` : Quản lý phòng chat
- `/admin/users-page` : Quản lý user

## Kiến trúc tổng quát

Hệ thống được thiết kế theo mô hình `client-server`.

- `Frontend` chạy trên trình duyệt, hiển thị giao diện và gửi yêu cầu lên server.
- `Backend` xử lý route, kiểm tra xác thực, quản lý session, xử lý logic admin và socket realtime.
- `SQLite` lưu dữ liệu hệ thống.
- `Socket.io` được dùng cho các tác vụ cần cập nhật tức thời như gửi tin nhắn, tham gia phòng, rời phòng, cập nhật trạng thái online và sự kiện phòng bị xóa.

Mô hình xử lý:

1. Người dùng thao tác trên trình duyệt.
2. Frontend gửi request HTTP hoặc sự kiện Socket.io.
3. Backend xử lý nghiệp vụ.
4. Dữ liệu được đọc/ghi vào SQLite.
5. Kết quả trả về giao diện.

## Cơ sở dữ liệu

Hệ thống sử dụng file SQLite tại:

`backend/database/database.db`

### Bảng `users`

Lưu thông tin tài khoản người dùng và admin:

- `id`
- `username`
- `full_name`
- `email`
- `password_hash`
- `role`
- `is_active`
- `created_at`

### Bảng `rooms`

Lưu danh sách phòng chat:

- `id`
- `room_name`
- `created_by`
- `created_at`

### Bảng `messages`

Lưu lịch sử tin nhắn:

- `id`
- `room_id`
- `sender`
- `content`
- `created_at`

## Cấu trúc thư mục

```text
chat-application/
|-- backend/
|   |-- database/
|   |   `-- database.db
|   |-- routes/
|   |   |-- admin.routes.js
|   |   |-- auth.routes.js
|   |   |-- messages.routes.js
|   |   `-- rooms.routes.js
|   |-- sockets/
|   |   `-- chat.socket.js
|   |-- utils/
|   |   `-- auth.helpers.js
|   `-- server.js
|-- frontend/
|   |-- assets/
|   |   `-- images/
|   |       `-- logo.png
|   `-- public/
|       |-- home.html
|       |-- gioi-thieu.html
|       |-- tinh-nang.html
|       |-- login.html
|       |-- register.html
|       |-- index.html
|       |-- admin-login.html
|       |-- admin-dashboard.html
|       |-- admin-rooms.html
|       |-- admin-users.html
|       |-- style.css
|       |-- home.js
|       |-- auth.js
|       |-- script.js
|       |-- admin-login.js
|       |-- admin-dashboard.js
|       |-- admin-rooms.js
|       `-- admin-users.js
|-- package.json
|-- package-lock.json
`-- README.md
```

## Hướng dẫn cài đặt và chạy dự án

### 1. Yêu cầu môi trường

Cần cài sẵn:

- `Node.js`
- `npm`

Kiểm tra phiên bản:

```bash
node -v
npm -v
```

### 2. Cài đặt package

Mở terminal tại thư mục project:

```bash
cd chat-application
npm install
```

### 3. Chạy server

```bash
node backend/server.js
```

Mặc định hệ thống chạy tại:

```text
http://localhost:3008
```

Nếu port `3008` đang bị chiếm bởi một server khác, cần tắt server cũ trước khi chạy lại đúng project này.

## Tài khoản mặc định để demo

### Tài khoản admin

- Username: `admin`
- Email: `admin@chatrealtime.local`
- Password: `Admin@12345`

### Tài khoản demo

- Username: `demo_user`
- Email: `demo@chatrealtime.local`
- Password: `Demo@12345`

Hoặc có thể vào trực tiếp:

```text
http://localhost:3008/demo-chat
```

## Các API và route chính

### Route công khai

- `GET /` : trang chủ
- `GET /gioi-thieu` : trang giới thiệu
- `GET /tinh-nang` : trang tính năng
- `GET /dang-nhap` : trang đăng nhập
- `GET /dang-ky` : trang đăng ký
- `GET /chat` : trang phòng chat, yêu cầu đăng nhập
- `GET /demo-chat` : vào nhanh bằng tài khoản demo
- `GET /health` : kiểm tra server đang hoạt động

### API xác thực người dùng

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### API phòng chat và tin nhắn

- `GET /rooms`
- `GET /messages/:roomId`

### API admin

- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin/me`
- `GET /admin/rooms`
- `POST /admin/rooms`
- `DELETE /admin/rooms/:id`
- `GET /admin/users`
- `PATCH /admin/users/:id/status`
- `PATCH /admin/users/:id/role`
- `DELETE /admin/users/:id`

## Luồng hoạt động chính

### 1. Đăng ký và đăng nhập

Người dùng tạo tài khoản mới, hệ thống lưu dữ liệu vào bảng `users`, băm mật khẩu bằng `crypto.scrypt`, sau đó tự động tạo session và chuyển người dùng về trang chủ.

### 2. Vào phòng chat

Người dùng đăng nhập, mở trang `/chat`, chọn một phòng có sẵn và tham gia phòng đó. Frontend sẽ kết nối đến Socket.io để bắt đầu giao tiếp realtime.

### 3. Gửi tin nhắn realtime

Khi người dùng gửi tin:

- frontend phát sự kiện `send_message`
- backend kiểm tra session và phòng chat
- tin nhắn được lưu vào bảng `messages`
- server phát sự kiện `receive_message` cho tất cả thành viên trong phòng

### 4. Quản lý hệ thống

Admin đăng nhập vào `/admin/login`, sau đó có thể truy cập dashboard, quản lý phòng chat và quản lý user.

## Điểm nổi bật của dự án

- Có giao diện người dùng và giao diện admin tách riêng.
- Hỗ trợ phòng chat nhiều phòng thay vì một phòng duy nhất.
- Có lưu lịch sử tin nhắn bằng SQLite.
- Có seed tài khoản admin và tài khoản demo để dễ báo cáo.
- Có phân quyền `admin/user`.
- Có tính năng đổi role trực tiếp trên trang quản lý user.
- Có cập nhật trạng thái online/offline.
- Có phân trang danh sách user.
- Có trang chủ, giới thiệu, tính năng và footer đầy đủ để demo trên GitHub và báo cáo.

## Hạn chế hiện tại

Do là phần mềm đồ án và bản thử nghiệm, hệ thống vẫn còn một số giới hạn:

- Chưa hỗ trợ gửi file, gửi ảnh, emoji hoặc thông báo nâng cao.
- Chưa tối ưu để triển khai cho số lượng người dùng lớn.
- Cơ sở dữ liệu SQLite phù hợp demo và học tập hơn là hệ thống quy mô lớn.
- Bảo mật hiện tại ở mức cơ bản, chưa có những cơ chế nâng cao như refresh token, CSRF protection hay phân tích log chuyên sâu.

## Hướng phát triển

Trong tương lai, dự án có thể được mở rộng thêm:

- Gửi file, hình ảnh và emoji trong đoạn chat
- Tìm kiếm tin nhắn
- Thêm avatar người dùng
- Nâng cấp cơ sở dữ liệu sang MySQL hoặc PostgreSQL
- Tối ưu giao diện trên mobile
- Bổ sung thông báo realtime đầy đủ hơn
- Mở rộng dashboard thống kê cho admin

## Đánh giá tổng quan

Dự án `Xây dựng ứng dụng chat trực tuyến` đã hoàn thành được những chức năng cốt lõi của một hệ thống chat realtime có quản lý cơ bản. Đây là một sản phẩm phù hợp với mục đích học tập, làm đồ án, demo trên lớp và nộp source code lên GitHub cho giảng viên theo dõi.

README này được viết để giúp thầy cô và người xem repository nhanh chóng nắm được:

- mục tiêu của đề tài
- công nghệ sử dụng
- chức năng đã hoàn thành
- cách chạy project
- thông tin tài khoản demo
- cấu trúc tổng quát của mã nguồn

## Thông tin tác giả

- Họ và tên: `Nguyễn Ngọc Minh`
- Lớp: `TH29.23`
- Tên đồ án: `Xây dựng ứng dụng chat trực tuyến`

