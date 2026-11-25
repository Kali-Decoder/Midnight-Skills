# Kuira Voting dApp: 3) Gradle Configuration

> Reference for the `android-example-voting` skill. Back to [SKILL.md](../SKILL.md).

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
