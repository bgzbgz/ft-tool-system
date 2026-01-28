# Fast Track Tool Factory V4 - Master Workflow Guide

> **Version**: 4.0
> **Last Updated**: January 2026
> **Status**: Production Ready

---

## Overview

The V4 Tool Factory consists of **3 core n8n workflows** that work together to produce world-class educational tools:

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| **1. Tool Factory** | Main production pipeline with 5 AI agents | Boss Office submission |
| **2. Deploy Tools** | GitHub deployment + MongoDB collection creation | Boss approval |
| **3. Boss Revisions** | Handle revision requests with priority override | Boss revision request |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BOSS OFFICE (Admin Panel)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Upload PDF/ │  │ Answer Spec │  │  Preview    │  │ Approve / Revise /  │ │
│  │ DOCX/MD/TXT │→ │ Questions   │→ │  Tool       │→ │ Reject              │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────────────┬────────────────────────────┬───────────────┘
                                 │                            │
                    ┌────────────▼────────────┐   ┌──────────▼──────────┐
                    │   WORKFLOW 1:           │   │  WORKFLOW 3:        │
                    │   TOOL FACTORY          │   │  BOSS REVISIONS     │
                    │                         │   │                     │
                    │  ┌─────────────────┐    │   │  ┌───────────────┐  │
                    │  │ 1. Secretary    │    │   │  │ Rev Secretary │  │
                    │  │ 2. Tool Builder │    │   │  │ Revision Agent│  │
                    │  │ 3. Template     │    │   │  └───────────────┘  │
                    │  │    Decider      │    │   │                     │
                    │  │ 4. QA Dept      │    │   └──────────┬──────────┘
                    │  │ 5. Feedback     │    │              │
                    │  │    Applier      │    │              │
                    │  └─────────────────┘    │              │
                    └────────────┬────────────┘              │
                                 │                           │
                    ┌────────────▼───────────────────────────▼──────────┐
                    │              WORKFLOW 2: DEPLOY TOOLS              │
                    │                                                    │
                    │  Webhook → GitHub Push → GitHub Action Trigger →   │
                    │  MongoDB Collection Creation → Return URL          │
                    └────────────────────────┬───────────────────────────┘
                                             │
                    ┌────────────────────────▼───────────────────────────┐
                    │                    OUTPUTS                         │
                    │  ┌──────────────┐  ┌───────────────────────────┐   │
                    │  │ GitHub Pages │  │ MongoDB Collection        │   │
                    │  │ /tools/slug  │  │ ft_tools_db.tool_{slug}   │   │
                    │  └──────────────┘  └───────────────────────────┘   │
                    └────────────────────────────────────────────────────┘
```

---

## Workflow Files

| File | Description |
|------|-------------|
| `V4-01-TOOL-FACTORY.md` | Complete Tool Factory workflow with 5 agents |
| `V4-02-DEPLOY-TOOLS.md` | GitHub deployment + MongoDB setup workflow |
| `V4-03-BOSS-REVISIONS.md` | Revision handling workflow |
| `V4-04-GITHUB-ACTIONS.md` | GitHub Actions runner for MongoDB collections |
| `V4-05-TEMPLATES.md` | Template configuration and selection logic |

---

## Environment Variables Required

Set these in n8n Settings → Variables:

```
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
MONGODB_DATABASE=ft_tools_db

# GitHub
GITHUB_OWNER=bgzbgz
GITHUB_REPO=ft-tool-system
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# LearnWorlds
LEARNWORLDS_API_KEY=your_api_key
LEARNWORLDS_SSO_SECRET=your_sso_secret

# Backend
BACKEND_URL=https://your-backend.com
BACKEND_CALLBACK_SECRET=your_callback_secret

# AI Models
GOOGLE_GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key (for QA - different model)
```

---

## Credentials Required

Create these in n8n Credentials:

1. **MongoDB** - Connection to ft_tools_db
2. **GitHub Token** - HTTP Header Auth with Bearer token
3. **Google Gemini** - For Secretary, Builder, Template Decider, Feedback Applier
4. **OpenAI** - For QA Department (different model = no bias)

---

## Quick Start

1. Import all 3 workflows into n8n
2. Configure environment variables
3. Set up credentials
4. Configure GitHub Actions in your repo
5. Test with a sample submission

---

## Category System

All tools are categorized into one of four types:

| Category | Code | Use Case |
|----------|------|----------|
| B2B Product | `b2b_product` | Business buying a product (software, equipment) |
| B2B Service | `b2b_service` | Business hiring a service (agency, consultant) |
| B2C Product | `b2c_product` | Consumer buying a product (personal purchase) |
| B2C Service | `b2c_service` | Consumer buying a service (coaching, fitness) |

Each category has:
- Specific prompt additions for AI agents
- Tailored scoring weights
- Category-appropriate decision language (GO/NO-GO, HIRE/DON'T HIRE, etc.)

---

## Next Steps

1. Read `V4-01-TOOL-FACTORY.md` for the main workflow
2. Read `V4-02-DEPLOY-TOOLS.md` for deployment setup
3. Read `V4-03-BOSS-REVISIONS.md` for revision handling
4. Configure `V4-04-GITHUB-ACTIONS.md` in your repository
