# Gestor de Empresas Pro

## Overview
Financial management dashboard for businesses. Multi-user system with three-tier role hierarchy (MASTER/GERENTE/OPERADOR) and store-based unit separation. Built with React + Express + PostgreSQL. All UI in Portuguese.

## Recent Changes
- 2026-02-08: Three-tier role system: MASTER (full access), GERENTE (store-scoped management), OPERADOR (create-only, store-scoped)
- 2026-02-08: Store-based data isolation: Fazenda, Loja do Manel, Loja da Maria, Mercado do Ze
- 2026-02-08: MASTER sees all stores; GERENTE/OPERADOR see only their assigned store's data
- 2026-02-08: User profile management: CNPJ/CPF, company name fields editable via ProfileDialog
- 2026-02-08: UserManagementDialog: MASTER can assign roles and stores to all users
- 2026-02-08: Sidebar shows role badge (Master/Gerente/Operador) with color coding and store badge
- 2026-02-08: DRE page blocked for OPERADOR with access denied message
- 2026-02-08: Employees now have mandatory store assignment; store badge shown in table
- 2026-02-08: Payroll auto-assigns employee's store to salary transactions
- 2026-02-08: CreateTransactionDialog: store selector for MASTER, auto-assigned for others
- 2026-02-08: All isAdmin checks replaced with canManage (MASTER || GERENTE)
- 2026-02-08: STORE_OPTIONS and getStoreLabel exported from shared/schema.ts
- 2026-02-08: getRoleLabel exported from shared/models/auth.ts
- 2026-02-08: Server routes use requireMaster, requireMasterOrGerente middleware
- 2026-02-08: UserContext { userId, role, store } passed to all storage methods for filtering
- 2026-02-08: GET /api/users (MASTER only) returns all users for management
- 2026-02-08: PATCH /api/user/role (MASTER only) updates user role and store
- 2026-02-08: PATCH /api/user/profile updates user's own profile fields
- 2026-02-08: First verified user auto-promoted to MASTER role
- 2026-02-08: Contas a Pagar/Receber: status (pago/pendente), dueDate, paymentDate fields on transactions
- 2026-02-08: Traffic light system: red border = overdue, orange = due within 3 days, green = paid
- 2026-02-08: Status badge per transaction: Pago, Pendente, Vencida, Vence em breve
- 2026-02-08: Mark-as-paid button (dollar icon) to liquidate pending transactions
- 2026-02-08: Dashboard alert cards: Total Vencido (red) and A Vencer 7 dias (orange) with counts
- 2026-02-08: Email alert button sends mailto: with due accounts grouped by store
- 2026-02-08: Recurring transactions: toggle + frequency (mensal/quinzenal) + count, generates N copies with incremented due dates
- 2026-02-08: DRE Previsto vs Realizado: 3-mode toggle (Realizado=paid only, Previsto=all by dueDate, Comparativo=side-by-side with difference)
- 2026-02-08: CreateTransactionDialog includes status selector, due date (for pending), payment date (for paid), recurring section
- 2026-02-08: Edit transaction dialog now includes status and due date fields
- 2026-02-08: Server route PATCH /api/transactions/:id/mark-paid to update status to pago with paymentDate
- 2026-02-08: Server route GET /api/notifications/due-today returns due-today and overdue transaction lists
- 2026-02-08: Added 'category' field to transactions (Alimentacao, Impostos, Salarios, Vendas, Servicos, Investimentos, Transporte, Aluguel, Materiais, Manutencao, Marketing, Outros)
- 2026-02-08: Category selectable in create/edit transaction dialogs, displayed as badge in tables
- 2026-02-08: DRE now groups receitas and despesas by category with breakdown
- 2026-02-08: DRE flexible period filters: Mensal, Trimestral, Anual, Personalizado (custom date range)
- 2026-02-08: CSV import now shows preview dialog with editable type/category before confirming import
- 2026-02-08: CSV import preview allows removing individual rows before import
- 2026-02-08: Payroll transactions auto-categorized as 'salarios'
- 2026-02-08: CATEGORY_OPTIONS and getCategoryLabel exported from shared/schema.ts for reuse
- 2026-02-08: Added DRE (Demonstrativo de Resultados) page with income statement
- 2026-02-08: Bank reconciliation: toggle transactions as 'Conciliada'
- 2026-02-08: CSV bank statement import with flexible column names
- 2026-02-08: Added email/PDF/WhatsApp/print export buttons across all pages
- 2026-02-08: PWA configured (manifest.json, service worker, Apple meta tags)
- 2026-02-08: Mobile responsive: tables convert to card layout on small screens
- 2026-02-08: Products with unit dropdown and specification field
- 2026-02-08: Team Management module with payroll processing
- 2026-02-07: Custom email/password authentication with email verification
- 2026-02-07: Translated entire UI to Portuguese
- 2026-08-13: Migrated database from PostgreSQL/Drizzle to Firebase Firestore
- 2026-08-13: Migrated authentication from custom bcrypt/session to Firebase Authentication (server still issues the 6-digit verification code UX, backed by Admin SDK)
- 2026-08-13: Added image compressor + Firebase Storage upload (ImageUploadField), first used for profile photo in ProfileDialog
- 2026-08-14: Project stays on the Firebase Spark (free) plan - no Cloud Functions/Cloud Run, so no server in production. Rearchitected to 100% client-side: client talks directly to Firestore/Firebase Auth via the Web SDK, `firestore.rules` is now the only access-control layer (was `server/storage.ts`). `server/` (Express) is kept in the repo as dormant/reference code, not part of the deploy.
- 2026-08-14: Email/password login removed - Google Sign-In is now the only auth method (simpler, and Google already verifies the e-mail, so the custom 6-digit code flow - which required a trusted server - is gone)
- 2026-08-14: First MASTER user is no longer auto-promoted via API; run `npm run promote-to-master -- <email>` once, locally, after the first login
- 2026-08-14: Deploy target is Firebase Hosting only (static `dist/public`), no `/api/**` rewrite

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: none in production (Firebase Spark/free plan - no Cloud Functions, no Cloud Run). `server/` (Express) still exists in the repo but is dormant/reference-only, not built or deployed.
- **Database**: Firebase Firestore, read/written **directly by the client** via the Web SDK (`client/src/lib/firestore-collections.ts`). All access control (who can read/write what) lives in `firestore.rules` - there is no trusted server in the loop anymore.
- **Auth**: Firebase Authentication, **Google Sign-In only** (`client/src/components/GoogleSignInButton.tsx`, `signInWithPopup` + `prompt: 'select_account'`). No email/password, no verification-code flow - Google already verifies the e-mail.
- **Storage**: Firebase Storage for images, client-direct, uploads always go through the compressor in `client/src/lib/image-compressor.ts` before `uploadCompressedImage`. Needs "Get Started" clicked once in the Firebase console (Spark-compatible, no billing required).
- **Deploy**: Firebase Hosting only, serving the static Vite build (`dist/public`) with an SPA fallback rewrite. `firebase deploy --only hosting,firestore:rules,firestore:indexes`.

