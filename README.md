# Tony & Rea - Internal LLM Tool

Private internal web tool for moderators and workers with no authentication.

## Features

- **Assistant Tab**: Mod replies, Education mode, Grammar fixes
- **Feed Tab**: Project knowledge ingestion and management
- **Threads Tab**: X/Twitter thread generation (280 chars per post)

## Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Express + TypeScript + OpenAI API
- Storage: Filesystem (./data/projects/)
- Scripts: Shell scripts for lifecycle management

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- OpenAI API key

### Installation

1. Clone or copy this project to your server

2. Setup environment:
```bash
cp .env.example .env
nano .env  # Add your OpenAI API key
```

3. Install and build:
```bash
chmod +x scripts/*.sh
./scripts/install.sh
```

4. Start the server:
```bash
./scripts/start.sh
```

5. Access the app:
```
http://your-server-ip:3000
```

## Scripts

- `./scripts/install.sh` - Install dependencies and build
- `./scripts/start.sh` - Start the server in background
- `./scripts/stop.sh` - Stop the server
- `./scripts/health.sh` - Check server health
- `./scripts/logs.sh` - View server logs

## Deployment

See the implementation plan for detailed deployment instructions.

### For Python Developers

| Python | Node.js Equivalent |
|--------|-------------------|
| `venv` | Not needed - npm installs locally |
| `requirements.txt` | `package.json` |
| `pip install` | `npm install` |
| `python app.py` | `npm start` |

## Project Structure

```
tony&rea/
├── backend/          # Express API
├── frontend/         # React UI
├── scripts/          # Shell scripts
├── data/            # Runtime data (gitignored)
└── .env            # Environment config (gitignored)
```

## Security

- No authentication (network boundary assumed)
- Per-IP rate limiting
- Request size limits
- CORS same-origin only
- API keys never exposed to frontend

## Data Storage

All project data stored in `./data/projects/`:
- Append-only entries
- Compiled knowledge base (kb.md)
- Generated threads
- Audit trail via deprecation (not deletion)

## Backup

```bash
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

## Updating

```bash
git pull
./scripts/stop.sh
./scripts/install.sh
./scripts/start.sh
```

## License

Private internal tool - not for public distribution.
