# GitHub 提交与 next-hop.tech 生产发布流程

本文是 Packet & Path 项目提交 GitHub 和发布生产站点的唯一操作手册。今后的 Codex 任务只要包含“提交 GitHub”“推送远端”“发布现网”或“部署 next-hop.tech”，都必须先完整读取本文，再按顺序执行。

## 1. 固定对象

| 对象 | 固定值 | 用途 |
|---|---|---|
| 本地仓库 | `D:\Projects\Personal Blog\website` | 所有 Git、构建和 Wrangler 命令的工作目录 |
| GitHub 远端 | `origin` → `huangzesheng0117/packet-and-path` | 个人源代码仓库 |
| 上游远端 | `upstream` → `CuteLeaf/Firefly` | 只用于同步框架，不用于本站发布 |
| 生产分支 | `master` | GitHub 与生产发布基线 |
| 版本 01 | `blog-version-01` | 从旧电脑迁入的本地维护环境 |
| 版本 02 | `blog-version-02` | 与当前线上内容对齐的可读分支 |
| Cloudflare Worker | `firefly` | 托管 `dist/` 静态资产 |
| 正式域名 | `https://next-hop.tech/`、`https://www.next-hop.tech/` | 发布后必须同时验证 |

2026-08-25 内容对齐时，本地版本 01、版本 02 和 `master` 共同位于 `eb145998…`，并包含中英文 F5 BIG-IP DNS 故障复盘。此后仅本地文档维护提交可以使版本 02 的分支尖端超前，但不改变其与线上一致的站点源代码基线。`origin/blog-version-02` 仍位于 `6ef2389…`，因为本地快进或文档提交都不构成 GitHub 推送授权。以后是否继续保持一致，必须以用户当次发布要求和实际 Git 输出为准。

## 2. 发布授权边界

- “提交/推送 GitHub”只授权 Git 提交和远端推送，不自动授权生产部署。
- “发布现网”“部署 next-hop.tech”才授权执行 `wrangler deploy`。
- 普通直发使用本地 `git` 推送个人仓库，不需要 GitHub CLI、PR 或额外创建临时分支。
- 只有用户明确要求 Pull Request 时，才进入 `gh`/PR 流程。
- 不得把 `upstream` 当作发布目标。

## 3. 标准发布顺序

以下步骤必须按顺序执行。前一步失败时停止，不得带着未解释的失败继续生产部署。

### 3.1 确认工作区与改动范围

```powershell
git status -sb
git branch -vv
git remote -v
git diff --stat
git diff
git diff --check
```

检查要求：

- 明确当前分支、待发布文件和提交范围。
- 工作区出现无关改动时，不得执行 `git add -A` 或 `git add .`。
- 检查改动中没有 token、密码、客户信息、未脱敏配置或私有案例材料。
- `dist/` 等生成物不应因为一次普通构建被误加入提交。

### 3.2 确认远端与部署凭据

```powershell
git ls-remote --heads origin
pnpm exec wrangler --version
pnpm exec wrangler whoami
```

预期结果：

- `origin` 可访问。
- Wrangler 为项目依赖中的 v4 版本。
- `wrangler whoami` 显示已登录且具有 Workers 写入权限。

这一步不检查 `gh`。本站的常规直发不创建 PR，因此 GitHub CLI 不是发布前置条件。

### 3.3 执行发布前验证

```powershell
pnpm check
pnpm type-check
pnpm build
git diff --check
git status -sb
```

附加要求：

- UI 或滚动动画改动必须先在 `http://127.0.0.1:5173/` 完成桌面端和移动端检查。
- `pnpm build` 必须在所有待发布代码修改完成后执行，因为 Wrangler 上传的是当前 `dist/`。
- 构建产生警告时要区分既有警告与新问题；任何 error 都必须在发布前处理。
- 如果检查命令失败，只能在确认是已记录的既有基线问题后向用户说明，不得静默忽略。

### 3.4 精确暂存并提交

```powershell
git add <明确列出的文件>
git diff --cached --check
git diff --cached
git commit -m "<Conventional Commit 信息>"
git status -sb
```

提交前缀使用：`feat:`、`fix:`、`docs:`、`style:`、`refactor:` 或 `chore:`。

如果全部改动已经存在于本地提交中且工作区干净，不创建无意义的空提交，直接使用当前 `HEAD` 作为发布提交。

### 3.5 同步版本分支

先记录要发布的提交：

```powershell
$releaseCommit = git rev-parse HEAD
```

普通线上发布应让生产基线 `master` 与线上对齐分支 `blog-version-02` 指向发布提交。若当前就在 `blog-version-02`，只需移动 `master`：

```powershell
git branch -f master $releaseCommit
```

