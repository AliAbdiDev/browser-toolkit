import { useEffect, useState } from "react";
import * as browser from "webextension-polyfill";

// The hostname of the DeepSeek chat website
const DEEPSEEK_CHAT_HOSTNAME = "chat.deepseek.com";

// List of domain patterns where universal RTL should not be applied
const DOMAINS_BLACKLIST_FOR_UNIVERSAL_RTL = [
  /^(.*\.)?github\.com$/,
  /^(.*\.)?stackoverflow\.com$/,
  /^codepen\.io$/,
  /^docs\.google\.com$/,
  /^jsfiddle\.net$/,
  /^codesandbox\.io$/,
];

// Check if the current website is in the blacklist.
// Intent: Prevent RTL on sites where it would break (like code editors).
function isCurrentDomainBlacklistedForUniversalRTL(): boolean {
  return DOMAINS_BLACKLIST_FOR_UNIVERSAL_RTL.some((pattern) =>
    pattern.test(window.location.hostname)
  );
}

// Check if the current website is DeepSeek chat.
// Intent: Make sure the special DeepSeek processing runs only on the right site.
function isCurrentSiteDeepSeekChat(): boolean {
  return window.location.hostname === DEEPSEEK_CHAT_HOSTNAME;
}

// ========================================================
// Hook 1: Manage the enabled/disabled state from storage
//         for the DeepSeek popup toggle.
// Intent: Keep the popup switch and the content script in sync.
// ========================================================
function useDeepSeekFeatureToggle(): boolean {
  const [isDeepSeekFeatureEnabled, setIsDeepSeekFeatureEnabled] = useState(false);

  useEffect(() => {
    let componentIsMounted = true;

    // Read the saved state from browser storage
    browser.storage.local
      .get("featureEnabled")
      .then((storageResult) => {
        if (componentIsMounted && storageResult.featureEnabled !== undefined) {
          setIsDeepSeekFeatureEnabled(Boolean(storageResult.featureEnabled));
        }
      })
      .catch((error) => console.error("Failed to read featureEnabled:", error));

    // Listen for changes from the popup
    function handleStorageChange(
      changes: Record<string, browser.Storage.StorageChange>,
      areaName: string
    ) {
      if (areaName === "local" && changes.featureEnabled) {
        setIsDeepSeekFeatureEnabled(Boolean(changes.featureEnabled.newValue));
      }
    }

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      componentIsMounted = false;
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return isDeepSeekFeatureEnabled;
}

// ========================================================
// Hook 2: Listen for the keyboard shortcut message from
//         the background script for universal RTL toggle.
// Intent: React to the hotkey without reloading the page.
// ========================================================
function useUniversalRTLKeyboardShortcutToggle(): boolean {
  const [isUniversalRTLActive, setIsUniversalRTLActive] = useState(false);

  useEffect(() => {
    function handleMessageFromBackgroundScript(message: any) {
      // The background sends this action when the shortcut is pressed
      if (message.action === "toggle-universal-rtl") {
        setIsUniversalRTLActive((previousState) => !previousState);
      }
    }

    browser.runtime.onMessage.addListener(handleMessageFromBackgroundScript);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessageFromBackgroundScript);
    };
  }, []);

  return isUniversalRTLActive;
}

