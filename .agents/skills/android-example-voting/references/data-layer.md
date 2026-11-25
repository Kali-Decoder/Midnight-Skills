# Kuira Voting dApp: 7) Data Layer

> Reference for the `android-example-voting` skill. Back to [SKILL.md](../SKILL.md).

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
