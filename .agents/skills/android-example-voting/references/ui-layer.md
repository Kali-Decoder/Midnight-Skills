# Kuira Voting dApp: 8) UI Layer

> Reference for the `android-example-voting` skill. Back to [SKILL.md](../SKILL.md).

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
