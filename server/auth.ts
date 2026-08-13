import type { Express, Request, Response, NextFunction } from "express";
import { adminAuth, db } from "./firebase";

const usersCol = () => db.collection("users");

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmailVerified?: boolean;
      // Claims do token do Firebase usadas so para provisionar o perfil no
      // Firestore no primeiro login (ex: Google Sign-In, que nunca passa
      // por /api/auth/register) - ver auto-provisionamento em /api/auth/user.
      userEmail?: string;
      userName?: string;
      userPicture?: string;
    }
  }
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Autenticacao agora e feita pelo Firebase Auth: o client obtem um ID token
// (via Firebase Web SDK) e manda em "Authorization: Bearer <token>" em toda
// chamada (isso e feito automaticamente pelo interceptor em
// client/src/lib/firebase.ts). Nao ha mais sessao/cookie no servidor.
export function setupAuth(_app: Express) {
  // Nao ha mais store de sessao para configurar (Firestore e stateless por
  // requisicao aqui) - mantido como funcao para nao mudar a chamada em
  // server/routes.ts.
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Nao autenticado." });
  }
  adminAuth
    .verifyIdToken(token)
    .then((decoded) => {
      req.userId = decoded.uid;
      req.userEmailVerified = !!decoded.email_verified;
      req.userEmail = typeof decoded.email === "string" ? decoded.email : undefined;
      req.userName = typeof decoded.name === "string" ? decoded.name : undefined;
      req.userPicture = typeof decoded.picture === "string" ? decoded.picture : undefined;
      next();
    })
    .catch(() => {
      res.status(401).json({ message: "Sessao invalida ou expirada. Faca login novamente." });
    });
}

export function getUserId(req: Request): string {
  return req.userId as string;
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

      const verificationCode = generateVerificationCode();
      const verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email: emailLower,
          password,
          emailVerified: false,
          displayName: [firstName, lastName].filter(Boolean).join(" ") || undefined,
        });
      } catch (err: any) {
        if (err?.code === "auth/email-already-exists") {
          return res.status(409).json({ message: "Este e-mail ja esta cadastrado." });
        }
        throw err;
      }

      const now = new Date();
      await usersCol().doc(userRecord.uid).set({
        email: emailLower,
        firstName: firstName || null,
        lastName: lastName || null,
        profileImageUrl: null,
        emailVerified: false,
        role: "operador",
        store: null,
        cnpjCpf: null,
        companyName: null,
        verificationCode,
        verificationCodeExpiresAt,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`\n========================================`);
      console.log(`CODIGO DE VERIFICACAO para ${emailLower}: ${verificationCode}`);
      console.log(`========================================\n`);

      const response: any = {
        message: "Cadastro realizado. Verifique seu e-mail.",
        needsVerification: true,
        user: { id: userRecord.uid, email: emailLower, firstName: firstName || null, lastName: lastName || null, role: "operador", emailVerified: false },
      };
      if (process.env.NODE_ENV !== "production") {
        response.verificationCode = verificationCode;
      }
      res.status(201).json(response);
    } catch (error) {
      console.error("Erro no registro:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });

  app.post("/api/auth/verify-email", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Codigo de verificacao e obrigatorio." });
      }

      const ref = usersCol().doc(userId);
      const doc = await ref.get();
      if (!doc.exists) {
        return res.status(404).json({ message: "Usuario nao encontrado." });
      }
      const user = doc.data()!;

      if (user.emailVerified) {
        return res.json({ message: "E-mail ja verificado.", verified: true });
      }

      if (user.verificationCode !== code) {
        return res.status(400).json({ message: "Codigo de verificacao incorreto." });
      }

      const expiresAt = user.verificationCodeExpiresAt?.toDate ? user.verificationCodeExpiresAt.toDate() : user.verificationCodeExpiresAt;
      if (expiresAt && new Date() > expiresAt) {
        return res.status(400).json({ message: "Codigo expirado. Solicite um novo codigo." });
      }

      await adminAuth.updateUser(userId, { emailVerified: true });
      await ref.update({
        emailVerified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
        updatedAt: new Date(),
      });

      res.json({ message: "E-mail verificado com sucesso!", verified: true });
    } catch (error) {
      console.error("Erro na verificacao:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });

  app.post("/api/auth/resend-code", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ref = usersCol().doc(userId);
      const doc = await ref.get();
      if (!doc.exists) {
        return res.status(404).json({ message: "Usuario nao encontrado." });
      }
      const user = doc.data()!;

      if (user.emailVerified) {
        return res.json({ message: "E-mail ja verificado." });
      }

      const verificationCode = generateVerificationCode();
      const verificationCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      console.log(`\n========================================`);
      console.log(`NOVO CODIGO DE VERIFICACAO para ${user.email}: ${verificationCode}`);
      console.log(`========================================\n`);

      await ref.update({ verificationCode, verificationCodeExpiresAt, updatedAt: new Date() });

      const response: any = { message: "Novo codigo enviado." };
      if (process.env.NODE_ENV !== "production") {
        response.verificationCode = verificationCode;
      }
      res.json(response);
    } catch (error) {
      console.error("Erro ao reenviar codigo:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });

  // O login em si (verificacao de senha) e feito no client via Firebase Web
  // SDK (signInWithEmailAndPassword) - o Admin SDK nao verifica senhas.
  // Esta rota so existe para invalidar tokens no logout.
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
      if (token) {
        const decoded = await adminAuth.verifyIdToken(token).catch(() => null);
        if (decoded) {
          await adminAuth.revokeRefreshTokens(decoded.uid).catch(() => {});
        }
      }
      res.json({ message: "Logout realizado." });
    } catch (error) {
      console.error("Erro no logout:", error);
      res.status(500).json({ message: "Erro ao encerrar sessao." });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const ref = usersCol().doc(userId);
      let doc = await ref.get();

      if (!doc.exists) {
        // Primeiro login sem passar por /api/auth/register (Google Sign-In,
        // por exemplo) - provisiona o perfil agora, usando os dados que ja
        // vieram verificados no token (e-mail, nome, foto). O e-mail
        // autenticado no token e a referencia usada para criar o registro
        // do lojista no Firestore.
        const fullName = (req.userName || "").trim();
        const [firstName, ...rest] = fullName ? fullName.split(/\s+/) : [null];
        const now = new Date();
        await ref.set({
          email: req.userEmail || "",
          firstName: firstName || null,
          lastName: rest.length ? rest.join(" ") : null,
          profileImageUrl: req.userPicture || null,
          emailVerified: !!req.userEmailVerified,
          role: "operador",
          store: null,
          cnpjCpf: null,
          companyName: null,
          verificationCode: null,
          verificationCodeExpiresAt: null,
          createdAt: now,
          updatedAt: now,
        });
        doc = await ref.get();
      }

      const user = doc.data()!;

      res.json({
        id: userId,
        email: user.email,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        role: user.role ?? "operador",
        store: user.store ?? null,
        cnpjCpf: user.cnpjCpf ?? null,
        companyName: user.companyName ?? null,
        emailVerified: !!user.emailVerified,
        profileImageUrl: user.profileImageUrl ?? null,
        createdAt: user.createdAt?.toDate ? user.createdAt.toDate() : user.createdAt,
      });
    } catch (error) {
      console.error("Erro ao buscar usuario:", error);
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });
}
