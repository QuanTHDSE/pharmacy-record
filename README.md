# Pharmacy Records

Monorepo cho hệ thống hồ sơ nội bộ của nhà thuốc, sử dụng pnpm workspaces.

## Cấu trúc

```text
pharmacy-records/
├── apps/
│   ├── desktop/       # Tauri + React + TypeScript + Vite
│   └── api/           # NestJS + TypeScript + Prisma
├── packages/
│   └── shared/        # Chỉ chứa TypeScript types và constants dùng chung
├── docker-compose.yml # PostgreSQL phục vụ phát triển cục bộ
├── pnpm-workspace.yaml
└── package.json
```

## Yêu cầu môi trường

- Node.js 20.19+, 22.12+ hoặc 24.x (khuyến nghị Node.js 24 LTS; xem `.nvmrc`)
- pnpm 10 trở lên
- Docker Desktop
- Rust stable, Microsoft C++ Build Tools và WebView2 để chạy hoặc build Tauri trên Windows

## Cài đặt

```powershell
pnpm install
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/desktop/.env.example apps/desktop/.env
```

Các giá trị mật khẩu và `JWT_SECRET` trong tệp ví dụ chỉ dành cho môi trường phát triển.

## PostgreSQL

Khởi động PostgreSQL:

```powershell
pnpm db:up
```

Xem log:

```powershell
pnpm db:logs
```

Dừng container:

```powershell
pnpm db:down
```

PostgreSQL Docker mặc định chạy tại `localhost:5433`, database `pharmacy_records`. Cổng host
`5433` tránh xung đột với PostgreSQL cài trực tiếp thường sử dụng `5432`; bên trong container
PostgreSQL vẫn lắng nghe ở cổng `5432`.

Kiểm tra cấu hình Prisma và sinh client sau khi thêm model:

```powershell
pnpm --filter @pharmacy-records/api prisma:validate
pnpm db:generate
```

Tạo migration trong giai đoạn triển khai schema:

```powershell
pnpm db:migrate
```

Khởi tạo tài khoản quản trị từ các biến `ADMIN_*` trong `apps/api/.env`:

```powershell
pnpm db:seed
```

Seed có thể chạy lại an toàn: nếu email đã tồn tại, tài khoản được kích hoạt và gán lại quyền
`ADMIN`; mật khẩu hiện tại không bị ghi đè ngoài ý muốn.

### Kết nối Supabase PostgreSQL

Prisma sử dụng hai biến kết nối riêng khi chạy trên cloud:

```dotenv
# NestJS runtime: Supavisor transaction pooler
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<URL_ENCODED_DATABASE_PASSWORD>@<POOLER_HOST>:6543/postgres?pgbouncer=true"

# Prisma CLI và seed: Supavisor session pooler dành cho migration, introspection và Studio
DIRECT_URL="postgresql://postgres.<PROJECT_REF>:<URL_ENCODED_DATABASE_PASSWORD>@<POOLER_HOST>:5432/postgres"
```

Không commit mật khẩu database. Trên Railway, khai báo cả `DATABASE_URL` và `DIRECT_URL` trong
Variables. Mật khẩu chứa ký tự đặc biệt phải được URL-encode. Áp dụng các migration đã commit
lên database cloud bằng:

```powershell
pnpm db:migrate:deploy
```

## Phát triển API

```powershell
pnpm dev:api
```

API v1 chạy tại `http://localhost:3000/api/v1`; endpoint kiểm tra là
`http://localhost:3000/api/v1/health`.

Swagger UI và OpenAPI JSON trong môi trường phát triển:

```text
http://localhost:3000/api/docs
http://localhost:3000/api/docs-json
```

## Frontend desktop

Frontend React sử dụng Hash Router để hoạt động ổn định cả trong Vite lẫn WebView của Tauri.
Các màn hình đã kết nối API thật gồm:

