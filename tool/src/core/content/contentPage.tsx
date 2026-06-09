import { useEffect, useState } from "react";
import * as browser from "webextension-polyfill";

const TARGET_HOSTNAME = "chat.deepseek.com";

function isTargetSite(): boolean {
  return window.location.hostname === TARGET_HOSTNAME;
}

function ContentPage() {
  const [featureEnabled, setFeatureEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    browser.storage.local
      .get("featureEnabled")
      .then((result) => {
        if (mounted && result.featureEnabled !== undefined) {
          setFeatureEnabled(Boolean(result.featureEnabled));
        }
      })
      .catch((err) => {
        console.error("Failed to read featureEnabled from storage:", err);
      });

    const handleStorageChange = (
      changes: Record<string, browser.Storage.StorageChange>,areaName: string
    ) => {
      if (areaName === "local" && changes.featureEnabled) {
        setFeatureEnabled(Boolean(changes.featureEnabled.newValue));
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      mounted = false;
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!featureEnabled || !isTargetSite()) return;

    let styleElem: HTMLStyleElement | null = null;
    let observer: MutationObserver | null = null;
    let debounceTimer: number | null = null;
    // FIX [High]: از object برای lastFlush استفاده می‌کنیم تا closure stale نشود
    const flushState = { lastFlush: 0 };
    const pendingNodes = new Set<HTMLElement>();

    const processComment = (comment: Element) => {
      if (comment.classList.contains("comment-rtl")) return;
      // FIX [Medium]: گسترش regex برای پوشش کامل Unicode فارسی/عربی
      if (/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(comment.textContent || "")) {
        const elem = comment as HTMLElement;
        elem.dataset.origDisplay = elem.style.display;
        elem.dataset.origDirection = elem.style.direction;
        elem.style.display = "inline-block";
        elem.style.direction = "rtl";
        elem.classList.add("comment-rtl");
      }
    };

    const processMord = (elem: Element) => {
      if (elem.classList.contains("mord-number")) return;

      const el = elem as HTMLElement;

      // FIX [High]: عناصر با child node (مثل MathJax) را رد کن تا DOM خراب نشود
      if (el.childElementCount > 0) return;

      const rawText = (el.textContent || "").trim();
      if (!rawText) return;

      const numberPattern = /^[+-]?[\d۰-۹,٬]+(?:(?:\/|\.|٫)[\d۰-۹]+)?$/;
      if (!numberPattern.test(rawText)) return;

      const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
      const englishDigits = "0123456789";
      const toEnglishNumber = (str: string) =>
        str.replace(/[۰-۹]/g, (ch) => englishDigits[persianDigits.indexOf(ch)]);

      let englishStr = toEnglishNumber(rawText);
      englishStr = englishStr.replace(/[,\u066C]/g, "");
      englishStr = englishStr.replace("/", ".");
      englishStr = englishStr.replace(/\u066B/g, ".");

      const number = parseFloat(englishStr);
      if (isNaN(number)) return;

      el.dataset.originalMord = el.textContent ?? "";
      el.textContent = new Intl.NumberFormat("fa-IR").format(number);
      el.classList.add("mord-number");
    };

    const withObserverPaused = (fn: () => void) => {
      observer?.disconnect();
      try {
        fn();
      } finally {
        // FIX [High]: reconnect در finally تضمین می‌شود حتی با exception
        if (observer && !document.hidden && document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      }
    };

    const processRoot = (root: ParentNode) => {
      withObserverPaused(() => {
        root.querySelectorAll(".comment").forEach(processComment);
        root.querySelectorAll(".mord").forEach(processMord);
      });
    };

    const flushPending = () => {
      if (pendingNodes.size === 0) return;
      withObserverPaused(() => {
        pendingNodes.forEach((node) => {
          if (!node.isConnected) return;
          if (node.matches?.(".comment")) processComment(node);
          // FIX [Medium]: بررسی .mord روی خود node
          if (node.matches?.(".mord")) processMord(node);
          node.querySelectorAll?.(".comment").forEach(processComment);
          node.querySelectorAll?.(".mord").forEach(processMord);
        });
        pendingNodes.clear();
      });
      debounceTimer = null;
    };

    const scheduleFlush = () => {
      const now = Date.now();
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      // FIX [High]: استفاده از flushState.lastFlush به جای متغیر closure
      const wait = now - flushState.lastFlush >= 200 ? 0 : 60;
      debounceTimer = window.setTimeout(() => {
        flushState.lastFlush = Date.now();
        flushPending();
      }, wait);
    };

    const injectStyle = () => {
      if (styleElem || !document.head) return;
      styleElem = document.createElement("style");
      styleElem.textContent = `
      .ds-message,
      .ds-markdown { direction: rtl !important; }
      .ds-markdown pre,
      .ds-markdown code { direction: ltr !important; }
      textarea,
      input[type="text"] {
        direction: rtl !important;
        text-align: right !important;
      }
      .mord-number {
        direction: ltr !important;
        display: inline-block;
        unicode-bidi: isolate;
      }
    `;
      document.head.appendChild(styleElem);
    };

    const revertAll = () => {
      if (styleElem) {
        styleElem.remove();
        styleElem = null;
      }

      document.querySelectorAll<HTMLElement>(".comment-rtl").forEach((elem) => {
        elem.style.display = elem.dataset.origDisplay ?? "";
        elem.style.direction = elem.dataset.origDirection ?? "";
        delete elem.dataset.origDisplay;
        delete elem.dataset.origDirection;
        elem.classList.remove("comment-rtl");
      });

      document.querySelectorAll<HTMLElement>(".mord-number").forEach((elem) => {
        // FIX [Medium]: بررسی دقیق‌تر برای جلوگیری از پاک شدن محتوای خالی
        if (elem.dataset.originalMord !== undefined) {
          elem.textContent = elem.dataset.originalMord;
          delete elem.dataset.originalMord;
        }
        elem.classList.remove("mord-number");
      });
    };

    const activate = () => {
      if (!document.head || !document.body) return;
      injectStyle();

      if (!observer) {
        observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) {
                pendingNodes.add(node);
              }
            });
          });
          if (pendingNodes.size > 0) scheduleFlush();
        });
      }
      observer.observe(document.body, { childList: true, subtree: true });processRoot(document);
    };

    const deactivate = () => {
      observer?.disconnect();
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };

    activate();
    console.log('rtl active');
    const handleVisibilityChange = () => {
      if (document.hidden) deactivate();
      else activate();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
     console.log('rtl deactivate');

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      deactivate();
      revertAll();
    };
  }, [featureEnabled]);

  return null;
}

export default ContentPage;
