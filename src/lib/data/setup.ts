import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { generateSetupCode, MAX_SETUP_ATTEMPTS, normalizeSetupCode } from "@/lib/setup-code";
import { createUser, type NewUser } from "@/lib/data/users";

/**
 * First-run setup. A deployment is "pending" until it has an approved admin that is not a
 * demo profile. While pending, the public pages, sign-up and login redirect to /setup, which
 * asks for the code the migrate step printed and creates the admin.
 */

/** There is one code at a time; the row is replaced whenever a new one is issued and removed when setup completes. */
const CODE_ROW = 1;

export async function isSetupPending(): Promise<boolean> {
  const admins = await prisma.user.count({ where: { role: "admin", status: "approved", isDemo: false } });
  return admins === 0;
}

/**
 * Generates a fresh code, stores its hash and returns the plain text, which is printed and
 * never stored. Returns null once an admin exists: a site that is set up has no setup code,
 * so the script cannot be used to add a second admin behind the first one's back.
 */
export async function issueSetupCode(): Promise<string | null> {
  if (!(await isSetupPending())) {
    await prisma.setupCode.deleteMany();
    return null;
  }
  const code = generateSetupCode();
  const codeHash = await hashPassword(code);
  await prisma.setupCode.upsert({
    where: { id: CODE_ROW },
    create: { id: CODE_ROW, codeHash },
    update: { codeHash, attempts: 0 },
  });
  return code;
}

/** The site already has an admin: /setup is closed. */
export class SetupDone extends Error {
  constructor() {
    super("This site is already set up");
  }
}

/** No code has been issued, or the last one was burnt by too many wrong attempts. */
export class NoSetupCode extends Error {
  constructor() {
    super("No setup code is active: generate one first");
  }
}

export class WrongSetupCode extends Error {
  constructor(public readonly attemptsLeft: number) {
    super(attemptsLeft > 0 ? `Wrong code, ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left` : "Wrong code, and no tries left: generate a new one");
  }
}

/**
 * Checks the code and creates the admin: approved, role admin, display name from the username.
 * Order matters: the username and email are checked before the code is consumed, so a taken
 * name does not cost the code; and the code is checked before anything is written. Five wrong
 * guesses burn the code (the row stays with its attempts exhausted, so the page can say why).
 */
export async function completeSetup(code: string, admin: NewUser) {
  if (!(await isSetupPending())) throw new SetupDone();
  const row = await prisma.setupCode.findUnique({ where: { id: CODE_ROW } });
  if (!row || row.attempts >= MAX_SETUP_ATTEMPTS) throw new NoSetupCode();
  const normalized = normalizeSetupCode(code);
  if (!(await verifyPassword(normalized, row.codeHash))) {
    const burnt = await prisma.setupCode.update({ where: { id: CODE_ROW }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
    throw new WrongSetupCode(Math.max(0, MAX_SETUP_ATTEMPTS - burnt.attempts));
  }
  const user = await createUser(admin, { status: "approved", role: "admin" });
  await prisma.setupCode.deleteMany();
  return user;
}
