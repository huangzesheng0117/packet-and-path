# Packet & Path Project Status

Last updated: 2026-08-25

## Purpose

Packet & Path is ZeSheng Huang's public network-engineering portfolio at `next-hop.tech`. It presents sanitized project delivery experience, production incident investigations, architecture decisions, change controls, and network automation work in Chinese and English.

## Current Status

| Area | Status | Notes |
|---|---|---|
| Case archive | Complete | 4,149 files totaling about 9.19 GiB are stored privately under `../Case/`; this directory is not part of Git. |
| New-computer environment | Complete | Node.js 22.23.2, npm 10.9.8, Git 2.55.0, Git LFS 3.7.1, pnpm 9.14.4, lockfile dependencies, project-local Wrangler 4.107.1, and the `next-hop-blog-release` Codex skill are installed. |
| New-computer credentials | User action required | Git author identity is configured and Git Credential Manager 2.9.0 is installed; no GitHub account is stored yet, and Wrangler is not authenticated. |
| Blog framework | Complete | Packet & Path fork version 6.15.0 on Astro 7.0.7 and Svelte 5. |
| Site identity | Complete | `Packet & Path`, author `ZeSheng Huang`, English default UI with same-route Simplified Chinese switching, and bilingual engineering content. |
| Source control | Content baseline reconciled locally | Local `master` and `blog-version-01` retain the `eb145998…` site-source baseline; `blog-version-02` carries the local documentation-maintenance commit on top of that baseline. The remote version-02 branch remains at `6ef2389…` until an explicitly authorized push. |
| Cloud deployment | Live | Cloudflare Worker `firefly` serves the static `dist/` output. Migration work does not require a redeployment. |
| Production domain | Live | `https://next-hop.tech/` and `https://www.next-hop.tech/` are the production domains. |
| Published portfolio content | Active | Three sanitized case/incident articles are published bilingually, including the F5 BIG-IP DNS incident retrospective. |
| Maintenance and release docs | Updated | `docs/MAINTENANCE.md` covers editing; `docs/RELEASE_WORKFLOW.md` is authoritative for GitHub and production releases. |
| Incident and asset controls | Active | `docs/ISSUE_LOG.md`, `docs/IMAGE_ASSET_GUIDELINES.md`, and `docs/IMAGE_SOURCES.md` record operational regressions and image provenance. |

## Repository Layout

| Path | Purpose |
|---|---|
| `src/content/posts/` | Canonical article bundles, frontmatter, Chinese bodies, and shared media. |
| `src/content-locales/` | Same-route English article bodies and English-specific media. |
| `src/content/spec/about.md` | Public About page. |
| `src/config/` | Site identity, navigation, profile, content, comments, and appearance configuration. |
| `src/pages/`, `src/layouts/` | Astro routing and page structure. |
| `src/components/`, `src/styles/` | UI components and Packet & Path visual customization. |
| `docs/MAINTENANCE.md` | Editing, content, troubleshooting, and upstream synchronization procedures. |
| `docs/RELEASE_WORKFLOW.md` | Mandatory GitHub and production release workflow. |
| `docs/ISSUE_LOG.md` | Confirmed faults and regression checks. |
| `scripts/` | Build-time and maintenance utilities. |

## Version and Deployment Model

| Ref or target | Role | State on 2026-08-25 |
|---|---|---|
| `blog-version-01` | Local maintenance environment migrated from the previous computer | `eb145998…`, includes F5 article |
| `blog-version-02` | Online-aligned environment | local documentation-maintenance commit on top of the `eb145998…` site-source baseline; remote `6ef2389…` pending explicit push authorization |
| `master` | GitHub production-release baseline | `eb145998…` locally and remotely |
| `next-hop.tech` | Deployed production content and reconciliation authority | F5 article present |

Local branch alignment does not authorize a commit, GitHub push, or Cloudflare deployment. Follow [`docs/RELEASE_WORKFLOW.md`](docs/RELEASE_WORKFLOW.md) whenever external state is meant to change.

## Local Development and Validation

```powershell
pnpm install --frozen-lockfile
pnpm dev                  # http://127.0.0.1:5173/
pnpm check
pnpm type-check
pnpm build
pnpm exec wrangler --version
```

Verified on 2026-08-25:

- `pnpm install --frozen-lockfile`: installed 1,141 packages without changing `package.json` or `pnpm-lock.yaml`.
- `pnpm check`: 190 files, zero errors, warnings, or hints.
- `pnpm type-check`: passed.
- `pnpm build`: passed, generated 22 static pages and the F5 incident route.
- `pnpm exec wrangler deploy --dry-run`: passed with Wrangler 4.107.1 and read 456 built assets; no deployment occurred.
- Local production preview: `/`, `/posts/`, the F5 article, and `/rss.xml` all returned HTTP 200 and contained the F5 title marker.
- Local development server: `pnpm dev` started at `http://127.0.0.1:5173/`; the F5 article returned HTTP 200, and the server was then stopped cleanly.

The build still reports a non-fatal large-chunk advisory and Pagefind skips ten disabled feature stubs that have no outer `<html>` element. Neither warning blocked the production build or the four active preview checks.

## Git Remote Model

| Remote | URL | Purpose |
|---|---|---|
| `origin` | `https://github.com/huangzesheng0117/Firefly.git` | Personal source repository and production release source. |
| `upstream` | `https://github.com/CuteLeaf/Firefly.git` | Read-only framework source; never publish Packet & Path content here. |

## Known Follow-ups

1. Complete GitHub Credential Manager and Wrangler/Cloudflare CLI authentication before the next authorized release.
2. Push `blog-version-02` only when the user explicitly asks to synchronize GitHub; do not infer this from the completed local fast-forward.
3. Continue sanitizing all private case material before publication.
4. Keep release, image-source, maintenance, and incident documentation synchronized with future workflow changes.

## Security Rules

- Never publish raw production configurations, credentials, hashes, tokens, customer contacts, serial numbers, licenses, or unredacted topology screenshots.
- Use documentation-safe IP ranges and anonymized organization/device names in public articles.
- Store Cloudflare and GitHub credentials outside the repository.
- Treat `../Case/` as private source material; only sanitized derivatives belong in public content.
