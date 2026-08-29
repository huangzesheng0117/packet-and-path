## 00. A Routine Drill—At Least, That Was the Plan

The original objective for the May 30 maintenance window was straightforward.

The Site A Internet core switch, `SITE-A-CORE-SVL`, was a StackWise Virtual system comprising two `C9500-16X` switches and running IOS XE `17.6.3`. Under normal conditions, the two physical switches presented themselves externally as a single logical system: one operated as Active, while the other remained in `STANDBY HOT`. Resiliency for production links was provided through StackWise Virtual, MEC/Port-channel, SSO, and related mechanisms.

The purpose of the maintenance was to validate a fundamental high-availability scenario:

> If the current Active switch fails, can the Standby take over correctly? After the former Active reloads, can it rejoin the system as the new Standby?

Under normal Cisco StackWise Virtual behavior, after executing:

```text
redundancy force-switchover
```

the expected sequence is:

```text
Switch1 Active
    ↓ force-switchover
Switch2 Standby takes over as Active
    ↓
Switch1 reloads as designed
    ↓
Switch1 completes booting and rejoins
    ↓
Switch2 Active + Switch1 Standby
    ↓
SSO / STANDBY HOT is restored
```

In other words, **the former Active reloading after a `force-switchover` is not itself a fault; it is an expected part of the process.**

The real problem was that, on this occasion, the Standby failed to take over. What began as a routine high-availability validation exercise became the starting point for nearly a month of troubleshooting, joint analysis with Cisco TAC, a network-wide assessment, and phased remediation.

---

## 01. Unexpected Standby Reload

### 1.1. Anomalies Before the Reload

In retrospect, one point in the logs proved critical: the first anomaly did not occur during the reload.

Roughly a dozen seconds before `redundancy force-switchover` was executed, the original Standby—slot2—had already generated FED/platform-related tracebacks. Cisco TAC focused on a call chain involving:

```text
fman_fp
doppler_l3_ucast
aobjman
```

These are not ordinary CLI, SNMP, or user-space management processes. They are associated with the Forwarding Engine Driver, platform object management, and hardware forwarding-table programming.

Evidence of this type of anomaly was already present on slot2 at approximately `06:52:35 BJT`.

Then, at `06:52:52`, the following command was executed:

```text
redundancy force-switchover
```

As the original Active, slot1 entered reload in accordance with the normal mechanism.

If this were the only evidence considered, it would be easy to reach the wrong conclusion:

> “The force-switchover command rebooted the Active, which caused the stack failure.”

That, however, was not the actual anomaly.

A `force-switchover` is expected to reload the former Active. The true failure was that **the original Standby, slot2, did not take over the Active role reliably.**

### 1.2. Anomalies During the Reload

Within seconds of the switchover, slot2 reported:

```text
TMPFS value 41% above warning level 40%
```

At the same time, multiple exception files were generated under `crashinfo-2` and `flash-2:/core`, involving:

```text
stack_mgr
fman_rp
fman_fp_image
pubd
service_mgr
iosd_ngwc
```

For the first time, the incident appeared to point in two seemingly different directions:

1. A FED/platform forwarding-programming anomaly;
2. A TMPFS/memory-resource issue on the Standby Linux platform.

At that stage, it was not yet possible to determine which was the primary cause. One fact was clear, however: **during the critical takeover window, the Standby was not a fully healthy node.**

### 1.3. State After the Reload

Slot1 booted normally after its reload:

- `06:58:49–06:58:53`: slot1 began rejoining and system services recovered;
- `06:59:08`: the logs confirmed a reload duration of approximately 376 seconds;
- `06:59:22`: the management plane recovered and SSH access became available;
- `06:59:50–06:59:57`: slot1's local physical interfaces and links including Po10/20/30/40/101/102 gradually recovered;
- `06:59:58–07:00:29`: Layer 3 and reachability states, including VLAN, BFD, and Track/IP SLA, recovered.

Production service was restored first through slot1 operating on its own.

The HA state, however, showed:

```text
slot1 Active Ready
slot2 Member / Provisioned

Hardware Mode = Simplex
Operating Redundancy Mode = Non-redundant
Communications = Down
```

This meant that the entire SVL system had degraded to:

```text
Switch1 operating alone as Active
Switch2 not properly joined
No Standby
```

This was the truly dangerous phase of the exercise. The objective had been to prove that a single-node failure would not affect the overall system. Instead, the exercise demonstrated that **when the Standby was actually required to assume the Active role, it could fail at the most critical moment.**

### 1.4. Subsequent Recovery Actions

At approximately `07:29`, slot2 began rejoining after manual recovery or power restoration:

```text
Switch 2 has been added to the stack
```

The recovery then proceeded as follows:

- `07:34:24`: the DAD link recovered;
- `07:34:31–07:34:37`: SVL recovered;
- `07:36:41`: slot2 was elected Standby;
- `07:37:47`: the system reached the SSO terminal state;
- `07:37:49–07:37:54`: production interfaces on slot2 recovered.

