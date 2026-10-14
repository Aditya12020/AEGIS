import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production') {
  if (!process.env.JWT_SECRET) {
    throw new Error('[FATAL SECURITY ERROR] JWT_SECRET must be configured in production environment.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('[FATAL SECURITY ERROR] DATABASE_URL must be configured in production environment.');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : 'dev-only-isolated-jwt-secret-not-for-prod-use'),
  aisDataDir: path.resolve(__dirname, '../../data'),
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000',
  scoringWeights: {
    proximity: 0.30,
    timeMatch: 0.25,
    trajectory: 0.25,
    speedAnomaly: 0.10,
    routeDeviation: 0.10,
  },
  copernicusMarine: {
    username: process.env.COPERNICUS_MARINE_USERNAME || '',
    password: process.env.COPERNICUS_MARINE_PASSWORD || '',
  },
  era5: {
    apiKey: process.env.ERA5_API_KEY || '',
    cdsUrl: process.env.ERA5_CDS_URL || 'https://cds.climate.copernicus.eu/api',
  },
  copernicusDataSpace: {
    clientId: process.env.COPERNICUS_DATASPACE_CLIENT_ID || process.env.COPERNICUS_CLIENT_ID || '',
    clientSecret: process.env.COPERNICUS_DATASPACE_CLIENT_SECRET || process.env.COPERNICUS_CLIENT_SECRET || '',
  },
  copernicusMarineDataset: process.env.COPERNICUS_MARINE_DATASET || 'cmems_mod_glo_phy_my_0.083deg_P1D-m',
};
