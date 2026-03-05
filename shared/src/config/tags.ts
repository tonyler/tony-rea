/**
 * Predefined KB Entry Tags
 *
 * LLM should use these tags when ingesting content.
 * New tags can be suggested via `suggested_new_tags` field for review.
 */

import * as fs from 'fs';
import * as path from 'path';

// Base predefined tags (static)
export const BASE_PREDEFINED_TAGS = [
  // Platform & Social
  'Twitter',
  'X',
  'Discord',
  'Telegram',
  'Spaces',
  'AMA',
  'Raids',
  'Social Media',
  'Medium',
  'TaskOn',
  'Galxe',
  'Zealy',
  'Spotify',
  'YouTube',
  'Reddit',
  'Mirror',
  'Substack',
  'LinkedIn',
  'Farcaster',
  'Lens',

  // Content Types
  'Announcement',
  'Blog Post',
  'Event',
  'Campaign',
  'Contest',
  'Quiz',
  'Giveaway',
  'Poll',
  'Voting',
  'Interview',
  'Tutorial',
  'Guide',
  'FAQ',
  'News',
  'Alpha',

  // Sphinx-specific
  'Sphinx Protocol',
  'Sphinx',
  'Sphinx Tech',
  'Sphinx App',
  'Sphinx Docs',
  'Perps',
  'Orderbook',

  // Protocol & Product
  'Testnet',
  'Pre-Testnet',
  'Mainnet',
  'Launch',
  'Update',
  'Roadmap',
  'Feature',
  'Bug Fix',
  'Beta',
  'Alpha Release',

  // Network & Chain
  'Neutron',
  'Cosmos',
  'IBC',
  'L1',
  'L2',
  'Appchain',
  'Cross-chain',

  // Technology
  'Blockchain',
  'Web3',
  'DeFi',
  'CeFi',
  'NFT',
  'Tokenization',
  'RWA',
  'Smart Contract',
  'API',
  'SDK',
  'Oracle',
  'Bridge',
  'Validator',
  'Node',

  // Trading & Finance
  'Trading',
  'Commodities',
  'Commodities Trading',
  'Futures',
  'Options',
  'Derivatives',
  'Perpetuals',
  'Spot',
  'Margin',
  'Leverage',
  'Long',
  'Short',
  'PnL',
  'Liquidity',
  'Market Making',
  'Hedging',
  'Risk Management',

  // DeFi Specific
  'Staking',
  'Yield',
  'Farming',
  'LP',
  'TVL',
  'APY',
  'APR',
  'Vault',

  // Token & Tokenomics
  'Token',
  'Tokenomics',
  'Vesting',
  'Unlock',
  'Burn',
  'Supply',
  'Allocation',

  // Rewards & Points
  'XP',
  'XP Distribution',
  'Rewards',
  'Airdrop',
  'Incentives',
  'Leaderboard',
  'Multiplier',
  'Points',
  'Bonus',

  // Community & Engagement
  'Community',
  'Engagement',
  'Partnership',
  'Collaboration',
  'Sponsorship',
  'Ambassador',
  'Collab',

  // Roles & Access
  'Role',
  'Genesis',
  'OG',
  'Whitelist',
  'Access',
  'Membership',
  'Early Access',

  // Governance & Compliance
  'Governance',
  'Compliance',
  'Regulation',
  'KYC',
  'Security',
  'Audit',
  'Bug Bounty',

  // Security
  'Exploit',
  'Hack',
  'Vulnerability',
  'Incident',

  // Team & Organization
  'Team',
  'Hiring',
  'Funding',
  'Investors',
  'Advisory',
  'VC',
  'Seed Round',
  'Series A',

  // Content & Media
  'Content Creation',
  'Meme',
  'Art',
  'Video',
  'Podcast',
  'Newsletter',
  'Thread',

  // Technical
  'Documentation',
  'Architecture',
  'Integration',
  'Migration',
  'Maintenance',
  'Upgrade',
  'Downtime',

  // Seasonal & Special
  'Christmas',
  'New Year',
  'Anniversary',
  'Milestone',
  'Celebration',
  'Holiday',

  // Status & Priority
  'Important',
  'Urgent',
  'Expired',
  'Ongoing',
  'Upcoming',
  'Completed',
  'Live',
  'Ended',

  // Partners (extendable via user tags)
  'Mad Scientists',
  'Revolve',
  'Galxe',
  'Bad Kids',
] as const;

