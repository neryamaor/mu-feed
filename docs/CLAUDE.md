# MuFeed — Claude Code Instructions

## Read before every task
Before starting any task, always read these files in order:
1. `docs/PRD.md` — what the app does and why
2. `docs/ARCHITECTURE.md` — how the codebase is structured and all key decisions
3. `docs/SCHEMA.sql` — the full database schema
4. `docs/TASKS.md` — the task list and current progress

## About this project
MuFeed is a mobile app for learning Palestinian Spoken Arabic through short videos.
Built with: React Native + Expo, Supabase (PostgreSQL), Cloudflare Stream, Whisper API, Claude/GPT-4 API.

## Non-negotiable rules
- The feed IS the video player — there is no separate video player screen. Videos auto-play inline in the feed, full-screen, one at a time (TikTok-style), with snap-to-video paging. All subtitles, tooltips, and action overlays render directly on the feed video.
- Subtitle hide is visual-only — when the user hides subtitles, `useSubtitles` must continue tracking the current segment in the background so subtitles can be restored instantly without re-fetching.
- All search logic lives in `services/search.ts` only — never in components or screens
- All external API calls live in `services/` only — never in components or screens
- Subtitle timing is segment-level only — do not store or use word-level timestamps
- Each `segment_word` has two translation references: `dictionary_entry_id` (global dictionary) and `context_translation_id` (video-specific context)
- Admin panel is completely invisible to regular users — only users with a row in `admin_permissions` see it
- Use Supabase Auth for all authentication — never build a custom auth system
- Never write search queries outside of `services/search.ts`

## When completing a task
- Mark the task as `[x]` in `docs/TASKS.md` when done
- Do not start the next task unless explicitly asked
- Summarize what was built and flag any decisions or assumptions made

## Environment variables
All environment variables are defined in `.env.example`. Never hardcode values — always read from environment variables.