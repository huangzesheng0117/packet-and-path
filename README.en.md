<div align="center">

# Packet & Path

**Network Engineering Field Notes**

[Website](https://next-hop.tech/) · [English](README.en.md) · [简体中文](README.md)

![Node.js >= 22](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=nodedotjs&logoColor=white)
![pnpm 9](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)
![Astro 7](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)

</div>

## About

Packet & Path is [ZeSheng Huang](https://github.com/huangzesheng0117)'s bilingual network engineering blog at [next-hop.tech](https://next-hop.tech/).

It documents sanitized network delivery projects, production incident investigations, architecture decisions, change controls, and automation work. Each article focuses on verifiable evidence, end-to-end data paths, risk boundaries, and reusable engineering lessons.

## Topics

- Enterprise campus networks, WANs, and carrier interconnection
- Data centers, Spine-Leaf, VXLAN EVPN, and ACI
- Firewalls, load balancing, DNS, and network security
- Production changes, migrations, and complex incident diagnosis
- Python, observability, and network automation

## Site features

- English-default interface with same-route Simplified Chinese switching
- Paired Chinese and English articles, metadata, and locale-specific assets
- Astro static generation with local full-text search powered by Pagefind
- Responsive homepage and reading experience for desktop and mobile
- Cloudflare Workers delivery for `next-hop.tech` and `www.next-hop.tech`

## Technology

- [Astro](https://astro.build/) 7
- [Svelte](https://svelte.dev/) 5
- TypeScript, Tailwind CSS, Biome, and Pagefind
- Cloudflare Workers
- Customized from [CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly), which is derived from [saicaca/fuwari](https://github.com/saicaca/fuwari)

## Local development

Requirements: Node.js 22 or newer and pnpm 9.

```powershell
git clone https://github.com/huangzesheng0117/packet-and-path.git
Set-Location -LiteralPath '.\packet-and-path'
pnpm install --frozen-lockfile
pnpm dev
```

The local development server runs at `http://127.0.0.1:5173/`.

Baseline validation before a commit:

```powershell
pnpm check
pnpm type-check
pnpm build
git diff --check
```

## Repository layout

| Path | Purpose |
|---|---|
| `src/content/posts/` | Chinese articles, shared frontmatter, and article assets |
| `src/content-locales/` | Same-route English bodies and locale-specific assets |
| `src/config/` | Site identity, navigation, profile, and feature configuration |
| `src/components/`, `src/styles/` | Page components and visual implementation |
| `docs/MAINTENANCE.md` | Local maintenance, content, and security guidance |
| `docs/RELEASE_WORKFLOW.md` | GitHub push and production release boundaries |

## Branch and release boundaries

- `master`: GitHub production-release baseline
- `blog-version-01`: local maintenance environment migrated from the previous computer
- `blog-version-02`: environment aligned with the current live content

> [!IMPORTANT]
> A GitHub push and a Cloudflare production deployment are separate operations. Updating this repository does not authorize a deployment to `next-hop.tech`; production releases must follow [`docs/RELEASE_WORKFLOW.md`](docs/RELEASE_WORKFLOW.md).

## Content safety

Public content must not expose customer identities, real production addressing, credentials, unsanitized topologies, or complete production configurations. Private case source material is not part of this repository; only sanitized and bilingual-reviewed derivatives may be published.

## Upstream and license

This site retains the upstream Firefly and Fuwari copyright notices and attribution. See [LICENSE](LICENSE) for the code license. Articles and third-party assets follow the notices on their respective pages or sources.
