"""Backend tests for new features in Assam Co-op Connect:
- Member portal (auto-create login + scoped views + /api/passbook)
- EMI schedule generation, /loans/{id}/schedule, /loans/{id}/pay-emi
- NPA classification
- Society Settings (GET any, PUT Admin only)
"""
import os
import time
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
).rstrip("/")
API = f"{BASE_URL}/api"


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def _login(email, password):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ---------- session tokens ----------
@pytest.fixture(scope="session")
def admin_token():
    return _login("admin@coopassam.in", "Admin@123")


@pytest.fixture(scope="session")
def manager_token():
    return _login("manager@coopassam.in", "Manager@123")


@pytest.fixture(scope="session")
def agent_token():
    return _login("agent@coopassam.in", "Agent@123")


# Unique phone so test is rerunnable
UNIQUE_PHONE = f"99{int(time.time()) % 10_000_000:07d}"
EXPECTED_EMAIL = f"{UNIQUE_PHONE}@member.coop"


@pytest.fixture(scope="session")
def new_member(admin_token):
    payload = {
        "name": "TEST_PortalMember",
        "phone": UNIQUE_PHONE,
        "address": "TEST Portal Address",
        "village": "Jorhat",
        "district": "Kamrup",
        "share_capital": 200.0,
        "occupation": "Tester",
    }
    r = requests.post(f"{API}/members", json=payload, headers=H(admin_token))
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def member_token(new_member):
    # New member auto-login with default password
    assert new_member.get("login_email") == EXPECTED_EMAIL
    assert new_member.get("default_password") == "Member@123"
    return _login(new_member["login_email"], "Member@123")


# ---------- Member auto-login ----------
class TestMemberAutoCreate:
    def test_member_response_has_login_fields(self, new_member):
        assert new_member["login_email"] == EXPECTED_EMAIL
        assert new_member["default_password"] == "Member@123"
        assert new_member.get("user_id")

    def test_member_can_login(self, member_token):
        assert isinstance(member_token, str) and len(member_token) > 20

    def test_member_auth_me_role(self, member_token):
        r = requests.get(f"{API}/auth/me", headers=H(member_token))
        assert r.status_code == 200
        assert r.json()["role"] == "Member"


# ---------- Member-scoped views ----------
class TestMemberScopedViews:
    def test_member_dashboard(self, member_token, new_member):
        r = requests.get(f"{API}/dashboard", headers=H(member_token))
        assert r.status_code == 200
        d = r.json()
        assert d["is_member"] is True
        assert d["member"]["id"] == new_member["id"]
        for key in ("total_savings", "loan_outstanding", "accounts", "loans", "recent_transactions"):
            assert key in d, f"missing {key}"

    def test_member_lists_only_own_record(self, member_token, new_member):
        r = requests.get(f"{API}/members", headers=H(member_token))
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 1
        assert rows[0]["id"] == new_member["id"]

    def test_member_lists_only_own_loans(self, member_token, admin_token, new_member):
        # ensure some other loan exists for someone else first (any pre-existing)
        r = requests.get(f"{API}/loans", headers=H(member_token))
        assert r.status_code == 200
        for ln in r.json():
            assert ln["member_id"] == new_member["id"]

    def test_passbook_member(self, member_token, new_member):
        r = requests.get(f"{API}/passbook", headers=H(member_token))
        assert r.status_code == 200
        d = r.json()
        assert d["member"]["id"] == new_member["id"]
        for k in ("accounts", "loans", "transactions"):
            assert k in d

    def test_passbook_staff_forbidden(self, admin_token):
        r = requests.get(f"{API}/passbook", headers=H(admin_token))
        assert r.status_code == 403


# ---------- EMI schedule + Pay EMI ----------
@pytest.fixture(scope="session")
def approved_loan(admin_token, new_member):
    # Create loan
    payload = {
        "member_id": new_member["id"],
        "amount": 12000.0,
        "interest_rate": 12.0,
        "tenure_months": 6,
        "purpose": "TEST EMI schedule",
    }
    r = requests.post(f"{API}/loans", json=payload, headers=H(admin_token))
    assert r.status_code == 200, r.text
    loan = r.json()
    # Approve loan -> schedule generated
    r2 = requests.post(f"{API}/loans/{loan['id']}/approve", headers=H(admin_token))
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body.get("ok") is True
    assert body.get("schedule_count") == 6
    return loan