// ========================================================
// Hook 3: Apply DeepSeek-specific RTL, number formatting,
//         and comment processing using lazy (virtual list)
//         approach.
// Intent: Only process visible elements to stay fast even
//         in very long chats.
// ========================================================
function useDeepSeekSpecificRTLProcessing(isEnabled: boolean): void {
  useEffect(() => {
    // Only run if enabled and on the correct website
    if (!isEnabled || !isCurrentSiteDeepSeekChat()) return;

    let deepSeekStyleElement: HTMLStyleElement | null = null;
    let domMutationObserver: MutationObserver | null = null;
    let lazyProcessingObserver: IntersectionObserver | null = null;
    let debounceTimerId: number | null = null;

    const flushTimingState = { lastFlushTime: 0 };
    const pendingElementsSet = new Set<HTMLElement>();

    // ----- Process a single comment element for RTL -----
    // Intent: Change a comment to right-to-left if it has Persian/Arabic text.
    function processCommentElementForRTL(commentElement: Element): void {
      if (commentElement.classList.contains("comment-rtl")) return;

      const textContent = commentElement.textContent || "";
      const containsPersianArabic = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(textContent);

      if (containsPersianArabic) {
        const htmlElement = commentElement as HTMLElement;
        // Save original display and direction
        htmlElement.dataset.origDisplay = htmlElement.style.display;
        htmlElement.dataset.origDirection = htmlElement.style.direction;
        // Apply RTL styles
        htmlElement.style.display = "inline-block";
        htmlElement.style.direction = "rtl";
        htmlElement.classList.add("comment-rtl");
      }
    }

    // ----- Process a single mord (math/number) element for Persian formatting -----
    // Intent: Show numbers in Persian format (like ۱۲۳) instead of English digits.
    function processMathNumberElementForPersianFormatting(mordElement: Element): void {
      if (mordElement.classList.contains("mord-number")) return;

      const htmlElement = mordElement as HTMLElement;
      // Skip elements that contain children (they are likely complex math)
      if (htmlElement.childElementCount > 0) return;

      const rawText = (htmlElement.textContent || "").trim();
      if (!rawText) return;

      const numberPattern = /^[+-]?[\d۰-۹,٬]+(?:(?:\/|\.|٫)[\d۰-۹]+)?$/;
      if (!numberPattern.test(rawText)) return;

      // Convert Persian digits to English digits for parsing
      const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
      const englishDigits = "0123456789";
      function convertPersianDigitsToEnglish(text: string): string {
        return text.replace(/[۰-۹]/g, (character) => englishDigits[persianDigits.indexOf(character)]);
      }

      let englishNumberString = convertPersianDigitsToEnglish(rawText);
      // Remove thousands separators and replace fraction markers
      englishNumberString = englishNumberString.replace(/[,\u066C]/g, "");
      englishNumberString = englishNumberString.replace("/", ".");
      englishNumberString = englishNumberString.replace(/\u066B/g, ".");

      const numberValue = parseFloat(englishNumberString);
      if (isNaN(numberValue)) return;

      // Save original text so we can undo the change later
      htmlElement.dataset.originalMord = htmlElement.textContent ?? "";
      // Format the number with Persian locale
      htmlElement.textContent = new Intl.NumberFormat("fa-IR").format(numberValue);
      htmlElement.classList.add("mord-number");
    }

    // ----- Add an element to the pending queue for later lazy processing -----
    // Intent: Collect new elements so we can process them in batches.
    function addElementToPendingQueue(element: HTMLElement): void {
      pendingElementsSet.add(element);
    }

    // ----- Process all elements currently in the pending queue -----
    // Intent: Start observing each pending element. They will be processed when they become visible.
    function processPendingElementsQueue(): void {
      if (pendingElementsSet.size === 0) return;

      pendingElementsSet.forEach((element) => {
        if (element.isConnected) {
          lazyProcessingObserver?.observe(element);
        }
      });
      pendingElementsSet.clear();
      debounceTimerId = null;
    }

    // ----- Schedule the processing of pending elements with debounce -----
    // Intent: Avoid running the processing too often when many elements appear at once.
    function schedulePendingQueueProcessing(): void {
      const currentTime = Date.now();
      if (debounceTimerId !== null) window.clearTimeout(debounceTimerId);

      const delayTime = currentTime - flushTimingState.lastFlushTime >= 200 ? 0 : 60;
      debounceTimerId = window.setTimeout(() => {
        flushTimingState.lastFlushTime = Date.now();
        processPendingElementsQueue();
      }, delayTime);
    }

    // ----- Create the IntersectionObserver for lazy processing -----
    // Intent: Only process elements when they are about to appear on screen (virtual list idea).
    function createLazyProcessingObserver(): void {
      lazyProcessingObserver = new IntersectionObserver(
        (observerEntries) => {
          observerEntries.forEach((entry) => {
            if (entry.isIntersecting) {
              const element = entry.target as HTMLElement;

              // Process the element if it hasn't been processed yet
              if (element.matches?.(".comment") && !element.classList.contains("comment-rtl")) {
                processCommentElementForRTL(element);
              }
              if (element.matches?.(".mord") && !element.classList.contains("mord-number")) {
                processMathNumberElementForPersianFormatting(element);
              }

              // Also process any child comments/numbers inside this element
              element.querySelectorAll?.(".comment:not(.comment-rtl), .mord:not(.mord-number)").forEach((child) => {
                if (child.matches(".comment")) processCommentElementForRTL(child);
                else if (child.matches(".mord")) processMathNumberElementForPersianFormatting(child);
              });

              // Stop observing this element – it is now processed
              lazyProcessingObserver?.unobserve(element);
            }
          });
        },
        { rootMargin: "100px" } // Start processing slightly before element enters screen
      );
    }

    // ----- Inject the DeepSeek-specific CSS styles -----
    // Intent: Apply RTL direction and fix mixed text word order only on the DeepSeek site.
    function injectDeepSeekSpecificStyles(): void {
      if (deepSeekStyleElement || !document.head) return;

      deepSeekStyleElement = document.createElement("style");
      deepSeekStyleElement.textContent = `
        .ds-message,
        .ds-markdown {
          direction: rtl !important;
          unicode-bidi: plaintext;   /* Fix mixed text word order */
        }
        .ds-markdown pre,
        .ds-markdown code {
          direction: ltr !important;
        }
        textarea,
        input[type="text"] {
          direction: rtl !important;
          text-align: right !important;
          unicode-bidi: plaintext;
        }
        .mord-number {
          direction: ltr !important;
          display: inline-block;
          unicode-bidi: isolate;
        }
      `;
      document.head.appendChild(deepSeekStyleElement);
    }

    // ----- Revert all changes made by this hook -----
    // Intent: Clean everything when the feature is turned off or the tab is closed.
    function revertAllDeepSeekModifications(): void {
      if (deepSeekStyleElement) {
        deepSeekStyleElement.remove();
        deepSeekStyleElement = null;
      }

      document.querySelectorAll<HTMLElement>(".comment-rtl").forEach((element) => {
        element.style.display = element.dataset.origDisplay ?? "";
        element.style.direction = element.dataset.origDirection ?? "";
        delete element.dataset.origDisplay;
        delete element.dataset.origDirection;
        element.classList.remove("comment-rtl");
      });

      document.querySelectorAll<HTMLElement>(".mord-number").forEach((element) => {
        if (element.dataset.originalMord !== undefined) {
          element.textContent = element.dataset.originalMord;
          delete element.dataset.originalMord;
        }
        element.classList.remove("mord-number");
      });
    }

    // ----- Activate all DeepSeek processing -----
    // Intent: Start watching the page, inject styles, and begin lazy processing.
    function activateDeepSeekProcessing(): void {
      if (!document.head || !document.body) return;

      injectDeepSeekSpecificStyles();
      createLazyProcessingObserver();

      // Watch for new messages loaded dynamically
      if (!domMutationObserver) {
        domMutationObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) {
                addElementToPendingQueue(node);
              }
            });
          });
          if (pendingElementsSet.size > 0) schedulePendingQueueProcessing();
        });
      }
      domMutationObserver.observe(document.body, { childList: true, subtree: true });

      // Process already existing elements (they will be processed lazily)
      document.querySelectorAll(".comment, .mord").forEach((element) => {
        addElementToPendingQueue(element as HTMLElement);
      });
      schedulePendingQueueProcessing();
    }

    // ----- Deactivate all DeepSeek processing -----
    // Intent: Stop all observers and timers to save resources.
    function deactivateDeepSeekProcessing(): void {
      domMutationObserver?.disconnect();
      lazyProcessingObserver?.disconnect();
      if (debounceTimerId !== null) {
        window.clearTimeout(debounceTimerId);
        debounceTimerId = null;
      }
    }

    // ----- Handle browser tab visibility change (pause/resume) -----
    // Intent: Pause processing when the tab is hidden to save CPU.
    function handleTabVisibilityChangeForDeepSeek(): void {
      if (document.hidden) {
        deactivateDeepSeekProcessing();
      } else {
        activateDeepSeekProcessing();
      }
    }

    // Start everything
    activateDeepSeekProcessing();

    document.addEventListener("visibilitychange", handleTabVisibilityChangeForDeepSeek);

    // Cleanup when hook disables or component unmounts
    return () => {
      document.removeEventListener("visibilitychange", handleTabVisibilityChangeForDeepSeek);
      deactivateDeepSeekProcessing();
      revertAllDeepSeekModifications();
    };
  }, [isEnabled]);
}

