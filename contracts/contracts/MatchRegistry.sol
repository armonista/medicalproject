// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[7] calldata input
    ) external view returns (bool);
}

contract MatchRegistry {
    IGroth16Verifier public immutable verifier;
    mapping(bytes32 => bool) public matches;

    event MatchVerified(
        uint256 indexed trialId,
        address indexed ephemeralPatient,
        uint256 indexed credentialCommitment,
        bytes32 matchId
    );

    constructor(address verifierAddress) {
        require(verifierAddress != address(0), "verifier=0");
        verifier = IGroth16Verifier(verifierAddress);
    }

    function submitMatch(
        uint256 trialId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[7] calldata publicSignals,
        address ephemeralPatient
    ) external returns (bytes32 matchId) {
        require(ephemeralPatient != address(0), "patient=0");
        // Public-signal layout: [commitment,minAge,maxAge,minBio,maxBio,diagnosis,trialId]
        require(publicSignals[6] == trialId, "trial mismatch");
        require(verifier.verifyProof(a, b, c, publicSignals), "invalid proof");

        matchId = keccak256(
            abi.encodePacked(trialId, ephemeralPatient, publicSignals[0])
        );
        require(!matches[matchId], "duplicate match");
        matches[matchId] = true;

        emit MatchVerified(trialId, ephemeralPatient, publicSignals[0], matchId);
    }
}
