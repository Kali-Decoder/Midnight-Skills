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

These are the actual versions from the working codebase. Deviating
causes dependency resolution failures (see §9).

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
| `@midnight-ntwrk/compact-runtime` | `0.16.0` |
| Compact compiler | `0.31.0` (pinned on compile command) |
| Compact language pragma | `>= 0.22` |

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
compact update 0.31.0         # Install Compact compiler
compact list                  # Verify 0.31.0 is the default
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

### 3.1) `gradle.properties` — **REQUIRED**

Without this file, Gradle uses defaults that make the build extremely
slow or break the configuration cache:

```properties
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official

org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.configuration-cache=true
```

**Failure mode:** Without `android.useAndroidX=true`, the SDK's
`AppCompatActivity` dependency resolves to the old support library and
fails at runtime with `ClassNotFoundException`.

**Failure mode:** Without `org.gradle.jvmargs=-Xmx2048m`, KSP+Hilt
together can OOM on large-ish projects. Bump to `-Xmx4096m` if you see
`OutOfMemoryError: Metaspace`.

**Failure mode:** `org.gradle.configuration-cache=true` will break if
your `app/build.gradle.kts` accesses project files at configuration
time (e.g., `file("../contract")`). The Copy tasks below avoid this by
using `rootProject.file()` with `doFirst`, but if you add a plugin
that reads files during evaluation, disable configuration cache.

### 3.2) `settings.gradle.kts`

```kotlin
pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "kuira-starter-android"
include(":app")
```

**Gotcha:** `FAIL_ON_PROJECT_REPOS` means you CANNOT declare
`repositories { ... }` inside `app/build.gradle.kts`. If a library
isn't in google() or mavenCentral(), add it to
`dependencyResolutionManagement` here.

### 3.3) Root `build.gradle.kts`

```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
}
```

Note: The Kuira contract plugin (`io.github.kuiralabs.contract`) and
localnet plugin (`io.github.kuiralabs.localnet`) are applied by ID and
version directly in `app/build.gradle.kts`, not through the version
catalog. They do NOT appear here.

### 3.4) `gradle/libs.versions.toml`

```toml
[versions]
agp = "8.13.2"
kotlin = "2.3.20"
ksp = "2.3.6"
hilt = "2.58"
composeBom = "2026.03.01"

androidxAppcompat = "1.7.0"
androidxActivity = "1.10.1"
androidxFragment = "1.8.5"
androidxLifecycle = "2.8.7"
androidxHiltNavCompose = "1.1.0"
androidxSecurityCrypto = "1.1.0-alpha07"

kuira = "0.1.0-alpha04"

[libraries]
androidx-appcompat = { group = "androidx.appcompat", name = "appcompat", version.ref = "androidxAppcompat" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "androidxActivity" }
androidx-fragment-ktx = { group = "androidx.fragment", name = "fragment-ktx", version.ref = "androidxFragment" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "androidxLifecycle" }
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "androidxLifecycle" }
androidx-hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version.ref = "androidxHiltNavCompose" }
androidx-security-crypto = { group = "androidx.security", name = "security-crypto", version.ref = "androidxSecurityCrypto" }

androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-compose-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-compose-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }

hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-compiler", version.ref = "hilt" }

kuira-dapp-ui = { group = "io.github.kuiralabs", name = "dapp-ui", version.ref = "kuira" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
```

**Version pinning rules:**
- AGP and Gradle wrapper MUST match major.minor: AGP 8.13.x ↔ Gradle 8.13
- Kotlin and KSP MUST match exactly: Kotlin 2.3.20 ↔ KSP 2.3.6
- Compose BOM and Compose compiler plugin are coupled via
  `kotlin-compose` plugin — do NOT set a compose-compiler version manually
- Hilt and ksp-hilt must match the Hilt version (the ksp artifact
  resolves transitively, no explicit dep needed)

### 3.5) `app/build.gradle.kts`

```kotlin
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    id("io.github.kuiralabs.contract") version "0.1.0-alpha04"
    id("io.github.kuiralabs.localnet") version "0.1.0-alpha04"
}

android {
    namespace = "com.kuiralabs.starter.counter"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.kuiralabs.starter.counter"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug { isMinifyEnabled = false }
        release { isMinifyEnabled = false }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures { compose = true }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

kuiraContract {
    source.set("../contract/src/managed/voting")
    bundleWalletKeys.set(true)
}

// Hand-rolled Copy to sync voting contract assets (the plugin handles
// the primary source; this is explicit for clarity and matches the
// starter codebase pattern):
tasks.register<Copy>("syncVotingAssets") {
    description = "Sync compiled Voting compact contract artifacts into app assets."
    group = "build"
    from("../contract/src/managed/voting/contract") {
        include("index.js")
        rename { "voting-contract.js" }
        into("runtime")
    }
    from("../contract/src/managed/voting/keys") {
        include("*.prover", "*.verifier")
        into("keys")
    }
    from("../contract/src/managed/voting/zkir") {
        include("*.bzkir")
        into("keys")
    }
    into("src/main/assets")
    doFirst {
        if (!file("../contract/src/managed/voting").exists()) {
            throw GradleException("Contract not compiled — run `npm run compile:voting` in contract/ first.")
        }
    }
}

tasks.named("preBuild") { dependsOn("syncVotingAssets") }

dependencies {
    implementation(libs.kuira.dapp.ui)

    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.fragment.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.security.crypto)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
}
```

**Plugin details:**

`io.github.kuiralabs.contract` — processes the `kuiraContract { ... }`
block. It:
1. Registers `validateKuiraContractSource` — fails the build with a
   clear message if `../contract/src/managed/voting` doesn't exist
2. Registers `syncContractAssets` — copies JS + keys into
   `src/main/assets/{runtime,keys}/`
3. Wires `syncContractAssets` into `preBuild`
4. The `bundleWalletKeys.set(true)` flag makes the plugin copy
   `.bzkir` bundle files into assets during the bundle task

`io.github.kuiralabs.localnet` — auto-runs `adb reverse` for the
localnet ports on physical devices during `installDebug`. No-op on
emulators (they use `10.0.2.2`).

**Why both plugin and Copy task?** The `kuiraContract` plugin handles
the primary source automatically (syncing JS + keys + bundleWalletKeys).
The hand-rolled `Copy` task exists in the starter codebase as an
explicit parallel sync. For this skill, the plugin alone is sufficient;
the Copy task is provided for clarity.

