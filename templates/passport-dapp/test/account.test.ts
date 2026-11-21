// Contract-logic unit tests over the in-process simulator. These cover the
// authorisation, device, grant, and recovery semantics; the token-flow
// circuits are exercised end-to-end by the localnet integration tests.

import { describe, it, expect, beforeEach } from 'vitest';

import { AccountSimulator } from './simulator.js';
import { deviceCommitment, grantCommitment, recoveryCommitment } from '../src/wallet/contract.js';
import { reconstruct } from '../src/wallet/shamir.js';
import { randomBytes32, hexToBytes32 } from '../src/wallet/hex.js';

const NIGHT = hexToBytes32('01');
const OTHER_COLOR = hexToBytes32('02');
const RECIPIENT = { bytes: hexToBytes32('aabbcc') };

let deviceSecret: Uint8Array;
let recoverySecret: Uint8Array;
let sim: AccountSimulator;

beforeEach(async () => {
  deviceSecret = randomBytes32();
  recoverySecret = randomBytes32();
  sim = await AccountSimulator.create({ deviceSecret, recoverySecret });
});

describe('constructor', () => {
  it('registers the initial device in epoch 0', async () => {
    const l = sim.ledger();
    expect(l.devices.member(deviceCommitment(deviceSecret))).toBe(true);
    expect(l.devices.lookup(deviceCommitment(deviceSecret))).toBe(0n);
    expect(l.device_epoch).toBe(0n);
    expect(l.device_count).toBe(1n);
    expect(l.round).toBe(0n);
  });

  it('stores the recovery commitment and three shares', async () => {
    const l = sim.ledger();
    expect(l.recovery).toBe(recoveryCommitment(recoverySecret));
    expect(l.recovery_shares.size()).toBe(3n);
    for (const index of [1n, 2n, 3n]) {
      expect(l.recovery_shares.member(index)).toBe(true);
    }
  });
});

describe('night custody', () => {
  it('mirrors deposits and withdrawals in night_balances', async () => {
    await sim.call('deposit_night', NIGHT, 1000n);
    expect(sim.ledger().night_balances.lookup(NIGHT)).toBe(1000n);

    await sim.call('withdraw_night', NIGHT, 400n, RECIPIENT);
    expect(sim.ledger().night_balances.lookup(NIGHT)).toBe(600n);
    expect(sim.ledger().round).toBe(1n);
  });

  it('rejects over-withdrawal', async () => {
    await sim.call('deposit_night', NIGHT, 100n);
    await expect(sim.call('withdraw_night', NIGHT, 200n, RECIPIENT)).rejects.toThrow(
      /insufficient balance/,
    );
  });

  it('rejects withdrawal from an unknown device', async () => {
    await sim.call('deposit_night', NIGHT, 100n);
    sim.as({ deviceSecret: randomBytes32() });
    await expect(sim.call('withdraw_night', NIGHT, 50n, RECIPIENT)).rejects.toThrow(/unknown device/);
  });

  it('rejects withdrawal when no device secret is present', async () => {
    await sim.call('deposit_night', NIGHT, 100n);
    sim.as({});
    await expect(sim.call('withdraw_night', NIGHT, 50n, RECIPIENT)).rejects.toThrow(
      /device_secret requested/,
    );
  });
});

describe('device management', () => {
  it('adds a second device that can then withdraw', async () => {
    const second = randomBytes32();
    await sim.call('add_device', deviceCommitment(second));
    expect(sim.ledger().device_count).toBe(2n);

    await sim.call('deposit_night', NIGHT, 100n);
    sim.as({ deviceSecret: second });
    await sim.call('withdraw_night', NIGHT, 50n, RECIPIENT);
    expect(sim.ledger().night_balances.lookup(NIGHT)).toBe(50n);
  });

  it('rejects adding an already-active device', async () => {
    await expect(sim.call('add_device', deviceCommitment(deviceSecret))).rejects.toThrow(
      /device already active/,
    );
  });

  it('removes a device, which then cannot act', async () => {
    const second = randomBytes32();
    await sim.call('add_device', deviceCommitment(second));
    await sim.call('remove_device', deviceCommitment(second));
    expect(sim.ledger().device_count).toBe(1n);

    await sim.call('deposit_night', NIGHT, 100n);
    sim.as({ deviceSecret: second });
    await expect(sim.call('withdraw_night', NIGHT, 50n, RECIPIENT)).rejects.toThrow(/unknown device/);
  });

  it('refuses to remove the last device', async () => {
    await expect(sim.call('remove_device', deviceCommitment(deviceSecret))).rejects.toThrow(
      /cannot remove last device/,
    );
  });
});

