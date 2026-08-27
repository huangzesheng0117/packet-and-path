# 前端视觉实现与维护说明

本文记录 2026 年 7 月完成的博客前端改造，作为后续维护当前设计的主要入口。
生产版本基线为提交 `1c76605e1aefffa21f42c65c80dbb411fb70df5a`。

## 1. 设计目标与边界

当前界面以“专业 IT / 网络工程”为视觉方向：

- 使用数据中心、服务器机柜和网络设备图片，不使用二次元插画。
- 首页保持全屏视觉冲击，但只保留必要内容，不移植参考站的社交、动态、相册、
  留言、音乐、壁纸、Live2D、悬浮工具等功能。
- 主导航只保留“主页、文章、关于”三个入口；“文章”下保留文章列表、分类和归档。
- 保留现有 Firefly/Astro 的内容、路由、构建和 Cloudflare Workers 发布体系，
  没有整体替换主题或套用另一个仓库。
- 首页与内容页共享同一套专业字体和青蓝色视觉语言，但首页采用独立全屏结构。

后续修改时应先确认是否仍符合以上边界，不要因为上游 Firefly 增加新组件而自动把
它们重新显示出来。

## 2. 参考实现

本次改造核对了参考网站的实际页面和以下源码：

- `MmzMing/my-blog`
  - 首页标题排线思路参考 `src/components/layout/HomeHero.astro` 与
    `src/utils/hatch-effect.ts`。
  - “站点数据 / 能力矩阵”参考提交
    `8eb3be351e50ca6902c0c171b3e8c776d7487fc6` 中的
    `HomeDataLayer.astro`、`DataMetricCard.astro`、`LogoLoop.svelte`
    和 `home-data-layer.css`。
- `tianshihao2003/dumpling-theme`
  - 导航项尺寸和字重参考 `src/components/layout/DropdownMenu.astro` 中的
    `h-11`、`font-bold` 和 `px-5`。
  - 仓库默认字体配置并不等于线上站点最终配置；实际页面加载
    `AaZongYiYuan-2.woff2`。
- `fqzlr/Firefly`
  - 线上导航的实际计算字体为 `AaZongYiYuan`，参数为 `16px / 700`。
  - 居中导航结构参考 `src/components/layout/Navbar.astro`。

以上三个参考仓库均以 MIT License 发布。本项目只移植与需求直接相关的实现思路，
没有复制整站功能。

## 3. 关键文件

| 文件 | 职责 |
| --- | --- |
| `src/pages/[...page].astro` | 首页入口、全屏 Hero、背景图和艺术标题 |
| `src/components/layout/Navbar.astro` | 三项居中导航、文章下拉菜单和单椭圆结构 |
| `src/components/layout/HomeDataLayer.astro` | 站点数据、文章档案、基础设施和技能矩阵 |
| `src/styles/professional.css` | 首页、内容页、动画、字体和响应式规则 |
| `src/layouts/Layout.astro` | 全局专业样式导入和首屏导航字体预加载 |
| `src/pages/posts/index.astro` | 独立文章列表页及其专业页头 |
| `src/components/widget/SidebarTOC.astro` | 文章页左侧目录、双语章节文字和目录交互入口 |
| `src/utils/toc-utils.ts` | 当前章节判定、锚点跳转和目录状态管理 |
| `src/config/navBarConfig.ts` | 导航入口和文章子菜单 |
| `src/config/siteConfig.ts` | 亮色主题、页面宽度和分类导航等全局设置 |
| `src/config/backgroundWallpaper.ts` | 关闭旧主题壁纸与播放器 |
| `src/config/displaySettingsConfig.ts` | 关闭用户侧外观切换功能 |
| `src/config/musicConfig.ts` | 关闭导航栏和侧边栏音乐播放器 |
| `src/config/sidebarConfig.ts` | 关闭桌面和移动端侧边栏 |
| `src/assets/images/professional/` | 本地专业网络工程图片 |
| `public/assets/fonts/` | 完整字体和导航关键字体子集 |

## 4. 首页 Hero

首页不再使用 Firefly 原横幅结构，而是在 `src/pages/[...page].astro` 中直接构建：

1. `Picture` 加载 `network-operations.webp`，并生成 AVIF/WebP 响应式资源。
2. `home-hero__veil` 提供深色遮罩，确保文字对比度。
3. `home-hero__grid` 和 `home-hero__scanline` 提供轻量网格与扫描线。
4. 页面中央只显示 `siteConfig.title`，当前为 `Packet & Path`。
5. 标题按字符拆分并分配白色到青色的渐变色。

艺术标题使用永久 CSS 排线，不使用 WebGL 或脚本在加载后替换 DOM：

- `background-clip: text` 负责排线填充。
- `css-hatch-drift` 负责排线缓慢移动。
- `hero-camera` 负责背景的轻微镜头运动。
- `hero-scan` 负责扫描线运动。