The system ultimately returned to:

```text
Switch1 Active Ready
Switch2 Standby Ready
Operating Redundancy Mode = sso
Communications = Up
Standby = STANDBY HOT
```

Production service had recovered, but one question remained:

> Why did a node that clearly showed `STANDBY HOT` before the switchover fail when it was actually required to take over as Active?

That question became the focus of the second phase of the investigation.

---

## 02. Root Cause Analysis

### 2.1. Assessing the Switchover Command

The most obvious suspect during the first round of discussion was:

```text
redundancy force-switchover
```

Was this command inappropriate for the scenario? Both the platform behavior and TAC's assessment quickly ruled out that possibility. The expected action of `force-switchover` is:

```text
Standby takes over as Active
Former Active reloads
```

Slot1 reloading as the former Active was therefore expected. The point that required explanation was:

```text
Why did slot2 fail during the takeover?
```

From that point onward, the investigation shifted from “Was the command correct?” to “Was the Standby truly healthy before the switchover?”

### 2.2. FED Error

TAC's analysis of the traceback showed that slot2 had experienced a FED/platform-related anomaly. FED can be understood as a critical layer between the IOS XE control plane and the forwarding hardware. Its responsibilities include:

- Forwarding-engine drivers;
- ASIC and hardware-table programming;
- Synchronizing interface, VLAN, adjacency, FIB, and related state to hardware;
- Internal communication among platform-management components.

The involvement of `fman_fp / doppler_l3_ucast / aobjman` did not resemble an ordinary production-configuration error. TAC characterized this type of FED error as a **rare, transient platform or hardware-programming anomaly**:

- It should not occur frequently under normal conditions;
- A single occurrence can often be cleared by a reload;
- Repeated occurrences within a short period warrant further investigation into possible hardware risk.

There was therefore a direct technical relationship between the FED error and the Standby's inability to take over the Active role reliably.

### 2.3. CSCwd88554

TMPFS provided another important lead. TAC further confirmed that the `C9500-16X + StackWise Virtual + IOS XE 17.6.3` combination was affected by the known issue `CSCwd88554`.

This issue does not manifest as conventional exhaustion of the IOS Processor Pool. Instead, utilization steadily increases in the Standby node's Linux-platform:

```text
/dev/shm
TMPFS
```

As uptime increases, applications continue creating objects in `/dev/shm`. TMPFS consumption gradually rises and, in turn, drives up Used Memory for the entire Linux control processor. At the time of the incident, the affected pair showed only:

```text
TMPFS 41%
```

This had not yet reached the 50% critical threshold, but it had crossed the 40% warning threshold. TAC's position was that this demonstrated an existing risk of resource leakage on the Standby; it could no longer be treated as a completely healthy backup node.

The short-term workaround for this bug is straightforward:

```text
reload standby
```

A reload clears the leaked state. The long-term resolution is to upgrade to a Cisco-recommended software release.

### 2.4. Limitations of the Commands

While investigating another device pair, we encountered an apparent contradiction. Its logs repeatedly reported:

```text
Used Memory value 87% exceeds warning level 85%
```

Yet the conventional command:

```text
show memory
```

reported:

```text
Processor Total approximately 1.35 GB
Used approximately 350 MB
Free approximately 998 MB
```

A manual calculation yielded only about 26% utilization, which initially made the log message look like a false alarm. We later confirmed that the two commands use entirely different measurement scopes.

#### `show memory`

This primarily displays the traditional Processor Pool within IOS/IOSd:

```text
IOS XE Linux
└── IOSd
    └── Processor Pool   ← this is the primary scope of show memory
```

#### `show platform software status control-processor brief`

This command reports aggregate resource usage across the IOS XE Linux control plane:

```text
IOS XE Linux control plane
├── kernel
├── IOSd
├── FED / fman
├── smand
├── sessmgrd
├── dbm
├── shared memory
├── tmpfs / /dev/shm
└── other platform processes
```

It is therefore entirely possible to see both:

```text
show memory                          → 26%
show platform ... control-processor → 87%
```

Neither result is wrong.

This realization marked an important shift in perspective during the investigation:

> On IOS XE platforms—particularly C9500 SVL—overall control-plane memory health cannot be determined from the traditional `show memory` command alone.

### 2.5. Consolidated Root-Cause Assessment

TAC's final assessment leaned toward the following combination:

```text
FED/platform anomaly
    +
Standby TMPFS/Linux memory leak
    +
Latent software risks in the older 17.6.3 release
    ↓
Standby fails during the Active takeover window
```

We deliberately did not reduce the conclusion to:

```text
“The memory leak caused the failure.”
```

TMPFS utilization was only 41%, while the FED traceback and core/crashinfo evidence offered a more direct explanation for the takeover failure. The behavior later observed across the other three device pairs further reinforced this interpretation.

---

## 03. Analysis of Other Devices

The original incident affected only one Site A Internet core pair. Once `CSCwd88554` had been confirmed, however, a more practical question emerged:

