# DeepSeek RTL

افزونه مرورگر برای نمایش راست‌به‌چپ سایت DeepSeek با پشتیبانی از اعداد فارسی.

## تکنولوژی‌ها

- [React 19](https://react.dev) — رابط کاربری popup
- [TypeScript](https://www.typescriptlang.org) — تایپ‌سیفتی
- [Vite](https://vitejs.dev) + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) — بیلد افزونه
- [Tailwind CSS v4](https://tailwindcss.com) — استایل‌دهی
- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) — API یکپارچه برای Chrome و Firefox

## نصب سریع

آخرین نسخه را از [Releases](../../releases/latest) دانلود کن.

---

### کروم

1. پوشه `dist_chrome` را از آرشیو خارج کن
2. به `chrome://extensions` برو
3. **Developer mode** را فعال کن
4. روی **Load unpacked** کلیک کن و پوشه `dist_chrome` را انتخاب کن

---

### فایرفاکس (نصب موقت)

1. پوشه `dist_firefox` را از آرشیو خارج کن
2. به `about:debugging` برو → **This Firefox** → **Load Temporary Add-on**
3. فایل `manifest.json` داخل `dist_firefox` را انتخاب کن

> ⚠️ این روش پس از بستن فایرفاکس افزونه را حذف می‌کند.

---

### فایرفاکس Developer Edition (نصب دائمی)

1. [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/) را نصب کن
2. در `about:config` مقدار `xpinstall.signatures.required` را روی `false` تنظیم کن
3. پوشه `dist_firefox` را از آرشیو خارج کن
4. به `about:debugging` برو → **This Firefox** → **Load Temporary Add-on**
5. فایل `manifest.json` داخل `dist_firefox` را انتخاب کن

> ✅ در Developer Edition با این تنظیم، افزونه پس از ری‌استارت مرورگر هم باقی می‌ماند.

---

## بیلد از سورس
```bash
pnpm install
pnpm build:chrome   # خروجی: dist_chrome/
pnpm build:firefox  # خروجی: dist_firefox/

## لایسنس

[MIT](LICENSE)
`