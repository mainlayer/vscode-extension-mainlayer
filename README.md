# VS Code Extension — Mainlayer Template

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/my-publisher.vscode-extension-mainlayer?label=VS%20Code%20Marketplace&logo=visual-studio-code&logoColor=white&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=my-publisher.vscode-extension-mainlayer)
[![CI](https://github.com/my-org/vscode-extension-mainlayer/actions/workflows/ci.yml/badge.svg)](https://github.com/my-org/vscode-extension-mainlayer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready VS Code extension template that demonstrates how to gate premium features behind a [Mainlayer](https://mainlayer.xyz) subscription — without writing any payment processing code yourself.

---

## Features

| Feature | Free | Premium |
|---------|:----:|:-------:|
| Core commands | yes | yes |
| Premium commands | | yes |
| Priority support | | yes |
| Early access to new features | | yes |

---

## Quick Start

### 1. Install the extension

Search for **My Extension (Mainlayer)** in the VS Code Marketplace, or install from the command line:

```bash
code --install-extension my-publisher.vscode-extension-mainlayer
```

### 2. Obtain a Mainlayer API key

1. Sign in to [mainlayer.xyz/dashboard](https://mainlayer.xyz/dashboard).
2. Create a new project and copy the **API key**.

### 3. Configure the extension

Open VS Code Settings (`Cmd/Ctrl + ,`) and search for **Mainlayer API Key**, or add it directly to your `settings.json`:

```json
{
  "myExtension.mainlayerApiKey": "ml_live_..."
}
```

Alternatively, run the command:

```
My Extension: Set Mainlayer API Key
```

---

## Commands

| Command | Description |
|---------|-------------|
| `My Extension: Run Free Feature` | Available to all users |
| `My Extension: Run Premium Feature` | Requires an active Premium subscription |
| `My Extension: Set Mainlayer API Key` | Enter or update your API key |
| `My Extension: Refresh Entitlements` | Clear caches and re-check subscription status |

---

## Upgrade to Premium

Run **My Extension: Run Premium Feature** and click **Upgrade Now** to open the in-editor upgrade panel. You can also visit [mainlayer.xyz/pricing](https://mainlayer.xyz/pricing) directly.

After purchasing, run **My Extension: Refresh Entitlements** to activate your new plan immediately.

---

## Architecture

```
src/
  extension.ts      — Entry point, command registration
  mainlayer.ts      — HTTP client for the Mainlayer API
  entitlement.ts    — Entitlement checks with two-layer caching
  upgrade.ts        — Upgrade prompt and API-key flow
  webview.ts        — In-editor pricing/payment WebviewPanel
tests/
  suite/
    extension.test.ts — 17 Mocha unit tests
```

### Caching strategy

Entitlement results are cached at two levels to minimise API calls while keeping latency low:

1. **In-memory session cache** — valid for 5 minutes, wiped on window reload.
2. **`ExtensionContext.globalState`** — persists across sessions with the same TTL. Used as a fallback when the Mainlayer API is unreachable.

---

## Development

```bash
# Install dependencies
npm ci

# Compile and watch
npm run watch

# Run tests (requires a VS Code installation)
npm test

# Lint
npm run lint

# Production build
npm run build

# Package for the Marketplace
npm run package
```

### Running in development

1. Open this repository in VS Code.
2. Press `F5` to launch the **Extension Development Host**.
3. Use the Command Palette (`Cmd/Ctrl + Shift + P`) to run extension commands.

---

## Configuration reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `myExtension.mainlayerApiKey` | `string` | `""` | Your Mainlayer API key. Keep this private. |

---

## Security

- API keys are stored in VS Code's global settings — never in source control.
- The extension communicates exclusively with `https://api.mainlayer.xyz` over TLS.
- Webview content is rendered with a strict Content Security Policy and per-render nonces.

---

## License

MIT. See [LICENSE](LICENSE) for details.

---

## Support

- Mainlayer documentation: [mainlayer.xyz/docs](https://mainlayer.xyz/docs)
- Extension issues: [github.com/my-org/vscode-extension-mainlayer/issues](https://github.com/my-org/vscode-extension-mainlayer/issues)