- đăng nhập và khôi phục phiên làm việc;
- dashboard tổng quan;
- tìm kiếm, tạo, cập nhật, xóa mềm và khôi phục bệnh nhân;
- chi tiết bệnh nhân với hồ sơ y tế, dị ứng và bệnh lý;
- danh mục bệnh lý;
- quản lý người dùng và audit logs dành riêng cho `ADMIN`.

JWT chỉ được lưu trong `sessionStorage`, tự xóa khi đóng ứng dụng hoặc khi API trả về `401`.
Frontend không sử dụng dữ liệu giả.

Chạy frontend trên trình duyệt để phát triển nhanh:

```powershell
pnpm dev:desktop:web
```

Chạy trong cửa sổ Tauri:

```powershell
pnpm dev:desktop
```

Origin `http://tauri.localhost` phải có trong `CORS_ORIGINS` khi chạy bản desktop đã đóng gói.

Cấu trúc nền của API:

```text
apps/api/src/
├── common/     # DTO dùng chung, response/error envelope, middleware và interceptors
├── config/     # Validation biến môi trường và cấu hình Swagger
├── database/   # DatabaseModule và PrismaService
├── health/     # Health check API/PostgreSQL
├── modules/
│   ├── auth/       # Đăng nhập, phát hành JWT và DTO xác thực
│   ├── users/      # Truy vấn người dùng và endpoint chỉ dành cho ADMIN
│   ├── patients/   # CRUD, tìm kiếm, xóa mềm và khôi phục bệnh nhân
│   ├── medical-records/  # Lịch sử các lần ghi nhận y tế
│   ├── diseases/         # Danh mục bệnh lý
│   ├── patient-diseases/ # Bệnh lý và tình trạng của từng bệnh nhân
│   ├── allergies/        # Dị ứng của từng bệnh nhân
│   └── audit-logs/ # Ghi nhận sự kiện xác thực và thay đổi dữ liệu
├── app.module.ts
└── main.ts
```

Mọi endpoint nghiệp vụ mới mặc định sử dụng URI version `v1`. Response JSON bao gồm
`success`, `data` hoặc `error`, cùng metadata `timestamp` và `requestId`.

## Xác thực và phân quyền

Các endpoint hiện có:

```text
POST /api/v1/auth/login  # Công khai; tối đa 5 lần thử/phút cho mỗi địa chỉ IP
GET  /api/v1/auth/me     # ADMIN hoặc PHARMACIST đã đăng nhập
GET  /api/v1/health      # Công khai

GET   /api/v1/users              # Chỉ ADMIN; tìm kiếm, lọc và phân trang
GET   /api/v1/users/:id          # Chỉ ADMIN; xem chi tiết
POST  /api/v1/users              # Chỉ ADMIN; tạo người dùng
PATCH /api/v1/users/:id          # Chỉ ADMIN; sửa họ tên, email hoặc vai trò
PATCH /api/v1/users/:id/status   # Chỉ ADMIN; kích hoạt/vô hiệu hóa
PATCH /api/v1/users/:id/password # Chỉ ADMIN; đặt lại mật khẩu
```

Gửi access token trong header:

```http
Authorization: Bearer <access-token>
```

Mọi endpoint mới mặc định yêu cầu JWT. Chỉ đánh dấu `@Public()` cho endpoint thật sự công khai;
dùng `@Roles(UserRole.ADMIN)` hoặc `@Roles(UserRole.PHARMACIST)` để giới hạn vai trò. Guard tải
lại người dùng từ PostgreSQL ở mỗi request, vì vậy việc khóa tài khoản hoặc đổi vai trò có hiệu
lực ngay cả với token đã phát hành. Các lần đăng nhập thành công/thất bại được lưu vào
`audit_logs`, nhưng mật khẩu và token không được ghi log.

Module người dùng không cung cấp hard delete vì người dùng có thể được tham chiếu bởi hồ sơ y tế,
đơn thuốc và audit log. Thay vào đó, Admin vô hiệu hóa tài khoản qua endpoint `status`. Hệ thống
ngăn Admin tự khóa/tự hạ quyền và luôn giữ ít nhất một Admin hoạt động. Đặt lại mật khẩu tăng
`tokenVersion`, vì vậy mọi JWT cũ của người dùng đó bị thu hồi ngay lập tức.

