import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

export default function setup() {
  const dir = path.join(__dirname, "..", ".e2e-data");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "progress"), { recursive: true });
  fs.cpSync(path.join(__dirname, "..", "data", "questions"), path.join(dir, "questions"), { recursive: true });
  fs.cpSync(path.join(__dirname, "..", "data", "dailyquestions"), path.join(dir, "dailyquestions"), { recursive: true });
  fs.cpSync(path.join(__dirname, "..", "data", "pyq_questions"), path.join(dir, "pyq_questions"), { recursive: true });
  fs.cpSync(path.join(__dirname, "..", "data", "full_length_questions"), path.join(dir, "full_length_questions"), { recursive: true });
  const users = ["e2e-phone", "e2e-desktop"].map((u, i) => ({
    id: `e2euser${i}`,
    username: u,
    passwordHash: bcrypt.hashSync("e2e-password", 4),
    createdAt: new Date().toISOString(),
  }));
  fs.writeFileSync(path.join(dir, "users.json"), JSON.stringify(users));
}
