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

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js with custom session-based auth
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Custom email/password with bcrypt hashing + email verification codes

### Key Tables
- `users`: id (varchar UUID), email (unique), firstName, lastName, passwordHash, emailVerified, verificationCode, verificationCodeExpiresAt, role ('master'|'gerente'|'operador'), cnpjCpf (nullable), companyName (nullable), store (nullable), createdAt, updatedAt
- `transactions`: id (serial), description, amount (cents), type, category (nullable), store (nullable), status (pago/pendente), dueDate (nullable), paymentDate (nullable), isRecurring (0/1), recurrenceFrequency (nullable), recurrenceCount (nullable), recurrenceGroupId (nullable), userId, date, reconciled (0/1)
- `employees`: id (serial), name, position, salary (cents), store (text, default 'fazenda'), userId, active (1/0), createdAt
- `products`: id (serial), name, specification (text, nullable), unit (text, default 'UN'), quantity, price (cents), userId, active (1/0), createdAt
- `settings`: id (serial), userId (unique), taxRate
- `sessions`: sid, sess, expire (for express-session with connect-pg-simple)

### Auth Flow
1. User registers with email, password, name
2. 6-digit verification code is generated (printed to server console for testing)
3. User enters code to verify email
4. Once verified, user can access the dashboard
5. First verified user is auto-promoted to MASTER

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
- `ProfileDialog` - Edit user profile (name, CNPJ/CPF, company name)
- `UserManagementDialog` - MASTER-only: assign roles and stores to users
- `SettingsDialog` - MASTER-only: tax rate configuration
- `CreateTransactionDialog` - Transaction creation with conditional store selector

## Project Structure
- `client/src/` - React frontend (all Portuguese)
- `client/src/App.tsx` - Main app with sidebar navigation, role-based visibility
- `client/src/pages/AuthPage.tsx` - Login/Register/Verify unified auth page
- `client/src/pages/Dashboard.tsx` - Financial dashboard with month filter, CSV import, reconciliation
- `client/src/pages/DRE.tsx` - DRE income statement with filters, OPERADOR blocked
- `client/src/pages/Products.tsx` - Product/inventory management
- `client/src/pages/TeamManagement.tsx` - Employee management with store assignment and payroll
- `client/src/components/ProfileDialog.tsx` - User profile editing
- `client/src/components/UserManagementDialog.tsx` - User role/store management (MASTER only)
- `client/src/hooks/use-auth.ts` - Auth hook with isMaster/isGerente/isOperador/canManage flags
- `server/auth.ts` - Custom authentication module (session, routes, middleware)
- `server/routes.ts` - Business API routes with role-based middleware
- `server/storage.ts` - Database storage layer with UserContext filtering
- `shared/schema.ts` - Drizzle schema + types + STORE_OPTIONS + CATEGORY_OPTIONS
- `shared/models/auth.ts` - Users and sessions table definitions + getRoleLabel

## Environment Variables
- `SESSION_SECRET` - Required for session encryption
- `DATABASE_URL` - PostgreSQL connection string

## Running
- `npm run dev` starts Express + Vite on port 5000
- `npm run db:push` syncs database schema
