import dotenv from "dotenv";
dotenv.config({ path: ".env.test", quiet: true });

console.log("DATABASE_URL:", process.env.DATABASE_URL); // ← add this

import prisma from "../src/config/db";

afterAll(async () => {
  await prisma.$disconnect();
});