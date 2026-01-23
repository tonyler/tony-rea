import { env } from './env';

export const appConfig = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  dataDir: env.DATA_DIR,
} as const;
