# Midnight Skills

Knowledge skills for AI agents building on Midnight Network. Each skill is a standalone markdown file that agents fetch and read into their context.

## Skills

| Skill | Description |
|-------|-------------|
| [1AM Wallet](1am-wallet/SKILL.md) | Integrate the 1AM browser wallet for dust-free contract deployment and transaction flow |
| [Compact](compact/SKILL.md) | The Compact smart contract language — TypeScript-like DSL that compiles to ZK circuits |
| [Midnight.js](midnight-js/SKILL.md) | TypeScript SDK — provider wiring, wallet SDK, contract deployment, DUST flow, testkit |
| [Testing](testing/SKILL.md) | Debug Compact contracts, read compiler errors, manage versions, avoid common traps |
| [Multinetwork](multinetwork/SKILL.md) | Deploy a single dApp across all networks (localnet, preview, preprod, mainnet) from one codebase |
| [Why Midnight](why-midnight/SKILL.md) | Midnight's architecture, privacy model, selective disclosure, and ZK proofs |

## Architecture

- **Frontend:** Static HTML landing page (`index.html`)
- **API:** Vercel serverless functions (`api/`)
- **Database:** MongoDB (anonymous download tracking)
- **Skills:** Markdown files served via Vercel routes through a tracking function

## Prerequisites

- Node.js >= 22
- A MongoDB database (Atlas or self-hosted)
- A [Vercel](https://vercel.com) account for deployment

## Setup

```bash
# Install dependencies
npm install

# Set environment variables (see .env.example)
cp .env.example .env
# Edit .env with your values
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB` | No | Database name (default: `midnight-skills`) |
| `STATS_SECRET` | Yes | Secret key to access `/api/stats` |

### Database Setup

Create a MongoDB database (Atlas or self-hosted). The app will create the
`skill_downloads` collection automatically on first insert.

## Deployment

The site deploys to Vercel. Push to `main` to trigger a deploy.

Ensure `MONGODB_URI` and `STATS_SECRET` are set in your Vercel project environment variables.

## License

MIT License

Copyright 2026 Tusharpamnani, Kali-Decoder

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
