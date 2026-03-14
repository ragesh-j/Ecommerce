import dotenv from "dotenv";
dotenv.config({ path: ".env.test", quiet: true });


import prisma from "../src/config/db";

afterAll(async () => {
  await prisma.$disconnect();
});