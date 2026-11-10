import { generatePassphrase, generatePassword } from '../core/generator.js';
import { checkPasswordBreach } from '../core/hibp.js';
import {
  clearSessionHistory,
  DEFAULT_SETTINGS,
  loadSessionHistory,
  loadSettings,
  pushSessionHistory,
  saveSettings,
  type GeneratorMode,
  type HistoryEntry,
  type StoredSettings
} from '../core/storage.js';
import { analyzeStrength } from '../core/strength.js';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

const passwordDisplay = $<HTMLDivElement>('password-display');
const entropyPill = $<HTMLSpanElement>('entropy-pill');
const strengthBar = $<HTMLDivElement>('strength-bar');
const strengthLabel = $<HTMLSpanElement>('strength-label');
const crackTime = $<HTMLSpanElement>('crack-time');

const copyBtn = $<HTMLButtonElement>('copy-btn');
const regenBtn = $<HTMLButtonElement>('regen-btn');
const fillBtn = $<HTMLButtonElement>('fill-btn');
const breachBtn = $<HTMLButtonElement>('breach-btn');
const breachStatus = $<HTMLSpanElement>('breach-status');
const clipboardBanner = $<HTMLDivElement>('clipboard-banner');
const clipboardTimerEl = $<HTMLSpanElement>('clipboard-timer');
const clearClipboardBtn = $<HTMLButtonElement>('clear-clipboard-btn');

const lengthRange = $<HTMLInputElement>('length-range');
const lengthValue = $<HTMLElement>('length-value');
const optUpper = $<HTMLInputElement>('opt-upper');
const optLower = $<HTMLInputElement>('opt-lower');
const optNumbers = $<HTMLInputElement>('opt-numbers');
const optSymbols = $<HTMLInputElement>('opt-symbols');
const optAmbiguous = $<HTMLInputElement>('opt-ambiguous');

const wordsRange = $<HTMLInputElement>('words-range');
const wordsValue = $<HTMLElement>('words-value');
const separatorSelect = $<HTMLSelectElement>('separator-select');
const optCapitalize = $<HTMLInputElement>('opt-capitalize');
const optPhraseNum = $<HTMLInputElement>('opt-phrase-num');

const optAutoClear = $<HTMLInputElement>('opt-autoclear');
const historyList = $<HTMLUListElement>('history-list');
const clearHistoryBtn = $<HTMLButtonElement>('clear-history-btn');

let settings: StoredSettings = structuredClone(DEFAULT_SETTINGS);
let activeTab: GeneratorMode | 'history' = 'password';
let currentSecret = '';
let clipboardCountdownId: number | undefined;
let clipboardSecondsLeft = 0;

function renderTokenizedPassword(value: string): void {
  passwordDisplay.replaceChildren();
  for (const ch of value) {
    const span = document.createElement('span');
    if (/[0-9]/.test(ch)) {
      span.className = 'tok-digit';
    } else if (/[^a-zA-Z0-9]/.test(ch)) {
      span.className = 'tok-symbol';
    } else {
      span.className = 'tok-letter';
    }
    span.textContent = ch;
    passwordDisplay.appendChild(span);
  }
}

function updateStrengthUI(): void {
  const report = analyzeStrength(
    currentSecret,
    settings.mode === 'passphrase'
      ? {
          wordCount: settings.passphrase.wordCount,
          includeNumber: settings.passphrase.includeNumber
        }
      : undefined
  );

  entropyPill.textContent = `${report.entropyBits} bits`;
  strengthLabel.textContent = report.label;
  crackTime.textContent = `Crack time: ${report.crackTimeDisplay}`;
  strengthBar.style.width = `${report.scorePercent}%`;

  const colors: Record<typeof report.label, string> = {
    Weak: '#ef4444',
    Fair: '#f59e0b',
    Strong: '#22c55e',
    Fortress: '#38bdf8'
  };
  strengthBar.style.backgroundColor = colors[report.label];
}

function resetBreachUI(): void {
  breachStatus.textContent = 'Privacy-preserving SHA-1 prefix check';
  breachStatus.className = 'status-text';
}

