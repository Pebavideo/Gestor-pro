# Gestor de Empresas Pro

## Overview
Financial management dashboard for businesses. Multi-user system with role-based permissions (Admin/Operator). Built with React + Express + PostgreSQL. All UI in Portuguese.

## Recent Changes
- 2026-02-08: Added 'category' field to transactions (Alimentacao, Impostos, Salarios, Vendas, Servicos, Investimentos, Transporte, Aluguel, Materiais, Manutencao, Marketing, Outros)
- 2026-02-08: Category selectable in create/edit transaction dialogs, displayed as badge in tables
- 2026-02-08: DRE now groups receitas and despesas by category with breakdown
- 2026-02-08: DRE flexible period filters: Mensal, Trimestral, Anual, Personalizado (custom date range)
- 2026-02-08: CSV import now shows preview dialog with editable type/category before confirming import
- 2026-02-08: CSV import preview allows removing individual rows before import
- 2026-02-08: Payroll transactions auto-categorized as 'salarios'
- 2026-02-08: CATEGORY_OPTIONS and getCategoryLabel exported from shared/schema.ts for reuse
- 2026-02-08: Added DRE (Demonstrativo de Resultados) page with income statement: Receita Bruta, Impostos, CPV, Despesas Operacionais, Lucro Liquido
- 2026-02-08: DRE with color-coded lines (green for positive, red for negative/loss), year/month filters, PDF export and email
- 2026-02-08: Bank reconciliation: toggle transactions as 'Conciliada' with checkmark icon in transaction table
- 2026-02-08: CSV bank statement import: parse CSV files with flexible column names (description/descricao, amount/valor, date/data, type/tipo)
- 2026-02-08: Added 'reconciled' field (integer 0/1) to transactions table
- 2026-02-08: Added email button (envelope icon) to Dashboard and TeamManagement for sending reports via email
- 2026-02-08: Email opens mailto: draft with full financial summary or employee list in the message body
- 2026-02-08: Removed 'Salario Medio' card from TeamManagement, kept only 'Total de Funcionarios' and 'Folha Mensal'
- 2026-02-08: Standardized date+time (dd/MM/yyyy HH:mm) display across all tables (Dashboard, Team, Products)
- 2026-02-08: Added 'Data de Admissao' field to employee creation form (datetime-local input)
- 2026-02-08: Employee tables now show admission date+time in both desktop and mobile views
- 2026-02-08: Product creation now asks to auto-launch expense transaction in financial dashboard (quantity × price)
- 2026-02-08: PDF export for Dashboard (financial report) and TeamManagement (team report) using jsPDF
- 2026-02-08: WhatsApp share button on transactions and employee payments (generates formatted message via wa.me)
- 2026-02-08: Print button for Dashboard and TeamManagement tables (opens print-friendly window)
- 2026-02-08: PWA configured (manifest.json, service worker, Apple meta tags) for Add to Home Screen
- 2026-02-08: Mobile responsive: tables convert to card layout on small screens, reduced padding
- 2026-02-08: Products now record date+time of entry (datetime-local input, displayed as dd/MM/yyyy HH:mm)
- 2026-02-08: Transactions now display time (HH:mm) alongside date
- 2026-02-08: Products now have 'unit' dropdown (UN, KG, M, M², M³, CX, FD, LT) and 'specification' field for detailed descriptions
- 2026-02-08: Added Products/Inventory module (CRUD, stock tracking, price management)
- 2026-02-08: Income transactions can link to products to auto-decrement stock
- 2026-02-08: Upgraded Dashboard filter to support Year + Month selectors (multi-year history)
- 2026-02-08: Added month filter to Dashboard for viewing profit by specific months
- 2026-02-08: Added transaction editing (PATCH /api/transactions/:id) with inline edit dialog
- 2026-02-08: Fixed payroll descriptions from "Salario" to "Pagamento"
- 2026-02-08: Added Team Management module (employees CRUD, payroll processing)
- 2026-02-08: Added sidebar navigation (Dashboard + Team Management + Products)
- 2026-02-07: Replaced Replit Auth with custom email/password authentication
- 2026-02-07: Added email verification flow (6-digit code, printed to console for testing)
- 2026-02-07: Added role system: Admin (full access) and Operator (create only)
- 2026-02-07: Data isolation per user (transactions and settings)
- 2026-02-07: First verified user to log in is automatically promoted to Admin
- 2026-02-07: Translated entire UI to Portuguese

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js with custom session-based auth
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Custom email/password with bcrypt hashing + email verification codes

### Key Tables
- `users`: id (varchar UUID), email (unique), firstName, lastName, passwordHash, emailVerified, verificationCode, verificationCodeExpiresAt, role ('admin'|'operator'), createdAt, updatedAt
- `transactions`: id (serial), description, amount (cents), type, category (nullable), store (nullable), userId, date, reconciled (0/1)
- `employees`: id (serial), name, position, salary (cents), userId, active (1/0), createdAt
- `products`: id (serial), name, specification (text, nullable), unit (text, default 'UN'), quantity, price (cents), userId, active (1/0), createdAt
- `settings`: id (serial), userId (unique), taxRate
- `sessions`: sid, sess, expire (for express-session with connect-pg-simple)

### Auth Flow
1. User registers with email, password, name
2. 6-digit verification code is generated (printed to server console for testing)
3. User enters code to verify email
4. Once verified, user can access the dashboard
5. First verified user is auto-promoted to Admin

### Data Isolation
- Each user sees only their own transactions and settings
- First user to register and verify is auto-promoted to Admin

### Roles
- **Admin**: Can create/edit/delete employees, process payroll, create/edit/delete transactions, manage products, update tax settings
- **Operator**: Can only create transactions, view employees and products list (read-only)

## Project Structure
- `client/src/` - React frontend (all Portuguese)
- `client/src/App.tsx` - Main app with sidebar navigation
- `client/src/pages/AuthPage.tsx` - Login/Register/Verify unified auth page
- `client/src/pages/Dashboard.tsx` - Financial dashboard with month filter, CSV import, reconciliation
- `client/src/pages/DRE.tsx` - DRE income statement with filters, PDF export, email
- `client/src/pages/Products.tsx` - Product/inventory management
- `client/src/pages/TeamManagement.tsx` - Employee management and payroll
- `server/auth.ts` - Custom authentication module (session, routes, middleware)
- `server/routes.ts` - Business API routes (transactions, settings, employees, payroll)
- `server/storage.ts` - Database storage layer
- `shared/schema.ts` - Drizzle schema + types
- `shared/models/auth.ts` - Users and sessions table definitions
- `shared/routes.ts` - API contract definitions

## Environment Variables
- `SESSION_SECRET` - Required for session encryption
- `DATABASE_URL` - PostgreSQL connection string

## Running
- `npm run dev` starts Express + Vite on port 5000
- `npm run db:push` syncs database schema
