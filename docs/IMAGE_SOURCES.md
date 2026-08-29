# Image sources

The professional visual assets used by the site are stored locally and optimized
as WebP files. The source pages were marked as free to use when downloaded.

| Local asset | Source | Photographer |
| --- | --- | --- |
| `src/assets/images/professional/network-operations.webp` | [IT technician working in a data center server room](https://www.pexels.com/photo/it-technician-working-in-data-center-server-room-37605911/) | panumas nikhomkhai |
| `src/assets/images/professional/optic-module.webp` | [Engineer working on a core switch](https://www.pexels.com/photo/engineer-fixing-core-swith-in-data-center-room-19226353/) | panumas nikhomkhai |
| `src/assets/images/professional/server-racks.webp` | [Server racks in a data center](https://www.pexels.com/photo/server-racks-on-data-center-5480781/) | Brett Sayles |
| `src/assets/images/professional/engineering-toolchain.webp` | Original AI-generated network automation workstation scene | OpenAI image generation |
| `src/content/posts/campus-office-network-deployment/cover-network-deployment.webp` | Original AI-generated campus wiring-closet deployment scene | OpenAI image generation |
| `src/content/posts/idc-edge-router-replacement/cover-edge-router.webp` | Original AI-generated redundant carrier-router commissioning scene | OpenAI image generation |
| `src/content/posts/f5-sh16-dns-force-offline-incident/cover-dns-incident.webp` | [Close-up of Ethernet cables connected to network equipment](https://www.pexels.com/photo/close-up-photo-of-ethernet-cables-on-network-switch-6466143/) | Sergei Starostin |
| `src/content/posts/cisco-c9500-svl-failover-incident/cover-svl-failover.webp` | Original AI-generated dual-switch StackWise Virtual failover and traffic-rerouting scene | OpenAI image generation |

License reference: [Pexels License](https://www.pexels.com/license/).

The four generated originals were created specifically for this site. Their prompts intentionally use different subjects, compositions, and lighting so they cannot be mistaken for one another or for the four Pexels-sourced assets. The untouched PNG originals remain in Codex generated-image storage; the repository contains optimized WebP derivatives.

All active mappings and the no-reuse verification process are documented in `docs/IMAGE_ASSET_GUIDELINES.md`.

## Incident article figures

The following inline figures belong exclusively to the bilingual F5 BIG-IP DNS incident retrospective. They are not used as homepage backgrounds or article covers.

| Local asset | Source | Creator / rights holder |
| --- | --- | --- |
| `src/content/posts/f5-sh16-dns-force-offline-incident/assets/grafana-response-ratio.png` | Sanitized Grafana export from the incident review | ZeSheng Huang |
| `src/content/posts/f5-sh16-dns-force-offline-incident/assets/simplified-architecture.png` | Sanitized topology redrawn for the incident review | ZeSheng Huang |
| `src/content/posts/f5-sh16-dns-force-offline-incident/assets/anycast-dns-architecture.png` | Sanitized Anycast DNS architecture redrawn for the incident review | ZeSheng Huang |
| `src/content/posts/f5-sh16-dns-force-offline-incident/assets/myf5-force-offline-big3d.png` | [F5 MyF5 article K15122](https://my.f5.com/manage/s/article/K15122), excerpted as supporting product documentation | F5, Inc. |
| `src/content/posts/f5-sh16-dns-force-offline-incident/assets/fault-mechanism.png` | Original failure-mechanism diagram created for the incident review | ZeSheng Huang |
| `src/content/posts/f5-sh16-dns-force-offline-incident/assets/investigation-path.png` | Original investigation-path diagram created for the incident review | ZeSheng Huang |

The English locale uses six PNG figures under `src/content-locales/f5-sh16-dns-force-offline-incident/assets/`. Five are English-localized versions of the corresponding sanitized incident-review figures; the already-English MyF5 excerpt is reused without content changes. The English article no longer depends on Mermaid replacements for these figures.
