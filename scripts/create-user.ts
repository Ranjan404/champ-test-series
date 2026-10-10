// Adds or updates a login. Usage:
//   npm run create-user -- <username> <password>
//   npm run create-user -- <username>            (prompts for the password)
import crypto from "node:crypto";
import readline from "node:readline";
import bcrypt from "bcryptjs";
import { updateUsers } from "../lib/store";

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a))));
}

async function main() {
  const [username, passArg] = process.argv.slice(2);
  if (!username || !/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    console.error("Usage: npm run create-user -- <username> [password]\nUsername: 3-32 chars, letters, digits, . _ -");
    process.exit(1);
  }
  const password = passArg ?? (await ask("Password: "));
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  let action = "Created";
  await updateUsers((users) => {
    const existing = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      existing.passwordHash = passwordHash;
      action = "Updated password for";
      return users;
    }
    return [...users, { id: crypto.randomUUID().replace(/-/g, ""), username, passwordHash, createdAt: new Date().toISOString() }];
  });
  console.log(`${action} user "${username}".`);
}

main();
