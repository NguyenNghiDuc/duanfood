# MINI FOOD

MINI FOOD là web commerce đồ ăn dùng Node.js + Express + EJS, chạy được với SQLite cho local và MySQL cho production. Project có giỏ hàng, tồn kho, voucher, flash sale, ví, nạp tiền cần admin xác nhận, hoàn tiền, VNPay, review đã mua, CSKH, RBAC, realtime notification, PWA, dashboard, AI/RAG và audit log.

## Chạy nhanh local

```bash
cp .env.example .env
npm ci
npm run migrate
npm run seed
npm start
```

Mặc định có thể dùng SQLite (`USE_MYSQL=0`). Sau khi seed, tài khoản demo lấy từ `SEED_ADMIN_USERNAME/SEED_ADMIN_PASSWORD` và `SEED_USER_USERNAME/SEED_USER_PASSWORD` trong `.env`.

## Docker + MySQL

```bash
cp .env.example .env
# bắt buộc đổi SESSION_SECRET và DB_PASS
docker compose up -d --build
```

App chạy ở `http://localhost:5000`. MySQL, uploads và backups dùng persistent volumes. Image production cũng được GitHub Actions build/push lên GHCR khi merge vào `main`.

## Scripts

```bash
npm run validate     # syntax JS + compile toàn bộ EJS
npm run test:e2e     # full commerce flow qua HTTP/session/CSRF
npm test             # validate + E2E
npm run migrate      # chạy versioned migrations
npm run seed         # tạo dữ liệu demo idempotent
npm run backup       # logical backup JSON
RESTORE_CONFIRM=YES npm run restore -- backups/mini-food-....json
```

Restore là thao tác phá dữ liệu hiện tại và chỉ chạy khi có `RESTORE_CONFIRM=YES`.

## Biến môi trường quan trọng

Xem đầy đủ tại `.env.example`.

### App & session
- `SESSION_SECRET`: bắt buộc ở production.
- `SESSION_STORE=database`: session được lưu trong DB, phù hợp deploy nhiều process hơn MemoryStore.
- `SESSION_TTL_MS`, `TRUST_PROXY`.

### Database
- Local: `USE_MYSQL=0`, `SQLITE_PATH=./data/fallback.db`.
- Production: `USE_MYSQL=1`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`.
- Checkout, wallet, topup, refund và các write quan trọng dùng transaction thật `BEGIN/COMMIT/ROLLBACK`.

### Email
Khuyến nghị Resend:
- `RESEND_API_KEY`
- `EMAIL_FROM`

Có thể thay bằng `EMAIL_WEBHOOK_URL` + `EMAIL_WEBHOOK_TOKEN`. Production không có provider email sẽ không âm thầm in OTP ra log.

### SMS OTP
Tùy chọn Twilio:
- `TWILIO_SID`
- `TWILIO_TOKEN`
- `TWILIO_FROM`

`TEST_OTP` chỉ được code đọc khi `NODE_ENV=test`.

### Cloud upload
Tùy chọn Cloudinary:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Nếu chưa cấu hình, local upload vẫn lưu ở `public/uploads`.

### VNPay
- `VNP_TMN_CODE`
- `VNP_HASH_SECRET`
- `VNP_URL`
- `VNP_RETURN_URL`

Luồng thanh toán kiểm HMAC, mã đơn, đúng số tiền và có event key để callback/IPN idempotent. Không đánh dấu paid chỉ vì khách bấm nút trên frontend.

### AI / RAG
- `AI_BASE_URL`, `AI_MODEL` cho model chính nếu dùng.
- `AI_EMBEDDING_URL`, `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_TOKEN` cho vector embeddings.
- Không có embedding provider thì RAG tự fallback sang lexical retrieval.
- `RAG_MIN_SCORE`, `RAG_ANSWER_SCORE` điều chỉnh threshold.
- `RAG_REBUILD_ON_START=1` để rebuild knowledge index khi boot.
- Admin có thể gọi `/api/ai/rag/rebuild` và `/api/ai/rag/search`.

Nguồn knowledge hiện gồm món ăn, FAQ trong `data/faq.json` và các correction đã được admin xác nhận.

## Security

Project có:
- CSRF token cho các request thay đổi dữ liệu.
- `HttpOnly`, `SameSite`, `Secure` cookie production.
- session regeneration sau login/reset password.
- CSP, HSTS, frame/content-type/referrer/permissions headers.
- rate limit cho login, OTP, AI, review, support và API nhạy cảm.
- upload whitelist JPG/PNG/WEBP, size limit và random filename.
- RBAC: `user`, `support`, `kitchen`, `staff`, `admin`, `super_admin`.
- audit log cho thao tác quản trị quan trọng.
- structured request/error logs với request ID.

## Health & monitoring

- `GET /healthz`: process liveness.
- `GET /readyz`: kiểm DB readiness.
- `GET /metrics`: Prometheus-style counters; đặt `METRICS_TOKEN` để bảo vệ endpoint.
- `ERROR_WEBHOOK_URL` + `ERROR_WEBHOOK_TOKEN`: gửi lỗi server mức `error` sang monitoring webhook.

## Realtime

Notification dùng SSE (`/notifications/stream`) + in-process event bus để push ngay. Có DB polling fallback nên client vẫn cập nhật nếu mất event. Với nhiều instance độc lập, nên đưa event bus sang Redis/NATS nếu cần realtime tuyệt đối giữa các node.

## Backup / migration

Migrations có version trong `migrations/` và được ghi ở `schema_migrations`. Startup chạy migration trước khi listen.

Backup tạo JSON theo timestamp trong `backups/`, thư mục này bị ignore khỏi Git. Trong production nên mount `backups/` ra persistent storage và chạy `npm run backup` bằng cron/scheduler ngoài container.

## CI/CD

`.github/workflows/ci.yml` chạy:
1. `npm ci`
2. syntax check JavaScript
3. compile toàn bộ EJS
4. E2E full commerce flow
5. Docker build

`.github/workflows/docker.yml` build image trên PR và push GHCR trên `main`/tag.

E2E kiểm luồng: đăng ký + OTP → login → địa chỉ → admin cấp ví/voucher → cart → wallet checkout → ledger/stock → review → admin hủy → refund/stock/voucher rollback → topup admin duyệt → bank order vẫn pending → CSRF invalid bị 403.

## Production checklist

Trước deploy thật:
1. Đổi toàn bộ secret trong `.env`; không commit `.env`.
2. Dùng MySQL production và backup định kỳ.
3. Cấu hình HTTPS/reverse proxy.
4. Cấu hình Resend/Twilio nếu cần email/SMS thật.
5. Cấu hình Cloudinary để uploads không phụ thuộc filesystem container.
6. Cấu hình VNPay sandbox trước, sau đó mới chuyển production endpoint/key.
7. Đặt `METRICS_TOKEN` và monitoring webhook.
8. Chạy `npm test` và chỉ deploy khi CI xanh.

## Cấu trúc production quan trọng

- `config/db.js`: DB + transaction abstraction.
- `lib/sessionStore.js`: persistent session store.
- `middleware/csrf.js`: CSRF.
- `lib/walletLedger.js`: ledger/refund.
- `lib/topupService.js`: topup approval atomic.
- `lib/vnpayService.js`: payment signing/verification.
- `lib/ragService.js`: hybrid RAG/vector retrieval.
- `lib/migrationRunner.js`: versioned migrations.
- `scripts/backup.js`, `scripts/restore.js`, `scripts/seed.js`.
- `test/e2e.test.js`: end-to-end commerce test.
