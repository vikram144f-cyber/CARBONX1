// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CarbonX evidence anchor
/// @notice Emits tamper-evident commitments; PostgreSQL remains the system of record.
contract CarbonXAnchor {
    event EvidenceAnchored(
        bytes32 indexed incidentId,
        bytes32 evidenceHash,
        string eventType,
        uint256 timestamp
    );

    function anchor(
        bytes32 incidentId,
        bytes32 evidenceHash,
        string calldata eventType
    ) external {
        bytes32 eventTypeHash = keccak256(bytes(eventType));
        require(
            eventTypeHash == keccak256("UNDER_ASSESSMENT") ||
                eventTypeHash == keccak256("AUDIT_RECOMMENDED") ||
                eventTypeHash == keccak256("RESOLVED"),
            "unsupported event type"
        );
        emit EvidenceAnchored(incidentId, evidenceHash, eventType, block.timestamp);
    }
}