若发布提交在其他分支，并且已经确认 `blog-version-02` 可以安全快进，再同步版本 02。不得用 `-f` 掩盖非快进历史：

```powershell
git switch blog-version-02
git merge --ff-only $releaseCommit
git branch -f master $releaseCommit
```

只有用户明确要求本地版本 01 也保持完全一致时，才同步它：

```powershell
git branch -f blog-version-01 $releaseCommit
```

在发布总结中明确三个本地分支及远端分支是否一致。本地同步、GitHub 推送和 Cloudflare 部署是三项独立授权。

同步后核对：

```powershell
git rev-parse master
git rev-parse blog-version-01
git rev-parse blog-version-02
```

### 3.6 原子推送 GitHub

正常发布只推送生产基线与线上对齐分支：

```powershell
git push --atomic origin master blog-version-02
```

只有用户明确要求远端版本 01 也同步时，才推送三个分支：

```powershell
git push --atomic origin master blog-version-01 blog-version-02
```

推送后只核对本次实际推送的远端；三分支同步时示例为：

```powershell
git ls-remote --heads origin master blog-version-01 blog-version-02
```

只有远端哈希与预期发布提交一致，才能继续生产部署。不要向 `upstream` 推送。

### 3.7 Wrangler 预部署与正式部署

```powershell
pnpm exec wrangler deploy --dry-run
pnpm exec wrangler deploy
```

检查要求：

- `--dry-run` 必须成功并正确读取 `dist/`。
- 正式部署目标必须是 Worker `firefly`。
- 输出必须同时列出 `next-hop.tech` 与 `www.next-hop.tech` Custom Domain。
- 记录 Wrangler 返回的 `Current Version ID`。
- 一次成功的正式部署后不要重复运行第二次手工部署。

GitHub 的 `master` 更新可能同时触发 Cloudflare 自动构建。Codex 的标准流程仍以本次显式 Wrangler 部署返回的 Version ID 作为完成凭据，不再反复等待或猜测自动构建状态。

### 3.8 验证两个正式域名

使用提交哈希添加查询参数，绕过浏览器和边缘缓存：

```powershell
$releaseSha = git rev-parse --short HEAD
$siteUrls = @("https://next-hop.tech/", "https://www.next-hop.tech/")

foreach ($siteUrl in $siteUrls) {
	$response = Invoke-WebRequest -Uri "${siteUrl}?release=$releaseSha" -Headers @{"Cache-Control"="no-cache"} -UseBasicParsing
	if ($response.StatusCode -ne 200) {
		throw "$siteUrl returned HTTP $($response.StatusCode)"
	}
	$hasSiteIdentity = $response.Content -match "PACKET|Packet|现场笔记"
	if (-not $hasSiteIdentity) {
		throw "$siteUrl did not return the expected site content"
	}
	[pscustomobject]@{
		Url = $siteUrl
		Status = $response.StatusCode
		Bytes = $response.RawContentLength
		HasSiteIdentity = $hasSiteIdentity
	}
}
```

对于 UI 改动，还必须打开带缓存绕过参数的生产首页进行一次实际视觉检查。HTTP 200 只能证明服务可用，不能证明布局正确。

### 3.9 最终一致性检查

```powershell
git status -sb
git branch -vv
git log -1 --oneline --decorate
```

最终结果必须说明：

- GitHub 提交哈希。
- `master`、版本 01、版本 02 各自指向的提交，以及它们是否一致。
- Cloudflare Worker 名称和 Version ID。
- 两个正式域名的验证结果。
- 本地工作区是否干净、当前停留在哪个分支。

## 4. 故障与回滚

### GitHub 推送失败

- 不执行 Wrangler 正式部署。
- 检查 `origin`、网络和认证后重试。
- 非快进冲突必须先检查远端差异，禁止直接 `--force` 覆盖 `master`。

### Wrangler 预部署失败

- 不执行正式部署。
- 重新检查 `pnpm build`、`dist/`、`wrangler.jsonc` 和 `wrangler whoami`。

### Wrangler 已部署但生产验证失败

先查看可回滚版本：

```powershell
pnpm exec wrangler versions list
```

确认目标版本后回滚：

```powershell
pnpm exec wrangler rollback <VERSION_ID>
```

Git 历史使用 `git revert` 创建可追踪的回滚提交，再按本文重新验证和发布。禁止使用 `git reset --hard` 或强推删除已经公开的生产历史。

## 5. 发布完成报告模板

```text
GitHub：<commit URL / hash>
分支：master=<hash>，blog-version-01=<hash>，blog-version-02=<hash>
版本状态：01 与 02 一致 / 保持分离
Cloudflare：firefly，Version ID=<id>
生产验证：next-hop.tech=200，www.next-hop.tech=200
本地状态：工作区干净，当前分支=<branch>
```