## Quản lý bệnh nhân

```text
GET    /api/v1/patients             # ADMIN, PHARMACIST; tìm kiếm và phân trang
GET    /api/v1/patients/:id         # ADMIN, PHARMACIST; xem chi tiết và số hồ sơ liên quan
POST   /api/v1/patients             # ADMIN, PHARMACIST; tạo bệnh nhân
PATCH  /api/v1/patients/:id         # ADMIN, PHARMACIST; cập nhật bệnh nhân
GET    /api/v1/patients/deleted     # Chỉ ADMIN; danh sách đã xóa
DELETE /api/v1/patients/:id         # Chỉ ADMIN; xóa mềm
PATCH  /api/v1/patients/:id/restore # Chỉ ADMIN; khôi phục
DELETE /api/v1/patients/:id/permanent # Chỉ ADMIN; xóa vĩnh viễn bệnh nhân đã xóa
```

Mã bệnh nhân được PostgreSQL sinh tự động theo dạng `BN-000001`, `BN-000002`, ... khi tạo
bệnh nhân mới và không thể chỉnh sửa sau đó. Endpoint danh sách hỗ trợ `page`, `limit`,
`search`, `patientCode`, `fullName`, `phone` và
`gender`. Tham số `search` tìm đồng thời trên mã bệnh nhân, họ tên và số điện thoại. Mã bệnh
nhân được chuẩn hóa thành chữ hoa; ngày sinh phải là ngày hợp lệ theo định dạng `YYYY-MM-DD`
và không được nằm trong tương lai.

Bệnh nhân được xóa mềm bằng `deletedAt` để có thể khôi phục. Từ danh sách đã xóa, Admin có thể
xóa vĩnh viễn bệnh nhân cùng toàn bộ hồ sơ y tế, dị ứng, bệnh lý và ảnh đính kèm. Mọi thao tác
tạo, sửa, xóa, khôi phục và xóa vĩnh viễn được ghi cùng người thực hiện, `requestId`, địa chỉ IP
và dữ liệu trước/sau vào `audit_logs`.

## Hồ sơ và thông tin y tế

```text
GET    /api/v1/patients/:patientId/medical-records
POST   /api/v1/patients/:patientId/medical-records
GET    /api/v1/medical-records/:id
PATCH  /api/v1/medical-records/:id
DELETE /api/v1/medical-records/:id                 # Chỉ ADMIN
GET    /api/v1/medical-records/:id/attachments
POST   /api/v1/medical-records/:id/attachments     # multipart/form-data, field "files"
GET    /api/v1/medical-records/:id/attachments/:attachmentId
DELETE /api/v1/medical-records/:id/attachments/:attachmentId

GET    /api/v1/diseases
GET    /api/v1/diseases/:id
POST   /api/v1/diseases                            # Chỉ ADMIN
PATCH  /api/v1/diseases/:id                        # Chỉ ADMIN
PATCH  /api/v1/diseases/:id/status                 # Chỉ ADMIN

GET    /api/v1/patients/:patientId/diseases
POST   /api/v1/patients/:patientId/diseases
GET    /api/v1/patient-diseases/:id
PATCH  /api/v1/patient-diseases/:id
DELETE /api/v1/patient-diseases/:id                # Chỉ ADMIN

GET    /api/v1/patients/:patientId/allergies
POST   /api/v1/patients/:patientId/allergies
GET    /api/v1/allergies/:id
PATCH  /api/v1/allergies/:id
DELETE /api/v1/allergies/:id                       # Chỉ ADMIN
```

