# KeyForge — Secure Password Generator Extension (Manifest V3)

A privacy-first, cryptographically secure browser extension for Chrome, Edge, and Brave that generates high-entropy passwords and Diceware-style passphrases, checks for known breaches via Have I Been Pwned (`k-anonymity`), and autofills fields directly from the popup or right-click context menu.

## Key Features

- **Cryptographically Secure Generation (`CSPRNG`)**: Uses `crypto.getRandomValues()` with rejection sampling to eliminate modulo bias, plus cryptographic Fisher-Yates shuffling and guaranteed inclusion of each enabled character class.
- **Random Password & Diceware Passphrase Modes**:
  - Configurable length (`8–64`), uppercase, lowercase, digits, symbols, and optional exclusion of ambiguous characters (`0, O, 1, l, I, |`).
  - Memorable `3–10` word passphrases backed by a curated 256-word (`8 bits/word`) dictionary with customizable separators, capitalization, and 2-digit numeric suffix.
- **Live Entropy & Crack-Time Estimator**: Calculates effective bits of entropy and estimates offline GPU brute-force crack times (`10^10 guesses/sec`).
- **Privacy-Preserving Breach Check (HIBP k-Anonymity)**: Computes the SHA-1 hash locally via Web Crypto (`crypto.subtle.digest`) and sends **only the first 5 hex characters** (with `Add-Padding: true`) to `api.pwnedpasswords.com`. Your password never leaves your browser.
- **Smart Autofill & Right-Click Context Menu**: Right-click any editable field (`KeyForge: Generate & Fill Strong Password`) or click **Fill Page** in the popup to inject a password cleanly into controlled React/Vue/Angular inputs via native value setters.
- **Session-Only History & Clipboard Auto-Clear**: Stores recent entries only in `chrome.storage.session` (masked by default, cleared automatically on browser close) with an optional 30-second clipboard auto-clear countdown.
- **Least-Privilege Permissions**: Uses `activeTab` + `scripting` on demand instead of broad `<all_urls>` host permissions.

## Tech Stack

- **TypeScript** (strict mode)
- **Manifest V3** (`service_worker`, `activeTab`, `contextMenus`, `scripting`, `storage`)
- **esbuild** for zero-config fast bundling
- **Vitest** for unit testing
- **GitHub Actions** CI for automated typechecking, tests, build, and `.zip` packaging

## Project Structure

```text
├── public/
│   ├── icons/               # Extension PNG icons (16, 48, 128)
│   └── manifest.json        # Chrome/Edge Manifest V3 definition
├── scripts/
│   ├── build.mjs            # esbuild bundler for popup, background, content script
│   └── generate-icons.mjs   # Zero-dependency PNG icon generator
├── src/
│   ├── core/
│   │   ├── generator.ts     # CSPRNG rejection-sampled password & passphrase engine
│   │   ├── hibp.ts          # SHA-1 k-anonymity breach checker
│   │   ├── storage.ts       # chrome.storage.local settings & session history
│   │   ├── strength.ts      # Entropy & crack-time analysis
│   │   └── wordlist.ts      # 256-word memorable wordlist
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.ts
│   ├── background.ts        # MV3 service worker & context menu handler
│   └── content.ts           # On-demand input autofill & shadow-DOM toast
└── tests/
    ├── generator.test.ts
    ├── hibp.test.ts
    └── strength.test.ts
```

## Getting Started

### 1. Install & Build

```bash
npm install
npm run typecheck
npm test
npm run build
```

### 2. Load in Chrome / Edge / Brave

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the generated `dist/` folder.

## Security Design Notes

- **No `Math.random()`**: All random indices are derived from `crypto.getRandomValues()` with rejection sampling (`value < Math.floor(2^32 / max) * max`).
- **No Persistent Password History**: Generated credentials are kept exclusively in `chrome.storage.session` and masked in the UI until explicitly revealed.
- **Strict CSP**: Zero inline scripts or remote code execution.
