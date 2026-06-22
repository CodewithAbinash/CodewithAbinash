"""
Assam Co-op Connect — Credit Co-operative Society Management API
Compliant with Assam Co-operative Societies Act, 2007 conventions
(share capital, member nominees, audit-friendly ledger, AGM notices).
"""

import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "assam-coop-secret-change-me-7c9f3e2a")
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60 * 24  # 24 h

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI(title="Assam Co-op Connect")
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_pw(p: str) -> str:
    return pwd_ctx.hash(p)


def verify_pw(p: str, h: str) -> bool:
    try:
        return pwd_ctx.verify(p, h)
    except Exception:
        return False


def make_token(sub: str, role: str) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(token: str = Depends(oauth_scheme)) -> dict:
    creds_err = HTTPException(status_code=401, detail="Invalid token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get("sub")
        if not uid:
            raise creds_err
    except JWTError:
        raise creds_err
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    if not user:
        raise creds_err
    return user


def require_roles(*roles: str):
    async def _dep(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not authorised")
        return user
    return _dep


# ---------- Models ----------
Role = Literal["Admin", "Manager", "Agent", "Member"]


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: Role


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: Role = "Member"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class MemberIn(BaseModel):
    name: str
    phone: str
    address: str
    village: Optional[str] = None
    district: str = "Kamrup"
    aadhaar: Optional[str] = None
    pan: Optional[str] = None
    nominee_name: Optional[str] = None
    nominee_relation: Optional[str] = None
    share_capital: float = 100.0  # min ₹100 per Assam Co-op rules
    occupation: Optional[str] = None


class Member(MemberIn):
    id: str
    member_no: str  # e.g. ACC-2026-0001
    joined_on: str
    status: Literal["Active", "Suspended"] = "Active"
    user_id: Optional[str] = None
    login_email: Optional[str] = None
    default_password: Optional[str] = None


class AccountIn(BaseModel):
    member_id: str
    account_type: Literal["RD", "FD", "DD"]
    principal: float
    interest_rate: float = 7.0   # % p.a.
    tenure_months: int = 12


class Account(AccountIn):
    id: str
    account_no: str
    balance: float
    opened_on: str
    status: Literal["Active", "Matured", "Closed"] = "Active"


class LoanIn(BaseModel):
    member_id: str
    amount: float
    interest_rate: float = 12.0
    tenure_months: int = 12
    purpose: str


class Loan(LoanIn):
    id: str
    loan_no: str
    emi: float
    total_interest: float
    total_payable: float
    paid: float = 0.0
    status: Literal["Pending", "Approved", "Rejected", "Closed"] = "Pending"
    applied_on: str
    approved_on: Optional[str] = None


class TxnIn(BaseModel):
    member_id: str
    account_id: Optional[str] = None
    loan_id: Optional[str] = None
    type: Literal["Deposit", "Withdrawal", "EMI", "Interest", "ShareCapital"]
    amount: float
    note: Optional[str] = None
    mode: Literal["Cash", "Online", "Cheque"] = "Cash"


class Txn(TxnIn):
    id: str
    receipt_no: str
    by_user: str  # user id of agent / admin
    by_name: str
    created_at: str


class NoticeIn(BaseModel):
    title: str
    body: str
    category: Literal["AGM", "Circular", "Rule", "General"] = "General"


class Notice(NoticeIn):
    id: str
    created_at: str
    created_by: str


# ---------- EMI helper ----------
def calc_emi(p: float, r_pa: float, n: int) -> tuple[float, float, float]:
    r = (r_pa / 12.0) / 100.0
    if r == 0:
        emi = p / n
    else:
        emi = p * r * pow(1 + r, n) / (pow(1 + r, n) - 1)
    total = emi * n
    return round(emi, 2), round(total - p, 2), round(total, 2)


def gen_no(prefix: str, count: int) -> str:
    return f"{prefix}-{datetime.now().year}-{count + 1:04d}"


def gen_emi_schedule(loan_id: str, amount: float, rate_pa: float, tenure: int, start: datetime) -> list:
    """Reducing-balance EMI schedule."""
    r = (rate_pa / 12.0) / 100.0
    emi_val, _, _ = calc_emi(amount, rate_pa, tenure)
    balance = amount
    rows = []
    for i in range(1, tenure + 1):
        interest = round(balance * r, 2)
        principal = round(emi_val - interest, 2)
        balance = round(max(balance - principal, 0), 2)
        due = start + timedelta(days=30 * i)
        rows.append({
            "id": str(uuid.uuid4()),
            "loan_id": loan_id,
            "installment_no": i,
            "due_date": due.isoformat(),
            "emi": emi_val,
            "principal_component": principal,
            "interest_component": interest,
            "balance_after": balance,
            "paid_amount": 0.0,
            "paid_on": None,
            "status": "Due",  # Due / Paid / Overdue
        })
    return rows


def npa_classify(schedule: list) -> bool:
    """Loan is NPA if any due installment is >90 days overdue."""
    today = datetime.now(timezone.utc)
    for s in schedule:
        if s["status"] != "Paid":
            try:
                due = datetime.fromisoformat(s["due_date"])
                if (today - due).days > 90:
                    return True
            except Exception:
                pass
    return False


# ---------- Auth ----------
@api.post("/auth/register", response_model=UserOut)
async def register(data: RegisterIn):
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(400, "Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "role": data.role,
        "password": hash_pw(data.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    return UserOut(**{k: user[k] for k in ("id", "name", "email", "phone", "role")})


@api.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_pw(data.password, user["password"]):
        raise HTTPException(401, "Incorrect email or password")
    token = make_token(user["id"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user.get("phone"),
            "role": user["role"],
        },
    }


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return UserOut(**{k: user.get(k) for k in ("id", "name", "email", "phone", "role")})


# ---------- Dashboard ----------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    # Member sees a personal mini-dashboard
    if user["role"] == "Member":
        member = await db.members.find_one({"user_id": user["id"]}, {"_id": 0})
        if not member:
            return {"is_member": True, "member": None, "accounts": [], "loans": [], "recent_transactions": []}
        accounts = await db.accounts.find({"member_id": member["id"]}, {"_id": 0}).to_list(50)
        loans = await db.loans.find({"member_id": member["id"]}, {"_id": 0, "schedule": 0}).to_list(50)
        txns = await db.transactions.find({"member_id": member["id"]}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
        total_savings = sum(a.get("balance", 0) for a in accounts)
        active_loans_amt = sum(ln["amount"] - ln.get("paid", 0) for ln in loans if ln["status"] == "Approved")
        return {
            "is_member": True,
            "member": member,
            "total_savings": round(total_savings, 2),
            "loan_outstanding": round(active_loans_amt, 2),
            "accounts": accounts,
            "loans": loans,
            "recent_transactions": txns,
        }

    # Staff dashboard
    members = await db.members.count_documents({})
    active_loans = await db.loans.count_documents({"status": "Approved"})
    pending_loans = await db.loans.count_documents({"status": "Pending"})
    accounts = await db.accounts.count_documents({"status": "Active"})

    # totals
    dep_agg = await db.transactions.aggregate(
        [{"$match": {"type": {"$in": ["Deposit", "ShareCapital"]}}},
         {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    ).to_list(1)
    total_deposits = dep_agg[0]["total"] if dep_agg else 0

    loan_agg = await db.loans.aggregate(
        [{"$match": {"status": "Approved"}},
         {"$group": {"_id": None, "principal": {"$sum": "$amount"},
                      "paid": {"$sum": "$paid"}}}]
    ).to_list(1)
    loan_outstanding = (
        (loan_agg[0]["principal"] - loan_agg[0]["paid"]) if loan_agg else 0
    )

    # NPA count
    npa = 0
    approved = await db.loans.find({"status": "Approved"}, {"schedule": 1}).to_list(1000)
    for ln in approved:
        if npa_classify(ln.get("schedule", [])):
            npa += 1

    recent = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)

    return {
        "is_member": False,
        "members": members,
        "active_loans": active_loans,
        "pending_loans": pending_loans,
        "accounts": accounts,
        "total_deposits": round(total_deposits, 2),
        "loan_outstanding": round(loan_outstanding, 2),
        "npa_loans": npa,
        "recent_transactions": recent,
    }


@api.get("/passbook")
async def passbook(user: dict = Depends(current_user)):
    """Own passbook for a Member; staff can pass ?member_id=..."""
    if user["role"] == "Member":
        member = await db.members.find_one({"user_id": user["id"]}, {"_id": 0})
    else:
        raise HTTPException(403, "Use /members/{id} for staff view")
    if not member:
        raise HTTPException(404, "Member record not found")
    accounts = await db.accounts.find({"member_id": member["id"]}, {"_id": 0}).to_list(50)
    loans = await db.loans.find({"member_id": member["id"]}, {"_id": 0}).to_list(50)
    txns = await db.transactions.find({"member_id": member["id"]}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return {"member": member, "accounts": accounts, "loans": loans, "transactions": txns}


# ---------- Members ----------
@api.get("/members", response_model=List[Member])
async def list_members(user: dict = Depends(current_user)):
    q: dict = {}
    if user["role"] == "Member":
        q = {"user_id": user["id"]}
    rows = await db.members.find(q, {"_id": 0}).sort("joined_on", -1).to_list(1000)
    return rows


@api.post("/members", response_model=Member)
async def add_member(data: MemberIn,
                     user: dict = Depends(require_roles("Admin", "Manager"))):
    count = await db.members.count_documents({})
    # auto-create a Member user account
    login_email = f"{data.phone.replace('+', '').replace('-', '').replace(' ', '')}@member.coop"
    default_pw = "Member@123"
    existing = await db.users.find_one({"email": login_email})
    if existing:
        member_user_id = existing["id"]
    else:
        member_user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": member_user_id,
            "name": data.name,
            "email": login_email,
            "phone": data.phone,
            "role": "Member",
            "password": hash_pw(default_pw),
            "created_at": now_iso(),
        })

    m = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "member_no": gen_no("ACC", count),
        "joined_on": now_iso(),
        "status": "Active",
        "user_id": member_user_id,
        "login_email": login_email,
        "default_password": default_pw,  # plaintext stored ONCE for admin handoff
    }
    await db.members.insert_one(m)
    # Share capital is logged as a transaction
    if m["share_capital"] > 0:
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "receipt_no": gen_no("RCP", await db.transactions.count_documents({})),
            "member_id": m["id"], "account_id": None, "loan_id": None,
            "type": "ShareCapital", "amount": m["share_capital"],
            "note": "Initial share capital", "mode": "Cash",
            "by_user": user["id"], "by_name": user["name"],
            "created_at": now_iso(),
        })
    return {k: v for k, v in m.items() if k != "_id"}


@api.get("/members/{member_id}")
async def get_member(member_id: str, user: dict = Depends(current_user)):
    m = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Member not found")
    accounts = await db.accounts.find({"member_id": member_id}, {"_id": 0}).to_list(100)
    loans = await db.loans.find({"member_id": member_id}, {"_id": 0}).to_list(100)
    txns = await db.transactions.find({"member_id": member_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {"member": m, "accounts": accounts, "loans": loans, "transactions": txns}


# ---------- Accounts (Savings) ----------
@api.get("/accounts", response_model=List[Account])
async def list_accounts(user: dict = Depends(current_user)):
    return await db.accounts.find({}, {"_id": 0}).sort("opened_on", -1).to_list(1000)


@api.post("/accounts", response_model=Account)
async def add_account(data: AccountIn,
                      user: dict = Depends(require_roles("Admin", "Manager"))):
    if not await db.members.find_one({"id": data.member_id}):
        raise HTTPException(404, "Member not found")
    count = await db.accounts.count_documents({})
    a = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "account_no": gen_no(data.account_type, count),
        "balance": data.principal,
        "opened_on": now_iso(),
        "status": "Active",
    }
    await db.accounts.insert_one(a)
    # Initial deposit transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "receipt_no": gen_no("RCP", await db.transactions.count_documents({})),
        "member_id": data.member_id, "account_id": a["id"], "loan_id": None,
        "type": "Deposit", "amount": data.principal,
        "note": f"{data.account_type} account opening", "mode": "Cash",
        "by_user": user["id"], "by_name": user["name"],
        "created_at": now_iso(),
    })
    return {k: v for k, v in a.items() if k != "_id"}


# ---------- Loans ----------
@api.get("/loans")
async def list_loans(user: dict = Depends(current_user)):
    q: dict = {}
    if user["role"] == "Member":
        m = await db.members.find_one({"user_id": user["id"]}, {"id": 1})
        q = {"member_id": m["id"]} if m else {"member_id": "__none__"}
    rows = await db.loans.find(q, {"_id": 0, "schedule": 0}).sort("applied_on", -1).to_list(1000)
    return rows


@api.post("/loans", response_model=Loan)
async def apply_loan(data: LoanIn, user: dict = Depends(current_user)):
    if not await db.members.find_one({"id": data.member_id}):
        raise HTTPException(404, "Member not found")
    emi, interest, total = calc_emi(data.amount, data.interest_rate, data.tenure_months)
    count = await db.loans.count_documents({})
    loan = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "loan_no": gen_no("LN", count),
        "emi": emi,
        "total_interest": interest,
        "total_payable": total,
        "paid": 0.0,
        "status": "Pending",
        "applied_on": now_iso(),
        "approved_on": None,
    }
    await db.loans.insert_one(loan)
    return {k: v for k, v in loan.items() if k != "_id"}


