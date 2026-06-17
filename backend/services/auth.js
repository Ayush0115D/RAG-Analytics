import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERS_FILE = path.join(__dirname, "..", "users.json");
const JWT_SECRET = process.env.JWT_SECRET || "rag-chatbot-jwt-secret";

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch { return []; }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export async function createUser({ name, email, password }) {
  const users = readUsers();
  if (users.find((u) => u.email === email)) throw new Error("Email already registered");
  const hashed = await bcrypt.hash(password, 10);
  const user = { id: Date.now().toString(), name, email, password: hashed, createdAt: new Date().toISOString() };
  users.push(user);
  writeUsers(users);
  const { password: _, ...safe } = user;
  return safe;
}

export async function authenticateUser({ email, password }) {
  const users = readUsers();
  const user = users.find((u) => u.email === email);
  if (!user) throw new Error("Invalid email or password");
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Invalid email or password");
  const { password: _, ...safe } = user;
  return safe;
}

export function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function getUserById(id) {
  const users = readUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  const { password: _, ...safe } = user;
  return safe;
}
