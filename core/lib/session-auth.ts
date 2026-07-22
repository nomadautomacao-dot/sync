import crypto from "crypto";
import { upsertSessionUser } from "@/core/lib/user-provisioning";
import { prisma as db } from "@/core/lib/prisma";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEV_USER = {
  email: "adrieltavares87@gmail.com",
  password: "91991589",
  name: "Adriel Tavares",
  role: "admin",
};

const DEFAULT_USER = {
  email: process.env.SYNC_LOGIN_EMAIL?.trim().toLowerCase() ?? (IS_PRODUCTION ? null : DEV_USER.email),
  password: process.env.SYNC_LOGIN_PASSWORD ?? (IS_PRODUCTION ? null : DEV_USER.password),
  name: process.env.SYNC_LOGIN_NAME?.trim() || (IS_PRODUCTION ? "Sync Admin" : DEV_USER.name),
  role: "admin",
};

export async function login(email: string, password: string) {
  if (!DEFAULT_USER.email || !DEFAULT_USER.password) {
    return {
      success: false,
      error: "Login por credenciais indisponivel: configure SYNC_LOGIN_EMAIL e SYNC_LOGIN_PASSWORD no servidor.",
    };
  }

  if (email !== DEFAULT_USER.email || password !== DEFAULT_USER.password) {
    return {
      success: false,
      error: "Credenciais invalidas",
    };
  }

  const appUser = await upsertSessionUser(DEFAULT_USER.email, DEFAULT_USER.name);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.session.create({
    data: {
      token,
      userId: appUser.id,
      expiresAt,
    },
  });

  return {
    success: true,
    token,
    user: {
      email: appUser.email,
      name: appUser.name,
      role: DEFAULT_USER.role,
    },
  };
}

export async function logout(token: string) {
  if (token) {
    await db.session.deleteMany({
      where: { token },
    });
  }

  return { success: true };
}

export async function getSession(token: string) {
  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { token },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  const user =
    (await db.user.findUnique({
      where: { id: session.userId },
    })) ??
    (await db.user.findUnique({
      where: { email: session.userId },
    }));

  if (!user) {
    return null;
  }

  return {
    user: {
      email: user.email,
      name: user.name,
      role: DEFAULT_USER.role,
    },
  };
}
