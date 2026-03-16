"""OLAF Feature Test Script

Tests all backend API endpoints against a running server.
Usage:
    python scripts/test_features.py [--base-url http://localhost:8080] [--token FIREBASE_ID_TOKEN]

If --token is not provided, auth-required endpoints will be skipped.
"""

import argparse
import sys

import httpx

# ── Colours for terminal output ──────────────────────────────────────────────
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

passed = 0
failed = 0
skipped = 0


def log_pass(name: str, detail: str = ""):
    global passed
    passed += 1
    print(f"  {GREEN}PASS{RESET}  {name}  {detail}")


def log_fail(name: str, detail: str = ""):
    global failed
    failed += 1
    print(f"  {RED}FAIL{RESET}  {name}  {detail}")


def log_skip(name: str, reason: str = ""):
    global skipped
    skipped += 1
    print(f"  {YELLOW}SKIP{RESET}  {name}  {reason}")


def section(title: str):
    print(f"\n{BOLD}{CYAN}── {title} ──{RESET}")


# ── Test functions ───────────────────────────────────────────────────────────

def test_health_check(client: httpx.Client):
    section("Health Check")
    try:
        r = client.get("/health")
        if r.status_code == 200:
            log_pass("GET /health", f"status={r.status_code}")
        else:
            log_fail("GET /health", f"status={r.status_code}")
    except Exception as e:
        log_fail("GET /health", str(e))


def test_auth(client: httpx.Client, headers: dict):
    section("Authentication")
    if not headers:
        log_skip("GET /api/auth/me", "no token")
        return None

    try:
        r = client.get("/api/auth/me", headers=headers)
        if r.status_code == 200:
            data = r.json()
            user_id = data.get("data", {}).get("userId", "")
            log_pass("GET /api/auth/me", f"userId={user_id}")
            return user_id
        else:
            log_fail("GET /api/auth/me", f"status={r.status_code} {r.text[:100]}")
            return None
    except Exception as e:
        log_fail("GET /api/auth/me", str(e))
        return None


def test_reminders(client: httpx.Client, headers: dict, user_id: str):
    section("Reminders")
    if not headers or not user_id:
        log_skip("Reminders", "no auth")
        return

    # Set a reminder (no time needed)
    try:
        r = client.post(
            "/api/companion/set-reminder",
            headers=headers,
            json={
                "userId": user_id,
                "args": {
                    "reminderType": "medication",
                    "message": "[TEST] Take vitamin D",
                },
            },
        )
        if r.status_code == 200 and r.json().get("status") == "success":
            reminder_id = r.json()["data"]["reminderId"]
            log_pass("POST set-reminder", f"id={reminder_id}")
        else:
            log_fail("POST set-reminder", f"status={r.status_code} {r.text[:200]}")
            return
    except Exception as e:
        log_fail("POST set-reminder", str(e))
        return

    # List reminders
    try:
        r = client.get(f"/api/health/reminders?userId={user_id}", headers=headers)
        if r.status_code == 200:
            reminders = r.json().get("data", {}).get("reminders", [])
            log_pass("GET reminders", f"count={len(reminders)}")
        else:
            log_fail("GET reminders", f"status={r.status_code}")
    except Exception as e:
        log_fail("GET reminders", str(e))

    # Complete the reminder
    try:
        r = client.post(
            "/api/companion/complete-reminder",
            headers=headers,
            json={
                "userId": user_id,
                "args": {"reminderId": reminder_id},
            },
        )
        if r.status_code == 200 and r.json().get("status") == "success":
            log_pass("POST complete-reminder", f"id={reminder_id}")
        else:
            log_fail("POST complete-reminder", f"status={r.status_code} {r.text[:200]}")
    except Exception as e:
        log_fail("POST complete-reminder", str(e))

    # Set reminder with fuzzy type (test normalization)
    try:
        r = client.post(
            "/api/companion/set-reminder",
            headers=headers,
            json={
                "userId": user_id,
                "args": {
                    "reminderType": "medicine",
                    "message": "[TEST] Fuzzy type test",
                },
            },
        )
        if r.status_code == 200 and r.json().get("status") == "success":
            log_pass("POST set-reminder (fuzzy type 'medicine')", "normalized OK")
        else:
            log_fail("POST set-reminder (fuzzy type)", f"status={r.status_code} {r.text[:200]}")
    except Exception as e:
        log_fail("POST set-reminder (fuzzy type)", str(e))