Admin và Dược sĩ có thể đọc, tạo và cập nhật dữ liệu lâm sàng. Các thao tác xóa mềm và quản lý
danh mục bệnh lý chỉ dành cho Admin. `recordedByUserId` luôn được lấy từ JWT, không nhận từ body.
Khi gắn bệnh lý hoặc dị ứng với một hồ sơ y tế, API xác minh hồ sơ đó thuộc đúng bệnh nhân và
chưa bị xóa. Bệnh lý có trạng thái `RESOLVED` bắt buộc có ngày khỏi bệnh; ngày khỏi không được
trước ngày chẩn đoán. Mọi thay đổi được ghi audit trong cùng transaction với dữ liệu nghiệp vụ.

Trên desktop, **Hồ sơ bệnh nhân** chỉ nhận ảnh từ máy tính và không còn ô nhập ghi chú lâm
sàng. Khi tạo mới phải chọn ít nhất một ảnh. Hệ thống chấp nhận JPEG, PNG và WebP, tối đa 10 MB
mỗi ảnh, 10 ảnh mỗi lần tải và 20 ảnh cho một hồ sơ. API xác minh chữ ký thực của tệp, không chỉ
dựa vào phần mở rộng hoặc MIME do trình duyệt gửi lên. Việc xem và xóa ảnh đều yêu cầu JWT.

Ảnh được lưu ngoài PostgreSQL tại thư mục cấu hình bởi `UPLOAD_DIR` (mặc định
`storage/medical-records`); cơ sở dữ liệu chỉ giữ metadata, checksum và quan hệ với hồ sơ/người
tải. Thư mục này đã được bỏ qua bởi Git và cần được sao lưu cùng cơ sở dữ liệu. Khi triển khai
nhiều API instance hoặc trên cloud, nên thay lớp lưu file cục bộ bằng Supabase Storage hoặc một
object storage tương đương.

## Audit logs

```text
GET /api/v1/audit-logs                # Chỉ ADMIN; tìm kiếm, lọc và phân trang
GET /api/v1/audit-logs/filter-options # Chỉ ADMIN; action và entityType hiện có
GET /api/v1/audit-logs/:id            # Chỉ ADMIN; xem dữ liệu trước/sau
```

Danh sách hỗ trợ `page`, `limit`, `search`, `action`, `entityType`, `entityId`, `actorUserId`,
`requestId`, `ipAddress`, `from` và `to`. Kết quả được sắp xếp mới nhất trước và kèm thông tin
người thực hiện nếu tài khoản vẫn tồn tại. Vì khóa chính PostgreSQL là `BIGINT`, trường `id` được
trả về dưới dạng chuỗi để tránh mất độ chính xác khi xử lý JSON/JavaScript.

Audit log là dữ liệu chỉ đọc: API không cung cấp thao tác tạo thủ công, sửa hoặc xóa. Các khóa
nhạy cảm có tên chứa `password`, `token`, `secret`, `authorization` hoặc `cookie` được tự động
thay bằng `[REDACTED]` trước khi ghi xuống cơ sở dữ liệu.

Mật khẩu được băm bằng Argon2id. Khi triển khai thật, phải thay `JWT_SECRET` và
`ADMIN_PASSWORD` mẫu bằng giá trị mạnh, riêng biệt; không commit tệp `.env`.

## Phát triển desktop

Chạy giao diện Vite trong trình duyệt, không cần Rust:

```powershell
pnpm dev:desktop:web
```

Chạy ứng dụng desktop Tauri:

```powershell
pnpm dev:desktop
```

Chạy đồng thời API và Tauri:

```powershell
pnpm dev
```

## Kiểm tra chất lượng

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

`packages/shared` không được chứa service, truy cập cơ sở dữ liệu hoặc logic nghiệp vụ.
Logic nghiệp vụ phải nằm trong các module phù hợp của `apps/api`.

Prisma schema hiện định nghĩa các model `User`, `Patient`, `MedicalRecord`,
`MedicalRecordAttachment`, `Disease`, `PatientDisease`, `Allergy` và `AuditLog`.
Migration PostgreSQL cũng bật `citext` và `pg_trgm` để hỗ trợ dữ liệu không phân biệt hoa thường
và tìm kiếm bệnh nhân hiệu quả.