> Were there other production devices of the same model and release, also running StackWise Virtual? Were they silently accumulating the same leak?

The production network contained four SVL pairs of this type, totaling eight physical switches. The first pair had already exposed the problem during the May 30 exercise. The remaining three were:

```text
SITE-A-EDGE-SVL
SITE-B-CORE-SVL
SITE-B-EDGE-SVL
```

The investigation therefore expanded from explaining a single incident to assessing the entire fleet running the same software release.

### 3.1. Log Analysis

The most useful device-side log messages were:

```text
%PLATFORM-4-ELEMENT_WARNING:
Used Memory value XX% exceeds warning level 85%

%PLATFORM-3-ELEMENT_TMPFS_WARNING:
TMPFS value XX% above warning level 40%
```

At higher thresholds, the devices reported:

```text
Used Memory > 90% critical
TMPFS > 50% critical
```

A historical review in Kibana showed that the leakage on the two Site B pairs did not occur suddenly. Instead, it followed a characteristic **slow, sustained, stepwise growth pattern**.

#### SITE-B-CORE-SVL

The affected node was:

```text
Switch2 / 2-RP0
```

Used Memory increased approximately as follows:

| Date | Used Memory |
|---|---:|
| May 18 | 86% |
| May 27–28 | 87% |
| June 6 | 88% |

TMPFS had begun increasing even earlier:

| Date | TMPFS |
|---|---:|
| March 10 | 43% |
| March 22–23 | 44% |
| April 10–11 | 45% |
| April 23 | 46% |
| May 3–4 | 47% |
| May 16 | 48% |
| May 25–26 | 49% |
| June 5 | 50% |

The curve was almost a textbook example of a slow leak:

```text
43 → 44 → 45 → 46 → 47 → 48 → 49 → 50%
```

#### SITE-B-EDGE-SVL

The affected node was:

```text
Switch1 / 1-RP0
```

Growth began earlier on this pair and was more severe.

Used Memory:

| Date | Used Memory |
|---|---:|
| April 7 | 86% |
| April 19 | 87% |
| April 28 | 88% |
| May 7–8 | 89% |
| May 19 | 90% Critical |
| May 28–29 | 91% |
| June 7 | 92% |

TMPFS:

| Date | TMPFS |
|---|---:|
| March 10 | 46% |
| March 20 | 47% |
| March 29–30 | 48% |
| April 9–10 | 49% |
| April 21 | 50% Critical |
| May 1 | 51% |
| May 11–12 | 52% |
| May 23 | 53% |
| June 2 | 54% |

By the time remediation began, this was no longer merely a potential risk: the control plane had remained in a Critical state for an extended period.

#### SITE-A-EDGE-SVL

The affected node on `SITE-A-EDGE-SVL` was also Switch2:

```text
2-RP0 Used Memory ≈ 86%
TMPFS ≈ 48%
```

Later alerts began listing the top memory allocators directly:

```text
Process: fed_main_event_fp_0
Process: install_mgr_rp_0
Process: sessmgrd_rp_0
```

The most notable entry was:

```text
fed_main_event_fp_0
```

This indicated that a FED-related process was among the primary sources of memory allocation. This pair, however, differed from the two Site B pairs in one crucial respect:

```text
Switch2 = Active, with high memory utilization
Switch1 = Standby, with low memory utilization
```

More importantly, Switch2 was not merely a node that might theoretically become Active. It had previously completed a real:

```text
redundancy force-switchover
```

It had successfully taken over from Standby as Active and had continued operating stably in the Active role. This fact prompted us to refine our understanding of the May 30 incident:

> High memory/TMPFS leakage is not, by itself, a sufficient condition for a Standby to fail its takeover.

In the original incident, the FED/platform anomaly was therefore more likely the direct trigger for the takeover failure, while the memory/TMPFS leak served as a background condition that degraded Standby health and amplified the risk.

### 3.2. Risk Analysis

At this stage, we evaluated the three device pairs using two distinct forms of risk ranking. If the only consideration is the operational impact of the command itself:

```text
force-switchover
```

is necessarily more disruptive than:

```text
reload standby peer
```

because it changes the Active role.

From the perspective of HA risk if no action were taken, however, the ranking was the reverse.

#### SITE-A-EDGE-SVL

```text
High-memory Switch2 = current Active
Low-memory Switch1 = current Standby
```

The risk was that the Active node itself was affected by the leak.

Two factors were comparatively favorable:

1. High-memory Switch2 had already demonstrated in production that it could operate as Active;
2. Low-memory Switch1 had recently reloaded and had a clean resource state, making it more likely to be a healthy takeover target.

Therefore, even if Switch2 unexpectedly reloaded because of the memory issue, the likelihood of Switch1 taking over successfully was comparatively more manageable.

#### The Two Site B Pairs

The two Site B pairs were the exact opposite:

```text
Low-memory switch = Active
High-memory switch = Standby
```