@api.post("/loans/{loan_id}/approve")
async def approve_loan(loan_id: str,
                       user: dict = Depends(require_roles("Admin", "Manager"))):
    loan = await db.loans.find_one({"id": loan_id, "status": "Pending"})
    if not loan:
        raise HTTPException(400, "Loan cannot be approved")
    schedule = gen_emi_schedule(
        loan_id, loan["amount"], loan["interest_rate"],
        loan["tenure_months"], datetime.now(timezone.utc),
    )
    await db.loans.update_one(
        {"id": loan_id},
        {"$set": {
            "status": "Approved",
            "approved_on": now_iso(),
            "approved_by": user["name"],
            "schedule": schedule,
        }},
    )
    return {"ok": True, "schedule_count": len(schedule)}


@api.post("/loans/{loan_id}/reject")
async def reject_loan(loan_id: str,
                      user: dict = Depends(require_roles("Admin", "Manager"))):
    res = await db.loans.update_one(
        {"id": loan_id, "status": "Pending"},
        {"$set": {"status": "Rejected", "approved_on": now_iso(),
                  "approved_by": user["name"]}},
    )
    if res.modified_count == 0:
        raise HTTPException(400, "Loan cannot be rejected")
    return {"ok": True}


@api.get("/loans/{loan_id}/schedule")
async def loan_schedule(loan_id: str, user: dict = Depends(current_user)):
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(404, "Loan not found")
    # Member can see only own loan schedule
    if user["role"] == "Member":
        m = await db.members.find_one({"user_id": user["id"]}, {"id": 1})
        if not m or m["id"] != loan["member_id"]:
            raise HTTPException(403, "Not allowed")
    schedule = loan.get("schedule", [])
    # Mark overdue
    today = datetime.now(timezone.utc)
    for s in schedule:
        if s["status"] != "Paid":
            try:
                due = datetime.fromisoformat(s["due_date"])
                s["status"] = "Overdue" if today > due else "Due"
            except Exception:
                pass
    return {
        "loan_no": loan["loan_no"],
        "emi": loan["emi"],
        "paid": loan.get("paid", 0),
        "total_payable": loan["total_payable"],
        "npa": npa_classify(schedule),
        "schedule": schedule,
    }


