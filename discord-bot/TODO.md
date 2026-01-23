# Discord Knowledge Bot - Implementation TODO

## Phase 1: Project Setup
- [x] Create `discord-bot/` directory structure
- [x] Initialize `package.json` with dependencies (discord.js, openai, zod, dotenv)
- [x] Create `tsconfig.json` with path aliases to shared code
- [x] Create `.env.example` with required variables
- [ ] Add to `.gitignore`

## Phase 2: Shared Package
- [x] Create `shared/` directory
- [x] Move `storage.ts` from backend to shared
- [x] Move `llm.ts` from backend to shared
- [x] Move `kb-compiler.ts` from backend to shared
- [x] Move `output-schemas.ts` from backend to shared
- [x] Move prompts (`feed-ingest.ts`, `feed-update.ts`, `shared/`) to shared
- [ ] Update backend imports to use shared package
- [x] Create `shared/package.json`
- [ ] Test backend still works after refactor

## Phase 3: Configuration System
- [x] Create `discord-bot/src/types/index.ts` with Zod schemas
- [x] Create `discord-bot/src/config/index.ts` - config loader
- [x] Create `discord-bot/src/config/env.ts` - env validation
- [x] Create sample config `discord-bot/config/example.json`

## Phase 4: Core Services
- [x] Create `discord-bot/src/services/logger.ts`
- [x] Create `discord-bot/src/services/queue.ts` - message queue with rate limiting
- [x] Create `discord-bot/src/prompts/classify.ts` - classification prompt
- [x] Create `discord-bot/src/services/classifier.ts` - LLM classification service
- [x] Create `discord-bot/src/services/processor.ts` - message processing logic
- [x] Implement `findRelatedEntries()` for deduplication

## Phase 5: Discord Integration
- [x] Create `discord-bot/src/bot.ts` - Discord client setup
- [x] Create `discord-bot/src/handlers/ready.ts` - ready event handler
- [x] Create `discord-bot/src/handlers/message.ts` - message event handler
- [x] Create `discord-bot/src/index.ts` - entry point
- [x] Add graceful shutdown handling

## Phase 6: Testing & Integration
- [ ] Create test Discord server
- [ ] Create test project config
- [ ] Test whitelisted channel (auto-ingest)
- [ ] Test monitored channel (classify -> ingest)
- [ ] Test correction/update flow (supersede)
- [ ] Test rate limiting with burst of messages
- [x] Add bot start script to `scripts/`

## Phase 7: Documentation
- [ ] Update main README with Discord bot info
- [x] Document config file format
- [x] Document env variables
- [ ] Add troubleshooting guide

## Optional Enhancements (Future)
- [ ] Slash commands (/status, /pause, /resume)
- [ ] Handle message edits (`messageUpdate` event)
- [ ] Web dashboard for bot status
- [ ] Multiple server support per project
- [ ] Webhook notifications on knowledge updates
