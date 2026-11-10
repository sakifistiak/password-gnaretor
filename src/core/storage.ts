import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  type PassphraseOptions,
  type PasswordOptions
} from './generator.js';

export type GeneratorMode = 'password' | 'passphrase';

export interface HistoryEntry {
  id: string;
  value: string;
  mode: GeneratorMode;
  entropyBits: number;
  createdAt: number;
}

export interface StoredSettings {
  mode: GeneratorMode;
  password: PasswordOptions;
  passphrase: PassphraseOptions;
  autoClearClipboard: boolean;
}

const SETTINGS_KEY = 'keyforge_settings';
const HISTORY_KEY = 'keyforge_session_history';
const MAX_HISTORY = 10;

export const DEFAULT_SETTINGS: StoredSettings = {
  mode: 'password',
  password: DEFAULT_PASSWORD_OPTIONS,
  passphrase: DEFAULT_PASSPHRASE_OPTIONS,
  autoClearClipboard: true
};

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

export async function loadSettings(): Promise<StoredSettings> {
  if (!hasChromeStorage()) {
    return structuredClone(DEFAULT_SETTINGS);
  }
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = result[SETTINGS_KEY] as Partial<StoredSettings> | undefined;
  return {
    mode: raw?.mode ?? DEFAULT_SETTINGS.mode,
    password: { ...DEFAULT_PASSWORD_OPTIONS, ...raw?.password },
    passphrase: { ...DEFAULT_PASSPHRASE_OPTIONS, ...raw?.passphrase },
    autoClearClipboard: raw?.autoClearClipboard ?? DEFAULT_SETTINGS.autoClearClipboard
  };
}

export async function saveSettings(settings: StoredSettings): Promise<void> {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function loadSessionHistory(): Promise<HistoryEntry[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) {
    return [];
  }
  const result = await chrome.storage.session.get(HISTORY_KEY);
  const entries = result[HISTORY_KEY];
  return Array.isArray(entries) ? (entries as HistoryEntry[]) : [];
}

export async function pushSessionHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<HistoryEntry[]> {
  const nextItem: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  const current = await loadSessionHistory();
  const deduped = current.filter((item) => item.value !== entry.value);
  const updated = [nextItem, ...deduped].slice(0, MAX_HISTORY);

  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    await chrome.storage.session.set({ [HISTORY_KEY]: updated });
  }
  return updated;
}

export async function clearSessionHistory(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    await chrome.storage.session.remove(HISTORY_KEY);
  }
}