@api.post("/loans/{loan_id}/pay-emi")
async def pay_emi(loan_id: str, user: dict = Depends(current_user)):
    """Pay the next due EMI installment (cash, by current user)."""
    loan = await db.loans.find_one({"id": loan_id})
    if not loan or loan.get("status") != "Approved":
        raise HTTPException(400, "Loan not active")
    schedule = loan.get("schedule", [])
    nxt = next((s for s in schedule if s["status"] != "Paid"), None)
    if not nxt:
        raise HTTPException(400, "All EMIs already paid")

    nxt["paid_amount"] = nxt["emi"]
    nxt["paid_on"] = now_iso()
    nxt["status"] = "Paid"

    # ledger entry
    count = await db.transactions.count_documents({})
    txn = {
        "id": str(uuid.uuid4()),
        "receipt_no": gen_no("RCP", count),
        "member_id": loan["member_id"],
        "account_id": None,
        "loan_id": loan_id,
        "type": "EMI",
        "amount": nxt["emi"],
        "note": f"EMI {nxt['installment_no']}/{loan['tenure_months']} for {loan['loan_no']}",
        "mode": "Cash",
        "by_user": user["id"],
        "by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.transactions.insert_one(txn)
    await db.loans.update_one(
        {"id": loan_id},
        {"$set": {"schedule": schedule},
         "$inc": {"paid": nxt["emi"]}},
    )
    # close loan if fully paid
    if all(s["status"] == "Paid" for s in schedule):
        await db.loans.update_one({"id": loan_id}, {"$set": {"status": "Closed"}})
    return {"ok": True, "receipt_no": txn["receipt_no"], "installment": nxt}


# ---------- Transactions / Collections ----------
@api.get("/transactions", response_model=List[Txn])
async def list_txns(user: dict = Depends(current_user)):
    return await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)


