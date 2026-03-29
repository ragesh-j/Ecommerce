
import dotenv from 'dotenv';
dotenv.config();
import './config/env'; 
import app from './app';
import prisma from './config/db';

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    await prisma.$connect();
    console.log('DB connected ✅');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} ✅`);
    });

    // graceful shutdown for ctrl+c
    process.on('SIGINT', async () => {
      await prisma.$disconnect();
      console.log('Connections closed, shutting down 👋');
      process.exit(0);
    });

    // graceful shutdown for deployment platforms (Railway, Render)
    process.on('SIGTERM', async () => {
      await prisma.$disconnect();
      console.log('Connections closed, shutting down 👋');
      process.exit(0);
    });

  } catch (error) {
    console.error('DB connection failed ❌', error);
    process.exit(1);
  }
}

main();