import browser from 'webextension-polyfill';

browser.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-rtl') {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tabId = tabs[0]?.id;
      if (tabId != null) {
        await browser.tabs.sendMessage(tabId, {
          action: 'toggle-universal-rtl',
        });
      }
    } catch (error) {
      console.warn('Could not send toggle-universal-rtl message:', error);
    }
  }
});