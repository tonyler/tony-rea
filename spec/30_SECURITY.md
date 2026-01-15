Security Model

- No authentication
- No login
- No accounts

Deployment:
- Hetzner server
- Publicly reachable URL

Protections:
- Per-IP rate limiting
- Request body size limits
- Same-origin CORS
- API keys stored only in env vars
- Never expose API keys to frontend
- Logs must not include prompts or secrets

Runtime:
- Node.js only
- Shell scripts for lifecycle control
