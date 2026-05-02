# ZAMASKILLS

Knowledge skills for AI agents building on Zama FHEVM. Each skill is a standalone markdown file that agents fetch and read into their context.

**Live site:** https://zamaskills-dev.vercel.app

## Skills

| Skill | Description |
|-------|-------------|
| [scaffold](scaffold/SKILL.md) | Build a Zama FHEVM counter app with Hardhat |
| [addresses](addresses/SKILL.md) | Canonical Zama FHEVM Sepolia addresses and services |
| [decryption](decryption/SKILL.md) | Public decryption workflow for Zama FHEVM |
| [private-token](private-token/SKILL.md) | Template for building a Zama FHEVM private token |
| [vesting-wallet](vesting-wallet/SKILL.md) | Confidential vesting wallet example for ERC7984 tokens |
| [erc20-wrapper](erc20-wrapper/SKILL.md) | Wrap a standard ERC-20 into a confidential ERC-7984 |
| [erc7984-standard](erc7984-standard/SKILL.md) | Full Hardhat project template for a confidential ERC-7984 token |
| [confidential-payroll](confidential-payroll/SKILL.md) | Full Hardhat project for confidential payroll |

## Architecture

- **Frontend:** Static HTML landing page (`index.html`)
- **API:** Vercel serverless functions (`api/`)
- **Database:** MongoDB (anonymous download tracking)
- **Skills:** Markdown files served via Vercel routes through a tracking function

See [docs/architecture.md](docs/architecture.md) for the full system overview and C4 diagrams.

## Prerequisites

- Node.js >= 18
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
| `MONGODB_DB` | No | Database name (default: `zamaskills`) |
| `STATS_SECRET` | Yes | Secret key to access `/api/stats` |

### Database Setup

Create a MongoDB database (Atlas or self-hosted). The app will create the
`skill_downloads` collection automatically on first insert.

## Development

This is a static site with Vercel serverless functions. There's no local dev server needed for the skills themselves (they're just markdown).

## Deployment

The site deploys to Vercel. Push to `main` to trigger a deploy.

Ensure `MONGODB_URI` and `STATS_SECRET` are set in your Vercel project environment variables.


## License

MIT License

Copyright 2026 Kali-Decoder

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
# Midnight-Skills