@api.post("/transactions", response_model=Txn)
async def add_txn(data: TxnIn, user: dict = Depends(current_user)):
    if not await db.members.find_one({"id": data.member_id}):
        raise HTTPException(404, "Member not found")
    count = await db.transactions.count_documents({})
    txn = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "receipt_no": gen_no("RCP", count),
        "by_user": user["id"],
        "by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.transactions.insert_one(txn)

    # Update balances
    if data.account_id:
        delta = data.amount if data.type == "Deposit" else -data.amount
        await db.accounts.update_one({"id": data.account_id}, {"$inc": {"balance": delta}})
    if data.loan_id and data.type == "EMI":
        await db.loans.update_one({"id": data.loan_id}, {"$inc": {"paid": data.amount}})

    return {k: v for k, v in txn.items() if k != "_id"}


# ---------- Notices ----------
@api.get("/notices", response_model=List[Notice])
async def list_notices(user: dict = Depends(current_user)):
    return await db.notices.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/notices", response_model=Notice)
async def add_notice(data: NoticeIn,
                     user: dict = Depends(require_roles("Admin", "Manager"))):
    n = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "created_by": user["name"],
    }
    await db.notices.insert_one(n)
    return {k: v for k, v in n.items() if k != "_id"}


# ---------- Reference: Assam Co-op rules ----------
@api.get("/rules")
async def assam_rules():
    return {
        "act": "The Assam Co-operative Societies Act, 2007",
        "registrar": "Registrar of Co-operative Societies, Assam",
        "min_share_capital_per_member": 100,
        "min_members_to_register": 10,
        "max_dividend_pct": 20,
        "reserve_fund_min_pct_of_profit": 25,
        "audit": "Annual audit by Govt. auditor mandatory under Sec. 78",
        "agm_within_days_of_fy_end": 180,
        "loan_priority": [
            "Loans to members only (Sec. 47)",
            "Self-help group lending permitted with bye-law amendment",
        ],
        "interest_cap_pa": 18,
        "key_sections": {
            "Sec. 23": "Registration of society",
            "Sec. 33": "Membership rights & liabilities",
            "Sec. 47": "Restriction on loans to non-members",
            "Sec. 65": "Distribution of net profit",
            "Sec. 78": "Audit & inquiry",
            "Sec. 88": "Settlement of disputes",
        },
        "disclaimer": "Summary for app guidance only. Refer official gazette.",
    }


