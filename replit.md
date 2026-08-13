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

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js, stateless (Firebase ID token verified per-request, no server session)
- **Database**: Firebase Firestore via `firebase-admin` (server-only; client never talks to Firestore directly)
- **Auth**: Firebase Authentication (email/password). Client signs in via Firebase Web SDK and sends `Authorization: Bearer <idToken>` on every API call (attached automatically by a fetch interceptor in `client/src/lib/firebase.ts`). Server verifies the token with the Admin SDK on each request.
- **Storage**: Firebase Storage for images, uploads always go through the compressor in `client/src/lib/image-compressor.ts` before `uploadCompressedImage`

### Key Collections (Firestore)
- `users` (doc id = Firebase Auth uid): email (unique), firstName, lastName, profileImageUrl, emailVerified, verificationCode, verificationCodeExpiresAt (internal, not returned to client), role ('master'|'gerente'|'operador'), cnpjCpf (nullable), companyName (nullable), store (nullable), createdAt, updatedAt
- `transactions` (doc id = string): description, amount (cents), type, category (nullable), store (nullable), status (pago/pendente), dueDate (nullable), paymentDate (nullable), isRecurring (0/1), recurrenceFrequency (nullable), recurrenceCount (nullable), recurrenceGroupId (nullable), userId, date, reconciled (0/1)
- `employees` (doc id = string): name, position, salary (cents), store (default 'fazenda'), userId, active (1/0), createdAt
- `products` (doc id = string): name, specification (nullable), unit (default 'UN'), quantity, price (cents), userId, active (1/0), createdAt
- `settings` (doc id = userId): taxRate
- No `sessions` collection - auth is stateless (Firebase ID tokens), see Auth Flow below.
- Composite indexes required for the store/role-filtered queries are declared in `firestore.indexes.json` (deploy with `firebase deploy --only firestore:indexes`, or let Firestore's console link auto-create them on first query).

### Auth Flow
1. User registers with email, password, name - server creates the Firebase Auth user (Admin SDK, `emailVerified:false`) and stores a 6-digit code on the Firestore user doc (printed to server console for testing)
2. Client immediately signs in with Firebase Web SDK using the same password, establishing a real Firebase session (auto-refreshing ID tokens)
3. User enters the 6-digit code; server validates it and flips `emailVerified:true` via Admin SDK; client force-refreshes its ID token so the new claim takes effect immediately
4. Once verified, user can access the dashboard
5. First verified user is auto-promoted to MASTER (`/api/user/make-admin`)
6. Login is done entirely client-side via Firebase Web SDK (`signInWithEmailAndPassword`) - the server never sees the password
7. Logout calls `signOut()` client-side and best-effort revokes refresh tokens server-side

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
- `client/src/pages/AuthPage.tsx` - Login/Register/Verify unified auth page (Firebase Auth underneath)
- `client/src/pages/Dashboard.tsx` - Financial dashboard with month filter, CSV import, reconciliation
- `client/src/pages/DRE.tsx` - DRE income statement with filters, OPERADOR blocked
- `client/src/pages/Products.tsx` - Product/inventory management
- `client/src/pages/TeamManagement.tsx` - Employee management with store assignment and payroll
- `client/src/components/ProfileDialog.tsx` - User profile editing
- `client/src/components/ImageUploadField.tsx` - Compress + upload image component
- `client/src/components/UserManagementDialog.tsx` - User role/store management (MASTER only)
- `client/src/hooks/use-auth.ts` - Auth hook with isMaster/isGerente/isOperador/canManage flags
- `client/src/lib/firebase.ts` - Firebase Web SDK init + global fetch interceptor (attaches Bearer token)
- `client/src/lib/image-compressor.ts` - Client-side image compression (browser-image-compression)
- `client/src/lib/firebase-storage.ts` - Uploads compressed images to Firebase Storage
- `server/firebase.ts` - Firebase Admin SDK init (Firestore, Auth, Storage)
- `server/auth.ts` - Firebase Authentication wiring (register/verify/resend/logout routes, bearer-token middleware)
- `server/routes.ts` - Business API routes with role-based middleware
- `server/storage.ts` - Firestore storage layer with UserContext filtering
- `shared/schema.ts` - Entity types + zod insert schemas + STORE_OPTIONS + CATEGORY_OPTIONS
- `shared/models/auth.ts` - User type + getRoleLabel
- `firestore.rules` / `storage.rules` / `firestore.indexes.json` / `firebase.json` - Firebase project config

## Environment Variables
See `.env.example`. Loaded from a local `.env` (via `dotenv`) - required for both server (Admin SDK) and client (Vite `VITE_FIREBASE_*`, see `envDir` in `vite.config.ts`):
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` - Admin SDK service account
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` - Web SDK config (public)

## Running
- `npm run dev` starts Express + Vite on port 5000
- No schema push step - Firestore is schemaless; deploy indexes/rules with the Firebase CLI (`firebase deploy --only firestore:indexes,firestore:rules,storage`) when needed