function resolveTagsDataDir(): string {
  const explicitDir = process.env.TAGS_DATA_DIR;
  if (explicitDir) {
    return path.resolve(explicitDir);
  }

  const candidates = [
    path.resolve(process.cwd(), 'backend/data'),
    path.resolve(process.cwd(), '../backend/data'),
    path.resolve(__dirname, '../../../backend/data'),
    path.resolve(process.cwd(), 'data'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  // Default to first candidate if none exist yet
  return candidates[0];
}

const TAGS_DATA_DIR = resolveTagsDataDir();
const USER_TAGS_FILE = path.join(TAGS_DATA_DIR, 'user-tags.json');
const PENDING_TAGS_FILE = path.join(TAGS_DATA_DIR, 'pending-tags.json');

export interface PendingTag {
  tag: string;
  proposedAt: string;
  source: 'llm' | 'user';
  count: number;
}

export function loadUserTags(): string[] {
  try {
    if (fs.existsSync(USER_TAGS_FILE)) {
      const data = fs.readFileSync(USER_TAGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load user tags:', error);
  }
  return [];
}

export function saveUserTags(tags: string[]): void {
  try {
    const dir = path.dirname(USER_TAGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USER_TAGS_FILE, JSON.stringify(tags, null, 2));
  } catch (error) {
    console.error('Failed to save user tags:', error);
    throw error;
  }
}

export function loadPendingTags(): PendingTag[] {
  try {
    if (fs.existsSync(PENDING_TAGS_FILE)) {
      const data = fs.readFileSync(PENDING_TAGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load pending tags:', error);
  }
  return [];
}

export function savePendingTags(tags: PendingTag[]): void {
  try {
    const dir = path.dirname(PENDING_TAGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PENDING_TAGS_FILE, JSON.stringify(tags, null, 2));
  } catch (error) {
    console.error('Failed to save pending tags:', error);
    throw error;
  }
}

export function addPendingTag(tag: string, source: 'llm' | 'user'): void {
  const pending = loadPendingTags();
  const existing = pending.find((item) => item.tag.toLowerCase() === tag.toLowerCase());

  if (existing) {
    existing.count++;
    existing.proposedAt = new Date().toISOString();
  } else {
    pending.push({
      tag,
      proposedAt: new Date().toISOString(),
      source,
      count: 1,
    });
  }

  savePendingTags(pending);
}

export function getAllTags(): string[] {
  const userTags = loadUserTags();
  return [...BASE_PREDEFINED_TAGS, ...userTags];
}

export type PredefinedTag = typeof BASE_PREDEFINED_TAGS[number];

/**
 * Get tags as a formatted string for LLM prompts
 */
export function getTagsForPrompt(): string {
  return getAllTags().join(', ');
}

/**
 * Validate if a tag is predefined
 */
export function isValidTag(tag: string): boolean {
  return getAllTags().some((t) => t.toLowerCase() === tag.toLowerCase());
}

/**
 * Find closest matching predefined tag (case-insensitive)
 */
export function normalizeToPrefinedTag(tag: string): string | null {
  const match = getAllTags().find((t) => t.toLowerCase() === tag.toLowerCase());
  return match || null;
}

export function buildTagNormalizationPrompt(
  unmatchedTags: string[]
): { system: string; user: string } | null {
  if (unmatchedTags.length === 0) return null;

  const allTags = getAllTags();
  const system = `You are a tag normalization assistant. Given a list of user-provided tags that don't exactly match our predefined tag list, find the closest matching predefined tag for each one. Only map a tag if you're confident it's a fuzzy match (e.g., "defi" -> "DeFi", "nft" -> "NFT", "twitter spaces" -> "Spaces"). If no predefined tag is a reasonable match, return the original tag unchanged.

Predefined tags: ${allTags.join(', ')}`;

  const user = `Map these tags to predefined ones where possible. Return JSON:
{ "mappings": { "original_tag": "matched_predefined_tag_or_original" } }

Tags to normalize: ${unmatchedTags.join(', ')}`;

  return { system, user };
}

// Legacy export for compatibility
export const PREDEFINED_TAGS = BASE_PREDEFINED_TAGS;
