# Pharmacy Records Mobile

Ứng dụng Expo/React Native dùng chung API với bản desktop/web. Dữ liệu bệnh nhân và ảnh hồ sơ vẫn được lưu ở BE Railway, không lưu trong APK.

## Chạy thử trên điện thoại

1. Từ thư mục gốc repo, chạy `pnpm install` rồi `pnpm dev:mobile`.
2. Cài Expo Go trên Android và quét mã QR trong terminal. Máy tính và điện thoại nên cùng mạng; nếu không, dùng `pnpm --filter @pharmacy-records/mobile exec expo start --tunnel` sau khi build `@pharmacy-records/shared`.
3. Đăng nhập bằng tài khoản hệ thống hiện có.

API mặc định là `https://pharmacy-records.up.railway.app/api`. Để đổi API, tạo `apps/mobile/.env.local` với `EXPO_PUBLIC_API_BASE_URL=https://.../api`, rồi khởi động lại Expo. Biến `EXPO_PUBLIC_` là công khai trong app, không đặt secret tại đây.

## Tạo APK

Từ `apps/mobile`, cài EAS CLI (`npm install -g eas-cli`), đăng nhập bằng `eas login`, sau đó chạy `eas build --platform android --profile preview`. File APK được cung cấp sau khi build. Cấu hình `eas.json` đặt riêng tại thư mục này. Build production sử dụng AAB cho Google Play.

## Phạm vi bản đầu

- Đăng nhập, tự khôi phục phiên bằng SecureStore, đăng xuất.
- Tổng quan, tìm và phân trang bệnh nhân, thêm/sửa bệnh nhân.
- Xem hồ sơ y tế, ảnh đính kèm có xác thực, thêm hồ sơ kèm một ảnh từ thư viện.
- Xem và thêm dị ứng, bệnh lý của bệnh nhân.

Các thao tác sửa/xóa hồ sơ, dị ứng, bệnh lý; quản trị người dùng; nhật ký hoạt động; chụp ảnh bằng camera chưa có trong bản đầu. Cần thử thực tế trên Android trước khi phát hành cho người dùng.
