/**
 * Predefined KB Entry Tags
 *
 * LLM should use these tags when ingesting content.
 * New tags can be suggested via `suggested_new_tags` field for review.
 */

export const PREDEFINED_TAGS = [
  // Platform & Social
  'Twitter',
  'Discord',
  'Telegram',
  'Spaces',
  'AMA',
  'Raids',

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

  // Protocol & Product
  'Sphinx Protocol',
  'Sphinx',
  'Testnet',
  'Pre-Testnet',
  'Mainnet',
  'Launch',
  'Update',
  'Roadmap',
  'Feature',
  'Bug Fix',

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

  // Trading & Finance
  'Trading',
  'Commodities',
  'Commodities Trading',
  'Futures',
  'Options',
  'Derivatives',
  'Liquidity',
  'Market Making',
  'Hedging',
  'Risk Management',

  // Rewards & Points
  'XP',
  'XP Distribution',
  'Rewards',
  'Airdrop',
  'Incentives',
  'Leaderboard',
  'Multiplier',

  // Community & Engagement
  'Community',
  'Engagement',
  'Partnership',
  'Collaboration',
  'Sponsorship',
  'Ambassador',

  // Roles & Access
  'Role',
  'Genesis',
  'OG',
  'Whitelist',
  'Access',
  'Membership',

  // Governance & Compliance
  'Governance',
  'Compliance',
  'Regulation',
  'KYC',
  'Security',

  // Team & Organization
  'Team',
  'Hiring',
  'Funding',
  'Investors',
  'Advisory',

  // Content & Media
  'Content Creation',
  'Meme',
  'Art',
  'Video',
  'Podcast',
  'Newsletter',

  // Technical
  'Documentation',
  'Architecture',
  'Integration',
  'Migration',
  'Maintenance',

  // Seasonal & Special
  'Christmas',
  'New Year',
  'Anniversary',
  'Milestone',
  'Celebration',

  // Status & Priority
  'Important',
  'Urgent',
  'Expired',
  'Ongoing',
  'Upcoming',
  'Completed',

  // Partners (can be extended)
  'Mad Scientists',
  'Revolve',
  'Galxe',
  'Bad Kids',
] as const;

export type PredefinedTag = typeof PREDEFINED_TAGS[number];

/**
 * Get tags as a formatted string for LLM prompts
 */
export function getTagsForPrompt(): string {
  return PREDEFINED_TAGS.join(', ');
}

/**
 * Validate if a tag is predefined
 */
export function isValidTag(tag: string): boolean {
  return PREDEFINED_TAGS.some(t => t.toLowerCase() === tag.toLowerCase());
}

/**
 * Find closest matching predefined tag (case-insensitive)
 */
export function normalizeToPrefinedTag(tag: string): string | null {
  const match = PREDEFINED_TAGS.find(t => t.toLowerCase() === tag.toLowerCase());
  return match || null;
}
