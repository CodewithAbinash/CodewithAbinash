# Assam Co-op Connect — PRD

## Vision
A trustworthy, mobile-first management app for Credit Co-operative Societies in Assam, aligned with the Assam Co-operative Societies Act, 2007. Built for low-bandwidth, semi-urban/rural usage with role-based access for Society staff and field agents.

## Current Scope (v1.2)
- **JWT auth** with 4 roles: Admin/Secretary, Manager, Collection Agent, Member.
- **Member portal**: every new member auto-gets a login (`<phone>@member.coop` / `Member@123`). Member-scoped dashboard, loans, passbook (`/api/passbook`).
- **Member registry** (Sec. 33): KYC, share capital, nominee, auto member_no (`ACC-YYYY-####`).
- **Savings**: RD / FD / Daily Pigmy accounts with rate, tenure, balance.
- **Loans** (Sec. 47): application, EMI calculator, Admin/Manager approval workflow.
- **EMI schedule**: auto-generated on loan approval; `/loans/{id}/schedule` & `/pay-emi` for repayment ledger; loan auto-closes when all installments paid.
- **NPA classification**: any installment >90 days overdue marks the loan NPA; counted on the staff dashboard.
- **Field Collection**: agent daily ledger with bulk submit.
- **Notices & AGM**: roles-restricted publishing.
- **Society Settings**: society name, registration no., address, contact, default rates, dividend % (Admin-edit only).
- **Assam Co-op Act 2007** quick reference (Sec. 23/33/47/65/78/88).
- **Dashboard**: total deposits, loan outstanding, NPA count, active members, recent transactions.

## Stack
- Backend: FastAPI + Motor (MongoDB), passlib bcrypt, python-jose JWT.
- Frontend: Expo Router, React Native, SecureStore for JWT.
- Design: Moss-green Assam earthy palette, single-action screens.

## Smart enhancement opportunity
Future: SMS/WhatsApp passbook receipts via Twilio + AI-driven loan eligibility advisor that uses recent deposit history + repayment record to fast-track approvals.