On the surface, current production service appeared more stable. If the low-memory Active failed unexpectedly, however, the system would have to rely on the high-memory Standby to take over. Whether that high-memory Standby could actually assume the Active role was precisely the unknown.

This risk path closely resembled the first incident on May 30. From an in-service HA-risk perspective, we therefore arrived at the following ranking:

```text
SITE-B-EDGE-SVL
    >
SITE-B-CORE-SVL
    >
SITE-A-EDGE-SVL
```

`SITE-B-EDGE-SVL` posed the greatest risk because its Standby had already reached:

```text
Used Memory 91–92%
TMPFS 54%
Critical
```

### 3.3. FED Risk

Confirming the memory leak alone was insufficient because the original incident had also involved a FED error. We therefore performed additional checks on the remaining three pairs:

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

The findings did not indicate that all three pairs had severe FED failures. Instead, they revealed different levels and types of risk:

- `SITE-B-CORE-SVL`: FED trace activity was comparatively higher, with ERR entries such as `l3_fib` and `l3_pbr`, but there were no new severe tracebacks or core files, and the FSS latency/seqerr counters were not increasing continuously;
- `SITE-A-EDGE-SVL`: historical FMAN/FED tracebacks were present, and a recent `punt: Error retrieving table_id` had also occurred. The top allocator in memory alerts pointed to `fed_main_event_fp_0`, but no new severe FED crash or core file appeared before remediation;
- `SITE-B-EDGE-SVL`: recent, strong FED evidence was comparatively limited; the dominant issue was that the Standby had already reached a Memory/TMPFS Critical state.

The remediation strategy therefore could not be one-size-fits-all.

## 04. The Monitoring Blind Spot

When we reviewed the monitoring coverage, we discovered another long-standing blind spot. Prometheus was using:

```text
cseSysMemoryUtilization{ip=~"$ip"}
```

Metrics of this type are generally oriented toward the memory view of the current Active supervisor. Yet the most dangerous condition in this incident often looked like:

```text
Active is healthy
Standby Linux memory continues to leak
```

Monitoring could therefore continue to report normal Active memory while the Standby—the node responsible for disaster-recovery takeover—silently climbed from 85% to 90% and eventually into a Critical state.

After this incident, our approach to memory monitoring changed:

```text
Do not monitor only a single “overall memory value”
for the logical device.

Monitor each of the following:
Switch1 / RP0
Switch2 / RP0
Active
Standby
TMPFS / /dev/shm
System-log warning/critical events
```

The following device-native commands also became more important health checks than `show memory`:

```text
show platform software status control-processor brief
show platform software mount switch active R0
show platform software mount switch standby R0
```

## 05. Remediation Logic

The preceding investigation showed that, although the three pairs were affected by the same general class of issue, the affected nodes occupied different roles. They therefore could not all be handled with the same command. We distilled the approach into two core principles.

#### When the Affected Node Is Standby

The objective is:

```text
Leave the healthy Active untouched
Reload only the high-memory Standby
```

The preferred command is:

```text
redundancy reload peer
```

#### When the Affected Node Is Active

The objective is:

```text
Have the healthy Standby take over as Active
Allow the high-memory former Active to reload
```

Use:

```text
redundancy force-switchover
```

The plans for the three device pairs therefore became:

| Device | Affected Node | Current Role of Affected Node | Remediation Strategy |
|---|---|---|---|
| SITE-B-EDGE-SVL | Switch1 | Standby | Reload the Standby |
| SITE-B-CORE-SVL | Switch2 | Standby | `redundancy reload peer` |
| SITE-A-EDGE-SVL | Switch2 | Active | `redundancy force-switchover` |

During execution, however, another unexpected event occurred. While working on `SITE-B-EDGE-SVL`, **our attempt to isolate traffic before the reload inadvertently triggered the Standby to reload.**

## 06. The Second Unexpected Incident

### 6.1. Why We Tried to Isolate Traffic

Initially, we did not want to reload the device immediately. Because all local production ports on the Standby would go down simultaneously during its reload, we considered manually shutting down the production links on the target switch first, allowing traffic to move to the other switch in advance:

```text
Shut down the uplink and downlink physical interfaces
    ↓
Confirm that traffic has moved to the healthy side
    ↓
Reload the Standby
    ↓
Allow the Standby to return and validate its health
    ↓
Issue no shutdown incrementally to restore dual-sided forwarding
```

From an operations perspective, this plan appeared intuitive: it decomposed a single, all-at-once reload into several observable steps. We therefore began by shutting down selected interfaces on the high-memory Standby Switch1 of `SITE-B-EDGE-SVL`.

Uplinks:

```text
interface TenGigabitEthernet1/0/1
 shutdown
interface TenGigabitEthernet1/0/2
 shutdown
```

Downlinks were then shut down:

```text
interface TenGigabitEthernet1/1/1
 shutdown
interface TenGigabitEthernet1/1/2
 shutdown
```

### 6.2. The Unexpected Reload

During the interface-state change window, Switch1 suddenly disappeared from the stack. Active Switch2 recorded:

