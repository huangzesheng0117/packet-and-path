---
title: "Cisco C9500 StackWise Virtual Failover Failure: Network-Wide Investigation and Remediation"
published: 2026-08-29
description: "An evidence-driven postmortem of a Cisco C9500 StackWise Virtual takeover failure, covering FED anomalies, CSCwd88554 TMPFS leakage, fleet-wide risk assessment, controlled reloads, and monitoring improvements."
image: "./cover-svl-failover.webp"
tags: [Cisco C9500, StackWise Virtual, IOS XE, High Availability, Memory Leak, Incident Response]
category: Incident Response
lang: en
draft: false
pinned: false
author: ZeSheng Huang
comment: false
---

## 00. 一次原本很普通的演练

5 月 30 日的维护窗口，最初的目标并不复杂。

站点 A 互联网核心交换机 `SITE-A-CORE-SVL` 是一组由两台 `C9500-16X` 组成的 StackWise Virtual 系统，运行 IOS XE `17.6.3`。在正常状态下，两台物理设备对外表现为一个逻辑系统：一台承担 Active，另一台处于 `STANDBY HOT`，业务链路通过 StackWise Virtual、MEC/Port-channel、SSO 等机制保持冗余。

这次维护希望验证一个最基本的高可用场景：

> 如果当前 Active 物理设备发生故障，Standby 能否正常接管；原 Active 重启后，是否可以重新加入并成为新的 Standby。

按照 Cisco StackWise Virtual 的正常机制，执行：

```text
redundancy force-switchover
```

预期过程应该是：

```text
Switch1 Active
    ↓ force-switchover
Switch2 Standby 接管 Active
    ↓
Switch1 按机制 reload
    ↓
Switch1 启动完成并重新加入
    ↓
Switch2 Active + Switch1 Standby
    ↓
SSO / STANDBY HOT 恢复
```

也就是说，**原 Active 在 `force-switchover` 后发生 reload 本身并不是故障，而是预期行为的一部分。**

真正的问题是：这一次，Standby 没有接住。这次演练从一个“验证高可用”的计划，变成了后续近一个月的排查、TAC 联合分析、现网横向扫描和分批修复工作的起点。

---



## 01. 备机异常重启



### 1.1. 重启前异常

后来回看日志时，一个时间点非常关键。最先出现的异常并不是 reload

在执行 `redundancy force-switchover` 之前约十几秒，原 Standby，也就是 slot2，已经出现了 FED / 平台相关 traceback。Cisco TAC 从 trace 中关注到的调用链涉及：

```text
fman_fp
doppler_l3_ucast
aobjman
```

这些组件并不是普通 CLI、SNMP 或用户态管理进程，而是与 Forwarding Engine Driver、平台对象管理以及硬件转发表编程相关的组件。

约 `06:52:35 BJT`，slot2 已经存在这类异常痕迹。

随后在 `06:52:52` 执行：

```text
redundancy force-switchover
```

slot1 作为原 Active 按照正常机制进入 reload。

如果只看到这里，很容易得出一个错误结论：

> “执行 force-switchover 把 Active 重启了，所以堆叠才故障。”

但这不是事件的真正异常点。

`force-switchover` 本来就会让原 Active reload。真正异常的是：**原 Standby slot2 没有稳定接管 Active。**



### 1.2. 重启时异常

在切换后的几秒内，slot2 出现：

```text
TMPFS value 41% above warning level 40%
```

与此同时，在 `crashinfo-2` 和 `flash-2:/core` 中生成了多份异常文件，涉及：

```text
stack_mgr
fman_rp
fman_fp_image
pubd
service_mgr
iosd_ngwc
```

这让事件第一次出现了两个看似不同的方向：

1. FED / 平台转发编程异常；
2. Standby Linux 平台的 TMPFS / 内存资源异常。

当时还无法判断二者哪个才是主因，但可以确认一点：**Standby 在接管 Active 的关键窗口里，本身并不是一个完全健康的节点。**



### 1.3. 重启后状态

slot1 在 reload 后正常启动：

- `06:58:49~06:58:53`：slot1 开始重新加入、系统服务恢复；
- `06:59:08`：日志确认 reload 耗时约 376 秒；
- `06:59:22`：管理面恢复，可以 SSH 登录；
- `06:59:50~06:59:57`：slot1 本地物理接口、Po10/20/30/40/101/102 等链路逐步恢复；
- `06:59:58~07:00:29`：VLAN、BFD、Track/IP SLA 等三层与可达性状态恢复。

业务先依赖 slot1 单机恢复了起来。

但此时查看 HA 状态却发现：

```text
slot1 Active Ready
slot2 Member / Provisioned

Hardware Mode = Simplex
Operating Redundancy Mode = Non-redundant
Communications = Down
```

这意味着整个 SVL 系统已经退化成了：

```text
Switch1 单机 Active
Switch2 未正常加入
没有 Standby
```

这才是本次演练真正危险的阶段。原本是为了验证“单机故障不会影响整体”，结果反而证明：**一旦需要 Standby 真正承担 Active 接管，它可能在最关键的时刻失效。**



### 1.4. 后续措施

约 `07:29`，slot2 经人工恢复/重新上电后开始重新加入：

