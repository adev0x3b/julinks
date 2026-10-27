import { randomInt } from "node:crypto";

/**
 * The setup code: printed once by the migrate step (or `npm run setup-code`) and typed into
 * /setup to create the admin account on a fresh install. Nothing else can create an admin
 * before that, so whoever finds a freshly deployed site first gets nothing.
 *
 * Pure helpers here; the database side is src/lib/data/setup.ts.
 */

/** 32 symbols, no 0/O or 1/I, so a code read off a terminal cannot be mistyped that way. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const GROUP_LENGTH = 4;

/** Wrong codes allowed before the code is burnt and a new one has to be generated. */
export const MAX_SETUP_ATTEMPTS = 5;

export const REGENERATE_COMMAND = "docker compose run --rm --no-deps migrate npm run setup-code";

/** Twelve symbols from a 32-letter alphabet: 60 bits, from the OS random source. */
export function generateSetupCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g += 1) {
    let group = "";
    for (let i = 0; i < GROUP_LENGTH; i += 1) group += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(group);
  }
  return groups.join("-");
}

/** What the user typed, as the generator would have printed it: upper case, separators dropped, regrouped. */
export function normalizeSetupCode(input: string): string {
  const symbols = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return symbols.replace(/(.{4})(?=.)/g, "$1-");
}

export function isWellFormedSetupCode(code: string): boolean {
  return new RegExp(`^(?:[${ALPHABET}]{${GROUP_LENGTH}}-){${GROUPS - 1}}[${ALPHABET}]{${GROUP_LENGTH}}$`).test(code);
}

/** The banner the migrate step prints, framed so it stands out between Prisma's and the seed's lines. */
export function setupBanner(code: string, appUrl: string): string {
  const line = "=".repeat(68);
  return [
    "",
    line,
    "  JuLinks is not set up yet: nobody can log in and no page is served.",
    `  Open ${appUrl}/setup and enter this code to create the admin account:`,
    "",
    `      ${code}`,
    "",
    `  Lost it, or typed it wrong ${MAX_SETUP_ATTEMPTS} times? A new one replaces it:`,
    `      ${REGENERATE_COMMAND}`,
    line,
    "",
  ].join("\n");
}