def test_health_logs(client: httpx.Client, headers: dict, user_id: str):
    section("Health Logs")
    if not headers or not user_id:
        log_skip("Health Logs", "no auth")
        return

    # Log a health checkin
    try:
        r = client.post(
            "/api/companion/log-health-checkin",
            headers=headers,
            json={
                "userId": user_id,
                "args": {"mood": "happy", "painLevel": 0, "notes": "[TEST] feeling good"},
            },
        )
        if r.status_code == 200:
            log_pass("POST log-health-checkin", f"status={r.json().get('status')}")
        else:
            log_fail("POST log-health-checkin", f"status={r.status_code} {r.text[:200]}")
    except Exception as e:
        log_fail("POST log-health-checkin", str(e))

    # Get health logs
    try:
        r = client.get(f"/api/health/logs?userId={user_id}&range=today", headers=headers)
        if r.status_code == 200:
            logs = r.json().get("data", {}).get("logs", [])
            log_pass("GET health/logs", f"count={len(logs)}")
        else:
            log_fail("GET health/logs", f"status={r.status_code}")
    except Exception as e:
        log_fail("GET health/logs", str(e))


def test_alerts(client: httpx.Client, headers: dict, user_id: str):
    section("Alerts")
    if not headers or not user_id:
        log_skip("Alerts", "no auth")
        return

    # Flag distress (creates an alert)
    try:
        r = client.post(
            "/api/companion/flag-emotional-distress",
            headers=headers,
            json={
                "userId": user_id,
                "args": {"severity": "low", "observation": "[TEST] automated test flag"},
            },
        )
        if r.status_code == 200:
            alert_id = r.json().get("data", {}).get("alertId", "")
            log_pass("POST flag-emotional-distress", f"alertId={alert_id}")
        else:
            log_fail("POST flag-emotional-distress", f"status={r.status_code} {r.text[:200]}")
            alert_id = None
    except Exception as e:
        log_fail("POST flag-emotional-distress", str(e))
        alert_id = None

    # Get alerts
    try:
        r = client.get(f"/api/alerts?userId={user_id}", headers=headers)
        if r.status_code == 200:
            alerts = r.json().get("data", {}).get("alerts", [])
            log_pass("GET alerts", f"count={len(alerts)}")
        else:
            log_fail("GET alerts", f"status={r.status_code}")
    except Exception as e:
        log_fail("GET alerts", str(e))

    # Acknowledge alert
    if alert_id:
        try:
            r = client.patch(f"/api/alerts/{alert_id}/acknowledge", headers=headers)
            if r.status_code == 200:
                log_pass("PATCH acknowledge alert", f"id={alert_id}")
            else:
                log_fail("PATCH acknowledge alert", f"status={r.status_code}")
        except Exception as e:
            log_fail("PATCH acknowledge alert", str(e))


def test_memories(client: httpx.Client, headers: dict, user_id: str):
    section("Memories (Storyteller)")
    if not headers or not user_id:
        log_skip("Memories", "no auth")
        return

    # List memories
    try:
        r = client.get(f"/api/storyteller/memories?userId={user_id}&limit=5", headers=headers)
        if r.status_code == 200:
            data = r.json().get("data", {})
            total = data.get("total", 0)
            memories = data.get("memories", [])
            log_pass("GET memories", f"total={total} returned={len(memories)}")

            # Get detail of first memory if available
            if memories:
                mid = memories[0]["id"]
                r2 = client.get(f"/api/storyteller/memories/{mid}?userId={user_id}", headers=headers)
                if r2.status_code == 200:
                    title = r2.json().get("data", {}).get("title", "")
                    log_pass("GET memory detail", f"id={mid} title={title[:40]}")
                else:
                    log_fail("GET memory detail", f"status={r2.status_code}")
        else:
            log_fail("GET memories", f"status={r.status_code}")
    except Exception as e:
        log_fail("GET memories", str(e))


def test_conversations(client: httpx.Client, headers: dict, user_id: str):
    section("Conversations")
    if not headers or not user_id:
        log_skip("Conversations", "no auth")
        return

    try:
        r = client.get(f"/api/companion/conversations?userId={user_id}&limit=5", headers=headers)
        if r.status_code == 200:
            convos = r.json().get("data", {}).get("conversations", [])
            log_pass("GET conversations", f"count={len(convos)}")
        else:
            log_fail("GET conversations", f"status={r.status_code}")
    except Exception as e:
        log_fail("GET conversations", str(e))