**Failure mode:** If `minSdk < 30`, the SDK fails at runtime because
it depends on `android.security.identity.IdentityCredential` (API 30+)
and `CredentialManager` (API 34+, with API 30+ fallback path).

**Failure mode:** If `compileSdk != 36` or `targetSdk != 36`, the
Kuira SDK's `WalletNotifications.PERMISSION` constant (`POST_NOTIFICATIONS`
added API 33, behavior change in API 34) may not resolve correctly.
Keep compileSdk = 36.

---

## 4) Android Resources

### 4.1) `app/src/main/res/values/strings.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Kuira Starter</string>
</resources>
```

### 4.2) `app/src/main/res/values/themes.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.KuiraStarter" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowBackground">@android:color/black</item>
    </style>
</resources>
```

**Why AppCompat parent?** `MainActivity` extends `AppCompatActivity`
(not `ComponentActivity`) because the SDK's `SigilStatusPanel` hosts
a biometric prompt internally. The prompt requires a `FragmentActivity`
— `AppCompatActivity` satisfies that; `ComponentActivity` does not.
The theme XML must have a compatible parent.

### 4.3) `app/src/main/res/xml/network_security_config.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="false" />
</network-security-config>
```

**Prefer this over `android:usesCleartextTraffic="true"`** in the
manifest. Both work on localnet, but this approach doesn't open
cleartext to the whole internet for the debug build. If you use the
debug manifest approach (see §4.5), it's enabled only for the `debug`
build type, so it's also safe.

### 4.4) Main `AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:name=".KuiraStarterApp"
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:networkSecurityConfig="@xml/network_security_config"
        android:supportsRtl="true"
        android:theme="@style/Theme.KuiraStarter">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="@string/app_name"
            android:theme="@style/Theme.KuiraStarter">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

**Network config:** The `android:networkSecurityConfig` attribute
pointing to `@xml/network_security_config` allows cleartext to
localhost/emulator host for localnet without globally enabling it.

### 4.5) Debug manifest (alternative to network_security_config)

`app/src/debug/AndroidManifest.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:usesCleartextTraffic="true" />
</manifest>
```

Merge rules: the debug manifest is merged into the main manifest for
debug builds only. It's simpler than the security config approach but
opens cleartext to ALL hosts, not just localnet.

**Failure mode:** If you use both `networkSecurityConfig` AND
`usesCleartextTraffic="true"`, the security config wins. If the
config doesn't include the right domain, cleartext still fails.

---

## 5) Contract

### 5.1) `contract/package.json`

```json
{
  "name": "@yourapp/voting-contract",
  "version": "0.1.0",
  "private": true,
  "description": "Voting contract for the Kuira Voting dApp. Compiled artifacts under src/managed/voting/ are consumed by the Android app via the kuiraContract Gradle plugin.",
  "scripts": {
    "compile:voting": "compact compile +0.31.0 src/voting.compact src/managed/voting && node scripts/patch-voting.js",
    "inspect:voting": "mn contract inspect --managed src/managed/voting"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.16.0"
  },
  "engines": {
    "compactc": "0.31.0"
  }
}
```

**Failure mode: Runtime version mismatch.** The compiled JS at
`src/managed/voting/contract/index.js` has a hard-coded runtime
version require. If the `@midnight-ntwrk/compact-runtime` version in
`package.json` doesn't match what the compiler baked in at compile
time, the Android app throws a JS runtime error when loading the
contract.

**Symptoms:** `"Could not find module '@midnight-ntwrk/compact-runtime'"`
or a cryptic `TypeError` from the JS engine.

**Fix:** Check `contract-info.json` in the managed output:
```bash
cat src/managed/voting/compiler/contract-info.json
# Look for "runtime-version" — must match package.json's dep
```
If they differ, either bump `@midnight-ntwrk/compact-runtime` in
`package.json` to match, or recompile with the correct toolchain
version.

**The `+0.31.0` pin** on the `compact compile` command is critical.
Without it, the command uses whatever compiler `compact` toolchain
has as default, which may mismatch the runtime version the contract
was last compiled with. Always pin.

### 5.2) `contract/scripts/patch-voting.js`

```javascript
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'managed', 'voting', 'contract', 'index.js');
let src = fs.readFileSync(file, 'utf8');

src = src.replace(
  "const optionIdx_0 = args_1[1]",
  "let optionIdx_0 = args_1[1];\n        if (typeof optionIdx_0 !== 'bigint') optionIdx_0 = BigInt(optionIdx_0)"
);

fs.writeFileSync(file, src, 'utf8');
console.log('Patched BigInt shim into voting contract JS');
```

**Why this patch is needed:** The Kuira SDK's Kotlin-to-JS bridge
sends Kotlin `Long` as JS `number`, not `bigint`. The Compact type
`Uint<64>` expects `bigint`. Without the patch, `castVote(0)` passes
`0` (JS number) which fails `typeof` checks inside the runtime.

**Failure mode:** If `compact compile` generates different variable
names, this string match silently no-ops. After any toolchain bump,
diff `contract/index.js` against a known-good copy.

**Failure mode:** The patched line assumes `optionIdx_0 = args_1[1]`
is the first argument to the castVote circuit. This is compiler-
generated and can change. Always verify the patch works after
recompiling.

### 5.3) `contract/src/voting.compact`

```compact
pragma language_version >= 0.22;

import CompactStandardLibrary;

export ledger pollQuestion: Opaque<"string">;
export ledger pollOptions: Opaque<"string">;
export ledger adminKeyHash: Bytes<32>;
export ledger voteCount: Uint<64>;
export ledger tally0: Uint<64>;
export ledger tally1: Uint<64>;
export ledger tally2: Uint<64>;
export ledger tally3: Uint<64>;
export ledger pollClosed: Boolean;

witness adminSecret(): Bytes<32>;

pure circuit deriveAdminKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "poll:admin:v1"), sk]);
}

constructor() {
  pollClosed = false;
  tally0 = 0;
  tally1 = 0;
  tally2 = 0;
  tally3 = 0;
  voteCount = 0;
}

export circuit createPoll(question: Opaque<"string">, options: Opaque<"string">): [] {
  pollQuestion = disclose(question);
  pollOptions = disclose(options);
  adminKeyHash = disclose(deriveAdminKey(adminSecret()));
}

export circuit castVote(optionIdx: Uint<64>): [] {
  assert(!pollClosed, "Poll is closed");
  assert(optionIdx < 4, "Invalid option index (0-3)");

  const idx = disclose(optionIdx);
  const count = voteCount;
  voteCount = disclose((count + 1) as Uint<64>);

  if (idx == 0) {
    tally0 = (tally0 + 1) as Uint<64>;
  } else if (idx == 1) {
    tally1 = (tally1 + 1) as Uint<64>;
  } else if (idx == 2) {
    tally2 = (tally2 + 1) as Uint<64>;
  } else {
    tally3 = (tally3 + 1) as Uint<64>;
  }
}

export circuit closePoll(): [] {
  assert(adminKeyHash == deriveAdminKey(adminSecret()), "Only admin can close poll");
  pollClosed = disclose(true);
}
```