function regenerate(recordHistory = false): void {
  if (settings.mode === 'passphrase') {
    currentSecret = generatePassphrase(settings.passphrase);
  } else {
    currentSecret = generatePassword(settings.password);
  }

  renderTokenizedPassword(currentSecret);
  updateStrengthUI();
  resetBreachUI();

  if (recordHistory) {
    const report = analyzeStrength(
      currentSecret,
      settings.mode === 'passphrase'
        ? {
            wordCount: settings.passphrase.wordCount,
            includeNumber: settings.passphrase.includeNumber
          }
        : undefined
    );
    void pushSessionHistory({
      value: currentSecret,
      mode: settings.mode,
      entropyBits: report.entropyBits
    }).then(renderHistory);
  }
}

function stopClipboardTimer(): void {
  if (clipboardCountdownId !== undefined) {
    window.clearInterval(clipboardCountdownId);
    clipboardCountdownId = undefined;
  }
  clipboardBanner.classList.add('hidden');
}

async function clearClipboardNow(): Promise<void> {
  stopClipboardTimer();
  try {
    await navigator.clipboard.writeText('');
  } catch {
    // Clipboard write may fail if popup loses focus
  }
}

function startClipboardTimer(): void {
  stopClipboardTimer();
  if (!settings.autoClearClipboard) return;

  clipboardSecondsLeft = 30;
  clipboardTimerEl.textContent = `Clipboard auto-clear in ${clipboardSecondsLeft}s`;
  clipboardBanner.classList.remove('hidden');

  clipboardCountdownId = window.setInterval(() => {
    clipboardSecondsLeft -= 1;
    if (clipboardSecondsLeft <= 0) {
      void clearClipboardNow();
    } else {
      clipboardTimerEl.textContent = `Clipboard auto-clear in ${clipboardSecondsLeft}s`;
    }
  }, 1000);
}

async function copySecret(value: string, button?: HTMLButtonElement): Promise<void> {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  startClipboardTimer();

  const report = analyzeStrength(value);
  const updated = await pushSessionHistory({
    value,
    mode: settings.mode,
    entropyBits: report.entropyBits
  });
  renderHistory(updated);

  if (button) {
    const prev = button.textContent;
    button.textContent = 'Copied!';
    window.setTimeout(() => {
      button.textContent = prev;
    }, 1200);
  }
}

function renderHistory(entries: HistoryEntry[]): void {
  historyList.replaceChildren();

  if (entries.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'No passwords generated in this browser session yet.';
    historyList.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const li = document.createElement('li');
    li.className = 'history-item';

    const span = document.createElement('span');
    span.className = 'history-value';
    let revealed = false;
    span.textContent = '•'.repeat(Math.min(16, entry.value.length));

    const actions = document.createElement('div');
    actions.className = 'history-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn-link';
    toggleBtn.textContent = 'Show';
    toggleBtn.addEventListener('click', () => {
      revealed = !revealed;
      span.textContent = revealed
        ? entry.value
        : '•'.repeat(Math.min(16, entry.value.length));
      toggleBtn.textContent = revealed ? 'Hide' : 'Show';
    });

    const copyItemBtn = document.createElement('button');
    copyItemBtn.type = 'button';
    copyItemBtn.className = 'btn-link';
    copyItemBtn.textContent = 'Copy';
    copyItemBtn.addEventListener('click', () => {
      void copySecret(entry.value, copyItemBtn);
    });

    actions.append(toggleBtn, copyItemBtn);
    li.append(span, actions);
    historyList.appendChild(li);
  }
}

function switchTab(next: GeneratorMode | 'history'): void {
  activeTab = next;
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
    const isTarget = btn.dataset.tab === next;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', String(isTarget));
  });

  $('panel-password').classList.toggle('hidden', next !== 'password');
  $('panel-passphrase').classList.toggle('hidden', next !== 'passphrase');
  $('panel-history').classList.toggle('hidden', next !== 'history');

  if (next === 'password' || next === 'passphrase') {
    if (settings.mode !== next) {
      settings.mode = next;
      void saveSettings(settings);
      regenerate();
    }
  } else {
    void loadSessionHistory().then(renderHistory);
  }
}

function syncControlsFromSettings(): void {
  lengthRange.value = String(settings.password.length);
  lengthValue.textContent = String(settings.password.length);
  optUpper.checked = settings.password.uppercase;
  optLower.checked = settings.password.lowercase;
  optNumbers.checked = settings.password.numbers;
  optSymbols.checked = settings.password.symbols;
  optAmbiguous.checked = settings.password.excludeAmbiguous;

  wordsRange.value = String(settings.passphrase.wordCount);
  wordsValue.textContent = String(settings.passphrase.wordCount);
  separatorSelect.value = settings.passphrase.separator;
  optCapitalize.checked = settings.passphrase.capitalize;
  optPhraseNum.checked = settings.passphrase.includeNumber;

  optAutoClear.checked = settings.autoClearClipboard;
}