```text
Switch 2 has been added to the stack
```

之后：

- `07:34:24`：DAD 链路恢复；
- `07:34:31~07:34:37`：SVL 恢复；
- `07:36:41`：slot2 被选举为 Standby；
- `07:37:47`：到达 SSO terminal state；
- `07:37:49~07:37:54`：slot2 侧业务接口重新恢复。

最终系统回到：

```text
Switch1 Active Ready
Switch2 Standby Ready
Operating Redundancy Mode = sso
Communications = Up
Standby = STANDBY HOT
```

业务恢复了，但一个问题被留下：

> 为什么一个在倒换前明明显示 `STANDBY HOT` 的节点，在真正接管 Active 时却没有接住？

这成为第二阶段排查的核心问题。

---



## 02. 问题分析



### 2.1. 命令分析

第一轮讨论最容易怀疑的是：

```text
redundancy force-switchover
```

是不是不应该用于这种场景？但从机制和 TAC 的判断看，这个方向很快被排除。`force-switchover` 的正常动作就是：

```text
Standby 接管 Active
原 Active reload
```

所以原 Active slot1 reload 是正常动作。真正需要解释的是：

```text
为什么 slot2 在接管过程中失效？
```

从这一刻起，调查对象从“命令是否正确”变成了“Standby 在切换前是否真的健康”。



### 2.2. FED error

TAC 对 traceback 的分析显示，slot2 存在 FED / 平台相关异常。FED 可以理解为 IOS XE 控制面与转发硬件之间非常重要的一层。它涉及：

- 转发引擎驱动；
- ASIC/硬件表项编程；
- 接口、VLAN、邻接、FIB 等状态向硬件同步；
- 平台管理组件之间的内部通信。

本次涉及的 `fman_fp / doppler_l3_ucast / aobjman` 并不像普通业务配置错误。TAC 对这类 FED error 的描述更接近一种**罕见的瞬时平台/硬件编程异常**：

- 正常情况下不应该频繁出现；
- 单次出现往往可以通过 reload 恢复；
- 如果短时间反复出现，则需要进一步考虑硬件风险。

因此，FED error 和“Standby 无法稳定接管 Active”在技术链路上存在非常直接的关联。



### 2.3. CSCwd88554

另一条线索来自 TMPFS。TAC 进一步确认，当前 `C9500-16X + StackWise Virtual + IOS XE 17.6.3` 场景存在已知问题 `CSCwd88554`。

其表现并不是传统意义上的 IOS Processor Pool 内存耗尽，而是 Standby 节点 Linux 平台的：

```text
/dev/shm
TMPFS
```

使用率持续增长。

随着运行时间变长，应用不断在 `/dev/shm` 中创建对象，tmpfs 使用量逐渐增加，并进一步抬高整个 Linux control-processor 的 Used Memory。本次故障组虽然当时只有：

```text
TMPFS 41%
```

并没有达到 50% critical，但已经越过 warning 40%。TAC 的意见是，这说明 Standby 已经存在资源泄漏风险，不能再把它当成一个完全健康的备用节点。

这个 Bug 的短期规避方式非常直接：

```text
reload standby
```

因为 reload 可以清空泄漏状态。长期解决则是升级到 Cisco 推荐的软件版本。



### 2.4. 命令的局限性

后续排查另外一组设备时，我们曾经产生过一个明显的困惑。设备日志不断报：

```text
Used Memory value 87% exceeds warning level 85%
```

但执行最常规的：

```text
show memory
```

看到的却是：

```text
Processor Total 约 1.35 GB
Used 约 350 MB
Free 约 998 MB
```

手工计算只有约 26%。一开始看起来像是日志误报。后来才确认，这两个命令根本不是同一个统计口径。

#### `show memory`

主要展示传统 IOS/IOSd 内部的 Processor Pool：

```text
IOS XE Linux
└── IOSd
    └── Processor Pool   ← show memory 主要看这里
```

#### `show platform software status control-processor brief`

展示的是 IOS XE Linux 控制平面的整体资源：

```text
IOS XE Linux control-plane
├── kernel
├── IOSd
├── FED / fman
├── smand
├── sessmgrd
├── dbm
├── shared memory
├── tmpfs / /dev/shm
└── 其它平台进程
```

因此完全可能同时出现：

```text
show memory                         → 26%
show platform ... control-processor → 87%
```

而二者都没有错。

这也是整个排查过程中非常重要的一次视角变化：

> 对 IOS XE 平台，尤其是 C9500 SVL，不能用传统 `show memory` 一条命令判断整个控制平面的内存健康度。



### 2.5. 原因归纳

TAC 最终倾向于：

```text
FED / 平台异常
    +
Standby TMPFS / Linux 内存泄漏
    +
17.6.3 老版本的潜在软件风险
    ↓
Standby 在 Active 接管窗口失效
```

但我们没有把它简单写成：

```text
“就是内存泄漏导致的”
```

因为 TMPFS 只有 41%，而 FED traceback 与 core/crashinfo 对“接管失败”的解释更加直接。后续另外三组设备的现网表现，进一步强化了这个判断。

---



## 03. 其它设备分析

最初的问题只发生在站点 A 的一组互联网核心设备上。但当 `CSCwd88554` 被确认以后，一个更现实的问题出现了：

