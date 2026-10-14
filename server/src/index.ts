import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import authRoutes from './routes/authRoutes';
import incidentRoutes from './routes/incidentRoutes';
import investigationRoutes from './routes/investigationRoutes';
import satelliteRoutes from './routes/satelliteRoutes';
import timeMachineRoutes from './routes/timeMachineRoutes';
import driftRoutes from './routes/driftRoutes';
import originRoutes from './routes/originRoutes';
import aisRoutes from './routes/aisRoutes';
import suspectRoutes from './routes/suspectRoutes';
import reportRoutes from './routes/reportRoutes';
import weatherRoutes from './routes/weatherRoutes';

const app = express();

const allowedOrigins = config.corsOrigin.split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server) in dev
    if (!origin || allowedOrigins.includes(origin) || config.nodeEnv !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'UNKNOWN';
  try {
    const { prisma } = await import('./services/db');
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'CONNECTED';
  } catch (err: any) {
    dbStatus = 'DISCONNECTED: ' + err.message;
  }

  res.json({
    service: 'AEGIS Maritime Oil Spill Intelligence Backend',
    version: '2.0.0',
    status: dbStatus === 'CONNECTED' ? 'ONLINE' : 'DEGRADED',
    environment: config.nodeEnv,
    database: dbStatus,
    timestamp: new Date().toISOString(),
    providers: {
      copernicusDataSpace: Boolean(config.copernicusDataSpace.clientId),
      copernicusMarine: Boolean(config.copernicusMarine.username),
      era5: Boolean(config.era5.apiKey),
      mlService: config.mlServiceUrl,
    },
  });
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/investigations', investigationRoutes);
app.use('/api/satellite', satelliteRoutes);
app.use('/api/time-machine', timeMachineRoutes);
app.use('/api/drift', driftRoutes);
app.use('/api/origin', originRoutes);
app.use('/api/ais', aisRoutes);
app.use('/api/suspects', suspectRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/weather', weatherRoutes);

app.listen(config.port, () => {
  console.log(`[AEGIS Server] Running on http://localhost:${config.port}`);
});