class TestEMISchedule:
    def test_schedule_endpoint_returns_full_structure(self, admin_token, approved_loan):
        r = requests.get(f"{API}/loans/{approved_loan['id']}/schedule",
                         headers=H(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("loan_no", "emi", "paid", "total_payable", "npa", "schedule"):
            assert k in d
        assert d["loan_no"] == approved_loan["loan_no"]
        assert d["npa"] is False  # freshly approved
        sched = d["schedule"]
        assert len(sched) == approved_loan["tenure_months"] == 6
        # Entry fields
        first = sched[0]
        for k in ("installment_no", "due_date", "principal_component",
                  "interest_component", "emi", "balance_after", "status"):
            assert k in first, f"missing {k}"
        assert first["installment_no"] == 1
        assert first["status"] in ("Due", "Overdue", "Paid")
        # Last balance approximately zero
        assert sched[-1]["balance_after"] <= 1.0

    def test_member_can_view_own_schedule(self, member_token, approved_loan):
        r = requests.get(f"{API}/loans/{approved_loan['id']}/schedule",
                         headers=H(member_token))
        assert r.status_code == 200

    def test_pay_emi_marks_paid_and_increments(self, admin_token, approved_loan):
        # Capture pre state
        pre = requests.get(f"{API}/loans/{approved_loan['id']}/schedule",
                           headers=H(admin_token)).json()
        emi = pre["emi"]
        pre_paid = pre["paid"]
        # Pay 1 EMI
        r = requests.post(f"{API}/loans/{approved_loan['id']}/pay-emi",
                          headers=H(admin_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["receipt_no"].startswith("RCP-")
        assert body["installment"]["status"] == "Paid"
        assert body["installment"]["installment_no"] == 1
        # Verify schedule[0] is Paid
        post = requests.get(f"{API}/loans/{approved_loan['id']}/schedule",
                            headers=H(admin_token)).json()
        assert post["schedule"][0]["status"] == "Paid"
        assert abs(post["paid"] - (pre_paid + emi)) < 0.01
        # Verify Txn record created (type=EMI)
        txns = requests.get(f"{API}/transactions", headers=H(admin_token)).json()
        emi_txn = next((t for t in txns if t.get("loan_id") == approved_loan["id"]
                        and t["type"] == "EMI" and t["receipt_no"] == body["receipt_no"]), None)
        assert emi_txn is not None, "EMI Txn not recorded"
        assert abs(emi_txn["amount"] - emi) < 0.01

    def test_pay_all_emis_closes_loan(self, admin_token, new_member):
        # Create a small 2-month loan, approve, pay both => Closed
        payload = {
            "member_id": new_member["id"], "amount": 2000.0,
            "interest_rate": 12.0, "tenure_months": 2,
            "purpose": "TEST closure",
        }
        loan = requests.post(f"{API}/loans", json=payload, headers=H(admin_token)).json()
        requests.post(f"{API}/loans/{loan['id']}/approve", headers=H(admin_token))
        r1 = requests.post(f"{API}/loans/{loan['id']}/pay-emi", headers=H(admin_token))
        r2 = requests.post(f"{API}/loans/{loan['id']}/pay-emi", headers=H(admin_token))
        assert r1.status_code == 200 and r2.status_code == 200
        # 3rd should fail (no more EMIs)
        r3 = requests.post(f"{API}/loans/{loan['id']}/pay-emi", headers=H(admin_token))
        assert r3.status_code == 400
        # Loan status should be Closed
        all_loans = requests.get(f"{API}/loans", headers=H(admin_token)).json()
        ln = next(l for l in all_loans if l["id"] == loan["id"])
        assert ln["status"] == "Closed"


# ---------- NPA Dashboard ----------
class TestNPADashboard:
    def test_dashboard_has_npa_count(self, admin_token):
        r = requests.get(f"{API}/dashboard", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "npa_loans" in d
        assert isinstance(d["npa_loans"], int)
        # No schedules are >90 days overdue (fresh ones), so should be 0
        assert d["npa_loans"] == 0

    def test_npa_classify_with_synthetic_overdue(self):
        # Test the npa_classify logic by simulating a schedule entry with old due_date
        from datetime import datetime, timezone, timedelta
        # Direct import of the helper for unit-style verification
        import sys
        sys.path.insert(0, "/app/backend")
        from server import npa_classify  # noqa: E402
        old_due = (datetime.now(timezone.utc) - timedelta(days=120)).isoformat()
        sched = [{"status": "Due", "due_date": old_due}]
        assert npa_classify(sched) is True
        recent_due = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        sched2 = [{"status": "Due", "due_date": recent_due}]
        assert npa_classify(sched2) is False
        # Paid items ignored
        sched3 = [{"status": "Paid", "due_date": old_due}]
        assert npa_classify(sched3) is False


# ---------- Settings ----------
class TestSettings:
    def test_get_settings_any_user(self, admin_token, manager_token, agent_token, member_token):
        for tok in (admin_token, manager_token, agent_token, member_token):
            r = requests.get(f"{API}/settings", headers=H(tok))
            assert r.status_code == 200, r.text
            d = r.json()
            assert "society_name" in d

    def test_put_settings_admin_persists(self, admin_token):
        new_name = "TEST Co-op Society"
        payload = {
            "society_name": new_name,
            "registration_no": "RCS/ASM/TEST/2026",
            "contact_email": "test@coopassam.in",
            "default_savings_rate": 7.5,
            "default_loan_rate": 12.5,
            "default_dividend_pct": 10.5,
        }
        r = requests.put(f"{API}/settings", json=payload, headers=H(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["society_name"] == new_name
        # GET to verify persistence
        g = requests.get(f"{API}/settings", headers=H(admin_token)).json()
        assert g["society_name"] == new_name
        assert g["registration_no"] == "RCS/ASM/TEST/2026"
        assert abs(g["default_savings_rate"] - 7.5) < 0.001

    def test_put_settings_manager_forbidden(self, manager_token):
        r = requests.put(f"{API}/settings",
                         json={"society_name": "X"}, headers=H(manager_token))
        assert r.status_code == 403

    def test_put_settings_agent_forbidden(self, agent_token):
        r = requests.put(f"{API}/settings",
                         json={"society_name": "X"}, headers=H(agent_token))
        assert r.status_code == 403

    def test_put_settings_member_forbidden(self, member_token):
        r = requests.put(f"{API}/settings",
                         json={"society_name": "X"}, headers=H(member_token))
        assert r.status_code == 403