function enforceAtLeastOnePool(changed: HTMLInputElement): void {
  const boxes = [optUpper, optLower, optNumbers, optSymbols];
  if (boxes.every((box) => !box.checked)) {
    changed.checked = true;
  }
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab as GeneratorMode | 'history' | undefined;
      if (target) switchTab(target);
    });
  });

  const onPasswordSettingChange = (): void => {
    settings.password = {
      length: Number(lengthRange.value),
      uppercase: optUpper.checked,
      lowercase: optLower.checked,
      numbers: optNumbers.checked,
      symbols: optSymbols.checked,
      excludeAmbiguous: optAmbiguous.checked
    };
    lengthValue.textContent = String(settings.password.length);
    void saveSettings(settings);
    regenerate();
  };

  lengthRange.addEventListener('input', onPasswordSettingChange);
  [optUpper, optLower, optNumbers, optSymbols].forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      enforceAtLeastOnePool(checkbox);
      onPasswordSettingChange();
    });
  });
  optAmbiguous.addEventListener('change', onPasswordSettingChange);

  const onPassphraseSettingChange = (): void => {
    settings.passphrase = {
      wordCount: Number(wordsRange.value),
      separator: separatorSelect.value as StoredSettings['passphrase']['separator'],
      capitalize: optCapitalize.checked,
      includeNumber: optPhraseNum.checked
    };
    wordsValue.textContent = String(settings.passphrase.wordCount);
    void saveSettings(settings);
    regenerate();
  };

  wordsRange.addEventListener('input', onPassphraseSettingChange);
  separatorSelect.addEventListener('change', onPassphraseSettingChange);
  optCapitalize.addEventListener('change', onPassphraseSettingChange);
  optPhraseNum.addEventListener('change', onPassphraseSettingChange);

  optAutoClear.addEventListener('change', () => {
    settings.autoClearClipboard = optAutoClear.checked;
    void saveSettings(settings);
    if (!settings.autoClearClipboard) {
      stopClipboardTimer();
    }
  });

  regenBtn.addEventListener('click', () => regenerate(true));
  copyBtn.addEventListener('click', () => void copySecret(currentSecret, copyBtn));
  clearClipboardBtn.addEventListener('click', () => void clearClipboardNow());

  breachBtn.addEventListener('click', async () => {
    breachBtn.disabled = true;
    breachStatus.className = 'status-text';
    breachStatus.textContent = 'Checking k-anonymity range...';

    try {
      const result = await checkPasswordBreach(currentSecret);
      if (result.compromised) {
        breachStatus.className = 'status-text compromised';
        breachStatus.textContent = `Exposed ${result.count.toLocaleString()}x (prefix ${result.prefix})`;
      } else {
        breachStatus.className = 'status-text safe';
        breachStatus.textContent = `Safe · 0 breaches (prefix ${result.prefix})`;
      }
    } catch {
      breachStatus.className = 'status-text';
      breachStatus.textContent = 'Offline or API unavailable';
    } finally {
      breachBtn.disabled = false;
    }
  });

  fillBtn.addEventListener('click', async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
      return;
    }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      const res = (await chrome.tabs.sendMessage(tab.id, {
        type: 'KEYFORGE_FILL',
        value: currentSecret
      })) as { filled?: boolean } | undefined;

      if (res?.filled) {
        fillBtn.textContent = 'Filled!';
        window.setTimeout(() => {
          fillBtn.textContent = 'Fill Page';
        }, 1200);
      }
    } catch {
      fillBtn.textContent = 'Restricted page';
      window.setTimeout(() => {
        fillBtn.textContent = 'Fill Page';
      }, 1500);
    }
  });

  clearHistoryBtn.addEventListener('click', () => {
    void clearSessionHistory().then(() => renderHistory([]));
  });
}

async function init(): Promise<void> {
  settings = await loadSettings();
  syncControlsFromSettings();
  bindEvents();
  switchTab(settings.mode);
  regenerate();
  if (activeTab === 'history') {
    renderHistory(await loadSessionHistory());
  }
}

void init();