> 现网还有没有同型号、同版本、同样使用 StackWise Virtual 的设备？它们是不是也在悄悄积累同样的泄漏？

现网总共有四组同类型 SVL，共八台物理交换机。第一组已经在 5 月 30 日演练中暴露问题，剩余三组分别是：

```text
SITE-A-EDGE-SVL
SITE-B-CORE-SVL
SITE-B-EDGE-SVL
```

于是排查从“解释一次故障”变成了“检查整个同版本设备群”。



### 3.1. 日志分析

设备侧最有价值的日志是：

```text
%PLATFORM-4-ELEMENT_WARNING:
Used Memory value XX% exceeds warning level 85%

%PLATFORM-3-ELEMENT_TMPFS_WARNING:
TMPFS value XX% above warning level 40%
```

达到更高阈值以后则会出现：

```text
Used Memory > 90% critical
TMPFS > 50% critical
```

通过 Kibana 回溯历史日志后，可以看到站点 B 两组设备的泄漏不是突然发生，而是一个非常典型的**缓慢、持续、阶梯式增长过程**。



#### SITE-B-CORE-SVL

异常对象是：

```text
Switch2 / 2-RP0
```

Used Memory 变化大致为：

| 时间 | Used Memory |
|---|---:|
| 5 月 18 日 | 86% |
| 5 月 27~28 日 | 87% |
| 6 月 6 日 | 88% |

TMPFS 则更早已经开始增长：

| 时间 | TMPFS |
|---|---:|
| 3 月 10 日 | 43% |
| 3 月 22~23 日 | 44% |
| 4 月 10~11 日 | 45% |
| 4 月 23 日 | 46% |
| 5 月 3~4 日 | 47% |
| 5 月 16 日 | 48% |
| 5 月 25~26 日 | 49% |
| 6 月 5 日 | 50% |

这条曲线几乎就是一个缓慢泄漏的模板：

```text
43 → 44 → 45 → 46 → 47 → 48 → 49 → 50%
```



#### SITE-B-EDGE-SVL

异常对象是：

```text
Switch1 / 1-RP0
```

这组增长更早，也更严重。

Used Memory：

| 时间 | Used Memory |
|---|---:|
| 4 月 7 日 | 86% |
| 4 月 19 日 | 87% |
| 4 月 28 日 | 88% |
| 5 月 7~8 日 | 89% |
| 5 月 19 日 | 90% Critical |
| 5 月 28~29 日 | 91% |
| 6 月 7 日 | 92% |

TMPFS：

| 时间 | TMPFS |
|---|---:|
| 3 月 10 日 | 46% |
| 3 月 20 日 | 47% |
| 3 月 29~30 日 | 48% |
| 4 月 9~10 日 | 49% |
| 4 月 21 日 | 50% Critical |
| 5 月 1 日 | 51% |
| 5 月 11~12 日 | 52% |
| 5 月 23 日 | 53% |
| 6 月 2 日 | 54% |

到修复前，它已经不再是“潜在风险”，而是控制平面长期处于 Critical。



#### SITE-A-EDGE-SVL

SITE-A-EDGE-SVL 的异常对象同样是 Switch2：

```text
2-RP0 Used Memory ≈ 86%
TMPFS ≈ 48%
```

后续告警还开始直接给出 Top memory allocators：

```text
Process: fed_main_event_fp_0
Process: install_mgr_rp_0
Process: sessmgrd_rp_0
```

其中最值得关注的是：

```text
fed_main_event_fp_0
```

它说明 FED 相关进程是当前主要内存分配来源之一。但这组设备与站点 B 的另外两组设备有一个非常重要的区别：

```text
Switch2 = Active，而且高内存
Switch1 = Standby，而且低内存
```

更重要的是，Switch2 并不是“理论上可能成为 Active”。它之前已经通过一次真实的：

```text
redundancy force-switchover
```

成功从 Standby 接管过 Active，并持续稳定承担 Active 角色。这个事实帮助我们修正了对 5 月 30 日故障原因的理解：

> 高内存/TMPFS 泄漏并不是“Standby 必然无法接管 Active”的充分条件。

因此，最初那组故障里，FED / 平台异常更像是直接触发接管失败的因素；内存/TMPFS 泄漏更像是降低 Standby 健康度、放大风险的背景因素。



### 3.2. 风险分析

这个阶段我们对三组设备做过两套不同的风险排序。如果只看“我要执行什么命令”，那么：

```text
force-switchover
```

一定比：

```text
reload standby peer
```

动作更大，因为它涉及 Active 角色切换。

但是如果从“不做任何操作、继续运行”的 HA 风险看，排序恰恰不同。

#### SITE-A-EDGE-SVL

```text
高内存 Switch2 = 当前 Active
低内存 Switch1 = 当前 Standby
```

风险是：Active 本身存在泄漏。

但它有两个相对有利的条件：

1. 高内存 Switch2 已经实际证明自己能够承担 Active；
2. 低内存 Switch1 近期经历过 reload，资源状态干净，作为接管方的健康度预期更好。

所以即使 Switch2 因内存问题意外 reload，Switch1 成功接管的概率相对更可控。

