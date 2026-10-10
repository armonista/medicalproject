pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

// Demonstration circuit:
// proves age and biomarker are inside researcher ranges and diagnosisCode matches,
// without revealing the patient's private values or salt.
template Eligibility() {
    signal input age;
    signal input biomarker;
    signal input diagnosisCode;
    signal input salt;

    signal input minAge;
    signal input maxAge;
    signal input minBiomarker;
    signal input maxBiomarker;
    signal input requiredDiagnosis;
    signal input trialId;

    signal output credentialCommitment;

    component ageLower = LessEqThan(16);
    ageLower.in[0] <== minAge;
    ageLower.in[1] <== age;
    ageLower.out === 1;

    component ageUpper = LessEqThan(16);
    ageUpper.in[0] <== age;
    ageUpper.in[1] <== maxAge;
    ageUpper.out === 1;

    component biomarkerLower = LessEqThan(16);
    biomarkerLower.in[0] <== minBiomarker;
    biomarkerLower.in[1] <== biomarker;
    biomarkerLower.out === 1;

    component biomarkerUpper = LessEqThan(16);
    biomarkerUpper.in[0] <== biomarker;
    biomarkerUpper.in[1] <== maxBiomarker;
    biomarkerUpper.out === 1;

    component diagnosisMatch = IsEqual();
    diagnosisMatch.in[0] <== diagnosisCode;
    diagnosisMatch.in[1] <== requiredDiagnosis;
    diagnosisMatch.out === 1;

    component commitment = Poseidon(4);
    commitment.inputs[0] <== age;
    commitment.inputs[1] <== biomarker;
    commitment.inputs[2] <== diagnosisCode;
    commitment.inputs[3] <== salt;
    credentialCommitment <== commitment.out;

    // Make trialId part of the constraint system/public statement.
    trialId * 1 === trialId;
}

component main { public [minAge, maxAge, minBiomarker, maxBiomarker, requiredDiagnosis, trialId] } = Eligibility();
