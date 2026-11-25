# Example Hello World DApp Skill: 12) `compose.yml`

> Reference for the `example-hello-world` skill. Back to [SKILL.md](../SKILL.md).

## 12) `compose.yml`

```yaml
services:
  proof-server:
    image: 'midnightntwrk/proof-server:9.0.2'
    command: ['midnight-proof-server', '-v']
    ports:
      - '127.0.0.1:6300:6300'
    environment:
      RUST_BACKTRACE: 'full'
    healthcheck:
      test: ['CMD-SHELL', 'echo > /dev/tcp/127.0.0.1/6300']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s

  indexer:
    image: 'midnightntwrk/indexer-standalone:4.4.101'
    ports:
      - '127.0.0.1:8088:8088'
    environment:
      RUST_LOG: 'indexer=info,chain_indexer=info,indexer_api=info,wallet_indexer=info,indexer_common=info,fastrace_opentelemetry=off,info'
      APP__INFRA__NODE__URL: 'ws://node:9944'
      APP__APPLICATION__NETWORK_ID: 'undeployed'
      APP__INFRA__STORAGE__PASSWORD: 'indexer'
      APP__INFRA__PUB_SUB__PASSWORD: 'indexer'
      APP__INFRA__LEDGER_STATE_STORAGE__PASSWORD: 'indexer'
      APP__INFRA__SECRET: '303132333435363738393031323334353637383930313233343536373839303132'
    healthcheck:
      test: ['CMD-SHELL', 'cat /var/run/indexer-standalone/running']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s
    depends_on:
      node:
        condition: service_healthy

  node:
    image: 'midnightntwrk/midnight-node:2.1.101'
    ports:
      - '127.0.0.1:9944:9944'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9944/health']
      interval: 2s
      timeout: 5s
      retries: 20
      start_period: 5s
    environment:
      CFG_PRESET: 'dev'
      SIDECHAIN_BLOCK_BENEFICIARY: '04bcf7ad3be7a5c790460be82a713af570f22e0f801f6659ab8e84a52be6969e'
```
