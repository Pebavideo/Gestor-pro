# Gestor de Empresas Pro

## Overview
Financial management dashboard for businesses. Multi-user system with role-based permissions (Admin/Operator). Built with React + Express + PostgreSQL. All UI in Portuguese.

## Recent Changes
- 2026-02-08: Added Team Management module (employees CRUD, payroll processing)
- 2026-02-08: Added sidebar navigation (Dashboard + Team Management)
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
- `transactions`: id (serial), description, amount (cents), type, userId, date
- `employees`: id (serial), name, position, salary (cents), userId, active (1/0), createdAt
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
- **Admin**: Can create/edit/delete employees, process payroll, create/delete transactions, update tax settings
- **Operator**: Can only create transactions, view employees list (read-only)

## Project Structure
- `client/src/` - React frontend (all Portuguese)
- `client/src/App.tsx` - Main app with sidebar navigation
- `client/src/pages/AuthPage.tsx` - Login/Register/Verify unified auth page
- `client/src/pages/Dashboard.tsx` - Financial dashboard
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