```text
Jun 19 22:00:48
%REDUNDANCY-3-STANDBY_LOST: PEER_NOT_PRESENT
%REDUNDANCY-3-STANDBY_LOST: PEER_DOWN
%NIF_MGR-6-STACK_LINK_DOWN
%STACKMGR-4-SWITCH_REMOVED: Switch 1 has been removed from the stack
```

This was followed by:

```text
%RF-5-RF_RELOAD: Peer reload. Reason: EHSA standby down
```

This was not the result of an operator issuing `redundancy reload peer`. After Switch1 recovered, the actual reload reason was unambiguous:

```text
Last reload reason : Critical software exception
```

The following files were also generated:

```text
SITE-B-EDGE-SVL_crashinfo_1_RP_00_00_20260619-220048-BJT
SITE-B-EDGE-SVL_1_RP_0-system-report_1_20260619-220109-BJT.tar.gz
```

### 6.3. FED Trace

The FED trace was even more significant. Because FED traces use UTC, `14:00:48` corresponds to `22:00:48 BJT`.

Within that same second, the following entries appeared:

```text
Port unbundle ... TenGigabitEthernet1/1/2
fed_ifm_avl_insert le not available ... if_id ... 1a

Port unbundle ... TenGigabitEthernet1/1/1
fed_ifm_avl_insert le not available ... if_id ... 19
```

Additional errors appeared during recovery:

```text
Set STP state, Retrieve BD handle failed
IFM get LE failed
Failed to find handle
SISF failed to determine vlan from interface
IPSG failed to determine vlan from interface
```

These messages do not prove that the `shutdown` command itself was defective. A healthy device must, of course, support shutting down ordinary production interfaces. They did, however, establish an important point for subsequent operations:

> On a node already affected by Linux memory/TMPFS leakage and running 17.6.3, introducing extensive interface unbundling and STP/VLAN/FED reprogramming does not necessarily reduce risk.

Before the planned `redundancy reload peer` could be issued, Switch1 reloaded on its own because of a Critical software exception.

### 6.4. Memory State

Switch1 rejoined the system within several minutes after its reload:

- `22:05:20`: SVL-related links recovered;
- `22:05:25`: Switch1 rejoined;
- `22:07:30`: Switch1 was elected Standby;
- It subsequently returned to `STANDBY HOT`.

Memory utilization also fell from Critical to:

```text
1-RP0 Healthy 23–25%
2-RP0 Healthy 28%
```

There was therefore no value in executing another Standby reload as originally planned. The operation shifted to:

1. Confirming SSO and `Communications Up`;
2. Confirming that Switch1 had returned to `STANDBY HOT`;
3. Confirming that memory and TMPFS had returned to healthy levels;
4. Restoring each previously shut-down interface;
5. Checking Po101/Po102, LACP, production traffic, and error counters;
6. Restoring dual-sided forwarding in full.

The final state was:

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

This incident changed our approach to every subsequent operation.

---

## 07. The Other Site B Pair

The conditions on `SITE-B-CORE-SVL` were better suited to a standard Standby reload:

```text
Switch1 = Active, low memory utilization
Switch2 = Standby, high memory utilization
```

Before the operation, Switch2 had reached:

```text
Used Memory approximately 89%
TMPFS 51% Critical
```

This time, the objective was explicit:

> Do not allow high-memory Switch2 to take over as Active; reload only that switch in its Standby role.

We therefore used:

```text
redundancy reload peer
```

The device displayed the following prompt:

```text
Stack is in Half ring setup; Reloading a switch might cause stack split
Reload peer [confirm]
Preparing to reload peer
```

At `22:35:05`:

```text
%RF-5-RF_RELOAD: Peer reload. Reason: Admin reload CLI
```

Switch2 then left the stack, while Active Switch1 remained Active throughout. During this period, the system temporarily showed:

```text
Operating Redundancy Mode = Non-redundant
Communications = Down
```

This was the expected intermediate state while the Standby was reloading; it did not indicate an Active-role transition. Approximately four minutes later, the SVL ports returned to Ready, and Switch2 rejoined and recovered:

```text
Switch1 Active Ready
Switch2 Standby Ready
Operating Redundancy Mode = sso
Communications = Up
Standby = STANDBY HOT
```

Memory utilization fell from nearly 90% to:

```text
1-RP0 Healthy ≈ 28%
2-RP0 Healthy ≈ 25–26%
```

This operation demonstrated in practice that:

> When the high-memory node is the Standby, `redundancy reload peer` can clear the leaked state without forcing that node to assume the Active role.

Traffic was then restored incrementally. Po101/Po102, LACP, interfaces, and production monitoring all ultimately returned to normal.

---

## 08. Refining the Operational Strategy

The two Site B operations produced two different outcomes.

#### Outcome One

`SITE-B-EDGE-SVL`:

```text
Manual shutdown / unbundle
    ↓
FED/IFM state changes
    ↓
Standby Critical software exception
    ↓
Unexpected reload
```

