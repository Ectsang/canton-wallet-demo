// Quick Canton State Check
val sv = participants.all.find(_.name == "sv").get
println("=== CANTON LEDGER STATE ===")
println(s"Total active contracts: ${sv.ledger_api.active_contracts.size}")

val dars = sv.dars.list()
val minimalTokenDar = dars.find(_.name.contains("minimal-token"))
println(s"MinimalToken DAR deployed: ${minimalTokenDar.isDefined}")

if (sv.ledger_api.active_contracts.size > 0) {
  println("Contract types:")
  sv.ledger_api.active_contracts.groupBy(_.template_id.entity_name).foreach { 
    case (template, contracts) => println(s"  ${template}: ${contracts.size}")
  }
} else {
  println("❌ NO CONTRACTS FOUND - You're using MOCK data!")
}

println("=== CONCLUSION ===")
if (sv.ledger_api.active_contracts.size == 0) {
  println("🔍 VERDICT: Your app is using MOCK data, not real Canton contracts")
  println("💡 This is why it feels 'too easy' - nothing is on the ledger!")
} else {
  println("✅ Real contracts found on Canton ledger")
}

true
