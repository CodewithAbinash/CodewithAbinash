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

    recent = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)

    return {
        "members": members,
        "active_loans": active_loans,
        "pending_loans": pending_loans,
        "accounts": accounts,
        "total_deposits": round(total_deposits, 2),
        "loan_outstanding": round(loan_outstanding, 2),
        "recent_transactions": recent,
    }


# ---------- Members ----------
@api.get("/members", response_model=List[Member])
async def list_members(user: dict = Depends(current_user)):
    rows = await db.members.find({}, {"_id": 0}).sort("joined_on", -1).to_list(1000)
    return rows


@api.post("/members", response_model=Member)
async def add_member(data: MemberIn,
                     user: dict = Depends(require_roles("Admin", "Manager"))):
    count = await db.members.count_documents({})
    m = {
        **data.model_dump(),
        "id": str(uuid.uuid4()),
        "member_no": gen_no("ACC", count),
        "joined_on": now_iso(),
        "status": "Active",
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
@api.get("/loans", response_model=List[Loan])
async def list_loans(user: dict = Depends(current_user)):
    return await db.loans.find({}, {"_id": 0}).sort("applied_on", -1).to_list(1000)


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
    res = await db.loans.update_one(
        {"id": loan_id, "status": "Pending"},
        {"$set": {"status": "Approved", "approved_on": now_iso()}},
    )
    if res.modified_count == 0:
        raise HTTPException(400, "Loan cannot be approved")
    return {"ok": True}


@api.post("/loans/{loan_id}/reject")
async def reject_loan(loan_id: str,
                      user: dict = Depends(require_roles("Admin", "Manager"))):
    res = await db.loans.update_one(
        {"id": loan_id, "status": "Pending"},
        {"$set": {"status": "Rejected", "approved_on": now_iso()}},
    )
    if res.modified_count == 0:
        raise HTTPException(400, "Loan cannot be rejected")
    return {"ok": True}


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