// ========================================================
// Hook 4: Apply universal RTL style on any website
//         (independent of DeepSeek classes).
// Intent: Make any page right-to-left with one hotkey,
//         without breaking code or math.
// ========================================================
function useUniversalRTLSitewideStyle(isActive: boolean): void {
  useEffect(() => {
    // Do not apply on blacklisted domains
    if (isCurrentDomainBlacklistedForUniversalRTL()) return;
    if (!isActive) return;

    const universalRTLStyleElementId = "universal-rtl-style";
    const existingStyleElement = document.getElementById(universalRTLStyleElementId);
    if (existingStyleElement) existingStyleElement.remove();

    const newStyleElement = document.createElement("style");
    newStyleElement.id = universalRTLStyleElementId;
    newStyleElement.textContent = `
      /* Set the main page direction to RTL */
      html body {
        direction: rtl !important;
      }
      /* Keep code blocks, math, and explicitly LTR elements as LTR */
      pre, code, [dir="ltr"], math, .katex, .katex * {
        direction: ltr !important;
        unicode-bidi: isolate;
      }
      /* Forms and text inputs: RTL alignment but allow LTR text */
      input, textarea, [contenteditable] {
        direction: rtl !important;
        text-align: right !important;
        unicode-bidi: plaintext;
      }
      /* Common text elements: let the browser decide direction per paragraph */
      p, div, span, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, a {
        unicode-bidi: plaintext;
      }
    `;
    document.head.appendChild(newStyleElement);

    // When the hook deactivates, remove the injected style
    return () => {
      const styleToRemove = document.getElementById(universalRTLStyleElementId);
      if (styleToRemove) styleToRemove.remove();
    };
  }, [isActive]);
}

// ========================================================
// Main Content Page Component
// Intent: Combine all hooks to provide both DeepSeek RTL and universal RTL features.
// ========================================================
function ContentPage() {
  const isDeepSeekFeatureActive = useDeepSeekFeatureToggle();
  const isUniversalRTLActive = useUniversalRTLKeyboardShortcutToggle();

  useDeepSeekSpecificRTLProcessing(isDeepSeekFeatureActive);
  useUniversalRTLSitewideStyle(isUniversalRTLActive);

  return null;
}

export default ContentPage;