#### 站点 B 的两组设备

站点 B 的两组设备恰好相反：

```text
低内存 Switch = Active
高内存 Switch = Standby
```

表面上看，当前业务运行更稳定。但一旦低内存 Active 意外故障，系统必须依赖高内存 Standby 接管。而“这个高内存 Standby 能不能真正接住 Active”恰恰是未知数。

这和 5 月 30 日第一次故障的风险路径高度相似。因此，从运行态 HA 风险看，我们最终形成了：

```text
SITE-B-EDGE-SVL
    >
SITE-B-CORE-SVL
    >
SITE-A-EDGE-SVL
```

其中 SITE-B-EDGE-SVL 风险最高，因为其 Standby 已经达到：

```text
Used Memory 91~92%
TMPFS 54%
Critical
```



### 3.3. FED 风险

仅确认内存泄漏还不够，因为最初故障中还有 FED error。于是对三组剩余设备进一步检查：

```text
show logging
show platform software trace message fed switch 1
show platform software trace message fed switch 2
show platform software fed switch active fss counters
show platform software fed switch standby fss counters
show platform software fed ... latency
show platform software fed ... seqerr
dir crashinfo-1:
dir crashinfo-2:
dir flash-1:/core/
dir flash-2:/core/
```

得到的结果并不是“三组都存在严重 FED 故障”，而是不同层级的风险：

- `SITE-B-CORE-SVL`：FED trace 相对更活跃，能看到 `l3_fib`、`l3_pbr` 等 ERR，但没有新的严重 traceback/core，FSS latency/seqerr 也没有持续增长；
- `SITE-A-EDGE-SVL`：存在历史 FMAN/FED traceback，近期也出现过 `punt: Error retrieving table_id`，同时内存告警的 top allocator 指向 `fed_main_event_fp_0`，但修复前没有新的严重 FED crash/core；
- `SITE-B-EDGE-SVL`：近期 FED 强证据相对少，真正最突出的问题是 Standby 已经 Memory/TMPFS Critical。

于是处理策略不再是“一刀切”。



## 04. 监控盲区

当我们开始反查监控时，又发现一个此前长期存在的盲点。Prometheus 使用的是：

```text
cseSysMemoryUtilization{ip=~"$ip"}
```

这类指标更偏向当前 Active supervisor 的内存视角。但本次最危险的场景恰恰经常发生在：

```text
Active 正常
Standby Linux 内存持续泄漏
```

所以监控可能长期显示 Active 内存正常，而真正承担灾备接管职责的 Standby 已经从 85%、90% 一路增长到 Critical。

这次事件之后，内存监控的思路发生了变化：

```text
不能只监控逻辑设备的一个“整体内存值”

而要监控：
Switch1 / RP0
Switch2 / RP0
Active
Standby
TMPFS / /dev/shm
系统日志 warning/critical
```

同时，设备自身的：

```text
show platform software status control-processor brief
show platform software mount switch active R0
show platform software mount switch standby R0
```

成为比 `show memory` 更重要的健康检查命令。



## 05. 处置逻辑

经过前面的排查，三组设备虽然命中了同一个大方向的问题，但角色位置不同，所以不能用同一种命令处理。核心原则被整理成了两条：

#### 异常节点是 Standby

目标是：

```text
保持健康 Active 不动
只 reload 高内存 Standby
```

首选：

```text
redundancy reload peer
```

#### 异常节点是 Active

目标是：

```text
让健康 Standby 接管 Active
同时让高内存原 Active reload
```

使用：

```text
redundancy force-switchover
```

于是三组设备的计划变成：

| 设备 | 异常节点 | 异常节点当前角色 | 修复策略 |
|---|---|---|---|
| SITE-B-EDGE-SVL | Switch1 | Standby | reload Standby |
| SITE-B-CORE-SVL | Switch2 | Standby | `redundancy reload peer` |
| SITE-A-EDGE-SVL | Switch2 | Active | `redundancy force-switchover` |



但真正执行时，又出现了一次新的意外。在我们对 SITE-B-EDGE-SVL 进行重启操作时，**本想先隔离流量，却意外触发了 Standby 重启。**



## 06. 第二次意外



### 6.1. 隔离流量原因

最开始我们并不想直接让设备 reload。考虑到 Standby reload 时其所有本地业务口都会同时消失，曾经设想先手工关闭待重启 Switch 上的业务链路，让流量提前转移到另一台设备：

```text
先 shutdown 上下行物理口
    ↓
确认流量已经切到健康侧
    ↓
再 reload Standby
    ↓
Standby 回来并验证健康
    ↓
再逐步 no shutdown 回切
```

从运维流程上看，这个方案非常直观：它把一次整体 reload 拆成多个可观察步骤。于是对 `SITE-B-EDGE-SVL` 的高内存 Standby Switch1，先关闭了部分接口。

上行：

```text
interface TenGigabitEthernet1/0/1
 shutdown
interface TenGigabitEthernet1/0/2
 shutdown
```

随后又关闭下行：

```text
interface TenGigabitEthernet1/1/1
 shutdown
interface TenGigabitEthernet1/1/2
 shutdown
```



### 6.2. 意外发生

就在接口状态变更窗口内，Switch1 突然从堆叠中消失。Active Switch2 记录：

