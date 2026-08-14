# CRM Features - Walkthrough

## Summary
Implemented all requested CRM features for the Assistente Sulma system.

## Changes Made

### Database Schema
- Added `Tag` model with name, color, and organization relation
- Added `category` field to `Lead` model for tabs/filtering
- Added `tags` relation to `Lead` model
- Added `priority` (low, medium, high) and `source` (whatsapp, instagram, manual) to `Lead` model

render_diffs(file:///wsl.localhost/Ubuntu-24.04/home/developer/www/sulma/prisma/schema.prisma)

### Kanban UI Enhancements (Visual)

- **Summary**: Displays first 2 lines of lead summary
- **Priority**: Color-coded icons (Red/ArrowUp for High, Green/ArrowDown for Low)
- **Time in Stage**: Shows how long the lead has been in the current status (e.g., "2d", "5h")
- **Source**: Icons for WhatsApp, Instagram, etc.
- **Responsible**: Avatar of the agent assigned to the lead

render_diffs(file:///wsl.localhost/Ubuntu-24.04/home/developer/www/sulma/src/app/(dashboard)/leads/ui/LeadsKanban.tsx)

### API Routes Created/Updated

| Route | Method | Description |
|-------|--------|-------------|
| `/api/leads` | GET | Include priority, source, summary, responsible agent |
| `/api/transcribe` | POST | Calls n8n webhook for audio transcription |
| `/api/leads/[id]/reminders` | GET, POST | List/create reminders |

### Integrations

- **n8n Webhook**: 
  - URL: `N8N_TRANSCRIBE_WEBHOOK` in `.env`
  - Workflow template: `docs/n8n-transcricao-workflow.json`

## Next Steps (Manual)

1. **Run Migration**:
```bash
cd /home/developer/www/sulma
npx prisma migrate dev --name add_kanban_enhancements
npx prisma generate
```

2. **Build & Test**:
```bash
npm run build
npm run dev
```