**Key contract design decisions:**

- **No `created` ledger field.** Unlike typical CRUD contracts, this
  contract doesn't track whether a poll has been created. The UI
  infers this from `pollQuestion != ""`. Calling `createPoll` twice
  would overwrite the first poll (there's no `assert(!created)` guard).
  This is intentional for simplicity.

- **`deriveAdminKey` is a `pure circuit`.** This means it produces no
  public output on its own — it's only used inside other circuits.
  The `pure` keyword means the circuit has no ledger writes and no
  public inputs; it's a helper function.

- **`>= 0.22` language version range** (not exact). This accepts any
  compatible 0.22.x compiler. The `compact compile +0.31.0` command
  line pin is what actually selects the compiler.

- **`pollClosed` is set to `true` via `disclose()`.** When the poll
  is closed, `pollClosed` becomes public and visible on-chain. Before
  closing, it defaults to `false` (from the constructor).

- **No double-vote guard.** There's no `Set<Bytes<32>>` checking
  voter identity. The `hasVoted` flag in the UI is just a local cache
  from `observeLedger()`. A user who votes, reinstalls, and votes
  again would succeed. This is by design for this simple contract.

- **`adminKeyHash` is set in `createPoll`, not in the constructor.**
  The constructor initializes it to... nothing (the Compact default).
  This means the first `createPoll` sets the admin key; subsequent
  calls would overwrite it (there's no guard). The Android side's
  `closePoll` assert checks against the CURRENT `adminKeyHash`, so
  only someone who knows `adminSecret()` can close.

### 5.4) Compile the contract

```bash
cd contract
npm install
npm run compile:voting
```

Expected output:
```
Compiling 3 circuits:
  circuit "createPoll" (k=...)
  circuit "castVote" (k=...)
  circuit "closePoll" (k=...)
Patched BigInt shim into voting contract JS
```

If the patch line doesn't appear, the `contract/index.js` doesn't
have the expected variable name. Check and update the regex.

After compiling, verify the runtime version:
```bash
cat src/managed/voting/compiler/contract-info.json
# Confirm runtime-version matches @midnight-ntwrk/compact-runtime in package.json
```

---

## 6) Application & DI

### 6.1) `KuiraStarterApp.kt`

```kotlin
package com.kuiralabs.starter.counter

import android.app.Application
import com.midnight.kuira.sdk.walletruntime.SessionLock
import com.midnight.kuira.sdk.walletruntime.WalletForegroundService
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class KuiraStarterApp : Application() {
    override fun onCreate() {
        super.onCreate()
        SessionLock.attach(this)
        WalletForegroundService.attach(this)
    }
}
```

**`SessionLock.attach(this)`** registers the app-level session lock
triggers: background detection (screen off / home button) and idle
timeout. Per-Activity reset is handled by `onUserInteraction`.

**`WalletForegroundService.attach(this)`** keeps wallet operations
(dust sync, send, contract calls) alive when the app backgrounds.
Shows a progress notification; tears down on foreground or lock.

**Failure mode:** If you forget `@HiltAndroidApp`, Dagger can't
initialize the dependency graph and you get a runtime crash on launch
(`dagger.hilt.internal.NoopComponentManager`).

### 6.2) `di/PasskeyConfigModule.kt`

```kotlin
package com.kuiralabs.starter.counter.di

import com.midnight.kuira.core.identity.passkey.PasskeyConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object PasskeyConfigModule {

    private const val PASSKEY_RP_ID = "YOUR_DOMAIN.example.com"

    @Provides
    @Singleton
    fun providePasskeyConfig(): PasskeyConfig =
        PasskeyConfig(rpId = PASSKEY_RP_ID, rpName = "Kuira Sigil")
}
```

**Why Dagger won't compile without this:** The Kuira SDK declares
`PasskeyConfig` as a required binding in its own module. If the
consuming app doesn't provide one, Dagger fails at compile time with
`[Dagger/MissingBinding] PasskeyConfig is injected at ...`. This is
intentional — the SDK can't know your domain.

**Passkey domain setup:**
1. Set `PASSKEY_RP_ID` to a domain you control
2. Host `assetlinks.json` at `https://<rpId>/.well-known/assetlinks.json`
   with your app's `applicationId` and signing SHA-256:
   ```bash
   ./gradlew signingReport | grep SHA-256
   ```
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.kuiralabs.starter.counter",
       "sha256_cert_fingerprints": ["SHA-256:..."]
     }
   }]
   ```

**Failure mode:** `RP_ID_MISMATCH` at runtime: the passkey credential
was created with one `rpId` but you're now using a different one.
Only solution: delete the credential from Google Password Manager and
re-create it.

---

## 7) Data Layer

### 7.1) `data/VotingContract.kt`

This is the core contract wrapper. Every detail matters.

```kotlin
package com.kuiralabs.starter.counter.data

import android.content.Context
import com.midnight.kuira.core.compact.ContractCallStage
import com.midnight.kuira.core.compact.MidnightContract
import com.midnight.kuira.core.compact.WitnessResult
import com.midnight.kuira.core.compact.proving.ProvingKeyManager
import com.midnight.kuira.sdk.MidnightSdk
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.security.MessageDigest

internal object VotingContract {

    private const val NAME = "voting"
    private const val CIRCUIT_CREATE_POLL = "createPoll"
    private const val CIRCUIT_CAST_VOTE = "castVote"
    private const val CIRCUIT_CLOSE_POLL = "closePoll"
    private const val WITNESS_ADMIN_SECRET = "adminSecret"

