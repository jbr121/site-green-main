/**
 * SOCORRO DO 2FA — última camada de recuperação.
 *
 * Use quando a pessoa perdeu o celular E os códigos de recuperação.
 * Só funciona com acesso ao servidor onde a loja roda (por isso é seguro).
 *
 *   npm run reset-2fa            -> mostra a situação de cada acesso
 *   npm run reset-2fa admin      -> zera o 2FA do usuário "admin"
 *   npm run reset-2fa admin --senha  -> zera o 2FA e sorteia uma senha nova
 *
 * Depois disso, a pessoa entra e o painel pede para configurar o 2FA de novo.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "db.json");
const AUDIT_PATH = path.join(ROOT, "data", "audit.jsonl");

if (!fs.existsSync(DB_PATH)) {
  console.error("Não encontrei data/db.json. Rode este comando na pasta da loja.");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
const users = Array.isArray(db.users) ? db.users : [];
const args = process.argv.slice(2);
const wantsNewPassword = args.some((a) => a === "--senha" || a === "--password");
const target = args.find((a) => !a.startsWith("--"));

function statusLine(u) {
  const on = u.totp && u.totp.confirmedAt;
  const left = (u.recoveryCodes || []).filter((c) => !c.usedAt).length;
  return `  ${String(u.username).padEnd(16)} ${u.role === "admin" ? "administrador" : "editor      "}  2FA: ${
    on ? `ativo (${left} código(s) de recuperação)` : "não configurado"
  }`;
}

if (!target) {
  console.log("\nAcessos cadastrados:\n");
  users.forEach((u) => console.log(statusLine(u)));
  console.log('\nPara zerar o 2FA de alguém:  npm run reset-2fa nome-do-usuario');
  console.log('Para zerar 2FA e senha:      npm run reset-2fa nome-do-usuario -- --senha\n');
  process.exit(0);
}

const user = users.find((u) => String(u.username).toLowerCase() === target.toLowerCase());
if (!user) {
  console.error(`Usuário "${target}" não existe. Rode sem argumentos para ver a lista.`);
  process.exit(1);
}

delete user.totp;
delete user.totpPending;
user.recoveryCodes = [];

let newPassword = null;
if (wantsNewPassword) {
  newPassword = crypto.randomBytes(12).toString("base64url");
  const kdf = { alg: "scrypt", N: 2 ** 15, r: 8, p: 1, keylen: 64 };
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(newPassword, salt, kdf.keylen, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 256 * 1024 * 1024 }).toString("hex");
  user.salt = salt;
  user.hash = hash;
  user.kdf = kdf;
  user.mustChangePassword = true;
}

const tmp = `${DB_PATH}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
fs.renameSync(tmp, DB_PATH);

try {
  fs.appendFileSync(
    AUDIT_PATH,
    `${JSON.stringify({
      id: `a-${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      action: "2fa.reset",
      label: "2FA zerado pelo servidor (linha de comando)",
      severity: "alert",
      actorName: "console do servidor",
      actorRole: "system",
      targetType: "user",
      targetName: user.username,
      detail: newPassword ? "2FA e senha redefinidos" : "2FA redefinido",
    })}\n`
  );
} catch {
  /* o log não pode impedir o resgate */
}

console.log(`\n2FA do usuário "${user.username}" foi zerado.`);
if (newPassword) console.log(`Senha temporária: ${newPassword}  (o painel vai exigir a troca no login)`);
console.log("No próximo login o painel vai pedir para configurar o aplicativo de novo.");
console.log("Reinicie o servidor para o painel enxergar a mudança na hora.\n");
