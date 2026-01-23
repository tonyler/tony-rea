import { z } from 'zod';
import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, 'Discord bot token required'),
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key required'),
  OPENAI_MODEL: z.string().default('gpt-4'),
  DATA_DIR: z.string().default('../data'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  QUEUE_PROCESS_INTERVAL_MS: z.coerce.number().min(500).default(2000),
  QUEUE_MAX_SIZE: z.coerce.number().min(10).default(100),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