这种实现解决了旧版本“刷新时短暂出现，随后消失”的问题。不要重新引入会在
客户端加载后覆盖标题节点的着色器或组件。

## 5. 导航栏

### 5.1 功能结构

导航配置位于 `src/config/navBarConfig.ts`：

- 主页：`/`
- 文章：
  - 文章列表：`/posts/`
  - 分类：`/categories/`
  - 归档：`/archive/`
- 关于：`/about/`

不要恢复 GitHub、动态、记录、网站导航或其他参考站入口，除非产品需求明确改变。

### 5.2 单椭圆结构

导航 DOM 必须维持以下三层：

```text
#navbar.network-navbar-shell        透明定位外壳
└── .network-navbar                唯一带背景和边框的椭圆卡片
    └── .network-nav-links         透明、无边框的链接容器
```

`#navbar` 仍需保留，因为原主题的布局和设置脚本会查询它。旧主题同时存在
`#navbar > div` 全局规则，因此：

- `.network-nav-links` 不能再次成为 `#navbar` 的直接子元素。
- 只能给 `.network-navbar` 设置白色背景、边框、阴影和 `border-radius: 999px`。
- `.network-nav-links` 必须保持透明、零边框、零阴影。
- `#navbar > .network-navbar` 的高优先级覆盖用于阻止旧主题规则生成矩形白框。

如果导航周围再次出现突出椭圆的白色长方形，首先检查以上 DOM 层级和
`src/styles/navbar.css` 中的 `#navbar > div`，不要用额外遮罩掩盖问题。

### 5.3 字体和首屏加载

导航与参考站保持 `AaZongYiYuan`、`16px`、`700`：

- 完整字体：`public/assets/fonts/AaZongYiYuan-2.woff2`。
- 首屏导航子集：`public/assets/fonts/AaZongYiYuan-nav.woff2`，约 2.1 KB。
- `Layout.astro` 在 `<head>` 最前部预加载导航子集。
- `professional.css` 使用 `font-display: block`，避免加载阶段先显示系统字体，
  再切换为目标字体。
- 导航字体栈先使用 `AaZongYiYuanNav`，缺字时再使用完整的
  `AaZongYiYuan`。

如果修改“主页、文章、关于”这些文字，必须重新生成子集，否则新增汉字会回退到
完整字体。项目已包含 `subset-font`，可在仓库根目录执行：

```powershell
node -e "const fs=require('fs');const subsetFont=require('subset-font');(async()=>{const input=fs.readFileSync('public/assets/fonts/AaZongYiYuan-2.woff2');const output=await subsetFont(input,'主页文章关于',{targetFormat:'woff2'});fs.writeFileSync('public/assets/fonts/AaZongYiYuan-nav.woff2',output)})()"
```

将命令中的文字替换为新的顶层导航文字，并同步检查 `Layout.astro` 中的预加载路径。

> `AaZongYiYuan` 不是随参考仓库 MIT License 一并开源的字体。生产站长期使用前
> 仍需确认字体的 Web 嵌入和再分发许可。

## 6. 站点数据与能力矩阵

`HomeDataLayer.astro` 负责首页 Hero 下方的白底数据区域：

- “站点访问”目前显示“待接入”，没有伪造访问量。
- “文章档案”在构建时读取非草稿文章，自动统计文章、分类和标签数量。
- “基础设施”循环展示 Cloudflare、GitHub、Spaceship DNS、Astro、Workers、
  Zero Trust。
- “技能图标”循环展示 Cisco、Linux、Python、Docker、Nginx、Git、
  Prometheus、Grafana、Cloudflare。
- 页脚统计 Markdown 中的中文字符和英文单词，显示本地内容字数。

基础设施和技能通过复制两组数据形成无缝循环；悬停时暂停。修改项目时应编辑组件
顶部的 `infrastructure` 或 `skills` 数组，不要直接复制 HTML。

访问量必须等真实统计服务接入后再替换“待接入”。不要将 Cloudflare 或第三方后台
中的敏感标识、Token 写入组件。

## 7. 内容页与文章列表

`professional.css` 同时调整了非首页：

- 中文正文和标题使用 `AaZongYiYuan` 与系统字体回退栈。
- 正文行高为 `1.92`，链接使用青蓝色。
- 文章卡片使用浅边框、白色表面和低强度阴影。
- 隐藏旧分类快捷栏。
- `src/pages/posts/index.astro` 提供独立文章列表入口和深色专业页头。

如果只修改文章排版，应优先调整
`body:not(.is-home) .custom-md` 及其标题规则，不要修改首页 Hero 字号。

### 7.1 文章左侧目录