def test_reports(client: httpx.Client, headers: dict, user_id: str):
    section("Health Reports")
    if not headers or not user_id:
        log_skip("Health Reports", "no auth")
        return

    try:
        r = client.get(f"/api/health/reports?userId={user_id}", headers=headers)
        if r.status_code == 200:
            reports = r.json().get("data", {}).get("reports", [])
            log_pass("GET health/reports", f"count={len(reports)}")
        else:
            log_fail("GET health/reports", f"status={r.status_code}")
    except Exception as e:
        log_fail("GET health/reports", str(e))


def test_gemini_token(client: httpx.Client, headers: dict):
    section("Gemini Token")
    if not headers:
        log_skip("POST /api/gemini/token", "no auth")
        return

    try:
        r = client.post("/api/gemini/token", headers=headers, json={"model": "gemini-2.0-flash-exp"})
        if r.status_code == 200:
            log_pass("POST /api/gemini/token", "token provisioned")
        else:
            log_fail("POST /api/gemini/token", f"status={r.status_code} {r.text[:100]}")
    except Exception as e:
        log_fail("POST /api/gemini/token", str(e))


def test_notifications(client: httpx.Client, headers: dict):
    section("Notifications")
    if not headers:
        log_skip("Notifications", "no auth")
        return

    try:
        r = client.post(
            "/api/notifications/register-token",
            headers=headers,
            json={"token": "test-fcm-token-12345", "device_id": "test-device"},
        )
        if r.status_code == 200:
            log_pass("POST register-token", "registered")
        else:
            log_fail("POST register-token", f"status={r.status_code}")
    except Exception as e:
        log_fail("POST register-token", str(e))

    try:
        r = client.request(
            "DELETE",
            "/api/notifications/unregister-token",
            headers=headers,
            json={"token": "test-fcm-token-12345"},
        )
        if r.status_code == 200:
            log_pass("DELETE unregister-token", "unregistered")
        else:
            log_fail("DELETE unregister-token", f"status={r.status_code}")
    except Exception as e:
        log_fail("DELETE unregister-token", str(e))


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Test all OLAF backend features")
    parser.add_argument("--base-url", default="http://localhost:8080", help="Backend base URL")
    parser.add_argument("--token", default="", help="Firebase ID token for auth")
    args = parser.parse_args()

    print(f"\n{BOLD}OLAF Feature Test{RESET}")
    print(f"Server: {args.base_url}")
    print(f"Auth:   {'provided' if args.token else 'none (auth endpoints will be skipped)'}")

    headers = {"Authorization": f"Bearer {args.token}"} if args.token else {}

    client = httpx.Client(base_url=args.base_url, timeout=30)

    try:
        # 1. Health check (no auth needed)
        test_health_check(client)

        # 2. Auth — get user ID
        user_id = test_auth(client, headers)

        # 3. Reminders (set, list, complete, fuzzy type, human time, no time)
        test_reminders(client, headers, user_id)

        # 4. Health logs
        test_health_logs(client, headers, user_id)

        # 5. Alerts (flag distress, list, acknowledge)
        test_alerts(client, headers, user_id)

        # 6. Memories
        test_memories(client, headers, user_id)

        # 7. Conversations
        test_conversations(client, headers, user_id)

        # 8. Reports
        test_reports(client, headers, user_id)

        # 9. Gemini token
        test_gemini_token(client, headers)

        # 10. Notifications
        test_notifications(client, headers)

    finally:
        client.close()

    # Summary
    total = passed + failed + skipped
    print(f"\n{BOLD}{'─' * 50}{RESET}")
    print(
        f"{BOLD}Results:{RESET}  {GREEN}{passed} passed{RESET}  "
        f"{RED}{failed} failed{RESET}  {YELLOW}{skipped} skipped{RESET}  ({total} total)"
    )

    if failed > 0:
        print(f"\n{RED}Some tests failed!{RESET}")
        sys.exit(1)
    else:
        print(f"\n{GREEN}All tests passed!{RESET}")


if __name__ == "__main__":
    main()