    private const val LEDGER_FIELD_POLL_QUESTION = "pollQuestion"
    private const val LEDGER_FIELD_POLL_OPTIONS = "pollOptions"
    private const val LEDGER_FIELD_ADMIN_KEY_HASH = "adminKeyHash"
    private const val LEDGER_FIELD_VOTE_COUNT = "voteCount"
    private const val LEDGER_FIELD_TALLY0 = "tally0"
    private const val LEDGER_FIELD_TALLY1 = "tally1"
    private const val LEDGER_FIELD_TALLY2 = "tally2"
    private const val LEDGER_FIELD_TALLY3 = "tally3"
    private const val LEDGER_FIELD_POLL_CLOSED = "pollClosed"

    private const val CONTRACT_JS_ASSET = "runtime/$NAME-contract.js"
    private const val VERIFIER_ASSET_CREATE = "keys/$CIRCUIT_CREATE_POLL.verifier"
    private const val VERIFIER_ASSET_CAST = "keys/$CIRCUIT_CAST_VOTE.verifier"
    private const val VERIFIER_ASSET_CLOSE = "keys/$CIRCUIT_CLOSE_POLL.verifier"

    private val ADMIN_SECRET = ByteArray(32) { 0x42 }

    private fun loadVerifierKeys(context: Context): Map<String, ByteArray> {
        val createVerifier = context.assets.open(VERIFIER_ASSET_CREATE).use { it.readBytes() }
        val castVerifier = context.assets.open(VERIFIER_ASSET_CAST).use { it.readBytes() }
        val closeVerifier = context.assets.open(VERIFIER_ASSET_CLOSE).use { it.readBytes() }
        return mapOf(
            CIRCUIT_CREATE_POLL to createVerifier,
            CIRCUIT_CAST_VOTE to castVerifier,
            CIRCUIT_CLOSE_POLL to closeVerifier,
        )
    }

    private fun installProvingKeys(context: Context) {
        ProvingKeyManager(context).installCircuitKeysFromAssets()
    }

    private fun buildHandle(
        context: Context,
        sdk: MidnightSdk,
        address: String?,
        forWrite: Boolean,
    ): MidnightContract = MidnightContract.create(sdk.config) {
        name = NAME
        contractJs = context.assets.open(CONTRACT_JS_ASSET)
        if (address != null) this.address = address
        if (forWrite) {
            coinPublicKey = sdk.coinPublicKey
            circuitVerifierKeys = loadVerifierKeys(context)
            witness(WITNESS_ADMIN_SECRET) { adminSecretWitness() }
        }
    }

    private fun adminSecretWitness(): WitnessResult =
        WitnessResult(null, ADMIN_SECRET)

    private suspend fun stageKeysAndHandle(
        context: Context,
        sdk: MidnightSdk,
        address: String?,
    ): MidnightContract {
        installProvingKeys(context)
        return buildHandle(context, sdk, address = address, forWrite = true)
    }

    suspend fun deploy(
        context: Context,
        sdk: MidnightSdk,
        onProgress: (suspend (ContractCallStage) -> Unit)? = null,
    ): String {
        val handle = stageKeysAndHandle(context, sdk, address = null)
        return handle.deploy(onProgress = onProgress).contractAddress
    }

    suspend fun createPoll(
        context: Context,
        sdk: MidnightSdk,
        address: String,
        question: String,
        options: String,
        onProgress: (suspend (ContractCallStage) -> Unit)? = null,
    ) {
        val handle = stageKeysAndHandle(context, sdk, address = address)
        handle.call(CIRCUIT_CREATE_POLL, question, options, onProgress = onProgress)
    }

    suspend fun castVote(
        context: Context,
        sdk: MidnightSdk,
        address: String,
        optionIdx: Long,
        onProgress: (suspend (ContractCallStage) -> Unit)? = null,
    ) {
        val handle = stageKeysAndHandle(context, sdk, address = address)
        handle.call(CIRCUIT_CAST_VOTE, optionIdx, onProgress = onProgress)
    }

    suspend fun closePoll(
        context: Context,
        sdk: MidnightSdk,
        address: String,
        onProgress: (suspend (ContractCallStage) -> Unit)? = null,
    ) {
        val handle = stageKeysAndHandle(context, sdk, address = address)
        handle.call(CIRCUIT_CLOSE_POLL, onProgress = onProgress)
    }

    fun buildReadHandle(context: Context, sdk: MidnightSdk, address: String): MidnightContract =
        buildHandle(context, sdk, address = address, forWrite = false)

    data class VotingLedger(
        val pollQuestion: String,
        val pollOptions: String,
        val adminKeyHash: ByteArray,
        val voteCount: Long,
        val tally0: Long,
        val tally1: Long,
        val tally2: Long,
        val tally3: Long,
        val pollClosed: Boolean,
    )

    suspend fun readLedger(handle: MidnightContract): VotingLedger {
        val ledger = handle.ledger()
        return VotingLedger(
            pollQuestion = ledger.getStringOrNull(LEDGER_FIELD_POLL_QUESTION) ?: "",
            pollOptions = ledger.getStringOrNull(LEDGER_FIELD_POLL_OPTIONS) ?: "",
            adminKeyHash = ledger.getBytes(LEDGER_FIELD_ADMIN_KEY_HASH, 32),
            voteCount = ledger.getUint64(LEDGER_FIELD_VOTE_COUNT),
            tally0 = ledger.getUint64(LEDGER_FIELD_TALLY0),
            tally1 = ledger.getUint64(LEDGER_FIELD_TALLY1),
            tally2 = ledger.getUint64(LEDGER_FIELD_TALLY2),
            tally3 = ledger.getUint64(LEDGER_FIELD_TALLY3),
            pollClosed = ledger.getBoolean(LEDGER_FIELD_POLL_CLOSED),
        )
    }