文章页在宽度不小于 `112rem` 时，会把“目录 + 正文”作为一个整体居中：正文保持
原宽度并向右平移，左侧目录使用 `20rem` 至 `24rem` 的独立空间，因此不会压缩
封面、正文或页脚。长章节名在目录中自动换行并完整显示。目录从正文 `h2` 开始，
显示三级层次；滚动时仅高亮当前章节，点击后平滑滚动并更新 URL 锚点。空间不足及
打印时恢复正文居中并隐藏目录，避免覆盖正文。

中英文文章共用一组稳定的英文锚点。语言切换时，锚点只分配给当前可见语言的
标题节点，隐藏语言不保留重复 `id`；修改双语文章结构时必须继续保持两种语言的
标题数量和层级一致。

## 8. 已关闭或删除的旧主题功能

为满足“只保留主页、文章、关于”的要求，本次关闭或移除了：

- 横幅/全屏壁纸模式和背景视频播放器。
- 主题色、布局、卡片、壁纸、波纹、渐变、轮播和樱花切换。
- 导航栏和侧边栏音乐播放器。
- 桌面与移动端通用侧边栏；文章页左侧独立目录不属于这套旧侧边栏。
- Spine 模型与右侧悬浮控制按钮。
- 页脚 RSS 和 Sitemap 文本入口。
- 首页旧 Logo、“Packet & Path”图标卡片、说明文字、CTA 按钮和拓扑动图。

RSS 与 Sitemap 文件仍由构建流程生成，只是页脚不再显示入口。

## 9. 图片与授权

专业图片均下载到本地并由 Astro 生成响应式格式，避免依赖远程图片服务：

- `network-operations.webp`：首页“生产网络笔记”区域。
- `server-racks.webp`：首页“文章档案”区域。
- `optic-module.webp`：首页“网络技术栈”区域。
- `engineering-toolchain.webp`：首页“工程工具链”区域。
- `src/content/posts/campus-office-network-deployment/cover-network-deployment.webp`：园区办公网项目文章封面。
- `src/content/posts/idc-edge-router-replacement/cover-edge-router.webp`：IDC 路由器替换项目文章封面。

具体来源、摄影师、生成方式和 Pexels License 链接见 `docs/IMAGE_SOURCES.md`。替换图片时必须同步更新该文件，并保留来源和授权记录，同时遵守 `docs/IMAGE_ASSET_GUIDELINES.md` 中“首页背景与文章封面不得复用”的规则。

## 10. 响应式与无障碍

- `900px` 以下，能力矩阵由多列切换为单列。
- `640px` 以下，Hero 标题、矩阵间距和页脚改为移动端尺寸。
- `520px` 以下，导航高度、字号、间距和菜单宽度缩小。
- `prefers-reduced-motion: reduce` 时关闭背景、扫描线、排线和循环动画。
- Hero 装饰图使用空 `alt`；导航保留 `aria-label`、`aria-current` 和键盘焦点样式。

修改动画时必须同时维护 `prefers-reduced-motion` 分支。

## 11. 本地预览与开机启动

开发服务器固定监听：

```text
http://127.0.0.1:5173/
```

`package.json` 的 `dev` 和 `start` 均显式使用 `--host 127.0.0.1 --port 5173`。
Windows 计划任务 `PacketAndPathBlogDevServer` 在登录后调用
`scripts/start-blog-dev-server.ps1`；脚本会先检查端口，避免重复启动，并将日志写入：

```text
%LOCALAPPDATA%\PacketAndPathBlog\dev-server.log
```

如果重启后无法访问，依次检查计划任务状态、5173 端口和以上日志。

## 12. 修改后的验证清单

提交前至少执行：

```powershell
node --max-old-space-size=4096 node_modules/astro/bin/astro.mjs check
pnpm build
git diff --check
```

浏览器检查：

- 冷缓存首次打开时，导航不能先闪现系统字体。
- 导航计算样式应为 `16px / 700`，字体栈首项为 `AaZongYiYuanNav`。
- 导航只能看到一个椭圆背景，内层链接容器必须透明且没有边框。
- 首页艺术标题刷新后持续存在并保持动画。
- Hero 图片、能力矩阵图片和导航字体均返回 `200`。
- 桌面和移动端均没有横向溢出。
- 浏览器控制台没有字体、图片或脚本错误。

## 13. 发布链路

当前发布链路保持不变：

```text
本地修改
→ 提交并推送 origin/master
→ Cloudflare 自动构建
→ pnpm exec wrangler deploy
→ firefly Worker
→ https://next-hop.tech/ 与 https://www.next-hop.tech/
```

`wrangler.jsonc` 同时声明根域和 `www` 为 Custom Domain。不要只在 Cloudflare
控制台临时改域名而不更新配置。完整发布、故障排查和回滚流程见
`docs/MAINTENANCE.md`。
