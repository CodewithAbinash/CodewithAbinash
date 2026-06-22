# Assam Co-op Connect — PRD

## Vision
A trustworthy, mobile-first management app for Credit Co-operative Societies in Assam, aligned with the Assam Co-operative Societies Act, 2007. Built for low-bandwidth, semi-urban/rural usage with role-based access for Society staff and field agents.

## MVP Scope
- JWT auth with 4 roles: Admin / Secretary, Manager, Collection Agent, Member.
- Member registry with KYC (Aadhaar/PAN), share capital, nominee, village/district.
- Savings accounts: Recurring Deposit, Fixed Deposit, Daily Pigmy.
- Loans: application, EMI calculator, Admin/Manager approval workflow, repayment tracking.
- Field Collection: agent daily ledger with per-member deposit entry and single submit.
- Notices & AGM management.
- Assam Co-op Act 2007 quick-reference (sections, dividend cap, audit, AGM).
- Dashboard with total deposits, outstanding loans, recent activity.

## Stack
- Backend: FastAPI + Motor (MongoDB), passlib bcrypt, python-jose JWT.
- Frontend: Expo Router, React Native, SecureStore for JWT, `expo-image`, `expo-linear-gradient`.
- Design: Moss-green "Assam earthy" palette, single-action screens, solid surfaces (no glass).

## Smart enhancement opportunity
Future: SMS receipts via Twilio + WhatsApp passbook share to drive member retention and conversion (each transaction can become a viral touch-point), plus AI-powered loan eligibility assistant.