    fun observeLedger(handle: MidnightContract): Flow<VotingLedger> =
        handle.observeLedger().map { ledger ->
            VotingLedger(
                pollQuestion = ledger.getStringOrNull(LEDGER_FIELD_POLL_QUESTION) ?: "",
                pollOptions = ledger.getStringOrNull(LEDGER_FIELD_POLL_OPTIONS) ?: "",
                adminKeyHash = ledger.getBytes(LEDGER_FIELD_ADMIN_KEY_HASH, 32),
                voteCount = ledger.getUint64(LEDGER_FIELD_VOTE_COUNT),
                tally0 = ledger.getUint64(LEDGER_FIELD_TALLY0),
                tally1 = ledger.getUint64(LEDGER_FIELD_TALLY1),
                tally2 = ledger.getUint64(LEDGER_FIELD_TALLY2),
                tally3 = ledger.getUint64(LEDGER_FIELD_TALLY3),
                pollClosed = ledger.getBoolean(LEDGER_FIELD_POLL_CLOSED),
            )
        }
}
```

**Critical pattern: `object` vs `class`** — this is a singleton, not
a per-instance class. The `ADMIN_SECRET` is hardcoded as
`ByteArray(32) { 0x42 }` (all 0x42 bytes). Every deploy from the
same APK uses the same admin secret. Anyone who decompiles the APK
gets the admin key for every deployed poll.

**`WitnessResult(null, ADMIN_SECRET)`**: The first parameter is
`privateState: Any?`—here `null` because no private state is needed.
The second is the witness byte array. `WitnessResult` wraps both into
a single object returned by the witness function.

**`MidnightContract.create(sdk.config) { ... }`** DSL builder:
- `name`: used as a key for the contract JS asset lookup
- `contractJs`: an `InputStream` to the contract JS file
- `address`: the on-chain address (null for deploy)
- `coinPublicKey`: needed for write operations (signing)
- `circuitVerifierKeys`: map of circuit name → verifier key bytes
- `witness(name) { ... }`: registers a witness provider

**Asset path convention:** The contract JS goes in `assets/runtime/`
and verifier keys go in `assets/keys/`. The `kuiraContract` Gradle
plugin copies them there automatically from the managed output
directory.

**Failure mode:** `IllegalStateException: Contract JS not found at
assets/runtime/voting-contract.js`. The asset wasn't synced. Run
`./gradlew :app:assembleDebug` to trigger the sync, then check
`app/src/main/assets/` exists with the right files.

**Failure mode:** `getBytes(LEDGER_FIELD_ADMIN_KEY_HASH, 32)` throws
if `adminKeyHash` hasn't been set yet (before `createPoll`). The
contract doesn't initialize `adminKeyHash` in the constructor, so
it may be all-zeros or an undefined value. The actual contract sets
it in `createPoll`. The UI must handle `adminKeyHash` being absent.

### 7.2) `data/ContractAddressStore.kt`

```kotlin
package com.kuiralabs.starter.counter.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.midnight.kuira.core.network.MidnightNetwork
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ContractAddressStore @Inject constructor(
    @ApplicationContext context: Context,
) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "kuira-starter-contract-prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun get(network: MidnightNetwork, prefix: String = "voting"): String? =
        prefs.getString("$prefix.${network.name}", null)

    fun put(network: MidnightNetwork, prefix: String = "voting", address: String) {
        prefs.edit().putString("$prefix.${network.name}", address).apply()
    }

    fun clear(network: MidnightNetwork, prefix: String = "voting") {
        prefs.edit().remove("$prefix.${network.name}").apply()
    }
}
```

The default prefix is `"voting"`, matching the VotingContract name.
Each network gets its own slot (e.g. `voting.UNDEPLOYED`), so
switching networks in the wallet panel doesn't strand the previous
deploy.

**EncryptedSharedPreferences:** Uses AES256-GCM for the master key
and AES256-SIV for key encryption. The `MasterKey.Builder` uses
Android Keystore under the hood, so the encryption keys are
hardware-backed on devices with a TEE.

**Failure mode:** `MasterKey.Builder.setKeyScheme` requires API 23+.
The minSdk is 30, so this is fine. But if you backport to lower
minSdk, use `MasterKey.DEFAULT_MASTER_KEY_ALIAS` instead.

---

## 8) UI Layer

### 8.1) `ui/VotingUiState.kt`

```kotlin
package com.kuiralabs.starter.counter.ui