```text
Jun 19 22:00:48
%REDUNDANCY-3-STANDBY_LOST: PEER_NOT_PRESENT
%REDUNDANCY-3-STANDBY_LOST: PEER_DOWN
%NIF_MGR-6-STACK_LINK_DOWN
%STACKMGR-4-SWITCH_REMOVED: Switch 1 has been removed from the stack
```

随后：

```text
%RF-5-RF_RELOAD: Peer reload. Reason: EHSA standby down
```

但这不是人为执行的 `redundancy reload peer`。真正的 reload reason 在 Switch1 恢复以后非常明确：

```text
Last reload reason : Critical software exception
```

同时生成：

```text
SITE-B-EDGE-SVL_crashinfo_1_RP_00_00_20260619-220048-BJT
SITE-B-EDGE-SVL_1_RP_0-system-report_1_20260619-220109-BJT.tar.gz
```



### 6.3. FED trace

更关键的是 FED trace。由于 FED trace 使用 UTC，`14:00:48` 对应 BJT `22:00:48`。

同一秒出现：

```text
Port unbundle ... TenGigabitEthernet1/1/2
fed_ifm_avl_insert le not available ... if_id ... 1a

Port unbundle ... TenGigabitEthernet1/1/1
fed_ifm_avl_insert le not available ... if_id ... 19
```

随后恢复过程中又出现：

```text
Set STP state, Retrieve BD handle failed
IFM get LE failed
Failed to find handle
SISF failed to determine vlan from interface
IPSG failed to determine vlan from interface
```

这些并不能证明“shutdown 命令本身有问题”。正常设备当然应该允许 shutdown 普通业务接口。但它证明了一件对后续操作非常重要的事情：

> 在这个已经存在 Linux 内存/TMPFS 泄漏、又运行 17.6.3 的节点上，额外制造大量接口 unbundle、STP/VLAN/FED 重新编程，并不一定是在降低风险。

这次 Switch1 反而在计划中的 `redundancy reload peer` 之前，通过 Critical software exception 自己 reload 了。



### 6.4. 内存状态

Switch1 重启后约几分钟重新加入：

- `22:05:20`：SVL 相关链路恢复；
- `22:05:25`：Switch1 被重新加入；
- `22:07:30`：Switch1 被选举为 Standby；
- 后续恢复到 `STANDBY HOT`。

内存也从原来的 Critical 降到：

```text
1-RP0 Healthy 23~25%
2-RP0 Healthy 28%
```

因此原计划中的“再执行一次 reload Standby”已经没有意义。操作转而变成：

1. 确认 SSO / Communications Up；
2. 确认 Switch1 已回到 Standby Hot；
3. 确认内存/TMPFS 已恢复；
4. 一一恢复之前 shutdown 的接口；
5. 检查 Po101/Po102、LACP、业务流量和错误计数；
6. 最终恢复双边承载。

最终状态：

```text
Switch1 Standby Ready
Switch2 Active Ready
Operating Redundancy Mode = sso
Communications = Up
Standby = STANDBY HOT

1-RP0 Memory ≈ 25%
2-RP0 Memory ≈ 28%

Po101(SU) Te1/1/1(P) Te2/1/1(P)
Po102(SU) Te1/1/2(P) Te2/1/2(P)
```

这次意外改变了后续所有操作的思路。

---



## 07. 站点 B 的另一组设备

SITE-B-CORE-SVL 的情况更适合标准的 Standby reload：

```text
Switch1 = Active，低内存
Switch2 = Standby，高内存
```

在操作前，Switch2 已经出现：

```text
Used Memory 约 89%
TMPFS 51% Critical
```

这一次的目标非常明确：

> 不让高内存 Switch2 接管 Active，只把它作为 Standby 单独重启。

因此使用：

```text
redundancy reload peer
```

设备在执行时提示：

```text
Stack is in Half ring setup; Reloading a switch might cause stack split
Reload peer [confirm]
Preparing to reload peer
```

`22:35:05`：

```text
%RF-5-RF_RELOAD: Peer reload. Reason: Admin reload CLI
```

随后 Switch2 从堆叠中退出，Active Switch1 始终保持 Active。这段时间系统会临时表现为：

```text
Operating Redundancy Mode = Non-redundant
Communications = Down
```

这是 Standby 正在重启时的预期中间状态，不代表 Active 发生了角色切换。约四分钟后，SVL 端口重新进入 Ready，Switch2 重新加入并恢复：

```text
Switch1 Active Ready
Switch2 Standby Ready
Operating Redundancy Mode = sso
Communications = Up
Standby = STANDBY HOT
```

内存从接近 90% 降到：

```text
1-RP0 Healthy ≈ 28%
2-RP0 Healthy ≈ 25~26%
```

这次操作真正验证了：

> 对“高内存节点位于 Standby”的场景，`redundancy reload peer` 可以在不强制高内存节点接管 Active 的情况下清除泄漏状态。

之后再逐步恢复流量，最终 Po101/Po102、LACP、接口与业务监控均恢复正常。

---



## 08. 操作策略修正

站点 B 的两次实际操作给出了两个不同的结果：

#### 结果一

`SITE-B-EDGE-SVL`：