#### Outcome Two

`SITE-B-CORE-SVL`:

```text
redundancy reload peer
    ↓
Standby leaves normally
    ↓
Active remains operational
    ↓
Standby reloads normally and rejoins
```

As a result, the earlier approach—pre-isolating traffic by shutting down production interfaces before a reload—was no longer the default recommendation. The reason was not that shutting down interfaces is inherently invalid. Rather:

> On a C9500 already known to have abnormal platform resource usage, additional interface configuration changes, Port-channel unbundling, and STP/VLAN/FED reprogramming introduce further platform-state transitions and additional trigger points.

Beginning with the subsequent Site A operation, the guiding principle became:

```text
If HA is healthy and the Standby has been validated as capable of takeover,
minimize additional changes
and use the HA command that directly matches the objective.
```

---

## 09. Site A Reload and Remediation

By late June, only `SITE-A-EDGE-SVL` remained untreated. Its role assignment was entirely different from that of the two Site B pairs:

```text
Switch1 = Standby, low memory utilization
Switch2 = Active, high memory utilization
```

Before remediation:

```text
1-RP0 Healthy ≈ 27%
2-RP0 Warning ≈ 86%
TMPFS ≈ 48%
```

The logs had also begun reporting:

```text
Top memory allocators are:
Process: fed_main_event_fp_0
Process: install_mgr_rp_0
Process: sessmgrd_rp_0
```

The high-memory Active could not be left in service indefinitely. However, issuing:

```text
redundancy reload peer
```

would reload the current Standby, Switch1, rather than the affected node, Switch2. That clearly would not meet the objective.

Issuing:

```text
reload slot 2
```

would reload Switch2, but because Switch2 was the current Active, this would leave role takeover to occur reactively after the unplanned disappearance of the Active. A controlled SSO switchover offered a much clearer process. We therefore selected:

```text
copy running-config startup-config
redundancy force-switchover
```

Applying the lesson learned from Site B, **we did not shut down Switch2's production interfaces in advance.**

### 9.1. Preconditions

Before execution, we confirmed:

```text
Switch1 Standby Ready
Current Software state = STANDBY HOT
Operating Redundancy Mode = sso
Communications = Up
SVL / DAD normal
Switch1 Memory ≈ 27%
```

No new severe FED traceback or core file was found.

This Site A pair also had another fact that materially improved the risk assessment:

- High-memory Switch2 had already carried the Active role in production for some time;
- Low-memory Switch1 had reloaded recently and had a comparatively clean resource state.

The objective was therefore unambiguous:

```text
Have the healthier Switch1 take over as Active in a controlled manner
Allow high-memory Switch2 to reload through the force-switchover mechanism
```

### 9.2. Execution

The commands executed were:

```text
SITE-A-EDGE-SVL#copy running-config startup-config
[OK]

SITE-A-EDGE-SVL#redundancy force-switchover
Proceed with switchover to standby RP? [confirm]
Manual Swact = enabled
```

At `02:14:03`, the logs clearly showed:

```text
%PLATFORM-6-HASTATUS_DETAIL: RP switchover, received chassis event became active
%HA-6-SWITCHOVER: Route Processor switched from standby to being active
```

Switch1 took over from Standby as Active. At the same time, the former Active, Switch2, was removed from the system and began reloading:

```text
%STACKMGR-4-SWITCH_REMOVED: Switch 2 has been removed from the stack
%HMANRP-5-CHASSIS_DOWN_EVENT: Chassis 2 gone DOWN
```

Switch1's local Te1/0/1, Te1/0/2, Te1/1/1, Te1/1/2, Po101, and Po102 interfaces came up almost immediately, and traffic began running on Switch1 alone.

While Switch2 was reloading, the system briefly showed:

```text
Hardware Mode = Simplex
Operating Redundancy Mode = Non-redundant
Communications = Down
```

This was an expected transitional state during the controlled switchover.

### 9.3. Result

Unlike the first incident on May 30, Switch1 did not fail during the takeover.

After Switch2 reloaded, the SVL connection returned to Ready. At `02:18:09–02:18:10`, the relevant frontend Stack Link ports on both sides transitioned from Pending to Ready.

The final checks showed:

```text
Switch1 Active Ready
Switch2 Standby Ready

Operating Redundancy Mode = sso
Communications = Up
Standby = STANDBY HOT
```

More importantly, the high-memory condition had been fully cleared:

```text
1-RP0 Healthy 27%
2-RP0 Healthy 25%
```

The Active node's `/dev/shm` also returned to a low level, for example:

```text
/dev/shm ≈ 7%
```

The production Port-channels recovered:

```text
Po101(SU) Te1/1/1(P) Te2/1/1(P)
Po102(SU) Te1/1/2(P) Te2/1/2(P)
```

At this point, remediation of the memory leak had been completed across all three remaining device pairs.

---

## 10. Incident Review and Lessons Learned

The most valuable outcome of the entire process was not simply identifying a Bug ID or learning a handful of reload commands. Its real value lay in how our conclusions evolved as new evidence emerged.

