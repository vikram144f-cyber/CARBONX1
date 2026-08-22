# Epic 06: Blockchain Anchoring

**Priority tier:** P0
**Owner:** Developer C
**Depends on:** Epic 03

## Goal
Anchor a cryptographic hash of the canonical evidence package to the Sepolia testnet to provide tamper-evident proof of the assessment state at critical incident lifecycle points.

## Definition of Done
- A smart contract is deployed to the Sepolia testnet.
- The backend deterministically hashes a JSON evidence package.
- The hash is sent to the blockchain, and the transaction hash is stored in PostgreSQL.
- The system gracefully handles blockchain failures without blocking the core workflow.

---

## Story 06.1: Smart Contract Deployment

**Owner:** Developer C
**Depends on:** none

**As a** system
**I want** a smart contract on the Sepolia testnet
**So that** I have a permanent ledger to anchor evidence hashes.

### Acceptance Criteria
- [ ] Write a simple Solidity contract `CarbonXAnchor` that accepts an incident ID, a bytes32 hash, and an event type string.
- [ ] Deploy the contract to Sepolia.
- [ ] Provide the contract address to be used as the `BLOCKCHAIN_CONTRACT_ADDRESS` environment variable.

### Technical notes
- PRD 5.4, Architecture Spine AD-8

---

## Story 06.2: Canonical Evidence Hashing

**Owner:** Developer C
**Depends on:** Epic 03

**As a** system
**I want** to deterministically serialize and hash an evidence package
**So that** the hash remains perfectly reproducible by third-party auditors.

### Acceptance Criteria
- [ ] Build a canonical JSON object from the `RiskAssessment` and `Incident` state.
- [ ] Ensure serialization is deterministic (e.g., using `JSON.stringify` with sorted keys).
- [ ] Calculate the `keccak256` hash of the serialized string using `viem`.
- [ ] The supported anchor event types must use the exact string literals: `"UNDER_ASSESSMENT"`, `"AUDIT_RECOMMENDED"`, and `"RESOLVED"`.

### Technical notes
- PRD 5.4, Architecture Spine AD-14

---

## Story 06.3: Non-Blocking Anchor Execution

**Owner:** Developer C
**Depends on:** 06.1, 06.2

**As a** system
**I want** to submit the hash to the blockchain asynchronously
**So that** RPC delays or failures do not block the user workflow.

### Acceptance Criteria
- [ ] Create a `BlockchainAnchor` record in PostgreSQL with status `PENDING`.
- [ ] Submit the transaction to Sepolia using `viem` and the server-side wallet.
- [ ] On success, update the record with the `txHash` and status `SUBMITTED`/`CONFIRMED`.
- [ ] If the RPC fails or times out, update the status to `FAILED`.
- [ ] Crucially, if the anchor fails, the incident state transition itself still succeeds and the workflow continues gracefully.

### Technical notes
- PRD 5.4, 10.0, Architecture Spine AD-9
