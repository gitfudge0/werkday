# Werkday

AI-powered workday summarizer that tracks your GitHub commits, JIRA tickets, and personal notes to generate daily standup reports.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui
- **Backend**: Hono server (runs on port 3001)
- **Desktop**: Tauri v2
- **Storage**: JSON files in `~/.werkday/`
- **Package Manager**: bun

## Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- [Rust](https://rustup.rs/) (for Tauri desktop builds)

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Start the development servers

You need to run both the backend server and the frontend in separate terminals:

**Terminal 1 - Backend Server:**
```bash
bun run dev:server
```

**Terminal 2 - Frontend:**
```bash
bun run dev
```

The frontend will be available at `http://localhost:5173`

### 3. (Optional) Run as Tauri desktop app

```bash
bun run tauri:dev
```

## Initial Setup (After Dev Build Starts)

Once the app is running, you'll need to configure your integrations:

### 1. Go to Settings

Click on **Settings** in the sidebar to configure your integrations.

### 2. Connect GitHub

1. Generate a GitHub Personal Access Token:
   - Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
   - Create a new token (classic) with these scopes: `repo`, `read:user`
2. Paste your token in the GitHub section and save

### 3. Connect JIRA

1. Generate a JIRA API Token:
   - Go to [Atlassian Account Settings > Security > API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Create a new API token
2. Enter your JIRA details:
   - **Domain**: Your Atlassian domain (e.g., `yourcompany` for `yourcompany.atlassian.net`)
   - **Email**: Your Atlassian account email
   - **API Token**: The token you generated
3. After connecting, select the JIRA projects you want to track

### 4. Configure AI (for Report Generation)

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys) or use a compatible provider
2. Enter your AI provider details in Settings:
   - **Provider**: OpenAI (or compatible)
   - **API Key**: Your API key
   - **Model**: e.g., `gpt-4o-mini`

### 5. Start Tracking

- **Dashboard**: View your activity overview for the last 7 days
- **GitHub**: See commits, PRs, and code reviews
- **JIRA**: Track issues, status transitions, comments, and time logged
- **Notes**: Add personal notes for things not captured elsewhere
- **Reports**: Generate AI-powered daily standup summaries

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start frontend dev server |
| `bun run dev:server` | Start backend server with hot reload |
| `bun run build` | Build frontend for production |
| `bun run build:server` | Bundle backend server |
| `bun run tauri:dev` | Run as Tauri desktop app (dev mode) |
| `bun run tauri:build` | Build production Tauri app |

## Data Storage

All data is stored locally in `~/.werkday/`:

- `config.json` - API keys and settings
- `github-cache.json` - Cached GitHub activity
- `jira/YYYY-MM-DD.json` - JIRA activity per day
- `notes/` - Personal notes

## License

MIT
