# Image asset guidelines

## Non-reuse rule

Every active homepage background and every article cover must use its own visually distinct source image.

The following are not allowed:

- Reusing the same asset path in two homepage modules or articles.
- Copying the same binary image under a different filename.
- Using a crop, recolor, blur, or other light derivative of an image that is already active elsewhere on the site.

New article covers should reflect the subject of that specific article. New homepage backgrounds should reflect the function of their own module. When an image is replaced, update `docs/IMAGE_SOURCES.md` in the same commit.

## Current active mapping

| Surface | Asset |
| --- | --- |
| Homepage — Production Network Notes | `src/assets/images/professional/network-operations.webp` |
| Homepage — Article Archive | `src/assets/images/professional/server-racks.webp` |
| Homepage — Network Technology Stack | `src/assets/images/professional/optic-module.webp` |
| Homepage — Engineering Toolchain | `src/assets/images/professional/engineering-toolchain.webp` |
| Article — Campus Office Network Deployment | `src/content/posts/campus-office-network-deployment/cover-network-deployment.webp` |
| Article — IDC Edge Router Replacement | `src/content/posts/idc-edge-router-replacement/cover-edge-router.webp` |
| Article — F5 BIG-IP DNS Incident Retrospective | `src/content/posts/f5-sh16-dns-force-offline-incident/cover-dns-incident.webp` |
| Article — Cisco C9500 SVL Failover Incident | `src/content/posts/cisco-c9500-svl-failover-incident/cover-svl-failover.webp` |

## Pre-publish verification

1. Resolve every active homepage and article image from its component or frontmatter.
2. Compute SHA-256 for all active files and reject any duplicate hash.
3. Visually inspect the homepage and article list to confirm the subjects and compositions are also distinct.
4. Run the normal build and deployment checks in `docs/RELEASE_WORKFLOW.md`.
