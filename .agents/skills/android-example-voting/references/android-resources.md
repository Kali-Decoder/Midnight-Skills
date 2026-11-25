# Kuira Voting dApp: 4) Android Resources

> Reference for the `android-example-voting` skill. Back to [SKILL.md](../SKILL.md).

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