sealed interface VotingUiState {
    data object NotReady : VotingUiState
    data object ReadyToDeploy : VotingUiState
    data class Deployed(
        val address: String,
        val pollQuestion: String?,
        val pollOptions: List<String>?,
        val adminKeyHash: ByteArray?,
        val voteCount: Long?,
        val tallies: List<Long>?,
        val pollClosed: Boolean?,
        val hasVoted: Boolean,
    ) : VotingUiState
}
```

**Note:** `adminKeyHash: ByteArray?` — it's nullable because the
contract doesn't set it until `createPoll` is called. Before that,
the ledger doesn't have a meaningful value for this field.

**`hasVoted` is a local boolean** — it's set to `true` in the
ViewModel after a successful `castVote()`. It's NOT persisted across
process death. A ViewModel destroy (e.g., activity kill due to memory
pressure) resets it to `false`. There's no persisted "has voted" flag
in this codebase.

### 8.2) `ui/VotingViewModel.kt`

```kotlin
package com.kuiralabs.starter.counter.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kuiralabs.starter.counter.data.ContractAddressStore
import com.kuiralabs.starter.counter.data.VotingContract
import com.kuiralabs.starter.counter.data.VotingContract.VotingLedger
import com.midnight.kuira.core.compact.ContractCallStage
import com.midnight.kuira.core.compact.MidnightContract
import com.midnight.kuira.core.network.MidnightNetwork
import com.midnight.kuira.sdk.MidnightSdk
import com.midnight.kuira.sdk.walletruntime.MidnightSdkProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class VotingViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val sdkProvider: MidnightSdkProvider,
    private val addressStore: ContractAddressStore,
) : ViewModel() {

    private val _state = MutableStateFlow<VotingUiState>(VotingUiState.NotReady)
    val state: StateFlow<VotingUiState> = _state.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private val _callStage = MutableStateFlow<ContractCallStage?>(null)
    val callStage: StateFlow<ContractCallStage?> = _callStage.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _question = MutableStateFlow("")
    val question: StateFlow<String> = _question.asStateFlow()

    private val _options = MutableStateFlow("")
    val options: StateFlow<String> = _options.asStateFlow()

    val selectedNetwork: StateFlow<MidnightNetwork> get() = sdkProvider.selectedNetwork
    fun selectNetwork(network: MidnightNetwork) = sdkProvider.selectNetwork(network)

    private var ledgerJob: Job? = null

    init {
        viewModelScope.launch {
            sdkProvider.sdk.combine(sdkProvider.selectedNetwork) { sdk, net -> sdk to net }
                .collect { (sdk, network) -> recomputeState(sdk, network) }
        }
    }

    private fun recomputeState(sdk: MidnightSdk?, network: MidnightNetwork) {
        val persisted = addressStore.get(network, "voting")
        val next = when {
            sdk == null -> VotingUiState.NotReady
            persisted == null -> VotingUiState.ReadyToDeploy
            else -> VotingUiState.Deployed(
                address = persisted,
                pollQuestion = null,
                pollOptions = null,
                adminKeyHash = null,
                voteCount = null,
                tallies = null,
                pollClosed = null,
                hasVoted = false,
            )
        }
        _state.value = next
        if (sdk != null && persisted != null) startObserving(sdk, persisted) else stopObserving()
    }

    fun deploy() {
        val sdk = sdkProvider.sdk.value ?: return
        val network = sdkProvider.selectedNetwork.value
        runAction {
            val address = VotingContract.deploy(context, sdk) { _callStage.value = it }
            addressStore.put(network, "voting", address)
            recomputeState(sdk, network)
        }
    }

    fun disconnect() {
        val network = sdkProvider.selectedNetwork.value
        addressStore.clear(network, "voting")
        recomputeState(sdkProvider.sdk.value, network)
    }

    fun updateQuestion(value: String) { _question.value = value }
    fun updateOptions(value: String) { _options.value = value }

    fun createPoll() {
        val sdk = sdkProvider.sdk.value ?: return
        val address = (state.value as? VotingUiState.Deployed)?.address ?: return
        val q = _question.value.trim()
        val o = _options.value.trim()
        if (q.isBlank() || o.isBlank()) return
        runAction {
            VotingContract.createPoll(context, sdk, address, q, o) { _callStage.value = it }
            readAndUpdateLedger(sdk, address)
        }
    }

    fun castVote(optionIdx: Int) {
        val sdk = sdkProvider.sdk.value ?: return
        val address = (state.value as? VotingUiState.Deployed)?.address ?: return
        runAction {
            VotingContract.castVote(context, sdk, address, optionIdx.toLong()) { _callStage.value = it }
            readAndUpdateLedger(sdk, address)
            _state.update { current ->
                if (current is VotingUiState.Deployed && current.address == address) {
                    current.copy(hasVoted = true)
                } else current
            }
        }
    }

    fun closePoll() {
        val sdk = sdkProvider.sdk.value ?: return
        val address = (state.value as? VotingUiState.Deployed)?.address ?: return
        runAction {
            VotingContract.closePoll(context, sdk, address) { _callStage.value = it }
            readAndUpdateLedger(sdk, address)
        }
    }

    private suspend fun readAndUpdateLedger(sdk: MidnightSdk, address: String) {
        val fresh = VotingContract.readLedger(readHandleFor(sdk, address))
        applyLedger(fresh, address)
    }

    private fun runAction(block: suspend () -> Unit) {
        viewModelScope.launch {
            _busy.value = true
            _error.value = null
            try {
                block()
            } catch (t: Throwable) {
                _error.value = t.message ?: t::class.simpleName ?: "Unknown error"
            } finally {
                _busy.value = false
                _callStage.value = null
            }
        }
    }

    private var readHandle: MidnightContract? = null
    private var readHandleAddress: String? = null

    private fun readHandleFor(sdk: MidnightSdk, address: String): MidnightContract {
        if (readHandle == null || readHandleAddress != address) {
            readHandle = VotingContract.buildReadHandle(context, sdk, address)
            readHandleAddress = address
        }
        return readHandle!!
    }

    private fun startObserving(sdk: MidnightSdk, address: String) {
        ledgerJob?.cancel()
        ledgerJob = viewModelScope.launch {
            val handle = readHandleFor(sdk, address)
            VotingContract.observeLedger(handle)
                .catch { }
                .collect { fresh -> applyLedger(fresh, address) }
        }
    }

    private fun applyLedger(fresh: VotingLedger, address: String) {
        val optList = fresh.pollOptions.split(",").map { it.trim() }.filter { it.isNotBlank() }
        _state.update { current ->
            if (current is VotingUiState.Deployed && current.address == address) {
                current.copy(
                    pollQuestion = fresh.pollQuestion,
                    pollOptions = optList,
                    adminKeyHash = fresh.adminKeyHash,
                    voteCount = fresh.voteCount,
                    tallies = listOf(fresh.tally0, fresh.tally1, fresh.tally2, fresh.tally3),
                    pollClosed = fresh.pollClosed,
                )
            } else current
        }
    }

    private fun stopObserving() {
        ledgerJob?.cancel()
        ledgerJob = null
        readHandle = null
        readHandleAddress = null
    }
}
```

**Key patterns:**

- **Network selection:** `sdkProvider.selectedNetwork` is a
  `StateFlow<MidnightNetwork>`. The SDK's `PanelBar` composable binds
  to it. The ViewModel reads it to pass to `ContractAddressStore`.

- **`recomputeState` vs `applyLedger`:** `recomputeState` is called
  when the SDK or network changes (e.g., wallet unlock, network
  switch). It resets to initial state. `applyLedger` is called when
  the on-chain ledger updates (via `observeLedger()` or manual
  `readLedger()`). It preserves the Deployed state and fills in live
  data.

- **`readHandle` caching:** A `MidnightContract` handle for read-only
  access is cached per address. When the address changes (e.g.,
  deploying a new contract), the old handle is discarded.

- **`runAction` error handling:** Catches ALL exceptions and surfaces
  the message. A failed `closePoll` (wrong admin secret) throws
  `CircuitExecutionException("Only admin can close poll")`. The
  `_callStage` progress is cleared in the `finally` block.

- **`ContractCallStage`**: The SDK defines a sealed interface for
  deploy/call progress. It's surfaced via the `ContractCallProgressBar`
  composable. The ViewModel exposes it as `callStage: StateFlow`.

- **`observeLedger().catch { }`**: Silently swallows ledger
  observation errors. If the connection drops during observation, it
  won't crash the ViewModel. The UI will just stop updating until the
  next user action triggers `readAndUpdateLedger`.

### 8.3) `ui/VotingScreen.kt`

```kotlin
package com.kuiralabs.starter.counter.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.midnight.kuira.dapp.PanelBar

@Composable
fun VotingScreen(
    modifier: Modifier = Modifier,
    viewModel: VotingViewModel = hiltViewModel(),
) {
    val selectedNetwork by viewModel.selectedNetwork.collectAsState()

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
                .padding(top = 56.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "Voting",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            VotingCard()
        }

        PanelBar(
            floating = true,
            network = selectedNetwork,
            onNetworkChange = viewModel::selectNetwork,
        )
    }
}
```

**`PanelBar(floating=true)`** renders a floating sigil chip (left)
and wallet chip (right). It's the SDK's recommended pairing — the
sigil chip handles forge/create/import, the wallet chip shows balance
and provides send/receive/dust registration.

**`WindowInsets.safeDrawing`** ensures the content avoids display
cutouts and system bars.

### 8.4) `ui/VotingCard.kt`

```kotlin
package com.kuiralabs.starter.counter.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.midnight.kuira.dapp.ContractCallProgressBar

