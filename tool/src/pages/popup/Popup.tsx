import { useEffect, useState } from "react";
import * as browser from "webextension-polyfill";

export default function Popup() {
  const [enabled, setEnabled] = useState(false);

  // هنگام mount مقدار ذخیره‌شده را بخوان
  useEffect(() => {
    browser.storage.local.get("featureEnabled").then((result) => {
      if (result.featureEnabled !== undefined) {
        setEnabled(result.featureEnabled);
      }
    });
  }, []);

  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);

    // ذخیره در storage (همه تب‌ها می‌توانند بخوانند)
    await browser.storage.local.set({ featureEnabled: newValue });

    // (اختیاری) ارسال پیام به تب فعال برای واکنش سریع‌تر
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tabId = tabs[0]?.id;
      if (tabId != null) {
        await browser.tabs.sendMessage(tabId, {
          action: "setFeatureEnabled",
          value: newValue,
        });
      }
    } catch (error) {
      console.error("Failed to send message to content script:", error);
    }
  };

  return (
    <div className="p-4 min-w-[200px] flex flex-col items-center gap-3">
       <div className="text-center"> در حال حاضر فقط برای سایت دیپسیک توسعه داده شده است.</div>
      <label className="flex flex-col items-center gap-2 cursor-pointer select-none">
        <span className="text-sm font-medium text-gray-700">فعال‌سازی راست چین</span>
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            onChange={handleToggle}
          />
          <div className="w-10 h-5 bg-gray-300 rounded-full peer-checked:bg-emerald-400 transition-colors duration-200" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform duration-200" />
        </div>
      </label>
    </div>
  );
}