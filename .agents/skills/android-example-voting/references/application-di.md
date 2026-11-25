# Kuira Voting dApp: 6) Application & DI

> Reference for the `android-example-voting` skill. Back to [SKILL.md](../SKILL.md).

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