@Composable
fun VotingCard(
    modifier: Modifier = Modifier,
    viewModel: VotingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val busy by viewModel.busy.collectAsState()
    val callStage by viewModel.callStage.collectAsState()
    val error by viewModel.error.collectAsState()
    val question by viewModel.question.collectAsState()
    val options by viewModel.options.collectAsState()

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Header(state)

            when (val s = state) {
                VotingUiState.NotReady -> NotReadyBody()
                VotingUiState.ReadyToDeploy -> ReadyToDeployBody(busy = busy, onDeploy = viewModel::deploy)
                is VotingUiState.Deployed -> DeployedBody(
                    state = s, busy = busy,
                    question = question, onQuestionChange = viewModel::updateQuestion,
                    options = options, onOptionsChange = viewModel::updateOptions,
                    onCreatePoll = viewModel::createPoll, onCastVote = viewModel::castVote,
                    onClosePoll = viewModel::closePoll, onDeployNew = viewModel::deploy,
                    onDisconnect = viewModel::disconnect,
                )
            }

            if (busy) {
                if (callStage == null) {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) { CircularProgressIndicator() }
                } else {
                    ContractCallProgressBar(
                        stage = callStage,
                        accent = MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.surfaceVariant,
                        labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            val err = error
            if (err != null) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.errorContainer,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = err,
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                    )
                }
            }
        }
    }
}

@Composable
private fun Header(state: VotingUiState) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = "Voting",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )
        StatusBadge(state)
    }
}

@Composable
private fun StatusBadge(state: VotingUiState) {
    val (label, dotColor) = when (state) {
        VotingUiState.NotReady -> "Not connected" to MaterialTheme.colorScheme.error
        VotingUiState.ReadyToDeploy -> "Ready" to MaterialTheme.colorScheme.tertiary
        is VotingUiState.Deployed -> "Active" to MaterialTheme.colorScheme.primary
    }
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = dotColor.copy(alpha = 0.12f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(8.dp).clip(CircleShape).background(dotColor)
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = dotColor,
            )
        }
    }
}

@Composable
private fun NotReadyBody() {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            text = "Forge a sigil above, then fund the wallet and register dust.",
            modifier = Modifier.padding(16.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun ReadyToDeployBody(busy: Boolean, onDeploy: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = "Wallet ready. Deploy a new voting contract to the current network.",
                modifier = Modifier.padding(16.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
        Button(
            onClick = onDeploy, enabled = !busy,
            modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp),
        ) { Text(text = "Deploy contract") }
    }
}

@Composable
private fun DeployedBody(
    state: VotingUiState.Deployed, busy: Boolean,
    question: String, onQuestionChange: (String) -> Unit,
    options: String, onOptionsChange: (String) -> Unit,
    onCreatePoll: () -> Unit, onCastVote: (Int) -> Unit,
    onClosePoll: () -> Unit, onDeployNew: () -> Unit, onDisconnect: () -> Unit,
) {
    AddressSection(state.address)

    if (state.pollQuestion.isNullOrBlank()) {
        CreatePollSection(
            question = question, onQuestionChange = onQuestionChange,
            options = options, onOptionsChange = onOptionsChange,
            onCreatePoll = onCreatePoll, busy = busy,
        )
    } else {
        PollResultsSection(
            question = state.pollQuestion ?: "",
            options = state.pollOptions ?: emptyList(),
            tallies = state.tallies ?: listOf(0, 0, 0, 0),
            totalVotes = state.voteCount ?: 0,
            hasVoted = state.hasVoted, pollClosed = state.pollClosed == true,
            onCastVote = onCastVote, onClosePoll = onClosePoll, busy = busy,
        )
    }

    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedButton(
            onClick = onDeployNew, enabled = !busy,
            modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp),
        ) { Text(text = "Deploy new") }
        OutlinedButton(
            onClick = onDisconnect, enabled = !busy,
            modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp),
        ) { Text(text = "Disconnect") }
    }

    Text(
        text = "Results update live from chain.",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun AddressSection(address: String) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = "Contract",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = address,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun CreatePollSection(
    question: String, onQuestionChange: (String) -> Unit,
    options: String, onOptionsChange: (String) -> Unit,
    onCreatePoll: () -> Unit, busy: Boolean,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Create a poll",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "No poll exists yet. Fill in the details below to create one.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = question, onValueChange = onQuestionChange,
                label = { Text("Poll question") },
                placeholder = { Text("e.g. What's the best programming language?") },
                singleLine = true, shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = options, onValueChange = onOptionsChange,
                label = { Text("Options") },
                placeholder = { Text("e.g. Rust, TypeScript, Kotlin, Go") },
                supportingText = { Text("Comma-separated, max 4 options") },
                singleLine = true, shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = onCreatePoll,
                enabled = !busy && question.isNotBlank() && options.isNotBlank(),
                modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp),
            ) { Text(text = "Create poll") }
        }
    }
}

@Composable
private fun PollResultsSection(
    question: String, options: List<String>, tallies: List<Long>,
    totalVotes: Long, hasVoted: Boolean, pollClosed: Boolean,
    onCastVote: (Int) -> Unit, onClosePoll: () -> Unit, busy: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = question,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (pollClosed) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.errorContainer,
                ) {
                    Text(
                        text = "Closed",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                    )
                }
            }
            if (hasVoted && !pollClosed) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Text(
                        text = "You voted",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
            if (totalVotes > 0) {
                Text(
                    text = "$totalVotes vote${if (totalVotes != 1L) \"s\" else \"\"}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.CenterVertically),
                )
            }
        }

        val maxTally = tallies.maxOrNull()?.coerceAtLeast(1) ?: 1
        options.forEachIndexed { idx, option ->
            val tally = tallies.getOrElse(idx) { 0L }
            val fraction = if (totalVotes > 0) tally.toFloat() / totalVotes else 0f
            OptionCard(
                label = option, tally = tally, fraction = fraction,
                totalVotes = totalVotes,
                isWinning = tally > 0 && tally == tallies.maxOrNull(),
                canVote = !hasVoted && !pollClosed && !busy,
                onVote = { onCastVote(idx) },
            )
        }

        if (!pollClosed) {
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = "Admin",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(
                        onClick = onClosePoll, enabled = !busy,
                        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                            contentColor = MaterialTheme.colorScheme.onError,
                        ),
                    ) { Text(text = "Close poll") }
                }
            }
        }
    }
}

