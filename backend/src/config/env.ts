import { z } from 'zod';
import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  DATA_DIR: z.string().default('./data'),
  HOST: z.string().default('127.0.0.1'),
  // Discord OAuth
  DISCORD_CLIENT_ID: z.string().min(1, 'Discord Client ID required'),
  DISCORD_CLIENT_SECRET: z.string().min(1, 'Discord Client Secret required'),
  DISCORD_REDIRECT_URI: z.string().default('http://localhost:3001/api/auth/callback'),
  // Multi-LLM providers for Articles feature
  PERPLEXITY_API_KEY: z.string().min(1, 'Perplexity API key required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API key required'),
  XAI_API_KEY: z.string().optional(),  // Only needed for X search
  OPENAI_API_KEY: z.string().optional(),  // Fallback only
  GOOGLE_API_KEY: z.string().optional(),  // Fallback only
  // Article generation config (hard cap at $0.20)
  MAX_ARTICLE_BUDGET: z.coerce.number().max(0.20, 'Budget cannot exceed $0.20').default(0.10),
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