```text
手工 shutdown / unbundle
    ↓
FED/IFM 状态变化
    ↓
Standby Critical software exception
    ↓
异常 reload
```

#### 结果二

`SITE-B-CORE-SVL`：

```text
redundancy reload peer
    ↓
Standby 正常离开
    ↓
Active 保持运行
    ↓
Standby 正常重启并回来
```

因此之前“先通过关闭业务接口预隔离流量，再 reload”的思路不再作为默认推荐方案。原因不是关闭接口本身不合法，而是：

> 对一个已知平台资源异常的 C9500，增加额外接口配置变更、Port-channel unbundle、STP/VLAN/FED 重编程，意味着增加新的平台状态变化和新的触发点。

从此后的站点 A 操作开始，原则变成：

```text
如果 HA 状态健康、Standby 已验证可接管
就尽量减少额外操作
直接使用符合目标的 HA 命令
```

---



## 09. 站点 A 重启修复

到 6 月下旬时，只剩下 `SITE-A-EDGE-SVL` 尚未处理。它的角色关系与站点 B 的两组设备完全不同：

```text
Switch1 = Standby，低内存
Switch2 = Active，高内存
```

修复前：

```text
1-RP0 Healthy ≈ 27%
2-RP0 Warning ≈ 86%
TMPFS ≈ 48%
```

日志中还开始出现：

```text
Top memory allocators are:
Process: fed_main_event_fp_0
Process: install_mgr_rp_0
Process: sessmgrd_rp_0
```

因此高内存 Active 不能继续长期放任运行。但如果直接：

```text
redundancy reload peer
```

重启的会是当前 Standby Switch1，而不是故障节点 Switch2，显然不符合目标。

如果直接：

```text
reload slot 2
```

虽然能够重启 Switch2，但它是当前 Active，会把角色接管留给设备在非计划 Active 消失时自行处理，不如 SSO 受控倒换清晰。所以最终选择：

```text
copy running-config startup-config
redundancy force-switchover
```

而且吸取站点 B 的经验，**不再提前 shutdown Switch2 的业务接口。**



### 9.1. 操作前提

执行前，我们已经确认：

```text
Switch1 Standby Ready
Current Software state = STANDBY HOT
Operating Redundancy Mode = sso
Communications = Up
SVL / DAD 正常
Switch1 Memory ≈ 27%
```

同时没有发现新的严重 FED traceback/core。

此外，站点 A 这组还有一个对风险评估非常有利的事实：

- 高内存 Switch2 已经实际承载 Active 一段时间；
- 低内存 Switch1 近期经历过 reload，资源状态相对干净。

这意味着这次目标非常明确：

```text
让更健康的 Switch1 主动接管 Active
让高内存 Switch2 按 force-switchover 机制 reload
```



### 9.2. 正式操作

实际执行：

```text
SITE-A-EDGE-SVL#copy running-config startup-config
[OK]

SITE-A-EDGE-SVL#redundancy force-switchover
Proceed with switchover to standby RP? [confirm]
Manual Swact = enabled
```

`02:14:03`，日志明确显示：

```text
%PLATFORM-6-HASTATUS_DETAIL: RP switchover, received chassis event became active
%HA-6-SWITCHOVER: Route Processor switched from standby to being active
```

Switch1 从 Standby 接管 Active。同时原 Active Switch2 被从系统中移除并开始 reload：

```text
%STACKMGR-4-SWITCH_REMOVED: Switch 2 has been removed from the stack
%HMANRP-5-CHASSIS_DOWN_EVENT: Chassis 2 gone DOWN
```

Switch1 本地的 Te1/0/1、Te1/0/2、Te1/1/1、Te1/1/2、Po101、Po102 几乎立即进入 up，流量开始由 Switch1 单边承担。

在 Switch2 reload 期间，系统短时间出现：

```text
Hardware Mode = Simplex
Operating Redundancy Mode = Non-redundant
Communications = Down
```

这是这次受控倒换中预期存在的过渡阶段。



### 9.3. 操作结果

与 5 月 30 日的第一次故障不同，这一次 Switch1 没有在接管过程中出现失效。

Switch2 重启后，SVL 连接重新进入 Ready。`02:18:09~02:18:10`，两侧相关前端 Stack Link 端口从 Pending 进入 Ready。

最终检查显示：

```text
Switch1 Active Ready
Switch2 Standby Ready

Operating Redundancy Mode = sso
Communications = Up
Standby = STANDBY HOT
```

更重要的是，高内存状态被彻底清除：

```text
1-RP0 Healthy 27%
2-RP0 Healthy 25%
```

Active 侧 `/dev/shm` 也回到低位，例如：

```text
/dev/shm ≈ 7%
```

业务聚合恢复：

```text
Po101(SU) Te1/1/1(P) Te2/1/1(P)
Po102(SU) Te1/1/2(P) Te2/1/2(P)
```

到这里，剩余三组设备的内存泄漏修复全部完成。

---



## 10. 故障复盘

整个过程最有价值的地方，并不是最后找到了一个 Bug ID，也不是掌握了几个 reload 命令。真正有价值的是，几次判断在证据不断增加以后被逐步修正。

### 10.1. 修正一

**原 Active reload 不等于倒换失败**。最初：

