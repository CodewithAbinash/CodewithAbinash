"""Backend tests for Assam Co-op Connect (FastAPI)."""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://coop-manager-assam.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"


# ---------- shared session ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "admin@coopassam.in", "password": "Admin@123"},
                      timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def manager_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "manager@coopassam.in", "password": "Manager@123"},
                      timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def agent_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "agent@coopassam.in", "password": "Agent@123"},
                      timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Auth ----------
class TestAuth:
    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "admin@coopassam.in", "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == "admin@coopassam.in"
        assert d["role"] == "Admin"

    def test_me_requires_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ---------- Members ----------
@pytest.fixture(scope="session")
def created_member(admin_token):
    payload = {
        "name": "TEST_Ramesh Bora",
        "phone": "9876500011",
        "address": "TEST Ward 7, Guwahati",
        "village": "Beltola",
        "district": "Kamrup",
        "share_capital": 500.0,
        "occupation": "Farmer",
    }
    r = requests.post(f"{API}/members", json=payload, headers=H(admin_token))
    assert r.status_code == 200, r.text
    return r.json()


class TestMembers:
    def test_create_member_admin(self, created_member):
        m = created_member
        assert m["id"]
        assert m["member_no"].startswith("ACC-")
        assert m["status"] == "Active"
        assert m["share_capital"] == 500.0

    def test_list_members(self, admin_token, created_member):
        r = requests.get(f"{API}/members", headers=H(admin_token))
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()]
        assert created_member["id"] in ids

    def test_get_member_detail(self, admin_token, created_member):
        r = requests.get(f"{API}/members/{created_member['id']}", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert d["member"]["id"] == created_member["id"]
        # share capital txn should exist
        types = [t["type"] for t in d["transactions"]]
        assert "ShareCapital" in types

    def test_agent_cannot_create_member(self, agent_token):
        payload = {"name": "TEST_Should_Fail", "phone": "9000000000",
                   "address": "x", "district": "Kamrup", "share_capital": 100}
        r = requests.post(f"{API}/members", json=payload, headers=H(agent_token))
        assert r.status_code == 403


# ---------- Accounts ----------
class TestAccounts:
    def test_create_rd_account(self, admin_token, created_member):
        payload = {"member_id": created_member["id"], "account_type": "RD",
                   "principal": 1000.0, "interest_rate": 7.0, "tenure_months": 12}
        r = requests.post(f"{API}/accounts", json=payload, headers=H(admin_token))
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["account_type"] == "RD"
        assert a["balance"] == 1000.0
        assert a["account_no"].startswith("RD-")
        pytest.shared_account_id = a["id"]

    def test_list_accounts(self, admin_token):
        r = requests.get(f"{API}/accounts", headers=H(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Loans + EMI math ----------
@pytest.fixture(scope="session")
def created_loan(admin_token, created_member):
    payload = {"member_id": created_member["id"], "amount": 60000.0,
               "interest_rate": 12.0, "tenure_months": 12,
               "purpose": "TEST Working capital"}
    r = requests.post(f"{API}/loans", json=payload, headers=H(admin_token))
    assert r.status_code == 200, r.text
    return r.json()


class TestLoans:
    def test_loan_emi_calc(self, created_loan):
        # 60000 @ 12% p.a. for 12 months -> r=0.01, EMI=P*r*(1+r)^n/((1+r)^n-1)
        # = 60000 * 0.01 * 1.12682503 / 0.12682503 ≈ 5330.93
        assert abs(created_loan["emi"] - 5330.93) < 1.0
        # total_payable = emi*12
        assert abs(created_loan["total_payable"] - created_loan["emi"] * 12) < 0.1
        assert created_loan["status"] == "Pending"
        assert created_loan["paid"] == 0.0
        assert created_loan["loan_no"].startswith("LN-")

    def test_agent_cannot_approve(self, agent_token, created_loan):
        r = requests.post(f"{API}/loans/{created_loan['id']}/approve",
                          headers=H(agent_token))
        assert r.status_code == 403

    def test_admin_approves(self, admin_token, created_loan):
        r = requests.post(f"{API}/loans/{created_loan['id']}/approve",
                          headers=H(admin_token))
        assert r.status_code == 200
        # verify status
        r2 = requests.get(f"{API}/loans", headers=H(admin_token))
        loan = next(l for l in r2.json() if l["id"] == created_loan["id"])
        assert loan["status"] == "Approved"
        assert loan["approved_on"] is not None

    def test_approve_already_approved_returns_400(self, admin_token, created_loan):
        r = requests.post(f"{API}/loans/{created_loan['id']}/approve",
                          headers=H(admin_token))
        assert r.status_code == 400

    def test_reject_flow(self, admin_token, created_member):
        # New pending loan to reject
        payload = {"member_id": created_member["id"], "amount": 5000,
                   "interest_rate": 14.0, "tenure_months": 6,
                   "purpose": "TEST Reject"}
        r = requests.post(f"{API}/loans", json=payload, headers=H(admin_token))
        loan = r.json()
        rj = requests.post(f"{API}/loans/{loan['id']}/reject", headers=H(admin_token))
        assert rj.status_code == 200


# ---------- Transactions ----------
class TestTransactions:
    def test_deposit_updates_balance(self, admin_token, created_member):
        # get account id
        accs = requests.get(f"{API}/accounts", headers=H(admin_token)).json()
        account = next(a for a in accs if a["member_id"] == created_member["id"])
        prev_balance = account["balance"]
        payload = {"member_id": created_member["id"], "account_id": account["id"],
                   "type": "Deposit", "amount": 250.0, "mode": "Cash",
                   "note": "TEST extra deposit"}
        r = requests.post(f"{API}/transactions", json=payload, headers=H(admin_token))
        assert r.status_code == 200, r.text
        # re-fetch account
        accs2 = requests.get(f"{API}/accounts", headers=H(admin_token)).json()
        new_bal = next(a["balance"] for a in accs2 if a["id"] == account["id"])
        assert abs(new_bal - (prev_balance + 250.0)) < 0.01

    def test_emi_payment_updates_loan(self, admin_token, created_loan):
        emi = created_loan["emi"]
        payload = {"member_id": created_loan["member_id"], "loan_id": created_loan["id"],
                   "type": "EMI", "amount": emi, "mode": "Cash", "note": "TEST EMI 1"}
        r = requests.post(f"{API}/transactions", json=payload, headers=H(admin_token))
        assert r.status_code == 200
        loans = requests.get(f"{API}/loans", headers=H(admin_token)).json()
        loan = next(l for l in loans if l["id"] == created_loan["id"])
        assert loan["paid"] >= emi - 0.01

    def test_agent_can_record_transaction(self, agent_token, created_member):
        # Agents do daily collection
        payload = {"member_id": created_member["id"], "type": "Deposit",
                   "amount": 10.0, "mode": "Cash", "note": "TEST agent deposit"}
        r = requests.post(f"{API}/transactions", json=payload, headers=H(agent_token))
        assert r.status_code == 200

    def test_list_transactions(self, admin_token):
        r = requests.get(f"{API}/transactions", headers=H(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Notices ----------
class TestNotices:
    def test_admin_create_notice(self, admin_token):
        payload = {"title": "TEST Notice", "body": "TEST body",
                   "category": "Circular"}
        r = requests.post(f"{API}/notices", json=payload, headers=H(admin_token))
        assert r.status_code == 200
        assert r.json()["title"] == "TEST Notice"

    def test_manager_can_create_notice(self, manager_token):
        payload = {"title": "TEST Manager Notice", "body": "x", "category": "General"}
        r = requests.post(f"{API}/notices", json=payload, headers=H(manager_token))
        assert r.status_code == 200

    def test_agent_cannot_create_notice(self, agent_token):
        payload = {"title": "TEST x", "body": "x", "category": "General"}
        r = requests.post(f"{API}/notices", json=payload, headers=H(agent_token))
        assert r.status_code == 403

    def test_list_notices(self, admin_token):
        r = requests.get(f"{API}/notices", headers=H(admin_token))
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ---------- Rules + Dashboard ----------
class TestRulesAndDashboard:
    def test_rules(self, admin_token):
        r = requests.get(f"{API}/rules", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "Assam Co-operative Societies Act" in d["act"]
        assert d["min_share_capital_per_member"] == 100
        assert "Sec. 47" in d["key_sections"]

    def test_dashboard(self, admin_token):
        r = requests.get(f"{API}/dashboard", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("members", "active_loans", "pending_loans", "accounts",
                  "total_deposits", "loan_outstanding", "recent_transactions"):
            assert k in d
        assert d["members"] >= 1
        assert d["active_loans"] >= 1  # we approved one