### Key Collections (Firestore)
- `users` (doc id = Firebase Auth uid): email, firstName, lastName, profileImageUrl, emailVerified, role ('master'|'gerente'|'operador'), cnpjCpf (nullable), companyName (nullable), store (nullable), createdAt, updatedAt. Auto-provisioned by the client on first login (`client/src/hooks/use-auth.ts`) from the Google profile (email/displayName/photoURL), defaulting to role "operador".
- `transactions` (doc id = string): description, amount (cents), type, category (nullable), store (nullable), status (pago/pendente), dueDate (nullable), paymentDate (nullable), isRecurring (0/1), recurrenceFrequency (nullable), recurrenceCount (nullable), recurrenceGroupId (nullable), userId, date, reconciled (0/1)
- `employees` (doc id = string): name, position, salary (cents), store (default 'fazenda'), userId, active (1/0), createdAt
- `products` (doc id = string): name, specification (nullable), unit (default 'UN'), quantity, price (cents), userId, active (1/0), createdAt
- `settings` (doc id = userId): taxRate. Each user has their own settings doc (pre-existing behavior kept as-is - only MASTER can update, but each user's doc is independent).
- Composite indexes for the store/role-filtered queries are declared in `firestore.indexes.json` (deploy with `firebase deploy --only firestore:indexes`).

### Auth Flow
1. User clicks "Entrar com Google" - `signInWithPopup` (Firebase Web SDK), account picker forced via `prompt: 'select_account'`
2. On first login ever, `fetchUser()` in `use-auth.ts` finds no `users/{uid}` doc and creates one from the Google profile (`emailVerified: true`, `role: "operador"`)
3. First MASTER is a manual one-time step: `npm run promote-to-master -- <email>` (local script, uses the Admin SDK service account from `.env`, not deployed)
4. Logout calls `signOut()` client-side
5. All subsequent reads/writes go straight to Firestore from the client; `firestore.rules` enforces the MASTER/GERENTE/OPERADOR + store rules that used to live in `server/storage.ts`

### Store-Based Data Isolation
- MASTER sees all stores' data (no store filtering)
- GERENTE sees only their assigned store's data
- OPERADOR sees only their assigned store's data
- Store is auto-assigned on create for GERENTE/OPERADOR users

### Roles
- **MASTER**: Full access to all stores, can manage users/roles, settings, DRE, all CRUD operations
- **GERENTE**: Can manage employees, transactions, products within their assigned store. Can view DRE (filtered by store). Cannot manage users or settings.
- **OPERADOR**: Can only create transactions within their assigned store. Read-only for employees and products. Cannot access DRE.

### Key Components
- `ProfileDialog` - Edit user profile (name, CNPJ/CPF, company name, profile photo via ImageUploadField)
- `ImageUploadField` - Reusable image picker: compresses (image-compressor.ts) then uploads to Firebase Storage (firebase-storage.ts)
- `UserManagementDialog` - MASTER-only: assign roles and stores to users
- `SettingsDialog` - MASTER-only: tax rate configuration
- `CreateTransactionDialog` - Transaction creation with conditional store selector

## Project Structure
- `client/src/` - React frontend (all Portuguese)
- `client/src/App.tsx` - Main app with sidebar navigation, role-based visibility
- `client/src/pages/AuthPage.tsx` - Single "Entrar com Google" screen
- `client/src/pages/Dashboard.tsx` - Financial dashboard with month filter, CSV import, reconciliation, dynamic greeting
- `client/src/pages/DRE.tsx` - DRE income statement with filters, OPERADOR blocked
- `client/src/pages/Products.tsx` - Product/inventory management
- `client/src/pages/TeamManagement.tsx` - Employee management with store assignment and payroll
- `client/src/components/GoogleSignInButton.tsx` - Google Sign-In popup button, handles cancel/blocked-popup gracefully
- `client/src/components/ProfileDialog.tsx` - User profile editing
- `client/src/components/ImageUploadField.tsx` - Compress + upload image component
- `client/src/components/UserManagementDialog.tsx` - User role/store management (MASTER only)
- `client/src/hooks/use-auth.ts` - Auth hook (isMaster/isGerente/isOperador/canManage) + first-login profile auto-provisioning
- `client/src/hooks/use-transactions.ts` - All transaction/settings reads+writes direct to Firestore (react-query wrapped)
- `client/src/hooks/use-products.ts` - Shared products query (used by Products.tsx and CreateTransactionDialog.tsx)
- `client/src/lib/firebase.ts` - Firebase Web SDK init (`auth`, `db`, `storage`, `googleProvider`)
- `client/src/lib/firestore-collections.ts` - Typed Firestore converters/collection refs, mirrors the old `server/storage.ts` document shapes
- `client/src/lib/image-compressor.ts` - Client-side image compression (browser-image-compression)
- `client/src/lib/firebase-storage.ts` - Uploads compressed images to Firebase Storage
- `firestore.rules` - **the access-control layer** (role/store filtering that used to live in `server/storage.ts`)
- `storage.rules` / `firestore.indexes.json` / `firebase.json` - rest of the Firebase project config
- `script/promote-to-master.ts` - one-time local script to bootstrap the first MASTER user
- `server/` - dormant Express backend, kept as reference only, not part of the deploy

## Environment Variables
See `.env.example`. Loaded from a local `.env` (via `dotenv`):
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` - Web SDK config (public, baked into the client build)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` - Admin SDK service account, only needed locally to run `script/promote-to-master.ts` (or the dormant `server/`)

## Running
- `npm run dev` starts the Vite dev client on port 5000 (talks directly to the real Firebase project - there's no local backend to also start)
- `npm run build` builds the static client to `dist/public`
- `npm run promote-to-master -- <email>` bootstraps the first MASTER, once, after that account's first login
- Deploy: `firebase deploy --only hosting,firestore:rules,firestore:indexes`