```text
force-switchover
↓
Switch1 reload
↓
是不是命令把设备弄坏了？
```

修正后：

```text
原 Active reload 是机制预期
真正异常是 Standby 没接住
```

### 10.2. 修正二

**STANDBY HOT 不等于绝对健康**。切换前：

```text
Standby = STANDBY HOT
```

这只能证明它满足当前 SSO 状态条件。它并不能证明：

```text
Linux 内存健康
TMPFS 无泄漏
FED 无异常
接管过程中硬件编程一定成功
```

因此之后所有倒换前检查都增加了：

```text
show platform software status control-processor brief
show platform software mount switch active R0
show platform software mount switch standby R0
FED trace
crashinfo/core
SVL/DAD
```

### 10.3. 修正三

**高内存不是“接管失败”的充分条件**。后来 SITE-A-EDGE-SVL 的高内存 Switch2 实际稳定承担 Active，说明：

```text
高内存 ≠ 一定不能当 Active
```

因此 5 月 30 日故障不能简单归因于：

```text
“Standby 内存高，所以接管失败”
```

更合理的理解是：

```text
FED / 平台异常是更直接的失败因素
TMPFS/内存泄漏降低节点健康度并放大风险
```

### 10.4. 修正四

**运行风险与变更风险需要分开评估**。如果只看命令：

```text
force-switchover 风险 > reload peer
```

但如果看当前运行态 HA：

```text
低内存 Active + 高内存 Standby
```

可能比：

```text
高内存 Active + 健康 Standby
```

更加危险。因为真正发生 Active 非计划故障时，前者必须依赖一个未知健康度的高内存 Standby 接管。

这也是为什么当时的运行风险排序是：

```text
SITE-B-EDGE-SVL
>
SITE-B-CORE-SVL
>
SITE-A-EDGE-SVL
```

### 10.5. 修正五

**提前 shutdown 流量并不天然更安全**。最初的运维直觉是：

```text
先手工迁流量
再重启
会更可控
```

SITE-B-EDGE-SVL 的实际经历证明：

```text
接口 shutdown
→ Port unbundle
→ STP/VLAN/IFM/FED 状态变化
→ 平台需要进行额外硬件编程
```

对于已经处于异常状态的节点，这些额外变化本身可能成为新的风险触发点。因此最终形成的原则不是“永远不能预隔离流量”，而是：

> 如果设备健康，流量预切换可以提高可控性；但如果设备本身已经存在平台/FED/内存异常，不应为了追求形式上的可控而增加大量额外的控制面和转发面变化。

---



## 11. 标准判断框架

经过这次全过程，针对同类 C9500 SVL 内存/FED 风险，后续可以先回答三个问题。

### 11.1. 异常发生节点

```text
show platform software status control-processor brief
```

不要只看：

```text
show memory
```

需要明确：

```text
1-RP0 还是 2-RP0？
```

### 11.2. 异常节点当前角色

```text
show switch
show redundancy
```

如果异常节点是 Standby：

```text
健康 Active 保持不动
redundancy reload peer
```

如果异常节点是 Active，并且 Standby 已确认健康：

```text
redundancy force-switchover
```

### 11.3. 问题原因判断

需要同时看：

```text
show logging
show platform software trace message fed switch 1
show platform software trace message fed switch 2
show platform software fed switch active fss counters
show platform software fed switch standby fss counters
dir crashinfo-1:
dir crashinfo-2:
dir flash-1:/core/
dir flash-2:/core/
```

如果只有缓慢 TMPFS/Used Memory 增长，没有新的 traceback/core/FSS error，风险更偏资源泄漏。如果同时出现：

```text
FED ERR
Traceback
assert
core
crashinfo
FSS error 持续增长
```

则应提升风险等级，不应再把它当成一个单纯的 reload 清内存问题。

---



## 12. 修复后验证

这次操作之后，“设备可以 SSH 登录”已经不再被认为是修复完成。恢复必须至少经过以下几层验证。

#### HA 层

```text
show platform
show redundancy
show switch
show stackwise-virtual
show stackwise-virtual link
show stackwise-virtual dual-active-detection
```

目标：

```text
Active Ready
Standby Ready
sso
Communications Up
STANDBY HOT
SVL Ready
DAD Available
```

#### 资源层

```text
show platform software status control-processor brief
show platform software mount switch active R0
show platform software mount switch standby R0
```

目标：两台 RP 均恢复 Healthy，Used Memory 和 `/dev/shm` 明显下降。

#### 接口与聚合层

```text
show interfaces status
show interfaces counters errors
show etherchannel summary
show etherchannel detail
show lacp neighbor
show lacp internal
```

目标：关键 Port-channel 为 `SU`，双侧成员恢复 `P`，无异常 error/discard。

#### 转发与协议层

根据设备业务继续检查：

```text
show ip ospf neighbor
show bgp summary
show spanning-tree summary
show spanning-tree inconsistentports
show mac address-table count
```

#### FED / crash 层

```text
show platform software trace message fed switch active
show platform software trace message fed switch standby
dir crashinfo-1:
dir crashinfo-2:
dir flash-1:/core/
dir flash-2:/core/
```

