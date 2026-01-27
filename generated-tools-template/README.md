# Fast Track Generated Tools

This repository contains auto-generated decision-making tools created by the Fast Track Tool Factory.

## Structure

```
tools/
├── {tool-slug}/
│   ├── index.html      # The interactive tool
│   ├── config.json     # Tool metadata and configuration
│   ├── database.yml    # Database provisioning config
│   └── api/
│       └── responses.js  # API endpoint (serverless)
├── {another-tool}/
│   └── ...
└── index.html          # Tool gallery page
```

## Adding Tools

Tools are automatically added by the n8n workflow when:
1. Boss submits a tool request
2. AI generates the tool
3. QA validation passes
4. Boss approves the tool

The workflow pushes directly to this repository via GitHub API.

## Database Provisioning

Each tool can have its own database. When a new tool is added:
1. GitHub Actions detects the new `database.yml`
2. Creates a SQLite database (or Supabase project)
3. Generates API endpoints for data storage
4. Commits the database and API files back to the repo

## Deployment

Tools are automatically deployed to GitHub Pages when pushed to `main`.

**Live URL:** `https://{owner}.github.io/{repo}/tools/{tool-slug}/`

## Categories

Tools are categorized into four types:
- **B2B Product** - Business evaluating product purchases
- **B2B Service** - Business evaluating service providers
- **B2C Product** - Individual making personal purchases
- **B2C Service** - Individual evaluating personal services

Each category has specific templates, prompts, and scoring logic.

## Environment Variables

For the n8n workflow to push to this repo:

```env
GITHUB_TOKEN=ghp_xxxx
GITHUB_OWNER=your-org
GITHUB_REPO=generated-tools
```

## Local Development

```bash
# Serve tools locally
npx serve tools

# Or use Python
python -m http.server 8080 --directory tools
```

## Security

- Tools are static HTML - no server-side code
- API endpoints are serverless functions (deploy separately)
- User data is stored in per-tool databases
- No sensitive data in the repository