describe('scoped grants', () => {
  let grantSecret: Uint8Array;

  beforeEach(async () => {
    grantSecret = randomBytes32();
    await sim.call('deposit_night', NIGHT, 1000n);
    await sim.call('add_grant', grantCommitment(grantSecret), NIGHT, 300n);
  });

  it('allows withdrawals within the cap and tracks cumulative spend', async () => {
    sim.as({ grantSecret });
    await sim.call('grant_withdraw_night', NIGHT, 100n, RECIPIENT);
    await sim.call('grant_withdraw_night', NIGHT, 200n, RECIPIENT);

    const info = sim.ledger().grants.lookup(grantCommitment(grantSecret));
    expect(info.spent).toBe(300n);
    expect(sim.ledger().night_balances.lookup(NIGHT)).toBe(700n);
  });

  it('rejects a withdrawal that exceeds the cap cumulatively', async () => {
    sim.as({ grantSecret });
    await sim.call('grant_withdraw_night', NIGHT, 250n, RECIPIENT);
    await expect(sim.call('grant_withdraw_night', NIGHT, 100n, RECIPIENT)).rejects.toThrow(
      /grant cap exceeded/,
    );
  });

  it('rejects a withdrawal outside the granted colour', async () => {
    sim.as({ grantSecret });
    await expect(sim.call('grant_withdraw_night', OTHER_COLOR, 10n, RECIPIENT)).rejects.toThrow(
      /colour outside grant scope/,
    );
  });

  it('rejects an unknown grant secret', async () => {
    sim.as({ grantSecret: randomBytes32() });
    await expect(sim.call('grant_withdraw_night', NIGHT, 10n, RECIPIENT)).rejects.toThrow(
      /unknown grant/,
    );
  });

  it('rejects a revoked grant', async () => {
    await sim.call('revoke_grant', grantCommitment(grantSecret));
    sim.as({ grantSecret });
    await expect(sim.call('grant_withdraw_night', NIGHT, 10n, RECIPIENT)).rejects.toThrow(
      /grant revoked/,
    );
  });

  it('only devices may issue or revoke grants', async () => {
    sim.as({ grantSecret });
    await expect(sim.call('add_grant', grantCommitment(randomBytes32()), NIGHT, 10n)).rejects.toThrow(
      /device_secret requested/,
    );
  });
});

describe('total-loss recovery', () => {
  it('rejects an invalid recovery secret', async () => {
    sim.as({ recoverySecret: randomBytes32() });
    await expect(sim.call(
        'recover',
        deviceCommitment(randomBytes32()),
        recoveryCommitment(randomBytes32()),
        randomBytes32(),
        randomBytes32(),
        randomBytes32(),
      ),
    ).rejects.toThrow(/invalid recovery secret/);
  });

  it('resets the device set, invalidates grants, and rotates the recovery secret', async () => {
    const grantSecret = randomBytes32();
    await sim.call('deposit_night', NIGHT, 500n);
    await sim.call('add_grant', grantCommitment(grantSecret), NIGHT, 100n);

    // Total loss: the user reconstructs the recovery secret from two of the
    // three on-chain shares (TODO(PVSS): plaintext shares — see shamir.ts).
    const l = sim.ledger();
    const reconstructed = reconstruct([
      { index: 1, value: l.recovery_shares.lookup(1n) },
      { index: 3, value: l.recovery_shares.lookup(3n) },
    ]);
    expect(recoveryCommitment(reconstructed)).toBe(l.recovery);

    const newDevice = randomBytes32();
    const newRecovery = randomBytes32();
    sim.as({ recoverySecret: reconstructed });
    await sim.call(
      'recover',
      deviceCommitment(newDevice),
      recoveryCommitment(newRecovery),
      randomBytes32(),
      randomBytes32(),
      randomBytes32(),
    );

    const after = sim.ledger();
    expect(after.device_epoch).toBe(1n);
    expect(after.device_count).toBe(1n);
    expect(after.recovery).toBe(recoveryCommitment(newRecovery));

    // The recovered device controls the account — and the assets followed it.
    sim.as({ deviceSecret: newDevice });
    await sim.call('withdraw_night', NIGHT, 100n, RECIPIENT);
    expect(sim.ledger().night_balances.lookup(NIGHT)).toBe(400n);

    // The lost device is locked out by the epoch bump.
    sim.as({ deviceSecret });
    await expect(sim.call('withdraw_night', NIGHT, 10n, RECIPIENT)).rejects.toThrow(
      /device of revoked epoch/,
    );

    // Grants issued before recovery are dead too.
    sim.as({ grantSecret });
    await expect(sim.call('grant_withdraw_night', NIGHT, 10n, RECIPIENT)).rejects.toThrow(
      /grant of revoked epoch/,
    );
  });

  it('old recovery secret stops working after rotation', async () => {
    const newDevice = randomBytes32();
    const newRecovery = randomBytes32();
    await sim.call(
      'recover',
      deviceCommitment(newDevice),
      recoveryCommitment(newRecovery),
      randomBytes32(),
      randomBytes32(),
      randomBytes32(),
    );
    // Same (old) recovery secret again — the commitment has rotated.
    await expect(sim.call(
        'recover',
        deviceCommitment(randomBytes32()),
        recoveryCommitment(randomBytes32()),
        randomBytes32(),
        randomBytes32(),
        randomBytes32(),
      ),
    ).rejects.toThrow(/invalid recovery secret/);
  });
});
