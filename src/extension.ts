import * as vscode from 'vscode'
import { MainlayerClient } from './mainlayer'
import { EntitlementManager } from './entitlement'
import { showUpgradePrompt, promptForApiKey } from './upgrade'

let entitlements: EntitlementManager | undefined

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('myExtension')
  const apiKey = config.get<string>('mainlayerApiKey') ?? ''

  // If no API key is set, defer client creation but keep the extension running
  // so free features remain available.
  let client: MainlayerClient | undefined
  if (apiKey.trim().length > 0) {
    client = new MainlayerClient(apiKey)
    entitlements = new EntitlementManager(client, context)
  }

  // Re-initialise client when the user updates their API key in settings.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('myExtension.mainlayerApiKey')) {
        const updatedKey =
          vscode.workspace.getConfiguration('myExtension').get<string>('mainlayerApiKey') ?? ''
        if (updatedKey.trim().length > 0) {
          client = new MainlayerClient(updatedKey)
          entitlements = new EntitlementManager(client, context)
          void vscode.window.showInformationMessage('Mainlayer: API key updated.')
        }
      }
    })
  )

  // ------------------------------------------------------------------
  // Free command — available to everyone, no API key required.
  // ------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand('myExtension.freeFeature', () => {
      vscode.window.showInformationMessage('Free feature!')
    })
  )

  // ------------------------------------------------------------------
  // Premium command — requires an active Mainlayer subscription.
  // ------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand('myExtension.premiumFeature', async () => {
      if (!client || !entitlements) {
        const action = await vscode.window.showWarningMessage(
          'A Mainlayer API key is required to use premium features.',
          'Enter API Key'
        )
        if (action === 'Enter API Key') {
          const key = await promptForApiKey()
          if (key) {
            client = new MainlayerClient(key)
            entitlements = new EntitlementManager(client, context)
          }
        }
        return
      }

      const hasAccess = await entitlements.check('premium')
      if (!hasAccess) {
        await showUpgradePrompt(client, { feature: 'premium', featureLabel: 'Premium' })
        return
      }

      vscode.window.showInformationMessage('Premium feature!')
    })
  )

  // ------------------------------------------------------------------
  // "Set API key" command — lets users set their key via Command Palette.
  // ------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand('myExtension.setApiKey', async () => {
      await promptForApiKey()
    })
  )

  // ------------------------------------------------------------------
  // "Refresh entitlements" command — clears caches and re-checks access.
  // ------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand('myExtension.refreshEntitlements', async () => {
      if (!entitlements) {
        void vscode.window.showWarningMessage('No Mainlayer API key configured.')
        return
      }
      await entitlements.clearAll()
      void vscode.window.showInformationMessage('Mainlayer: Entitlements refreshed.')
    })
  )
}

export function deactivate(): void {
  entitlements = undefined
}
