import * as dotenv from 'dotenv';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { seedAdmin } from './data/seedAdmin';
import adminRoute from './routes/adminRoute';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());

app.use(express.json());

async function initialize() {
  await prisma.$connect();

  if (process.env.SEED_ADMIN === 'true') {
    await seedAdmin();
  }

  // start the server after seeding
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

initialize().catch((err) => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});

// admin routes
app.use('/api/admin', adminRoute);

app.get('/', (req, res) => {
  res.send('Welcome to the Backend API');
});

export default app;