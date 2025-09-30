// Onboard external party for contract creation
val externalPartyKey = crypto.generateKeyPair()
val partyId = "ExternalParty"

// Get the participant
val participant = participants.local.head

// Propose the new external party
participant.topology.party_to_participant_mappings.propose_delta(
  participant.topology.party_to_participant_mappings.authorize(
    ops = Seq(
      TopologyChangeOp.Add,
      PartyToParticipant.create(
        partyId = PartyId.tryFromProtoPrimitive(partyId),
        domainId = None,
        threshold = PositiveInt.one,
        participants = Seq(ParticipantId.tryFromProtoPrimitive(participant.id.toProtoPrimitive))
      )
    ),
    signedBy = Seq(participant.id.fingerprint),
    serial = None,
    mustFullyAuthorize = true
  )
)

println(s"Successfully onboarded party: $partyId")
println(s"Party key: ${externalPartyKey.publicKey}")
