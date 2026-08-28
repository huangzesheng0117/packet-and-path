<div align="center">

# Packet & Path

**Network Engineering Field Notes**

[访问网站](https://next-hop.tech/) · [English](README.en.md) · [简体中文](README.md)

![Node.js >= 22](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=nodedotjs&logoColor=white)
![pnpm 9](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)
![Astro 7](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)

</div>

## 项目简介

Packet & Path 是 [ZeSheng Huang](https://github.com/huangzesheng0117) 的双语网络工程技术博客，正式站点为 [next-hop.tech](https://next-hop.tech/)。

这里记录经过脱敏的网络建设项目、生产故障排查、架构决策、变更控制和自动化实践。文章强调可验证的证据、完整的数据路径、风险边界与可复用的工程经验。

## 内容方向

- 企业园区网、WAN 与运营商互联
- 数据中心、Spine-Leaf、VXLAN EVPN 与 ACI
- 防火墙、负载均衡、DNS 与网络安全
- 生产网络变更、迁移割接和复杂故障定位
- Python、监控可观测性与网络自动化

## 站点特性

- 英文为默认界面，同一路由支持简体中文切换
- 中英文文章、元数据和专用资源成对维护
- 基于 Astro 的静态生成与 Pagefind 本地全文搜索
- 面向桌面端和移动端的响应式首页与文章阅读体验
- 通过 Cloudflare Workers 提供 `next-hop.tech` 和 `www.next-hop.tech`

## 技术栈

- [Astro](https://astro.build/) 7
- [Svelte](https://svelte.dev/) 5
- TypeScript、Tailwind CSS、Biome、Pagefind
- Cloudflare Workers
- 基于 [CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly) 定制，Firefly 源自 [saicaca/fuwari](https://github.com/saicaca/fuwari)

## 本地开发

环境要求：Node.js 22 或更高版本、pnpm 9。

```powershell
git clone https://github.com/huangzesheng0117/packet-and-path.git
Set-Location -LiteralPath '.\packet-and-path'
pnpm install --frozen-lockfile
pnpm dev
```

本地开发服务器运行于 `http://127.0.0.1:5173/`。

提交前的基础验证：

```powershell
pnpm check
pnpm type-check
pnpm build
git diff --check
```

## 主要目录

| 路径 | 用途 |
|---|---|
| `src/content/posts/` | 中文文章、共享 Frontmatter 与文章资源 |
| `src/content-locales/` | 同路由英文正文与英文专用资源 |
| `src/config/` | 站点身份、导航、作者资料和功能配置 |
| `src/components/`、`src/styles/` | 页面组件和视觉实现 |
| `docs/MAINTENANCE.md` | 本地维护、内容与安全规范 |
| `docs/RELEASE_WORKFLOW.md` | GitHub 推送与生产发布边界 |

## 分支与发布边界

- `master`：GitHub 生产发布基线
- `blog-version-01`：从旧电脑迁入的本地维护环境
- `blog-version-02`：与当前线上内容对齐的版本环境

> [!IMPORTANT]
> GitHub 推送与 Cloudflare 生产部署是两项独立操作。更新仓库不代表授权部署 `next-hop.tech`；正式发布必须遵循 [`docs/RELEASE_WORKFLOW.md`](docs/RELEASE_WORKFLOW.md)。

## 内容安全

公开内容不得包含客户身份、真实生产地址、账号凭据、未脱敏拓扑或完整生产配置。私有案例原始资料不属于本仓库，只有经过脱敏并完成中英文核对的内容才能发布。

## 上游与许可

本站保留 Firefly 与 Fuwari 的上游版权和署名。代码许可见 [LICENSE](LICENSE)；文章及第三方资源遵循各自页面或来源声明。
