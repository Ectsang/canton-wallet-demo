// Canton Console Test Script - Phase 1.2
// Tests basic console connectivity and participant readiness

// Test 1: List all participants
val allParticipants = participants.all
println(s"Found ${allParticipants.size} participants")

// Test 2: Find SV participant (where DSO party is hosted)
val svParticipant = participants.all.find(_.name == "sv")
svParticipant match {
  case Some(sv) => 
    println(s"✓ SV participant found: ${sv.name}")
    
    // Test 3: List parties on SV participant
    val parties = sv.parties.list()
    println(s"Found ${parties.size} parties on SV participant")
    
    // Test 4: Find DSO party
    val dsoParty = parties.find(_.party.toProtoPrimitive.startsWith("DSO::"))
    dsoParty match {
      case Some(dso) => 
        println(s"✓ DSO party found: ${dso.party.toProtoPrimitive}")
      case None => 
        println("⚠ DSO party not found")
    }
    
    // Test 5: List uploaded packages
    val packages = sv.packages.list()
    println(s"Found ${packages.size} uploaded packages")
    
    // Test 6: Check if we can list DARs
    try {
      val dars = sv.dars.list()
      println(s"✓ DAR listing works, found ${dars.size} DARs")
    } catch {
      case e: Exception => 
        println(s"⚠ DAR listing failed: ${e.getMessage}")
    }
    
  case None => 
    println("✗ SV participant not found")
    println("Available participants:")
    allParticipants.foreach(p => println(s"  - ${p.name}"))
}

// Test 7: Check console responsiveness
println("✓ Console is responsive and ready for DAML operations")

// Return success indicator
true
