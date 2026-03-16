"""Get a Firebase ID token for testing.

Usage:
    python scripts/get_token.py --email user@example.com --password mypassword

Prints the ID token to stdout so you can pipe it:
    python scripts/test_features.py --token $(python scripts/get_token.py --email x --password y)
"""

import argparse
import os
import sys

import httpx


def main():
    parser = argparse.ArgumentParser(description="Get Firebase ID token")
    parser.add_argument("--email", required=True, help="Firebase user email")
    parser.add_argument("--password", required=True, help="Firebase user password")
    parser.add_argument(
        "--api-key",
        default=os.environ.get("FIREBASE_API_KEY", ""),
        help="Firebase Web API key (or set FIREBASE_API_KEY env var)",
    )
    args = parser.parse_args()

    if not args.api_key:
        print("ERROR: Provide --api-key or set FIREBASE_API_KEY env var", file=sys.stderr)
        sys.exit(1)

    resp = httpx.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={args.api_key}",
        json={
            "email": args.email,
            "password": args.password,
            "returnSecureToken": True,
        },
        timeout=10,
    )

    if resp.status_code != 200:
        print(f"ERROR: {resp.status_code} {resp.text}", file=sys.stderr)
        sys.exit(1)

    data = resp.json()
    token = data.get("idToken", "")
    print(token)


if __name__ == "__main__":
    main()
