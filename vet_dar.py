#!/usr/bin/env python3
"""
Vet DAR packages on Canton LocalNet participants

Canton requires DARs to be "vetted" before they can be used in transactions.
This script vets a package on both app-provider and app-user participants.

Usage:
    python3 vet_dar.py <package-id>

Example:
    python3 vet_dar.py 1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e
"""
import subprocess
import json
import sys

def vet_dar_on_participant(package_id, port, participant_name):
    """Vet a DAR on a specific participant"""
    vet_request = {
        "main_package_id": package_id,
        "synchronize": True
    }

    print(f"🔒 Vetting on {participant_name} (localhost:{port})...")
    result = subprocess.run([
        'grpcurl', '-plaintext', '-d', json.dumps(vet_request),
        f'localhost:{port}',
        'com.digitalasset.canton.admin.participant.v30.PackageService/VetDar'
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print(f"⚠️  {participant_name} vetting warning:")
        print(result.stderr)
        return False
    else:
        print(f"✅ {participant_name} vetting successful")
        return True

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 vet_dar.py <package-id>")
        print("\nExample:")
        print("  python3 vet_dar.py 1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e")
        print("\nWhat is vetting?")
        print("  Canton requires packages to be 'vetted' before they can be used in transactions.")
        print("  This ensures that all participants agree on which packages are allowed.")
        sys.exit(1)

    package_id = sys.argv[1]

    print(f"🔒 Canton DAR Vetting Tool")
    print(f"📦 Package ID: {package_id}\n")

    # Vet on both participants
    success_provider = vet_dar_on_participant(package_id, 3902, "app-provider")
    success_user = vet_dar_on_participant(package_id, 2902, "app-user")

    print()
    if success_provider and success_user:
        print("✅ DAR successfully vetted on both participants!")
        print("💡 You can now use this package in transactions")
    else:
        print("⚠️  Vetting completed with warnings")
        print("💡 Check the messages above for details")
        sys.exit(1)

if __name__ == '__main__':
    main()