### 10.1. Lesson One

**A reload of the former Active does not mean the switchover failed.** Our initial interpretation was:

```text
force-switchover
↓
Switch1 reloads
↓
Did the command break the device?
```

The corrected interpretation was:

```text
The former Active is expected to reload
The actual anomaly was that the Standby failed to take over
```

### 10.2. Lesson Two

**`STANDBY HOT` does not guarantee absolute health.** Before the switchover:

```text
Standby = STANDBY HOT
```

This confirms only that the node currently satisfies the conditions for the SSO state. It does not prove that:

```text
Linux memory is healthy
TMPFS is free of leakage
FED is operating normally
Hardware programming will succeed during takeover
```

We therefore added the following to every subsequent pre-switchover health check:

```text
show platform software status control-processor brief
show platform software mount switch active R0
show platform software mount switch standby R0
FED trace
crashinfo/core
SVL/DAD
```

### 10.3. Lesson Three

**High memory utilization is not, by itself, sufficient to cause a takeover failure.** The high-memory Switch2 on `SITE-A-EDGE-SVL` later operated stably as Active, demonstrating that:

```text
High memory utilization ≠ necessarily incapable of operating as Active
```

The May 30 incident therefore cannot be reduced to:

```text
“The Standby had high memory utilization, so its takeover failed.”
```

A more technically sound interpretation is:

```text
The FED/platform anomaly was the more direct cause of failure
TMPFS/memory leakage degraded node health and amplified the risk
```

### 10.4. Lesson Four

**Operational risk and change risk must be assessed separately.** Looking only at the commands:

```text
force-switchover risk > reload peer risk
```

But from the perspective of the current HA operating state:

```text
Low-memory Active + high-memory Standby
```

may be more dangerous than:

```text
High-memory Active + healthy Standby
```

In the event of an unplanned Active failure, the former configuration must rely on a high-memory Standby of uncertain health to take over.

This is why our operational-risk ranking at the time was:

```text
SITE-B-EDGE-SVL
>
SITE-B-CORE-SVL
>
SITE-A-EDGE-SVL
```

### 10.5. Lesson Five

**Shutting down traffic in advance is not inherently safer.** Our original operational instinct was:

```text
Manually migrate traffic first
Then reload
The operation will be more controlled
```

The actual experience on `SITE-B-EDGE-SVL` showed:

```text
Interface shutdown
→ Port unbundle
→ STP/VLAN/IFM/FED state changes
→ Additional hardware programming by the platform
```

For a node already in an abnormal state, those additional transitions can themselves become new risk triggers. The final principle was therefore not “never pre-isolate traffic,” but rather:

> If the device is healthy, moving traffic in advance can improve operational control. If the device already has platform, FED, or memory anomalies, however, do not introduce extensive additional control-plane and forwarding-plane changes merely to create the appearance of a more controlled procedure.

---

## 11. Standard Decision Framework

Based on the complete investigation and remediation process, future C9500 SVL memory/FED incidents can begin by answering three questions.

### 11.1. Which Node Is Affected?

Use:

```text
show platform software status control-processor brief
```

Do not rely solely on:

```text
show memory
```

Determine explicitly:

```text
1-RP0 or 2-RP0?
```

### 11.2. What Is the Affected Node's Current Role?

Use:

```text
show switch
show redundancy
```

If the affected node is Standby:

```text
Leave the healthy Active untouched
redundancy reload peer
```

If the affected node is Active and the Standby has been confirmed healthy:

```text
redundancy force-switchover
```

### 11.3. What Is the Nature of the Problem?

Review all of the following:

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

If the only symptom is slow growth in TMPFS/Used Memory, with no new traceback, core file, or FSS error, the risk is more consistent with a resource leak. If the following also appear:

```text
FED ERR
Traceback
assert
core
crashinfo
Continuously increasing FSS errors
```

the risk level should be raised. The issue should no longer be treated as a simple case of reloading to clear memory.

---

## 12. Post-Remediation Validation

After this incident, “the device accepts SSH connections” was no longer considered evidence that remediation was complete. Recovery must be validated across at least the following layers.

#### HA Layer

```text
show platform
show redundancy
show switch
show stackwise-virtual
show stackwise-virtual link
show stackwise-virtual dual-active-detection
```

Target state:

```text
Active Ready
Standby Ready
sso
Communications Up
STANDBY HOT
SVL Ready
DAD Available
```

#### Resource Layer

```text
show platform software status control-processor brief
show platform software mount switch active R0
show platform software mount switch standby R0
```

Target state: both RPs have returned to Healthy, with Used Memory and `/dev/shm` significantly reduced.

#### Interface and Link-Aggregation Layer

```text
show interfaces status
show interfaces counters errors
show etherchannel summary
show etherchannel detail
show lacp neighbor
show lacp internal
```

Target state: critical Port-channels show `SU`, members on both switches show `P`, and no abnormal errors or discards are present.

#### Forwarding and Protocol Layer

