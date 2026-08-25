# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Packet & Path is a customized Firefly 6.15.0 static blog built on **Astro 7.0.7** with **Svelte 5** interactive islands. It is based on the Firefly/Fuwari theme family and uses English as the configured default UI, with same-route Simplified Chinese switching and additional upstream locale support where configured.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server at `127.0.0.1:5173` |
| `pnpm build` | Production build (LQIPs → Astro → font subsets → Pagefind) |
| `pnpm preview` | Preview production build |
| `pnpm check` | `astro check` for type/error checking |
| `pnpm type-check` | `tsc --noEmit --isolatedDeclarations` |
| `pnpm lint` | Biome lint + auto-fix |
| `pnpm format` | Biome format |
| `pnpm new-post <filename>` | Scaffold a new blog post |

Package manager is **pnpm** (enforced). Node.js >= 22 required.

## Architecture

### Astro + Svelte Hybrid

- `.astro` components for static content and layouts
- `.svelte` components for interactive UI (search, settings, pagination, archive) — mounted with `client:load` or `client:visible`
- Swup.js handles SPA-like page transitions with multiple container targets

### Configuration-Driven

All features are toggled/configured via TypeScript files in `src/config/`, exported through the barrel at `src/config/index.ts`. Key configs:

- `siteConfig.ts` — core site settings, theme, pagination
- `sidebarConfig.ts` — sidebar layout (left/right/both, widget ordering)
- `commentConfig.ts`, `analyticsConfig.ts`, `fontConfig.ts`, etc.

### Layout System

- `Layout.astro` — base HTML shell (head, body, theme init, analytics, Swup hooks)
- `MainGridLayout.astro` — full page grid with sidebar(s), navbar, wallpaper, footer

### Content Collections

Defined in `src/content.config.ts`:
- `posts` — blog posts (`.md`/`.mdx`) with frontmatter: title, published, tags, category, draft, pinned, password, comment, etc.
- `spec` — special pages (about, guestbook)

### Key Directories

- `src/components/` — organized by domain: `analytics/`, `comment/`, `common/`, `controls/`, `features/`, `layout/`, `misc/`, `pages/`, `widget/`
- `src/plugins/` — 15 custom remark/rehype plugins (Mermaid, PlantUML, KaTeX, GitHub cards, reading time, etc.)
- `src/i18n/` — translation keys in `i18nKey.ts`, language files in `languages/*.ts`, lookup via `translation.ts`
- `src/utils/` — content sorting, crypto (encrypted posts), date formatting, image processing/LQIP, TOC generation
- `src/pages/` — Astro file-based routing
- `scripts/` — build-time and maintenance utilities (`generate-lqips.ts`, `subset-fonts.ts`, `new-post.js`, and PowerShell helpers)

### Path Aliases (tsconfig.json)

`@components/*`, `@assets/*`, `@constants/*`, `@utils/*`, `@i18n/*`, `@layouts/*` → `./src/<dir>/*`; `@/*` → `./src/*`

## Code Style

- **Biome** enforces: tab indentation, double quotes, recommended lint rules
- Relaxed rules for `.svelte`/`.astro` files (useConst off, noUnusedVariables off)
- Commit convention: **Conventional Commits** (`feat:`, `fix:`, `chore:`, etc.)

## Build Pipeline

Multi-step: `scripts/generate-lqips.ts` → `astro build` → `scripts/subset-fonts.ts` → `pagefind --site dist`

LQIP data is generated into `src/constants/lqips.json` and committed. Regenerate it with `pnpm lqips`; there is no `pnpm icons` script in this fork.

## Deployment

- **Cloudflare Workers** is the Packet & Path production target (`wrangler.jsonc`, Worker `firefly`).
- `vercel.json` remains an upstream-compatible alternative configuration, not the current production path.
- Static output to `dist/`
