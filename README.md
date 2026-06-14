# 🤖 AI Code Reviewer - This will generate the review for all your PR's and commits

> A GitHub Action that automatically reviews pull requests using **Google Gemini AI** and posts structured, actionable feedback as a PR comment.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## What it does

When a pull request is opened or updated, this action:

1. Fetches the PR diff via the GitHub API
2. Sends it to Gemini 1.5 Flash with a structured code review prompt
3. Posts a detailed Markdown comment on the PR with:
   - An overall quality **score (1–10)**
   - A **summary** of the changes
   - A table of **issues** categorised by severity (critical / major / minor / suggestion)
   - What was done **well**

---

## Quick Start

### 1. Add your Gemini API key as a secret

In your repository: **Settings → Secrets and variables → Actions → New repository secret**

Name: `GEMINI_API_KEY`
Value: your key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 2. Create the workflow file

Create `.github/workflows/ai-review.yml` in your repo:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - name: AI Code Review
        uses: Chumani-Lalasa/ai-code-reviewer@v1
        with:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

That's it. Open a pull request and the bot will comment automatically.

---

## Example Review Comment

> **Overall Score:** 🟢 **8/10**
>
> **Summary:** The PR adds JWT authentication middleware with good error handling. Minor improvements needed around input validation and logging consistency.
>
> **What's Good**
> - Clean separation of concerns between middleware and route handlers
> - Proper use of async/await with try/catch
>
> | Severity | File | Issue | Suggestion |
> |---|---|---|---|
> | 🟡 minor | `middleware/auth.js` | Error message exposes internal token format | Use a generic "Unauthorized" message |
> | 💡 suggestion | `routes/user.js` | Missing input validation on email field | Add express-validator or Joi schema |

---

## Inputs

| Input | Required | Description |
|---|---|---|
| `gemini-api-key` | Yes | Your Google Gemini API key |

## Outputs

| Output | Description |
|---|---|
| `score` | Overall quality score (1–10) |
| `issues_count` | Number of issues found |

---

## Tech Stack

- **Node.js 20** — runtime
- **@google/generative-ai** — Gemini SDK
- **@actions/core + @actions/github** — GitHub Actions toolkit
- **@vercel/ncc** — bundler (packages everything into `dist/index.js`)

---

## Local Development

```bash
git clone https://github.com/Chumani-Lalasa/ai-code-reviewer.git
cd ai-code-reviewer
npm install

# Make changes to src/
# Then rebuild the bundle:
npm run build

# Commit dist/index.js along with your changes
git add dist/ && git commit -m "rebuild bundle"
```

---

## License

MIT © [Chumani Lalasa](https://github.com/Chumani-Lalasa)