@Composable
private fun OptionCard(
    label: String, tally: Long, fraction: Float,
    totalVotes: Long, isWinning: Boolean, canVote: Boolean, onVote: () -> Unit,
) {
    val bgColor = when {
        isWinning && tally > 0 -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
        canVote -> MaterialTheme.colorScheme.surface
        else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
    }
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = bgColor,
        tonalElevation = if (canVote) 1.dp else 0.dp,
        modifier = Modifier
            .fillMaxWidth()
            .then(if (canVote) Modifier.clickable(onClick = onVote) else Modifier),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = if (tally > 0) "$tally" else "0",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (isWinning && tally > 0)
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            LinearProgressIndicator(
                progress = { fraction },
                modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                color = if (isWinning && tally > 0)
                    MaterialTheme.colorScheme.primary
                else
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = if (totalVotes > 0) "${(fraction * 100).toInt()}%" else "-",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (canVote) {
                    Text(
                        text = "Tap to vote",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                if (isWinning && tally > 0) {
                    Text(
                        text = "Leading",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
    }
}
```

### 8.5) Theme files

**`ui/theme/Color.kt`** — example palette:

```kotlin
package com.kuiralabs.starter.counter.ui.theme

import androidx.compose.ui.graphics.Color

val PrimaryRed = Color(0xFFDC0000)
val DarkRed = Color(0xFF8B0000)
val LightRed = Color(0xFFFF4D4D)
val LightRedBg = Color(0xFFFFDAD4)

val AccentYellow = Color(0xFFFFD700)
val DarkYellow = Color(0xFF9A8200)
val LightYellow = Color(0xFFFFF8D4)

val NearBlack = Color(0xFF0D0D0D)
val DarkSurface = Color(0xFF1A1A1A)
val SurfaceVariant = Color(0xFF2D2D2D)
val OutlineColor = Color(0xFF6B6B6B)
val OnSurfaceVariantColor = Color(0xFFC4C4C4)

val AccentGreen = Color(0xFF00D2A0)
val DarkGreen = Color(0xFF003828)

val White = Color(0xFFF5F5F5)
```

**`ui/theme/Type.kt`** — Material 3 type scale:

```kotlin
package com.kuiralabs.starter.counter.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val VoteTypography = Typography(
    headlineLarge = TextStyle(
        fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 34.sp,
    ),
    headlineMedium = TextStyle(
        fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 30.sp,
    ),
    headlineSmall = TextStyle(
        fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp,
    ),
    titleLarge = TextStyle(
        fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 24.sp,
    ),
    titleMedium = TextStyle(
        fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp,
    ),
    titleSmall = TextStyle(
        fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp,
    ),
    bodyLarge = TextStyle(
        fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp,
    ),
    bodySmall = TextStyle(
        fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp,
    ),
    labelLarge = TextStyle(
        fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp,
    ),
    labelMedium = TextStyle(
        fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp,
    ),
    labelSmall = TextStyle(
        fontWeight = FontWeight.Medium, fontSize = 10.sp, lineHeight = 14.sp,
    ),
)
```

**`ui/theme/Theme.kt`** — `VoteTheme` composable:

```kotlin
package com.kuiralabs.starter.counter.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val VoteDarkColorScheme = darkColorScheme(
    primary = PrimaryRed,
    onPrimary = White,
    primaryContainer = DarkRed,
    onPrimaryContainer = LightRedBg,
    secondary = AccentYellow,
    onSecondary = NearBlack,
    secondaryContainer = DarkYellow,
    onSecondaryContainer = LightYellow,
    tertiary = AccentGreen,
    onTertiary = NearBlack,
    tertiaryContainer = DarkGreen,
    onTertiaryContainer = AccentGreen,
    background = NearBlack,
    onBackground = White,
    surface = DarkSurface,
    onSurface = White,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = OnSurfaceVariantColor,
    outline = OutlineColor,
    outlineVariant = SurfaceVariant,
    error = Color(0xFFCF6679),
    onError = NearBlack,
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
)

@Composable
fun VoteTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = VoteDarkColorScheme,
        typography = VoteTypography,
        content = content,
    )
}
```

The theme is dark-only. All three files are required — omitting any
one breaks the build.

### 8.6) `MainActivity.kt`

```kotlin
package com.kuiralabs.starter.counter

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.kuiralabs.starter.counter.ui.VotingScreen
import com.kuiralabs.starter.counter.ui.theme.VoteTheme
import com.midnight.kuira.dapp.wallet.WalletAppShell
import com.midnight.kuira.sdk.walletruntime.WalletNotifications
import com.midnight.kuira.sdk.walletruntime.SessionLock
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    @Inject lateinit var sessionLock: SessionLock

    private val notifPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (WalletNotifications.shouldRequest(this)) {
            notifPermission.launch(WalletNotifications.PERMISSION)
        }
        setContent {
            WalletAppShell {
                VoteTheme {
                    Surface(modifier = Modifier.fillMaxSize()) {
                        VotingScreen()
                    }
                }
            }
        }
    }

    override fun onUserInteraction() {
        super.onUserInteraction()
        sessionLock.onUserActivity()
    }
}
```

**Why `AppCompatActivity`?** The SDK's `SigilStatusPanel` hosts a
biometric prompt, which requires `FragmentActivity`. `AppCompatActivity`
is a subclass of `FragmentActivity`; `ComponentActivity` is not.

**`WalletAppShell`** wraps:
- `SessionLockGate` — shows a lock screen overlay when the session
  is locked (auto-lock or manual lock)
- `WalletOverlayHost` — hosts full-screen Send/Receive/Settings
  overlays in the activity window

**`WalletNotifications.shouldRequest(this)`** checks API 33+
`POST_NOTIFICATIONS` permission relevance. If the app needs to show
progress notifications for background wallet ops, this should be
requested. It's best-effort — denial doesn't break functionality.

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
| `Error: Unknown compiler version +0.31.0` | compactc not installed at that version | `compact update 0.31.0` |
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
