#!/bin/bash
# Manual DAR Upload Script
# Run this in your terminal: bash upload-dar-manual.sh

echo "📦 Uploading MinimalToken DAR to Canton..."
echo ""

# Create Canton script
cat > /tmp/upload.sc << 'CANTONEOF'
// Upload DAR to both participants
participants.app_provider.dars.upload("/app/minimal-token.dar")
participants.app_user.dars.upload("/app/minimal-token.dar")

// List packages to confirm
println("\n✅ Packages on app-provider:")
participants.app_provider.packages.list().take(5).foreach(pkg => println("  " + pkg.packageId))

println("\n✅ Looking for MinimalToken package:")
val target = "9d2d9824087d262af3f7726bf16038a7b46d4e735051cfe532f204c452512e61"
val found = participants.app_provider.packages.list().exists(_.packageId == target)
if (found) {
  println("  ✅ MinimalToken package FOUND: " + target)
} else {
  println("  ❌ MinimalToken package NOT FOUND")
}
CANTONEOF

echo "Running Canton console..."
docker exec canton /app/bin/canton daemon \
  -c /app/app-provider/on/canton.conf \
  --auto-connect-local \
  --bootstrap /tmp/upload.sc 2>&1 | \
  grep -E "Uploading|uploaded|Packages|✅|❌|MinimalToken|9d2d9824" || echo "Check output above"

echo ""
echo "Done! Now try creating a token in the UI."