Continue with the relevant checks for the services carried by the device:

```text
show ip ospf neighbor
show bgp summary
show spanning-tree summary
show spanning-tree inconsistentports
show mac address-table count
```

#### FED and Crash Layer

```text
show platform software trace message fed switch active
show platform software trace message fed switch standby
dir crashinfo-1:
dir crashinfo-2:
dir flash-1:/core/
dir flash-2:/core/
```

Finally, Grafana and active service tests should be used to confirm that traffic has genuinely returned to dual-sided forwarding.

---

## 13. Monitoring Improvements

The incident response did not end after reloading the three high-memory switches. It exposed several longer-term issues.

### 13.1. Insufficient Memory Monitoring

Monitoring cannot be limited to the Active supervisor of a logical device. At minimum, it must distinguish:

```text
Switch1 / RP0
Switch2 / RP0
Active / Standby
Used Memory
TMPFS / /dev/shm
Warning / Critical
```

The following device-generated messages should also feed into log-based alerting:

```text
%PLATFORM-4-ELEMENT_WARNING
%PLATFORM-3-ELEMENT_CRITICAL
%PLATFORM-3-ELEMENT_TMPFS_WARNING
%PLATFORM-3-ELEMENT_TMPFS_CRITICAL
```

### 13.2. Platform Health Checks

Historically, pre-switchover validation focused on:

```text
show switch
show redundancy
STANDBY HOT
```

Future checks must also include:

```text
show platform software status control-processor brief
show platform software mount switch standby R0
FED trace
crashinfo/core
SVL/DAD
```

`STANDBY HOT` remains a necessary condition, but it is no longer treated as a sufficient one.

### 13.3. Future Software Upgrade

The investigation confirmed the presence of:

```text
CSCwd88554
```

FED/platform-related anomalies had also occurred. A reload can therefore clear the current state, but it cannot eliminate the long-term software-release risk. The durable solution remains:

```text
Plan an upgrade to a software release recommended by Cisco TAC
```

---

## 14. Conclusion

Condensed into a single end-to-end sequence, the month-long investigation unfolded as follows.

#### Act One: The Drill

```text
Validate failover after an Active failure
        ↓
Execute redundancy force-switchover
        ↓
Former Active reloads as expected
        ↓
Former Standby fails to take over
        ↓
Stack degrades to a single switch
```

#### Act Two: Root-Cause Investigation

```text
TAC analyzes trace/core evidence
        ↓
FED/platform anomaly identified
        +
CSCwd88554 /dev/shm TMPFS leak identified
        ↓
STANDBY HOT is recognized as insufficient proof
of complete Standby health
```

#### Act Three: Expanding the Investigation

```text
Inspect the other three SVL pairs
running the same model and release
        ↓
SITE-B-CORE: high memory on Switch2
SITE-B-EDGE: Switch1 already Critical
SITE-A-EDGE: high memory on Switch2, currently Active
        ↓
Kibana confirms long-term, gradual growth
in TMPFS/Used Memory
        ↓
Reassess in-service HA risk for each pair
```

#### Act Four: Phased Remediation

```text
SITE-B-EDGE
Standby encounters a Critical software exception and reloads
while interfaces are being manually isolated
→ Memory returns to normal
→ Traffic is restored one interface at a time

SITE-B-CORE
redundancy reload peer
→ High-memory Standby reloads normally
→ Rejoins as STANDBY HOT
→ Memory returns to normal

SITE-A-EDGE
No advance interface shutdown
→ Execute redundancy force-switchover directly
→ Healthy Switch1 takes over successfully as Active
→ High-memory Switch2 reloads
→ Dual-switch SSO is restored
```

Ultimately, the value of the initial switchover failure extended well beyond repairing a single device pair.

It exposed, ahead of a genuine outage, a software-release issue hidden on the Standby and largely invisible to production traffic. That discovery drove a wider assessment and remediation of the other three device pairs. More importantly, it changed how we evaluate HA:

> **High availability is not merely the presence of one Active node and one node showing `STANDBY HOT`. It requires confidence that the backup node—when the moment of takeover actually arrives—has a healthy Linux control plane, sufficient system resources, a normal FED state, and the ability to complete hardware programming and state synchronization.**

That is the most important conclusion from the entire investigation and remediation effort.

---

## 15. Command Reference

### 15.1. HA / SVL

```text
show platform
show redundancy
show switch
show stackwise-virtual
show stackwise-virtual link
show stackwise-virtual dual-active-detection
```

### 15.2. Linux Control-Plane Memory / TMPFS

```text
show platform software status control-processor brief
show platform software mount switch active R0
show platform software mount switch standby R0
show platform software process memory switch active R0 all sorted
show platform software process memory switch standby R0 all sorted
```

### 15.3. Traditional IOSd Memory (Supplementary Only; Not a Measure of Total Platform Memory)

```text
show memory
```

### 15.4. FED / Platform Anomalies

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

### 15.6. Production Forwarding After Recovery

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
