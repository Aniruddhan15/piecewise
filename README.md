# PieceWise

Helps non-technical small business owners find, compare and adopt AI tools. Each business
function is a puzzle piece, and pieces show whether they really fit the systems the business
already runs. Built for the UMD AI for Small Business Hack-a-thon, Fall 2026.

## Run it

```bash
npm i
npm run dev
```

Open http://localhost:3000. The whole app works with no API key: AI steps fall back to plain rules.

To turn on live AI, copy `.env.example` to `.env.local` and set `OPENROUTER_API_KEY`.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests: rules, fit score, gateway |
| `npx playwright test` | Browser tests: every demo to the plan page, accessibility, drag and drop |
| `npm run validate` | Checks the catalog; also runs before every build |
| `npm run discover -- --max 5` | Discovery agent: reads new listings into `data/candidates/` |
| `npm run discover -- --dry-run` | Lists what it would read, with no AI calls |
| `npm run pregen` | Pre-generates AI text for the demos into `data/cache/llm.json` |
| `npm run check:evidence` | Re-checks every source link and reports any that look gone |

## How it's built

- **`data/`**: the catalog as JSON, validated by Zod. Adding a business type only needs data changes.
- **`src/modules/compat-engine/`**: the rules, as pure functions with no AI. Rule order follows the spec.
- **`src/modules/fit-score/`**: the 0 to 100 score. Weights live in one object.
- **`src/modules/llm/`**: the only code that talks to an AI model. Server side only, with structured
  output, a fallback model, caching and limits. It can rephrase and classify, and guards reject output
  that adds new numbers or quotes that aren't on the page.
- **`scripts/discover.ts`**: finds new tools. Candidates stay `verified: false` until a person approves them.

## What "verified" means

`verified: true` means we fetched the source page during the build and it supported the claim. Anything
else shows as "unverified" in the app. Setup hours are our estimates, and the app says so.

## Before adding a discovery source

Read the site's terms as well as its robots.txt. The Shopify App Store allows crawling in robots.txt,
but Shopify's terms bar automated access, so it isn't configured as a source.