# ---------- Society Settings ----------
class SettingsIn(BaseModel):
    society_name: str = "Assam Co-op Connect"
    registration_no: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    default_savings_rate: float = 7.0
    default_loan_rate: float = 12.0
    default_dividend_pct: float = 10.0
    logo_base64: Optional[str] = None


@api.get("/settings")
async def get_settings(user: dict = Depends(current_user)):
    s = await db.settings.find_one({"id": "society"}, {"_id": 0})
    if not s:
        s = {"id": "society", **SettingsIn().model_dump(), "updated_at": now_iso()}
        await db.settings.insert_one(s)
        s = {k: v for k, v in s.items() if k != "_id"}
    return s


@api.put("/settings")
async def update_settings(data: SettingsIn,
                          user: dict = Depends(require_roles("Admin"))):
    payload = {**data.model_dump(), "updated_at": now_iso()}
    await db.settings.update_one(
        {"id": "society"}, {"$set": payload, "$setOnInsert": {"id": "society"}},
        upsert=True,
    )
    s = await db.settings.find_one({"id": "society"}, {"_id": 0})
    return s


# ---------- Seed ----------
@app.on_event("startup")
async def seed():
    # admin
    if not await db.users.find_one({"email": "admin@coopassam.in"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Society Secretary",
            "email": "admin@coopassam.in",
            "phone": "+91-98640-00000",
            "role": "Admin",
            "password": hash_pw("Admin@123"),
            "created_at": now_iso(),
        })
        logger.info("Seeded admin user")
    # manager
    if not await db.users.find_one({"email": "manager@coopassam.in"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Branch Manager",
            "email": "manager@coopassam.in",
            "phone": "+91-98640-11111",
            "role": "Manager",
            "password": hash_pw("Manager@123"),
            "created_at": now_iso(),
        })
    # agent
    if not await db.users.find_one({"email": "agent@coopassam.in"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Field Agent Bikash",
            "email": "agent@coopassam.in",
            "phone": "+91-98640-22222",
            "role": "Agent",
            "password": hash_pw("Agent@123"),
            "created_at": now_iso(),
        })

    # one sample notice if none
    if await db.notices.count_documents({}) == 0:
        await db.notices.insert_one({
            "id": str(uuid.uuid4()),
            "title": "Annual General Meeting Notice",
            "body": "The 14th AGM will be held on 30-Jun-2026 at 11:00 AM at the society hall, Guwahati. All members are requested to attend with their passbook.",
            "category": "AGM",
            "created_at": now_iso(),
            "created_by": "Society Secretary",
        })


# ---------- App wiring ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("coop-api")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
