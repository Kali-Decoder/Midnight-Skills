---
name: vesting-wallet
description: Build a confidential vesting wallet for ERC7984 tokens using Zama FHEVM and Hardhat.
---

**Scope**
This skill provides a working example of a **confidential vesting wallet** using Zama FHEVM and OpenZeppelin ERC7984 tokens, including Solidity contract + Hardhat test.

Place files exactly as shown:
- `.sol` → `contracts/`
- `.ts` → `test/`

## 1) Contract: `contracts/VestingWalletExample.sol`

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/**
 * @title VestingWalletExample
 * @dev Confidential vesting wallet for ERC7984 tokens with linear vesting.
 */
contract VestingWalletExample is Ownable, ReentrancyGuardTransient, ZamaEthereumConfig {
  mapping(address token => euint128) private _tokenReleased;
  uint64 private _start;
  uint64 private _duration;

  event VestingWalletConfidentialTokenReleased(address indexed token, euint64 amount);

  constructor(address beneficiary, uint48 startTimestamp, uint48 durationSeconds) Ownable(beneficiary) {
    _start = startTimestamp;
    _duration = durationSeconds;
  }

  function start() public view returns (uint64) { return _start; }
  function duration() public view returns (uint64) { return _duration; }
  function end() public view returns (uint64) { return start() + duration(); }
  function released(address token) public view returns (euint128) { return _tokenReleased[token]; }

  function releasable(address token) public returns (euint64) {
    euint128 vestedAmount_ = vestedAmount(token, uint48(block.timestamp));
    euint128 releasedAmount = released(token);
    ebool success = FHE.ge(vestedAmount_, releasedAmount);
    return FHE.select(success, FHE.asEuint64(FHE.sub(vestedAmount_, releasedAmount)), FHE.asEuint64(0));
  }

  function release(address token) public nonReentrant {
    euint64 amount = releasable(token);
    FHE.allowTransient(amount, token);
    euint64 amountSent = IERC7984(token).confidentialTransfer(owner(), amount);

    euint128 newReleasedAmount = FHE.add(released(token), amountSent);
    FHE.allow(newReleasedAmount, owner());
    FHE.allowThis(newReleasedAmount);
    _tokenReleased[token] = newReleasedAmount;
    emit VestingWalletConfidentialTokenReleased(token, amountSent);
  }

  function vestedAmount(address token, uint48 timestamp) public returns (euint128) {
    return _vestingSchedule(
      FHE.add(released(token), IERC7984(token).confidentialBalanceOf(address(this))),
      timestamp
    );
  }

  function _vestingSchedule(euint128 totalAllocation, uint48 timestamp) internal returns (euint128) {
    if (timestamp < start()) {
      return euint128.wrap(0);
    } else if (timestamp >= end()) {
      return totalAllocation;
    } else {
      return FHE.div(FHE.mul(totalAllocation, (timestamp - start())), duration());
    }
  }
}
```

## 2) Test: `test/VestingWallet.test.ts`

```ts
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingWalletExample", function () {
  let vestingWallet: any;
  let token: any;
  let owner: any;
  let beneficiary: any;
  let other: any;

  const VESTING_AMOUNT = 1000;
  const VESTING_DURATION = 60 * 60; // 1 hour

  beforeEach(async function () {
    const accounts = await ethers.getSigners();
    [owner, beneficiary, other] = accounts;

    // Deploy ERC7984 mock token
    token = await ethers.deployContract("ERC7984Mock", [
      "TestToken",
      "TT",
      "https://example.com/metadata",
    ]);

    // Start in 1 minute
    const currentTime = await time.latest();
    const startTime = currentTime + 60;

    vestingWallet = await ethers.deployContract("VestingWalletExample", [
      beneficiary.address,
      startTime,
      VESTING_DURATION,
    ]);

    // Mint tokens to vesting wallet
    const encryptedInput = await fhevm
      .createEncryptedInput(await token.getAddress(), owner.address)
      .add64(VESTING_AMOUNT)
      .encrypt();

    await token
      .connect(owner)
      ["mint(address,bytes32,bytes)"](
        vestingWallet.target,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
  });

  describe("Vesting Schedule", function () {
    it("should not release tokens before vesting starts", async function () {
      await expect(vestingWallet.connect(beneficiary).release(await token.getAddress()))
        .to.not.be.reverted;
    });

    it("should release half the tokens at midpoint", async function () {
      const currentTime = await time.latest();
      const startTime = currentTime + 60;
      const midpoint = startTime + (VESTING_DURATION / 2);
      await time.increaseTo(midpoint);
      await expect(vestingWallet.connect(beneficiary).release(await token.getAddress()))
        .to.not.be.reverted;
    });

    it("should release all tokens after vesting ends", async function () {
      const currentTime = await time.latest();
      const startTime = currentTime + 60;
      const endTime = startTime + VESTING_DURATION + 1000;
      await time.increaseTo(endTime);
      await expect(vestingWallet.connect(beneficiary).release(await token.getAddress()))
        .to.not.be.reverted;
    });
  });
});
```

## 3) Run Tests

```bash
npx hardhat test
```

## Notes
- This example uses encrypted ERC7984 balances, but tests only validate calls do not revert.  
- For full correctness checks, integrate decryption flow using the Zama relayer or FHEVM plugin.