最后再结合 Grafana 与业务拨测，确认流量确实已经重新回到双边承载。

---



## 13. 监控改进

这次事件最后并没有停留在“把三台高内存 Switch reload 掉”。它暴露了几个更长期的问题。

### 13.1. 内存监控不足

不能只监控一个逻辑设备的 Active supervisor。需要至少能识别：

```text
Switch1 / RP0
Switch2 / RP0
Active / Standby
Used Memory
TMPFS / /dev/shm
Warning / Critical
```

并把设备自身：

```text
%PLATFORM-4-ELEMENT_WARNING
%PLATFORM-3-ELEMENT_CRITICAL
%PLATFORM-3-ELEMENT_TMPFS_WARNING
%PLATFORM-3-ELEMENT_TMPFS_CRITICAL
```

纳入日志告警。

### 13.2. 平台健康检查

过去的倒换前检查更关注：

```text
show switch
show redundancy
STANDBY HOT
```

以后还需要增加：

```text
show platform software status control-processor brief
show platform software mount switch standby R0
FED trace
crashinfo/core
SVL/DAD
```

`STANDBY HOT` 是必要条件，但不再被视为充分条件。

### 13.3. 后续版本升级

这次已经确认存在：

```text
CSCwd88554
```

同时又出现过 FED / 平台相关异常。所以 reload 只能清理当前状态，不能消除版本层面的长期风险。长期方案仍然是：

```text
根据 Cisco TAC 推荐版本规划升级
```

---



## 14. 总结

如果把这一个月的过程压缩成一条完整链路，它实际上是这样的：

#### 第一幕：演练

```text
想验证 Active 故障时能否正常切换
        ↓
执行 redundancy force-switchover
        ↓
原 Active 正常 reload
        ↓
原 Standby 接管失败
        ↓
堆叠退化为单机
```

#### 第二幕：追因

```text
TAC 分析 trace/core
        ↓
发现 FED / 平台异常
        +
发现 CSCwd88554 /dev/shm TMPFS 泄漏
        ↓
认识到 STANDBY HOT 不代表 Standby 完全健康
```

#### 第三幕：扩大排查

```text
检查另外三组同型号同版本 SVL
        ↓
SITE-B-CORE：Switch2 高内存
SITE-B-EDGE：Switch1 已 Critical
SITE-A-EDGE：Switch2 高内存且当前 Active
        ↓
Kibana 证明 TMPFS/Used Memory 是长期缓慢增长
        ↓
重新评估每一组的运行态 HA 风险
```

#### 第四幕：逐组修复

```text
SITE-B-EDGE
手工隔离接口时触发 Standby Critical software exception reload
→ 内存恢复
→ 逐口恢复流量

SITE-B-CORE
redundancy reload peer
→ 高内存 Standby 正常 reload
→ 重新加入 STANDBY HOT
→ 内存恢复

SITE-A-EDGE
不再预先 shutdown 接口
→ 直接 redundancy force-switchover
→ 健康 Switch1 成功接管 Active
→ 高内存 Switch2 reload
→ 双机 SSO 恢复
```

最终，最初那次“倒换失败”带来的价值并不只是修复了一组设备。

它让一个隐藏在 Standby 上、平时几乎不影响业务的版本问题被提前暴露；又进一步推动了另外三组设备的横向排查和修复。更重要的是，它改变了以后对 HA 的理解：

> **高可用并不只是看当前有没有一个 Active 和一个 STANDBY HOT，而是要确认那个“备用节点”在真正需要接管时，是否具备健康的 Linux 控制面、足够的系统资源、正常的 FED 状态，以及可完成硬件编程和状态同步的能力。**

这也是整个排查和修复过程最终留下的最重要结论。

---



## 15. 命令清单

### 15.1. HA / SVL

```text
show platform
show redundancy
show switch
show stackwise-virtual
show stackwise-virtual link
show stackwise-virtual dual-active-detection
```

### 15.2. Linux 控制平面内存 / TMPFS

```text
show platform software status control-processor brief
show platform software mount switch active R0
show platform software mount switch standby R0
show platform software process memory switch active R0 all sorted
show platform software process memory switch standby R0 all sorted
```

### 15.3. 传统 IOSd 内存（辅助，不作为平台总内存判断依据）

```text
show memory
```

### 15.4. FED / 平台异常

```text
show logging last 5000 | include FED|fed|FMAN|fman|Traceback|traceback|crash|core|PMAN
show platform software trace message fed switch 1
show platform software trace message fed switch 2
show platform software fed switch active fss counters
show platform software fed switch standby fss counters
show platform software fed switch active fss err-pkt-counters latency
show platform software fed switch standby fss err-pkt-counters latency
show platform software fed switch active fss err-pkt-counters seqerr
show platform software fed switch standby fss err-pkt-counters seqerr
```

### 15.5. Crash / Core

```text
dir crashinfo-1:
dir crashinfo-2:
dir flash-1:/core/
dir flash-2:/core/
```

### 15.6. 恢复后业务承载

```text
show interfaces status
show interfaces counters errors
show etherchannel summary
show etherchannel detail
show lacp neighbor
show lacp internal
show ip ospf neighbor
show bgp summary
show spanning-tree summary
show spanning-tree inconsistentports
```
