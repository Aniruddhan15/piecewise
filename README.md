# 🧩 PieceWise

### Find the AI tools that actually fit your business.

**AI adoption shouldn't be a guessing game.**

Small businesses are surrounded by AI tools promising to save time, reduce costs, and improve operations. But finding a tool is easy. Knowing whether it works with your existing systems, fits your budget, and solves a real problem is much harder.

**PieceWise** is a vendor-neutral AI tool discovery and decision-support platform that helps small business owners find, compare, and evaluate AI solutions based on their actual business needs.

Instead of recommending AI for the sake of AI, PieceWise focuses on **compatibility, transparency, and practical adoption**.

🚀 **[Try PieceWise Live](https://piecewise-v1.vercel.app/)** | 💻 **[Explore the Source Code](https://github.com/Aniruddhan15/piecewise)**

---

## 💡 The Problem

Small businesses often face three challenges when adopting AI:

- **Discovery overload:** Hundreds of AI products, with little clarity on which ones solve their operational problems.
- **Integration uncertainty:** A promising tool may not connect with the POS, accounting, booking, or management software they already use.
- **Hidden costs and misleading recommendations:** Advertised prices don't always include the integrations a business needs.

Most recommendation platforms answer: *"Which AI tools are popular?"*

**PieceWise asks a better question: "Which AI tools actually make sense for your business?"**

## ⚙️ How PieceWise Works

**1. Understand the business**

Choose a business type, such as a restaurant, coffee shop, salon, retail store, or service provider, and identify the systems already in use.

**2. Break operations into pieces**

PieceWise organizes business operations into six functional components, making it easier to identify opportunities for improvement.

**3. Discover compatible tools**

Explore AI solutions evaluated against the business's existing technology stack, with compatibility checks and supporting evidence.

**4. Compare before committing**

Examine integration requirements, relevant pricing, and a weighted fit score to understand the trade-offs between solutions.

**5. Build an actionable plan**

Put together a business-specific AI toolkit and explore adoption guidance, including free Small Business Administration advisory resources.

## ✨ Key Features

| Feature | What it delivers |
|---|---|
| 🧩 Modular Business Analysis | Breaks operations into manageable functional components |
| 🔗 Compatibility Engine | Evaluates whether tools integrate with existing business systems |
| 📊 Fit Scoring | Provides a weighted 0–100 score for comparing solutions |
| 🤖 AI-Assisted Guidance | Uses structured LLM outputs to explain and classify recommendations |
| 🔍 Evidence Verification | Connects supported claims to sources and distinguishes unverified information |
| 💰 Pricing Transparency | Highlights relevant plan costs and integration requirements |
| 🛡️ Vendor-Neutral Discovery | No paid placements influencing recommendations |
| 🧰 Personalized AI Toolkit | Helps businesses assemble solutions around their operational needs |

## 🏗️ Engineering Behind PieceWise

PieceWise combines **deterministic decision logic with AI-assisted reasoning** rather than relying entirely on generative AI.

**Compatibility Engine**

A rules-based evaluation layer checks integration requirements and compatibility constraints. This keeps critical decisions grounded in defined conditions rather than potentially unreliable model-generated claims.

**Weighted Fit Scoring**

A configurable scoring engine evaluates candidate solutions on a 0–100 scale, supporting structured comparisons.

**LLM Gateway**

A server-side AI layer handles classification and natural-language explanations using structured outputs, caching, fallback behavior, and guardrails against unsupported claims.

**Tool Discovery and Evidence Validation**

A discovery workflow identifies potential tools, while source verification and human approval help maintain the reliability of the catalog.

**Resilient Application Design**

Core functionality remains available without an AI API key through deterministic fallback logic.

## 🛠️ Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **AI Integration:** OpenAI-compatible SDK, OpenRouter
- **Validation:** Zod
- **Backend/Application Logic:** Next.js server-side modules
- **Testing:** Vitest, Playwright, accessibility testing
- **Infrastructure:** Vercel deployment, Firebase configuration
- **Developer Tooling:** ESLint, Prettier, GitHub Actions

## 🚀 Getting Started

Clone the repository:

```bash
git clone https://github.com/Aniruddhan15/piecewise.git
cd piecewise
```

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

The application supports a no-API-key mode. For live AI functionality, configure `OPENROUTER_API_KEY` in `.env.local`.

### Testing and Validation

```bash
npm test
npx playwright test
npm run validate
npm run check:evidence
```

## 🎯 Our Philosophy

**The best AI solution isn't the most sophisticated one. It's the one that solves the right problem and fits the business using it.**

PieceWise was built around that principle: making AI adoption more accessible, explainable, and practical for the businesses that need it.

## 🏆 Origin

Developed for the **University of Maryland — AI for Small Business Hackathon, Fall 2026**.

PieceWise explores how intelligent software systems can bridge the gap between rapidly evolving AI capabilities and the everyday operational challenges faced by small businesses.

---

**Built for small businesses. Designed for better decisions. Powered by practical AI.**
