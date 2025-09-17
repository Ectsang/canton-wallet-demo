// Canton Console Verification Script
// Run this in Canton console to verify integration test results
// Usage: load this file in Canton console with:
// @ load("/path/to/canton-verify.scala")

import com.digitalasset.canton.console.ConsoleEnvironment
import com.digitalasset.canton.participant.domain.DomainConnectionConfig
import scala.concurrent.duration._

println("=" * 60)
println("Canton Integration Test Verification Script")
println("=" * 60)

// Helper function to print section headers
def printSection(title: String): Unit = {
  println(s"\n${"=" * 60}")
  println(s"  $title")
  println(s"${"=" * 60}")
}

// Helper function to safely execute and print results
def safePrint[T](description: String, action: => T): Unit = {
  try {
    val result = action
    println(s"✅ $description")
    println(s"   Result: $result")
  } catch {
    case e: Exception =>
      println(s"❌ $description")
      println(s"   Error: ${e.getMessage}")
  }
}

// 1. List all parties
printSection("1. All Parties in the System")
try {
  val allParties = participant.parties.list().filter(_.filterString.nonEmpty)
  println(s"Total parties found: ${allParties.size}")
  
  allParties.foreach { party =>
    println(s"\nParty ID: ${party.toLf}")
    println(s"  Display Name: ${party.filterString}")
    println(s"  Namespace: ${party.namespace}")
    println(s"  Fingerprint: ${party.fingerprint}")
  }
} catch {
  case e: Exception =>
    println(s"Error listing parties: ${e.getMessage}")
}

// 2. Find test wallet parties (created by integration tests)
printSection("2. Test Wallet Parties")
try {
  val testParties = participant.parties.list().filter(_.filterString.contains("test-wallet"))
  println(s"Found ${testParties.size} test wallet parties")
  
  testParties.foreach { party =>
    println(s"\nTest Party: ${party.toLf}")
    println(s"  Hint: ${party.filterString}")
    
    // Check party details
    val partyDetails = participant.parties.find(party.toLf)
    partyDetails.foreach { details =>
      println(s"  Active: ${details.active}")
      println(s"  Participants: ${details.participants.mkString(", ")}")
    }
  }
} catch {
  case e: Exception =>
    println(s"Error finding test parties: ${e.getMessage}")
}

// 3. List all active contracts
printSection("3. Active Contracts Summary")
try {
  val allContracts = participant.ledger_api.acs.of_all()
  println(s"Total active contracts: ${allContracts.size}")
  
  // Group contracts by template
  val contractsByTemplate = allContracts.groupBy(_.templateId)
  
  println("\nContracts by template:")
  contractsByTemplate.foreach { case (templateId, contracts) =>
    println(s"  ${templateId}: ${contracts.size} contracts")
  }
} catch {
  case e: Exception =>
    println(s"Error listing contracts: ${e.getMessage}")
}

// 4. Find Token contracts
printSection("4. Token Contracts")
try {
  val tokenContracts = participant.ledger_api.acs.filter { contract =>
    contract.templateId.toString.contains("Token") || 
    contract.templateId.toString.contains("token")
  }
  
  println(s"Found ${tokenContracts.size} token-related contracts")
  
  tokenContracts.foreach { contract =>
    println(s"\nContract ID: ${contract.contractId}")
    println(s"  Template: ${contract.templateId}")
    println(s"  Created: ${contract.createdAt}")
    
    // Try to extract token details from arguments
    try {
      val args = contract.arguments
      println(s"  Arguments: $args")
      
      // Look for common token fields
      args.fields.foreach { case (fieldName, value) =>
        if (fieldName.contains("token") || fieldName.contains("Token") ||
            fieldName.contains("symbol") || fieldName.contains("name") ||
            fieldName.contains("owner") || fieldName.contains("balance")) {
          println(s"    $fieldName: $value")
        }
      }
    } catch {
      case _: Exception =>
        println(s"  Arguments: [Unable to parse]")
    }
  }
} catch {
  case e: Exception =>
    println(s"Error finding token contracts: ${e.getMessage}")
}

// 5. Find balance contracts for test parties
printSection("5. Token Balances for Test Parties")
try {
  val testParties = participant.parties.list().filter(_.filterString.contains("test-wallet"))
  
  testParties.foreach { party =>
    println(s"\nChecking balances for party: ${party.toLf}")
    
    val balanceContracts = participant.ledger_api.acs.filter { contract =>
      contract.arguments.toString.contains(party.toLf) &&
      (contract.templateId.toString.contains("Balance") || 
       contract.templateId.toString.contains("balance"))
    }
    
    if (balanceContracts.nonEmpty) {
      println(s"  Found ${balanceContracts.size} balance contracts")
      balanceContracts.foreach { contract =>
        println(s"    Contract: ${contract.contractId}")
        try {
          val args = contract.arguments
          println(s"    Arguments: $args")
        } catch {
          case _: Exception =>
            println(s"    Arguments: [Unable to parse]")
        }
      }
    } else {
      println(s"  No balance contracts found")
    }
  }
} catch {
  case e: Exception =>
    println(s"Error finding balance contracts: ${e.getMessage}")
}

// 6. Recent transactions
printSection("6. Recent Transactions (Last 10)")
try {
  val recentTransactions = participant.ledger_api.transactions.flat(
    limit = 10,
    verbose = true
  )
  
  println(s"Found ${recentTransactions.size} recent transactions")
  
  recentTransactions.foreach { tx =>
    println(s"\nTransaction ID: ${tx.transactionId}")
    println(s"  Effective At: ${tx.effectiveAt}")
    println(s"  Command ID: ${tx.commandId}")
    println(s"  Workflow ID: ${tx.workflowId}")
    println(s"  Events: ${tx.events.size}")
  }
} catch {
  case e: Exception =>
    println(s"Error listing transactions: ${e.getMessage}")
}

// 7. Summary statistics
printSection("7. Summary Statistics")
try {
  val totalParties = participant.parties.list().size
  val testParties = participant.parties.list().filter(_.filterString.contains("test")).size
  val totalContracts = participant.ledger_api.acs.of_all().size
  val tokenContracts = participant.ledger_api.acs.filter(_.templateId.toString.toLowerCase.contains("token")).size
  
  println(s"Total parties: $totalParties")
  println(s"Test parties: $testParties")
  println(s"Total active contracts: $totalContracts")
  println(s"Token-related contracts: $tokenContracts")
} catch {
  case e: Exception =>
    println(s"Error calculating statistics: ${e.getMessage}")
}

println("\n" + "=" * 60)
println("Verification complete!")
println("=" * 60)