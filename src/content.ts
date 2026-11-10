interface FillMessage {
  type: 'KEYFORGE_FILL';
  value: string;
}

function isFillableInput(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) {
    return !el.disabled && !el.readOnly;
  }
  if (el instanceof HTMLInputElement) {
    const allowedTypes = new Set(['password', 'text', 'email', 'search', '']);
    return allowedTypes.has(el.type.toLowerCase()) && !el.disabled && !el.readOnly;
  }
  return false;
}

function findTargetInput(): HTMLInputElement | HTMLTextAreaElement | null {
  if (isFillableInput(document.activeElement)) {
    return document.activeElement;
  }

  const passwordInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="password"]')
  );
  const visible = passwordInputs.find((input) => {
    if (input.disabled || input.readOnly) return false;
    const rect = input.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  return visible ?? null;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function showToast(message: string, isError = false): void {
  const existing = document.getElementById('keyforge-toast-host');
  existing?.remove();

  const host = document.createElement('div');
  host.id = 'keyforge-toast-host';
  const shadow = host.attachShadow({ mode: 'closed' });

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.setAttribute(
    'style',
    [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'z-index:2147483647',
      'padding:10px 14px',
      'border-radius:10px',
      `background:${isError ? '#7f1d1d' : '#0f172a'}`,
      'color:#f8fafc',
      `border:1px solid ${isError ? '#f87171' : '#38bdf8'}`,
      'font:500 13px/1.4 system-ui,-apple-system,sans-serif',
      'box-shadow:0 10px 25px rgba(0,0,0,0.35)'
    ].join(';')
  );

  shadow.appendChild(toast);
  document.documentElement.appendChild(host);
  window.setTimeout(() => host.remove(), 2600);
}

const globalFlag = '__keyforgeListenerRegistered';
if (!(window as unknown as Record<string, boolean>)[globalFlag]) {
  (window as unknown as Record<string, boolean>)[globalFlag] = true;

  chrome.runtime.onMessage.addListener((message: FillMessage, _sender, sendResponse) => {
    if (message?.type !== 'KEYFORGE_FILL') {
      return;
    }

    const target = findTargetInput();
    if (!target) {
      showToast('KeyForge: Focus a password or input field first.', true);
      sendResponse({ filled: false });
      return;
    }

    target.focus();
    setNativeValue(target, message.value);
    void navigator.clipboard?.writeText(message.value).catch(() => undefined);
    showToast('KeyForge: Generated password filled & copied');
    sendResponse({ filled: true });
  });
}
