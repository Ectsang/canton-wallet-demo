#!/usr/bin/env python3
"""
Upload MinimalToken DAR to Canton LocalNet participants and update package IDs
Based on proven working method from CONTEXT.md

Usage:
    python3 scripts/upload_dar.py [version]

    If version is not provided, it will be read from
    daml/minimal-token/daml.yaml

Examples:
    # Auto-detect version from daml.yaml
    python3 scripts/upload_dar.py
    # Use specific version
    python3 scripts/upload_dar.py 1.0.0
"""
import subprocess
import base64
import json
import sys
import os
import re
import yaml


# Get project root (parent of scripts directory)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DAML_PROJECT_PATH = os.path.join(PROJECT_ROOT, 'daml', 'minimal-token')
DAML_YAML_PATH = os.path.join(DAML_PROJECT_PATH, 'daml.yaml')


def read_version_from_daml_yaml():
    """Read version from daml.yaml file"""
    if not os.path.exists(DAML_YAML_PATH):
        print(f"❌ daml.yaml not found at: {DAML_YAML_PATH}")
        sys.exit(1)

    try:
        with open(DAML_YAML_PATH, 'r') as f:
            daml_config = yaml.safe_load(f)

        version = daml_config.get('version')
        if not version:
            print("❌ No 'version' field found in daml.yaml")
            sys.exit(1)

        return str(version)
    except Exception as e:
        print(f"❌ Failed to read daml.yaml: {e}")
        sys.exit(1)


def get_dar_path(version):
    """Get the path to the DAR file for the specified version"""
    dar_dist_path = os.path.join(DAML_PROJECT_PATH, '.daml', 'dist')
    dar_file = f'minimal-token-{version}.dar'
    return os.path.join(dar_dist_path, dar_file)


def upload_dar(dar_path, version):
    """Upload DAR to both Canton participants"""
    if not os.path.exists(dar_path):
        print(f"❌ DAR file not found: {dar_path}")
        print("💡 Did you run 'daml build' first?")
        sys.exit(1)

    print(f"📦 Reading DAR file: {dar_path}")
    with open(dar_path, 'rb') as f:
        dar_bytes = f.read()

    dar_b64 = base64.b64encode(dar_bytes).decode('utf-8')
    print(f"✅ Encoded DAR file ({len(dar_bytes)} bytes)")

    upload_request = {
        "dars": [{
            "bytes": dar_b64,
            "description": (
                f"MinimalToken v{version} - "
                "ProposeBurn/AcceptBurn pattern"
            )
        }],
        "vet_all_packages": True,
        "synchronize_vetting": True
    }

    # Upload to app-provider (port 3902)
    print("\n🚀 Uploading to app-provider (localhost:3902)...")
    result_provider = subprocess.run([
        'grpcurl', '-plaintext', '-d', json.dumps(upload_request),
        'localhost:3902',
        'com.digitalasset.canton.admin.participant.v30.'
        'PackageService/UploadDar'
    ], capture_output=True, text=True)

    if result_provider.returncode != 0:
        print("❌ app-provider upload failed")
        print(result_provider.stderr)
        sys.exit(1)

    print("✅ app-provider upload successful")
    provider_response = json.loads(result_provider.stdout)
    package_id = (
        provider_response['darIds'][0]
        if provider_response.get('darIds')
        else None
    )

    if not package_id:
        print("❌ Could not extract package ID from response")
        sys.exit(1)

    print(f"📦 Package ID: {package_id}")

    # Upload to app-user (port 2902)
    print("\n🚀 Uploading to app-user (localhost:2902)...")
    result_user = subprocess.run([
        'grpcurl', '-plaintext', '-d', json.dumps(upload_request),
        'localhost:2902',
        'com.digitalasset.canton.admin.participant.v30.'
        'PackageService/UploadDar'
    ], capture_output=True, text=True)

    if result_user.returncode != 0:
        print("❌ app-user upload failed")
        print(result_user.stderr)
        sys.exit(1)

    print("✅ app-user upload successful")

    # Vet the DAR on both participants
    print("\n🔒 Vetting DAR on participants...")
    vet_dar(package_id)

    return package_id


