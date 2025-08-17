
# Haravan Marketing Platform (AI + Webhooks) — Web-only

- **Webhooks**: `/webhooks/haravan` (HMAC verify)
- **AI**: `/ai/export`, `/ai/analyze`
- **Admin**: `/admin/nightly-run`, `/admin/metrics/daily`, `/admin/targets`, `/admin/coupons`
- **Jobs**: Agenda chạy trong web khi `START_JOBS=true` (00:05 VN & mỗi giờ)

## Deploy
1. Blueprint deploy trên Render với `render.yaml` (web-only).
2. ENV: `MONGODB_URI`, `HRV_ACCESS_TOKEN`, `HRV_CLIENT_SECRET`, `APP_BASE_URL`, `OPENAI_API_KEY`, `TIMEZONE=Asia/Ho_Chi_Minh`, `START_JOBS=true`.

## Webhooks
Haravan Admin → Webhooks →
- URL: `POST {APP_BASE_URL}/webhooks/haravan`
- Secret: `HRV_CLIENT_SECRET`
- Topics: `orders/*`, `products/update`
