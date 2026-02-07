import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const PgSession = connectPgSimple(session);

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: "sessions",
        createTableIfMissing: false,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "E-mail e senha sao obrigatorios." });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
      }

      const emailLower = email.toLowerCase().trim();

      const [existing] = await db.select().from(users).where(eq(users.email, emailLower));
      if (existing) {
        return res.status(409).json({ message: "Este e-mail ja esta cadastrado." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const verificationCode = generateVerificationCode();
      const verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      console.log(`\n========================================`);
      console.log(`CODIGO DE VERIFICACAO para ${emailLower}: ${verificationCode}`);
      console.log(`========================================\n`);

      const [user] = await db
        .insert(users)
        .values({
          email: emailLower,
          firstName: firstName || null,
          lastName: lastName || null,
          passwordHash,
          emailVerified: false,
          verificationCode,
          verificationCodeExpiresAt,
          role: "operator",
        })
        .returning();

      (req.session as any).userId = user.id;

      res.status(201).json({
        message: "Cadastro realizado. Verifique seu e-mail.",
        needsVerification: true,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, emailVerified: false },
      });
    } catch (error) {
      console.error("Erro no registro:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });

  app.post("/api/auth/verify-email", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Sessao expirada. Faca o cadastro novamente." });
      }

      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Codigo de verificacao e obrigatorio." });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "Usuario nao encontrado." });
      }

      if (user.emailVerified) {
        return res.json({ message: "E-mail ja verificado.", verified: true });
      }

      if (user.verificationCode !== code) {
        return res.status(400).json({ message: "Codigo de verificacao incorreto." });
      }

      if (user.verificationCodeExpiresAt && new Date() > user.verificationCodeExpiresAt) {
        return res.status(400).json({ message: "Codigo expirado. Solicite um novo codigo." });
      }

      await db
        .update(users)
        .set({
          emailVerified: true,
          verificationCode: null,
          verificationCodeExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({ message: "E-mail verificado com sucesso!", verified: true });
    } catch (error) {
      console.error("Erro na verificacao:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });

  app.post("/api/auth/resend-code", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Sessao expirada. Faca o cadastro novamente." });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "Usuario nao encontrado." });
      }

      if (user.emailVerified) {
        return res.json({ message: "E-mail ja verificado." });
      }

      const verificationCode = generateVerificationCode();
      const verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      console.log(`\n========================================`);
      console.log(`NOVO CODIGO DE VERIFICACAO para ${user.email}: ${verificationCode}`);
      console.log(`========================================\n`);

      await db
        .update(users)
        .set({ verificationCode, verificationCodeExpiresAt, updatedAt: new Date() })
        .where(eq(users.id, userId));

      res.json({ message: "Novo codigo enviado." });
    } catch (error) {
      console.error("Erro ao reenviar codigo:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "E-mail e senha sao obrigatorios." });
      }

      const emailLower = email.toLowerCase().trim();
      const [user] = await db.select().from(users).where(eq(users.email, emailLower));

      if (!user) {
        return res.status(401).json({ message: "E-mail ou senha incorretos." });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "E-mail ou senha incorretos." });
      }

      (req.session as any).userId = user.id;

      if (!user.emailVerified) {
        const verificationCode = generateVerificationCode();
        const verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

        console.log(`\n========================================`);
        console.log(`CODIGO DE VERIFICACAO para ${user.email}: ${verificationCode}`);
        console.log(`========================================\n`);

        await db
          .update(users)
          .set({ verificationCode, verificationCodeExpiresAt, updatedAt: new Date() })
          .where(eq(users.id, user.id));

        return res.status(200).json({
          message: "E-mail nao verificado. Verifique seu e-mail.",
          needsVerification: true,
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, emailVerified: false },
        });
      }

      res.json({
        message: "Login realizado com sucesso.",
        needsVerification: false,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, emailVerified: true },
      });
    } catch (error) {
      console.error("Erro no login:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Erro no logout:", err);
        return res.status(500).json({ message: "Erro ao encerrar sessao." });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logout realizado." });
    });
  });

  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Nao autenticado." });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ message: "Usuario nao encontrado." });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        profileImageUrl: user.profileImageUrl,
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error("Erro ao buscar usuario:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Nao autenticado." });
  }
  next();
}

export function getUserId(req: Request): string {
  return (req.session as any)?.userId;
}