def vet_dar(package_id):
    """Vet the DAR on both participants for transactions"""
    vet_request = {
        "main_package_id": package_id,
        "synchronize": True
    }

    # Vet on app-provider (port 3902)
    print("  🔒 Vetting on app-provider...")
    result_provider = subprocess.run([
        'grpcurl', '-plaintext', '-d', json.dumps(vet_request),
        'localhost:3902',
        'com.digitalasset.canton.admin.participant.v30.PackageService/VetDar'
    ], capture_output=True, text=True)

    if result_provider.returncode != 0:
        print("  ⚠️  app-provider vetting warning:", result_provider.stderr)
    else:
        print("  ✅ app-provider vetting successful")

    # Vet on app-user (port 2902)
    print("  🔒 Vetting on app-user...")
    result_user = subprocess.run([
        'grpcurl', '-plaintext', '-d', json.dumps(vet_request),
        'localhost:2902',
        'com.digitalasset.canton.admin.participant.v30.PackageService/VetDar'
    ], capture_output=True, text=True)

    if result_user.returncode != 0:
        print("  ⚠️  app-user vetting warning:", result_user.stderr)
    else:
        print("  ✅ app-user vetting successful")

    print("✅ DAR vetting complete")


def update_package_config(package_id, version):
    """Update the package configuration file with the new package ID"""
    config_path = os.path.join(
        PROJECT_ROOT, 'src', 'config', 'packageConfig.js'
    )

    print(f"\n📝 Updating package configuration: {config_path}")

    # Read current config
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            content = f.read()
    else:
        # Create new config file
        content = """// MinimalToken Package Configuration
// This file is auto-generated by upload_dar.py

export const MINIMAL_TOKEN_PACKAGE_CONFIG = {
  // Current active version
  currentVersion: null,
  currentPackageId: null,

  // All deployed versions
  versions: {}
};

export default MINIMAL_TOKEN_PACKAGE_CONFIG;
"""

    # Parse existing versions (simple regex approach)
    versions_match = re.search(r"versions:\s*{([^}]*)}", content, re.DOTALL)
    versions = {}

    if versions_match:
        versions_str = versions_match.group(1)
        # Extract version entries
        for match in re.finditer(r"'([^']+)':\s*'([^']+)'", versions_str):
            versions[match.group(1)] = match.group(2)

    # Add new version
    versions[version] = package_id

    # Build new versions object
    versions_str = ",\n    ".join([
        f"'{v}': '{pid}'"
        for v, pid in sorted(versions.items(), reverse=True)
    ])

    # Create new config content
    new_content = f"""// MinimalToken Package Configuration
// This file is auto-generated by upload_dar.py

export const MINIMAL_TOKEN_PACKAGE_CONFIG = {{
  // Current active version
  currentVersion: '{version}',
  currentPackageId: '{package_id}',

  // All deployed versions (newest first)
  versions: {{
    {versions_str}
  }}
}};

export default MINIMAL_TOKEN_PACKAGE_CONFIG;
"""

    # Write updated config
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, 'w') as f:
        f.write(new_content)

    print("✅ Updated package configuration")
    print(f"   Current version: {version}")
    print(f"   Package ID: {package_id}")


def main():
    # Get version from command line or daml.yaml
    if len(sys.argv) > 2:
        print("Usage: python3 scripts/upload_dar.py [version]")
        print()
        print("If version is not provided, it will be read from daml.yaml")
        print()
        print("Examples:")
        print("  python3 scripts/upload_dar.py           # Auto-detect")
        print("  python3 scripts/upload_dar.py 1.0.0     # Specific version")
        sys.exit(1)

    if len(sys.argv) == 2:
        version = sys.argv[1]
        print("📝 Using version from command line")
    else:
        print("📝 Reading version from daml.yaml...")
        version = read_version_from_daml_yaml()
        print(f"✅ Found version: {version}")

    dar_path = get_dar_path(version)

    print("\n🚀 Canton DAR Upload Tool")
    print(f"📦 Version: {version}")
    print(f"📁 DAR path: {dar_path}\n")

    # Upload DAR and get package ID
    package_id = upload_dar(dar_path, version)

    # Update package configuration
    update_package_config(package_id, version)

    print("\n✅ Upload complete!")
    print("\n📝 Configuration updated automatically in:")
    print("   - src/config/packageConfig.js")
    print(
        "\n💡 Make sure your services import from packageConfig.js "
        "to use the new version"
    )


if __name__ == '__main__':
    main()
