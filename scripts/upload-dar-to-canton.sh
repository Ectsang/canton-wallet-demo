#!/bin/bash
# Upload MinimalToken DAR to Canton participants via console

set -e

# Use the latest built DAR (auto-accept version)
DAR_FILE="$(pwd)/daml/minimal-token/.daml/dist/minimal-token-autoaccept-2.0.0.dar"

if [ ! -f "$DAR_FILE" ]; then
  echo "❌ DAR file not found: $DAR_FILE"
  echo "💡 Try building the DAR first: daml build --project-root=daml/minimal-token"
  exit 1
fi

echo "📦 Uploading DAR to Canton participants..."
echo "📁 DAR file: $DAR_FILE"

# Create temp script for Canton console
cat > /tmp/upload-dar.canton << 'CANTON_SCRIPT'
// Upload MinimalToken DAR to all participants
val darPath = "/app/minimal-token.dar"

println("🔄 Uploading DAR to app-provider...")
participants.app_provider.dars.upload(darPath)

println("🔄 Uploading DAR to app-user...")
participants.app_user.dars.upload(darPath)

println("✅ DAR uploaded to all participants!")

// List uploaded packages
println("\n📦 Packages on app-provider:")
participants.app_provider.packages.list().foreach(pkg => println("  " + pkg.packageId))
CANTON_SCRIPT

echo "📋 Executing Canton console script..."

# Copy DAR into container and execute via docker exec
docker cp "$DAR_FILE" canton:/app/minimal-token.dar
docker exec canton /app/bin/canton -c /app/app-provider/on/canton.conf --no-tty < /tmp/upload-dar.canton

echo ""
echo "✅ Upload complete!"
echo ""
echo "📦 Extract package ID:"
unzip -p "$DAR_FILE" META-INF/MANIFEST.MF | grep "Main-Dalf:" | awk '{print $2}' | cut -d'-' -f5
