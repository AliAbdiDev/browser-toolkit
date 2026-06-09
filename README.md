# Browser Toolkit

`Browser Toolkit` یک افزونهٔ شخصی برای مرورگر است که در حال حاضر مهم‌ترین کارش
**راست‌چین کردن چت DeepSeek** و پشتیبانی از نمایش اعداد فارسی می‌باشد.  
این پروژه قرار است مجموعه‌ای از ابزارهای کاربردی کوچک مرورگر را در خود جای دهد.

## تکنولوژی‌ها

- [React 19](https://react.dev) — رابط کاربری popup
- [TypeScript](https://www.typescriptlang.org) — تایپ‌سیفتی
- [Vite](https://vitejs.dev) + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) — بیلد افزونه
- [Tailwind CSS v4](https://tailwindcss.com) — استایل‌دهی
- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) — API یکپارچه برای Chrome و Firefox

## نصب سریع

فایل‌های آمادهٔ نصب را از [آخرین نسخه (Releases)](https://github.com/AliAbdiDev/browser-toolkit/releases) دانلود کن:

| مرورگر | لینک دانلود |
|--------|--------------|
| **Chrome** | [dist_chrome.zip](https://github.com/AliAbdiDev/browser-toolkit/releases/latest/download/dist_chrome.zip) |
| **Firefox** | [dist_firefox.zip](https://github.com/AliAbdiDev/browser-toolkit/releases/latest/download/dist_firefox.zip) |

پس از دانلود، فایل ZIP را از حالت فشرده خارج کن و مطابق راهنمای زیر نصب کن.

---

### کروم

1. فایل `dist_chrome.zip` را دانلود و استخراج کن.
2. به `chrome://extensions` برو.
3. **Developer mode** را فعال کن.
4. روی **Load unpacked** کلیک کن و پوشهٔ استخراج‌شده را انتخاب کن.

---

### فایرفاکس (نصب موقت)

1. فایل `dist_firefox.zip` را دانلود و استخراج کن.
2. به `about:debugging` برو → **This Firefox** → **Load Temporary Add-on**
3. فایل `manifest.json` داخل پوشهٔ استخراج‌شده را انتخاب کن.

> ⚠️ این روش پس از بستن فایرفاکس افزونه را حذف می‌کند.

---

### فایرفاکس Developer Edition (نصب دائمی)

1. [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/) را نصب کن.
2. در `about:config` مقدار `xpinstall.signatures.required` را روی `false` تنظیم کن.
3. فایل `dist_firefox.zip` را دانلود و استخراج کن.
4. به `about:debugging` برو → **This Firefox** → **Load Temporary Add-on**
5. فایل `manifest.json` داخل پوشهٔ استخراج‌شده را انتخاب کن.

> ✅ در Developer Edition با این تنظیم، افزونه پس از ری‌استارت مرورگر هم باقی می‌ماند.

---

## بیلد از سورس
```bash
pnpm install
pnpm build:chrome   # خروجی: dist_chrome/
pnpm build:firefox  # خروجی: dist_firefox/