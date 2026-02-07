# Gestor de Empresas Pro

## Overview
Financial management dashboard for businesses. Multi-user system with role-based permissions (Admin/Operator). Built with React + Express + PostgreSQL.

## Recent Changes
- 2026-02-07: Added multi-user authentication via Replit Auth (OIDC)
- 2026-02-07: Added role system: Admin (full access) and Operator (create only)
- 2026-02-07: Data isolation per user (transactions and settings)
- 2026-02-07: First user to log in is automatically promoted to Admin

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js with Replit Auth (OIDC/Passport)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Replit Auth via OpenID Connect

### Key Tables
- `users`: id (varchar), email, firstName, lastName, role ('admin'|'operator')
- `transactions`: id (serial), description, amount (cents), type, userId, date
- `settings`: id (serial), userId (unique), taxRate
- `sessions`: sid, sess, expire (for auth sessions)

### Roles
- **Admin**: Can create transactions, delete transactions, update tax settings
- **Operator**: Can only create new transactions, view their own data

### Data Isolation
- Each user sees only their own transactions and settings
- First user to register is auto-promoted to Admin

## Project Structure
- `client/src/` - React frontend
- `server/` - Express backend
- `server/replit_integrations/auth/` - Replit Auth integration (DO NOT MODIFY)
- `shared/schema.ts` - Drizzle schema + types
- `shared/routes.ts` - API contract definitions
- `shared/models/auth.ts` - Auth-related schema (DO NOT MODIFY)

## Running
- `npm run dev` starts Express + Vite on port 5000
- `npm run db:push` syncs database schema
