---
name: android-example-voting
description: Build a voting/poll dApp on Midnight Network using the Kuira Android SDK — Compact smart contract with create/cast/close circuits, passkey-derived identity, embedded wallet, Compose UI, reactive ledger reads via observeLedger(), and on-device ZK proving. Use when building a poll or voting dApp targeting Android.
---

# Kuira Voting dApp

This skill generates a runnable voting dApp for Midnight Network using
the [Kuira Android SDK](https://kuiralabs.github.io/kuira-sdk-android/).
Every snippet below is taken directly from the working starter-android
codebase. If the build fails, read the **Failure Modes** sections —
they cover the three most common things that go wrong.

**Primary references:**
- `https://kuiralabs.github.io/kuira-sdk-android/` — Kuira SDK docs
- `https://kuiralabs.github.io/kuira-sdk-android/api/` — Dokka API reference
- `https://github.com/kuiralabs/kuira-starter-android` — official starter
- `https://central.sonatype.com/namespace/io.github.kuiralabs` — Maven Central

---

## What this builds

| Capability | How |
|------------|-----|
| Forge sigil | `PanelBar` — one biometric creates passkey-DID + wallet |
| Deploy contract | Deploy the Compact contract to Midnight |
| Create poll | Organizer-only via SHA-256 admin key match |
| Cast vote | Select one of 4 options, ZK-proved on-device |
| Close poll | Only the admin key holder can close |
| Live results | `observeLedger()` streams state changes reactively |

---

## Pinned Versions

> **Ledger 9 status (21 Nov 2026) — NEEDS CHECK against Kuira.** The
> contract side below is updated to the Ledger 9.1 toolchain: `voting.compact`
> compiles with Compact 0.36.1 (language 0.28.0) for runtime 0.21.0. The Kuira
> SDK is not. Its newest release is `0.1.0-alpha05` (Maven Central, July 2026),
> which predates the Ledger 9 upgrade. Kuira's embedded wallet, on-device prover
> and localnet are Ledger 8-era until Kuira ships a Ledger 9 build. Mainnet
> stopped decoding Ledger 8 transactions on 6 Nov 2026, and Preview relaunched as
> a new Ledger 9 chain on 7 Nov 2026. Until then, this app cannot transact on
> public networks, and its runtime pin must match whatever runtime the Kuira
> build embeds (see §9). Check the Kuira release notes before relying on it.

These are the versions from the working codebase, with the contract
toolchain moved to Ledger 9. Deviating on the Gradle side causes
dependency resolution failures (see §9).

| Layer | Version |
|---|---|
| Kuira SDK (`io.github.kuiralabs:dapp-ui`) | `0.1.0-alpha04` |
| Kuira Contract plugin | `0.1.0-alpha04` |
| Kuira Localnet plugin | `0.1.0-alpha04` |
| AGP | `8.13.2` |
| Kotlin | `2.3.20` |
| KSP | `2.3.6` |
| Hilt | `2.58` |
| Compose BOM | `2026.03.01` |
| Gradle | `8.13` |
| JDK | `17` |
| `compileSdk` / `targetSdk` | `36` |
| `minSdk` | `30` |
| `appcompat` | `1.7.0` |
| `activity-compose` | `1.10.1` |
| `fragment-ktx` | `1.8.5` |
| `hilt-navigation-compose` | `1.1.0` |
| `security-crypto` | `1.1.0-alpha07` |
| `@midnight-ntwrk/compact-runtime` | `@midnight-ntwrk/compact-runtime@0.21.0` (from `references/versions.json`) |
| Compact compiler | `compact compile +0.36.1` (from `references/versions.json`) |
| Compact language pragma | `pragma language_version >= 0.28.0` |

---

## 1) Project Structure

```
kuira-starter-android/
├── settings.gradle.kts
├── build.gradle.kts               # Root (plugin declarations only)
├── gradle.properties               # MUST exist — jvmargs, caching
├── gradle/
│   ├── libs.versions.toml
│   └── wrapper/
│       └── gradle-wrapper.properties  # Gradle 8.13
├── local.properties                # sdk.dir — NOT committed
├── contract/
│   ├── package.json
│   ├── scripts/
│   │   └── patch-voting.js
│   └── src/
│       ├── voting.compact
│       └── managed/voting/         # Compiled artifacts (gitignored)
├── app/
│   ├── build.gradle.kts
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── res/
│       │   │   ├── values/
│       │   │   │   ├── strings.xml
│       │   │   │   └── themes.xml
│       │   │   ├── xml/
│       │   │   │   └── network_security_config.xml
│       │   │   ├── drawable/
│       │   │   │   ├── ic_launcher_foreground.xml
│       │   │   │   └── ic_launcher_background.xml
│       │   │   └── mipmap-anydpi-v26/
│       │   │       └── ic_launcher.xml
│       │   └── java/com/kuiralabs/starter/counter/
│       │       ├── KuiraStarterApp.kt
│       │       ├── MainActivity.kt
│       │       ├── di/PasskeyConfigModule.kt
│       │       ├── data/
│       │       │   ├── VotingContract.kt
│       │       │   └── ContractAddressStore.kt
│       │       └── ui/
│       │           ├── theme/{Color,Type,Theme}.kt
│       │           ├── VotingScreen.kt
│       │           ├── VotingCard.kt
│       │           ├── VotingViewModel.kt
│       │           └── VotingUiState.kt
│       └── debug/AndroidManifest.xml   # Cleartext for localnet
```

**Warning:** `local.properties` must exist with `sdk.dir=...` or the
AGP `android` block can't resolve `compileSdk`. Android Studio creates
it; in CI you must create it manually or use an env var.

---

## 2) Prerequisites

### 2.1) Toolchain

```bash
java --version               # JDK 17+
node --version                # Node.js 18+
compact update 0.36.1         # Install Compact compiler
compact list                  # Verify 0.36.1 is installed (the compile script pins +0.36.1)
```

### 2.2) Android Setup

- Android Studio Ladybug+
- Device/emulator Android 13+ (API 33+) with screen lock set
- Domain for passkey `rpId` (or use GitHub Pages)
- Google Password Manager (GMS Core 23.40.13+)

### 2.3) Gradle wrapper

The wrapper at `gradle/wrapper/gradle-wrapper.properties` must specify
Gradle 8.13 (matching AGP 8.13.2):

```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

---

## 3) Gradle Configuration

Full content: [references/gradle-configuration.md](references/gradle-configuration.md). It covers version catalog, root/app `build.gradle.kts`, settings, and the Kuira SDK dependency wiring. Open it when you reach this step.

---

## 4) Android Resources

Full content: [references/android-resources.md](references/android-resources.md). It covers manifest, strings, themes, and other `res/` files. Open it when you reach this step.

---

## 5) Contract

Full content: [references/contract.md](references/contract.md). It covers the voting Compact contract (create/cast/close circuits) and how it is compiled and bundled into the app. Open it when you reach this step.

---

## 6) Application & DI

Full content: [references/application-di.md](references/application-di.md). It covers the `Application` class and dependency-injection setup. Open it when you reach this step.

---

## 7) Data Layer

Full content: [references/data-layer.md](references/data-layer.md). It covers repositories, wallet/identity plumbing, and reactive ledger reads via `observeLedger()`. Open it when you reach this step.

---

## 8) UI Layer

Full content: [references/ui-layer.md](references/ui-layer.md). It covers every Compose screen, view model, and navigation file. Open it when you reach this step.

---

## 9) Failure Modes & Troubleshooting

### 9.1) Build failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Could not find method kuiraContract()` | `io.github.kuiralabs.contract` plugin not applied | Check the plugin ID and version in `app/build.gradle.kts` |
| `Cannot access class 'com.midnight.kuira.*'` | Kuira dep not resolved | Check `mavenCentral()` in `settings.gradle.kts`, verify `kuira` version in catalog |
| `[Dagger/MissingBinding] PasskeyConfig` | No `PasskeyConfigModule` | Create the module (§6.2) |
| `OutOfMemoryError: Metaspace` | Not enough JVM heap | Bump `org.gradle.jvmargs` to `-Xmx4096m` |
| `Configuration cache state found but cache is disabled` | Changed config cache setting mid-project | Delete `~/.gradle/configuration-cache/` and rebuild |
| `Could not find required SDK platform API 36` | SDK platform not installed | Install Android SDK Platform 36 |
| `java.lang.RuntimeException: Cannot load contract JS` | Asset not synced | Run `./gradlew :app:assembleDebug` to trigger `kuiraContract` sync |
| `IllegalStateException: Contract not compiled at .../managed/voting` | `kuiraContract.validateKuiraContractSource` failing | Run `npm run compile:voting` in `contract/` |

### 9.2) Runtime failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `"Could not find module '@midnight-ntwrk/compact-runtime'"` | Runtime version mismatch | Check `contract-info.json` vs `package.json` (§5.1) |
| `CircuitExecutionException: Only admin can close poll` | Wrong witness value | The hardcoded `ADMIN_SECRET` matches or it doesn't. No recovery from a different device. |
| `CircuitExecutionException: Poll is closed` | Already closed | Wait for next poll — no reopen circuit exists |
| `TypeError: optionIdx_0 is not a function` | BigInt patch failed | Check `patch-voting.js` matches the generated JS (§5.2) |
| `SessionLock attach failed` | Called from wrong lifecycle | Call in `Application.onCreate()`, not `Activity.onCreate()` |
| `WalletNotifications.shouldRequest` crash on API < 33 | Runtime check not guarded | The SDK handles this internally; if it crashes, you may have minSdk < 30 |
| `NullPointerException` on `readLedger` before createPoll | `adminKeyHash` is undefined | Handle `VotingLedger.adminKeyHash` being all-zeros or null in UI |
| App shows "Forge a sigil" but user already has one | SDK state reset | Clear app data and re-forge, or check logcat for `SigilStateProvider` errors |

### 9.3) Network failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `java.net.ConnectException: Connection refused` | Localnet not running | Run `mn localnet up` |
| `javax.net.ssl.SSLHandshakeException` | Cleartext blocked on localnet | Add `10.0.2.2` to `network_security_config.xml` (§4.3) or use debug manifest (§4.5) |
| `RP_ID_MISMATCH` | Passkey domain changed | Delete credential in Google Password Manager, re-forge |
| `INSUFFICIENT_DUST` | Wallet not funded | Airdrop NIGHT and register dust (§10.2) |
| Transaction pending forever | Indexer not synced | Wait for `observeLedger()` to emit or check indexer health |

### 9.4) Contract compilation failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Error: Unknown compiler version +0.36.1` | compactc not installed at that version | `compact update 0.36.1` |
| `Could not find package '@midnight-ntwrk/compact-runtime'` | npm deps not installed | `cd contract && npm install` |
| `Syntax error: expected ';'` | Language version mismatch | Check `pragma language_version` matches toolchain |
| `The compiler cannot find module` | Import path issue | Ensure `contract-info.json` paths are relative |

### 9.5) Gradle version catalog gotchas

- **Kotlin ↔ KSP version coupling:** Kotlin 2.3.20 requires KSP
  2.3.6. If you upgrade Kotlin to 2.3.21, you MUST also find and
  upgrade KSP to the matching version. The KSP version format is
  `<kotlin-version>-<ksp-release>`.

- **AppCompat 1.7.x requires fragment-ktx 1.8.x** — mixing a newer
  appcompat with an older fragment causes
  `NoSuchMethodError: Fragment.getParentFragmentManager()`.

- **AGP ↔ Gradle coupling:** AGP 8.13 requires Gradle 8.13. If you
  change the wrapper distribution URL, the `buildscript` classpath
  will fail.

- **Compose BOM and compiler:** The `kotlin-compose` plugin in Kotlin
  2.0+ replaces the old `composeOptions { kotlinCompilerExtensionVersion }`
  block. Do NOT set a compose compiler version manually — the BOM
  and plugin coordinate automatically.

---

## 10) Wallet & Deploy Flow

### 10.1) Prerequisite: Passkey domain

1. Pick a domain you control (e.g., `yourname.github.io`)
2. Upload `assetlinks.json` to `https://<domain>/.well-known/`
3. Set `PASSKEY_RP_ID` in `PasskeyConfigModule.kt`

### 10.2) Wallet funding (localnet)

1. Open app, tap **Forge sigil** in the wallet panel
2. Copy wallet address from the wallet panel
3. Airdrop NIGHT:
   ```bash
   mn airdrop 1000 --wallet <addr> --network undeployed
   ```
4. In app, tap **Register dust** in the wallet panel
5. Wait ~30 seconds for dust sync
6. Tap **Deploy contract**

### 10.3) Using the app

1. **Create poll:** Enter question + options (comma-separated), tap
   "Create poll". Wait for the transaction to confirm.
2. **Cast vote:** Tap an option card. The `ContractCallProgressBar`
   shows ZK proving progress. After success, the "You Voted" badge
   appears and tallies update.
3. **Close poll:** Tap "Close poll" (only works on the device that
   deployed). After close, the "Closed" badge appears and voting is
   disabled.
4. **Switch network:** Use the network selector in `PanelBar`. Each
   network has its own deployed contract address.
5. **Disconnect:** Clears the persisted address, returns to deploy
   screen.

---

## 11) Testing & Verification

### Localnet flow

```bash
# Start localnet (Docker stack)
mn localnet up

# Compile contract
cd contract && npm install && npm run compile:voting

# Install + run
cd .. && ./gradlew :app:installDebug
```

### Verify APK assets

```bash
./gradlew :app:assembleDebug
unzip -l app/build/outputs/apk/debug/app-debug.apk | grep voting
# Expected:
#   assets/runtime/voting-contract.js
#   assets/keys/createPoll.verifier
#   assets/keys/castVote.verifier
#   assets/keys/closePoll.verifier
#   assets/keys/createPoll.prover
#   assets/keys/castVote.prover
#   assets/keys/closePoll.prover
#   assets/keys/*.bzkir    (if bundleWalletKeys is enabled)
```

### Pre-release check

```bash
./gradlew kuiraDoctor
```

Catches: missing `PasskeyConfig` binding, unhosted `assetlinks.json`,
stale contract artifacts, missing assets.

---

## 12) Toolchain Bump Procedure

When `compactc`, the language version, or `@midnight-ntwrk/compact-runtime`
updates:

1. `compact update <new-version>` and `compact list` to confirm
2. Bump `engines.compactc` in `contract/package.json`
3. Bump `@midnight-ntwrk/compact-runtime` in `contract/package.json`
4. **CRITICAL:** Update the `+<version>` pin in `compile:voting` script
5. Check `scripts/patch-voting.js` against newly generated JS —
   variable names may have changed
6. `rm -rf src/managed/voting && npm run compile:voting`
7. Verify runtime version in `contract-info.json` matches
   `package.json`
8. `./gradlew :app:assembleDebug` to trigger asset resync
9. Run the localnet flow to verify deploy + createPoll + castVote +
   closePoll all work
10. `./gradlew kuiraDoctor`
11. Commit regenerated artifacts

---

## 13) SDK APIs Used

| API | Purpose |
|-----|---------|
| `MidnightSdkProvider` | Injected singleton providing `MidnightSdk` + network selection |
| `MidnightContract.create(config) { }` | Build contract handle with name, JS, address, verifier keys, witnesses |
| `.deploy(onProgress)` | Deploy contract, returns `DeployResult (.contractAddress)` |
| `.call(circuit, vararg args, onProgress)` | Call a circuit — circuit `assert` failure throws `CircuitExecutionException` |
| `.ledger()` | Read current on-chain state, returns typed `MidnightLedger` |
| `.observeLedger()` | Reactive `Flow<MidnightLedger>` — emits current state then each change |
| `MidnightLedger.getBoolean/getString/getStringOrNull/getUint64/getBytes(n, size)` | Typed ledger field accessors |
| `ProvingKeyManager.installCircuitKeysFromAssets()` | Stage proving keys from assets for on-device proving |
| `PanelBar(floating = true, network, onNetworkChange)` | Drop-in floating sigil + wallet pills |
| `WalletAppShell { }` | Root wrapper — `SessionLockGate` + `WalletOverlayHost` |
| `ContractCallProgressBar(stage, accent)` | Built-in progress for deploy/call stages |
| `WalletForegroundService.attach(this)` | Background wallet ops survive app backgrounding |
| `SessionLock.attach(this)` / `.onUserActivity()` | App-wide auto-lock + idle-timer reset |
| `WalletNotifications.shouldRequest(this)` / `PERMISSION` | `POST_NOTIFICATIONS` gating for API 33+ |
| `MidnightSdk.coinPublicKey` | The wallet's public key needed for write handles |
| `WitnessResult(null, bytes)` | Witness provider returning a static byte array |

---

## 14) References

- [Kuira SDK Home](https://kuiralabs.github.io/kuira-sdk-android/)
- [Kuira API Reference (Dokka)](https://kuiralabs.github.io/kuira-sdk-android/api/)
- [Kuira Add to Android Project](https://kuiralabs.github.io/kuira-sdk-android/recipes/add-kuira-to-an-android-project/)
- [Kuira Bind to a Passkey Domain](https://kuiralabs.github.io/kuira-sdk-android/recipes/bind-your-app-to-a-passkey-domain/)
- [Kuira Set Up Sigil Identity](https://kuiralabs.github.io/kuira-sdk-android/recipes/set-up-sigil-identity/)
- [Kuira Hello Compact](https://kuiralabs.github.io/kuira-sdk-android/recipes/hello-compact/)
- [Kuira Deploy and Call a Contract](https://kuiralabs.github.io/kuira-sdk-android/recipes/deploy-and-call-a-compact-contract/)
- [Kuira Run kuiraDoctor](https://kuiralabs.github.io/kuira-sdk-android/recipes/run-kuira-doctor/)
- [Kuira llms.txt](https://kuiralabs.github.io/kuira-sdk-android/llms.txt)
- [Kuira Starter (GitHub)](https://github.com/kuiralabs/kuira-starter-android)
