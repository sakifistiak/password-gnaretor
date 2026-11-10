import { generatePassphrase, generatePassword } from './core/generator.js';
import { loadSettings, pushSessionHistory } from './core/storage.js';
import { analyzeStrength } from './core/strength.js';

const MENU_ID = 'keyforge-generate-fill';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'KeyForge: Generate & Fill Strong Password',
      contexts: ['editable']
    });
  });
});

async function injectAndFill(tabId: number, secret: string): Promise<boolean> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });

  const response = (await chrome.tabs.sendMessage(tabId, {
    type: 'KEYFORGE_FILL',
    value: secret
  })) as { filled?: boolean } | undefined;

  return Boolean(response?.filled);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  try {
    const settings = await loadSettings();
    const secret =
      settings.mode === 'passphrase'
        ? generatePassphrase(settings.passphrase)
        : generatePassword(settings.password);

    const strength = analyzeStrength(
      secret,
      settings.mode === 'passphrase'
        ? {
            wordCount: settings.passphrase.wordCount,
            includeNumber: settings.passphrase.includeNumber
          }
        : undefined
    );

    const filled = await injectAndFill(tab.id, secret);
    if (filled) {
      await pushSessionHistory({
        value: secret,
        mode: settings.mode,
        entropyBits: strength.entropyBits
      });
    }
  } catch (err) {
    console.error('[KeyForge] Context menu fill failed:', err);
  }
});
