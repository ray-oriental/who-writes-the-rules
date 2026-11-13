# Who Writes the Rules for AI? — 游戏策划文档（框架版）

版本：v0.3 · 2026-11-12
用途：交给团队和 AI 编码工具，搭建可运行的原型框架
课程：POL3610J A3 Design Project（Option B）

> **怎么读这份文档**
> - 标 **[已定]** 的是组内已经讨论过的设计；标 **[建议]** 的是在讨论基础上补充的细化，可以改；标 **[待定]** 的是还没决定的参数。
> - 游戏本身是一个**框架**：代表团、红线、出席条件、议题、阈值都写在配置文件里，团队可以在初始设置上自由改，不需要改代码。
> - 配置里的示例内容只是占位，**正式使用前要按资料重写，并在 claims 表里登记来源**（课程要求：每条游戏规则都是对现实的断言）。

---

## 1. 项目定位

### 1.1 一句话

一个接入大模型 API 的模拟国际 AI 安全会议。玩家坐在某个代表团的席位上，先要设法把各方请到桌前，再和 AI 扮演的其他代表团谈判，争取让一份 AI 安全量化提案获得三分之二支持；通过的提案进入公开平台，由观众打分排名。

### 1.2 课程四行逻辑 [已定，主张已按老师意见更新]

| 步骤 | 内容 |
|---|---|
| 用户与决策 | GC Expo 上的一名工程学生，担任某代表团的技术顾问。他要决定：把哪些安全测试和及格线放上桌，为了让各方坐下来、让提案通过愿意让出什么。 |
| 政治主张 | 谁写测试，谁就提前决定了大半场谈判；但现实中更早的瓶颈是**各方根本不愿坐到一起**。一个指标只有在各方都能到场、并且能在不交出最看重之物（模型访问权、安全控制权）的前提下核验结果时，才可能跨境通用。当官方渠道停摆时，工程师之间的技术渠道往往是维持对话的方式。 |
| 他们需要什么 | 亲身体会：技术选择决定谁能通过；正确的测试如果对方无法核验照样失败；以及“谁肯上桌”在谈判开始前就框定了结果。 |
| 所以我们做 | 本游戏。 |

### 1.3 课程检验：如果主张变了，原型会不会变？

会。出席条件、红线、投票权分配、技术渠道的作用范围都直接来自政治主张，并且全部可配置。老师“各方不愿坐在一起”的意见，就直接催生了第 5.2 节的“召集阶段”。这次修改应写进 revision log。

---

## 2. 设计原则

1. **规则在代码里，不在模型里。** 轮数、投票门槛、出席判定、红线检查、结果分类都是确定性的程序逻辑。模型只负责“替各方说话”和“写报告”，不做裁判。 [已定]
2. **结构化提案 + 自由对话。** 提案由结构化条款组成（便于程序判定），谈判在聊天里进行（便于角色扮演）。 [建议]
3. **AI 不能太好说话。** 每个 AI 代表团都有隐藏的红线表和必得项，投票时程序先查表，模型只能在规定范围内调整并给出理由。 [已定/细化]
4. **玩家的技术论证必须有用。** 通过“论据标签”机制（第 5.4 节），玩家提出特定类型的技术论证可以松动对方的软性立场。这是工程知识在游戏中的“筹码”。 [建议]
5. **每条规则可追溯。** 每个配置项都可以挂一个 `source_ids`，对应 claims 表。 [已定]
6. **一切可配置、可重玩。** 复盘时允许换一套选择重玩，对比结果。 [建议]

---

## 3. 一局游戏的流程

```
┌─────────────┐   ┌────────────────┐   ┌──────────────────────────────┐   ┌───────────┐   ┌──────────┐
│ 0 选择席位  │ → │ 1 召集（上桌） │ → │ 2 谈判循环                    │ → │ 3 结果判定 │ → │ 4 公开平台 │ → 5 复盘/重玩
│ 读角色卡    │   │ 场合/议程/形式 │   │ 5轮 → 书记员报告 → 投票      │   │ 结果类型   │   │ 评分/排行 │
└─────────────┘   │ 各方决定去不去 │   │ 未达2/3 → 回到谈判（≤3次）    │   └───────────┘   └──────────┘
                  └───────┬────────┘   └──────────────┬───────────────┘
                          │  没人来/谈崩                │
                          └────────→ 技术渠道（Track 2）←┘
                                     专家达成技术附件 → 带回官方桌
```

**时长目标（Expo）** [建议]：阶段 0–1 约 2–3 分钟；每个谈判循环约 3 分钟，最多 3 个循环；总计 10–12 分钟。

---

## 4. 核心概念与术语

| 术语 | 含义 |
|---|---|
| 代表团 Delegation | 一个参会方，如中国、欧盟、美国、前沿 AI 实验室、全球南方、独立评测机构。玩家占一个，其余由 AI 扮演。 |
| 声音 Voice | 代表团内部的子角色。默认中国有两个声音：标准工程师（TC260）和监管方。用于体现“没有单一行为体”。 |
| 主席 Chair | 不投票。负责控场、点名发言、宣布进入报告和投票。 |
| 书记员 Rapporteur | AI 角色，每个循环结束时根据记录写一页报告。只总结，不判断。 |
| 场合 Forum | 谈判在哪里进行：联合国、双边、小圈子、技术标准机构等。 |
| 议程 Agenda | 这次会谈哪些议题，从议题目录中选。 |
| 条款 Clause | 提案的最小单位，形如“议题 + 参数”，例如“越狱成功率 ≤ 5%，由第三方核验”。 |
| 提案 Proposal | 一组条款加书记员的文字说明。 |
| 红线 Red line | 一旦出现就必投反对的条件（硬约束）。 |
| 必得项 Must-have | 缺了就倾向反对的条件（软约束，可被说服）。 |
| 出席条件 Attendance conditions | 决定某代表团是否愿意来某个场合的规则。 |
| 论据标签 Argument tag | 程序从玩家发言中识别出的论证类型，如“不交权重的核验方案”。 |
| 信任值 Trust | 各代表团对玩家代表团的信任，受玩家选择影响。 |
| 轮 Round | 玩家发言一次 + 2–3 个 AI 代表回应。 |
| 循环 Cycle | 5 轮 + 1 份报告 + 1 次投票。 |
| 技术渠道 Track 2 | 专家对话。约束力弱，但门槛低，产出“技术附件”。 |

---

## 5. 各阶段规则

### 5.0 选择席位 [已定]

- 玩家从代表团列表中选一个席位（可配置哪些席位允许玩家选）。
- 显示角色卡：本代表团的授权、红线、必得项、掌握的技术事实、与其他方的关系。
- 若所选代表团有多个声音，玩家扮演其中一个（默认技术顾问/工程师），另一个声音由 AI 扮演，投票前需要内部协调（见 5.5）。
- 前测：开始前回答 1 道题（见第 10 节）。

### 5.1 设计目标：为什么要有“召集阶段” [已定方向，规则为建议]

老师的意见：现实中最大的问题是各国往往不愿坐在一起。现实依据（需进 claims 表）：
- 中国不在 AI 安全研究所国际网络（2024 年成立）之内；
- 2025 年巴黎 AI 行动峰会，美国和英国没有签署宣言；
- 中国 2025 年提出成立世界人工智能合作组织，属于在既有机制之外另建平台（Johnston：inside / outside / parallel）；
- 官方对话停滞时，中美之间仍有二轨对话和科学家对话（如 IDAIS 2024 年北京共识）。资料里的“XIV Round of the U.S.-China Dialogue on AI and International Security”可能属于二轨对话，**待核实**。

### 5.2 阶段 1：召集（上桌） [建议]

玩家作为召集方或发起方，做三个选择（每个选择 3–4 个选项，均来自配置）：

| 选择 | 默认选项 | 含义 |
|---|---|---|
| 场合 forum | 联合国多边 / 中美双边 / 志同道合小圈子 / 技术标准机构（类 ISO） | 不同场合，各方的默认出席意愿不同 |
| 议程范围 agenda | 仅测试方法 / 测试+核验与访问 / 测试+出口管制 | 范围越大越有实质，但越多人不来 |
| 形式 format | 官方谈判（Track 1）/ 专家对话（Track 2） | Track 2 门槛低但结果无约束力 |

另可选：**邀请名单**（是否邀请某方）。

**出席判定（确定性）：**

```
for each delegation d (非玩家):
    if d 不在邀请名单: status = EXCLUDED
    else:
        score = d.base_willingness[forum]
              + Σ(d.attendance_conditions 中被触发的修正值)
              + trust_modifier(d.trust)
        status = ATTEND if score >= d.attend_threshold else DECLINE
    reason = 触发了哪些条件（用于界面展示和复盘）
```

- 出席条件示例：“议程含出口管制 → −3”“场合为排他性小圈子且我方不在 → 拒绝并考虑另立”“议程要求交出权重 → 实验室拒绝”。
- AI 模型只负责把拒绝理由写成一段外交辞令，不参与判定。

**平行机制（另起炉灶）：**
- 被排除或拒绝的代表团中，`parallel_forum_propensity` 高的一方可能召集平行会议。
- 平行会议不需要实时模拟：程序按这些代表团的偏好自动生成一份“对方标准”的条款集（规则生成，模型润色）。
- 结局可能出现“两套互不兼容的标准”（见 5.8）。

**最低出席要求：**
- 配置 `quorum`（如至少 4 个代表团）和 `major_powers`（如中、美、欧）。
- 不满足 quorum：会议流会，玩家可以 ① 重新召集（改选项，最多 N 次），或 ② 转入技术渠道。

**信任代价：**
- 选择排他性场合、或明确排除某方，会降低被排除方的 `trust`，影响后续出席和投票。
- 允许玩家同时参加两个场合（如主会和平行会）的规则设为 **[待定]**，默认不允许。

### 5.3 阶段 2：谈判 [已定框架，细节为建议]

**轮的定义** [已定]：玩家发言一次，然后 2–3 个 AI 代表回应。不是所有人轮流发言，否则时间不够。

**谁来回应（发言人选择算法）** [建议]：
1. 被玩家点名的代表团优先；
2. 其次是与玩家刚提出的条款冲突最大的代表团（按红线和必得项计算）；
3. 主席在需要时插话（控场、提醒剩余轮数）；
4. 每轮最多 `max_responders` 个回应者（默认 3）。

**玩家可执行的动作** [建议]：

| 动作 | 方式 | 作用 |
|---|---|---|
| 提出条款 | 结构化表单（选议题、填参数、选核验方） | 进入“桌面条款”列表 |
| 修改条款 | 表单 | 产生新版本，旧版本留痕 |
| 发言/论证 | 自由聊天 | 被打上论据标签，可能松动对方立场 |
| 点名 | 下拉选择 | 指定回应者 |
| 提供交换 side-payment | 从配置的交换项中选，如“提供共享测试集”“资助能力建设” | 提升特定代表团的满意度 |
| 私下磋商 | 与某一代表团单独对话 1 轮（每循环限 1 次） | 了解对方真实底线的一部分 |

**AI 代表的行为约束：**
- 只能使用角色简报里的事实和立场，不得编造新事实；
- 可以提出反条款（同样走结构化格式，由程序校验合法性）；
- 每次发言输出结构化数据：`{speech, stance_on_clauses, proposed_amendments, argument_tags_used}`。

### 5.4 论据标签：让技术知识变成筹码 [建议]

- 配置中定义一个**固定的论据标签列表**，例如：
  - `verify_without_weights`：提出不需要交出权重的核验方法（结构化访问、安全飞地、零知识证明等）
  - `measurement_error`：指出指标的误差或可被刷分
  - `capacity_support`：提出共享测试设施或能力建设
  - `mutual_recognition`：提出各国测试结果互认
  - `sovereignty_respect`：提出由本国机构执行、只交换结果
- 一个“标签器”模型调用把玩家的每次发言分类到 0–2 个标签，并输出置信度；低于阈值不计。
- 每个代表团的软性立场在配置里写明：哪些标签能松动它、松动多少、最多松动几次。
- 所有松动记入日志，复盘时展示“你的哪句话改变了谁”。

### 5.5 报告与投票 [已定，细化为建议]

**报告（每循环结束时）：**
- 书记员读取：本循环的对话记录 + 程序维护的“桌面条款”列表。
- 输出：一页提案，包含条款清单（来自程序，不可增删）、各方立场摘要、未解决分歧。
- **异议窗口**：投票前，任何代表团（包括玩家）都可以标记“报告歪曲了我方立场”，书记员修订一次。

**谁有投票权** [待定，做成配置开关]：
- `voting_mode: all_delegations`：所有到场代表团各一票（默认）；
- `voting_mode: states_only`：只有国家/地区投票，企业和评测机构做观察员；
- 主席不投票。

**通过门槛** [已定]：赞成票 ≥ 到场投票方的 2/3（向上取整）。可配置为 ISO 式双条件：≥ 2/3 赞成且反对票 ≤ 1/4（[建议] 作为可选项）。

**AI 代表团如何投票（确定性 + 有限调整）：**

```
for each 条款 c in 提案:
    if c 触犯 d 的任一红线: vote = NO（不可被说服），reason = 该红线
score = Σ 满足的必得项权重 − Σ 缺失的必得项权重
      + Σ 被论据标签松动的修正
      + side_payment 修正 + trust 修正
vote = YES if score >= d.vote_threshold else NO
LLM 只做两件事：
    1) 用外交语言写出投票理由（必须引用上面的判定结果）；
    2) 在 |score − threshold| ≤ ε 的“摇摆区”内，可根据本循环对话给出 ±1 调整，并说明理由。
```

**多声音代表团的内部协调**（如中国）：配置 `internal_resolution`：
- `veto_by_any`：任一声音触到红线即反对（默认，体现监管方的否决力）；
- `lead_voice`：由主导声音决定；
- `average`：两个声音的分数取平均。
- 若玩家扮演其中一个声音，投票前与另一声音进行 1 轮内部对话。

**弃权与退场** [建议]：
- 代表团可弃权，弃权不计入分母（可配置）；
- 当提案或发言触发某方 `walkout_triggers`（如议程被扩到出口管制），该方当场退场，后续不再参与投票。

### 5.6 循环与结束条件 [已定]

- 每 5 轮出一份报告并投票；
- 通过 → 进入结果判定；
- 未通过 → 回到谈判，最多 `max_cycles` 次（默认 3）；
- 3 次仍未通过 → 结局为“未达成协议”。这是合法结局，也是现实中最常见的结局；
- 中途流会（到场方低于 quorum）→ 可以转入技术渠道或结束。

### 5.7 技术渠道（Track 2） [建议]

**何时可用：**
- 召集阶段直接选择专家对话形式；或
- 官方会议流会 / 一次投票失败后，玩家选择“开专家渠道”（每局限 1 次）。

**规则：**
- 参会者是各代表团的“专家版本”，出席门槛更低（`track2_willingness` 单独配置）；
- 只能讨论 `track2_scope` 内的议题（默认：测试方法、指标定义、核验技术），不能谈出口管制、准入等政治议题；
- 运行 1 个缩短循环（3 轮 + 报告 + 投票）；
- 产出“技术附件”：约束力为零，但
  - 带回官方会议时，附件中的条款以“已有专家共识”形式进入，相关代表团对这些条款的反对分数降低（`track2_bonus`）；
  - 可以满足某些代表团的出席条件，例如“只有议程限于已有技术共识时才来”。

**设计意图**：这是整个游戏中最直接回答 Option B 的机制。官方桌坐不齐时，工程师的技术语言维持了对话（对应 Haas 的认知共同体）。

### 5.8 结果判定 [建议]

| 结局 | 判定条件 | 复盘要点 |
|---|---|---|
| 全面协议 | 提案通过，所有 `major_powers` 到场且投赞成 | 少见；问玩家付出了什么 |
| 俱乐部标准 | 提案通过，但有 `major_powers` 缺席 | 内容可能很强，但覆盖面有限 |
| 纸面标准 | 提案通过，但有 `major_powers` 投反对 | 会场通过 ≠ 被执行 |
| 标准分裂 | 主会通过，同时平行会议产生了另一套标准 | 两套标准不兼容，工程上要做双份合规 |
| 仅专家共识 | 官方未通过，但 Track 2 附件已产生 | 弱但不为零，可作为下次的起点 |
| 未达成协议 | 达到最大循环数仍未通过 | 最常见的现实结局 |

结局类型会作为标签显示在公开平台上。

### 5.9 公开平台与排行榜 [已定，细化为建议]

**发布内容**：所有通过的提案（含俱乐部标准、纸面标准）及 Track 2 附件，均附带：
- 条款清单；
- 场合、到场方、缺席方；
- 投票结果（谁赞成、谁反对）；
- 结局类型标签。

**观众评分**：三道固定题，各 1–5 分：
1. 主要大国会签吗？
2. 它真的能测吗？
3. 对不在场的国家公平吗？
另可留短评。

**防刷与审核：**
- 每位观众每份提案评一次（Expo 现场可用扫码 + 设备标识；正式可用登录）；
- 短评经过内容审核（关键词 + 模型审核），不通过则隐藏；
- 管理员可下架。

**排行榜排序：**
- 默认按三题平均分的贝叶斯平均：`(C × m + Σratings) / (C + n)`，其中 m 为全站平均，C 为可配置的先验票数，防止票数少的提案排到最前；
- 支持按结局类型筛选；
- 每条旁边同时显示会场票数，提示“会场通过 ≠ 外界承认”。

### 5.10 复盘与重玩 [建议]

复盘页展示：
- 时间线：召集选择 → 出席结果及原因 → 每循环的条款变化 → 投票；
- “你的哪句话改变了谁”：论据标签日志；
- 反事实提示：“如果你当时不把出口管制放进议程，美国/中国会出席”（由出席判定逻辑直接计算）；
- **一键重玩**：保留角色，只改召集选择，对比两局结局。这就是“自由选择加入哪个群体并观察区别”的落地方式。
- 后测：回答与前测相同的题目。

---

## 6. 配置框架

### 6.1 目录结构 [建议]

```
config/
  scenario.yaml          # 本局全局设置：席位、主席、major_powers、时长
  rules.yaml             # 轮数、循环数、门槛、投票模式、开关
  forums.yaml            # 场合列表及其属性
  agenda_catalog.yaml    # 议题/指标目录（条款模板）
  argument_tags.yaml     # 论据标签列表
  side_payments.yaml     # 可提供的交换项
  delegations/
    china.yaml
    eu.yaml
    us.yaml
    frontier_lab.yaml
    global_south.yaml
    evaluator.yaml
  prompts/
    delegate.md
    chair.md
    rapporteur.md
    tagger.md
    decline_letter.md
  claims.csv             # 断言—来源对照表
```

### 6.2 rules.yaml 示例

```yaml
rounds_per_cycle: 5
max_cycles: 3
max_responders_per_round: 3
private_talks_per_cycle: 1
voting_mode: all_delegations      # all_delegations | states_only
pass_rule:
  type: two_thirds                # two_thirds | iso_double
  negative_cap: 0.25              # 仅 iso_double 使用
abstain_counts_in_denominator: false
quorum: 4
major_powers: [china, us, eu]
reconvene_attempts: 2
track2:
  enabled: true
  uses_per_game: 1
  rounds: 3
  scope: [test_method, metric_definition, verification_tech]
  bonus: 2
swing_band: 1                     # LLM 可调整的摇摆区宽度
tagger_confidence_min: 0.6
expo_mode:
  time_limit_minutes: 12
```

### 6.3 forums.yaml 示例

```yaml
- id: un_multilateral
  name: UN Global Dialogue session
  exclusive: false
  binding_level: low
  description: 人人可来，文本最弱
- id: bilateral_us_china
  name: China–U.S. bilateral
  exclusive: true
  members_fixed: [china, us]
- id: likeminded_club
  name: Like-minded testing network
  exclusive: true
  binding_level: medium
- id: standards_body
  name: Technical standards committee (ISO-like)
  exclusive: false
  binding_level: medium
  track_preference: technical
```

### 6.4 agenda_catalog.yaml 示例（条款模板）

```yaml
- id: jailbreak_rate
  category: test_method
  label: Jailbreak success rate
  params:
    threshold_pct: {type: number, min: 0, max: 50, default: 5}
    test_set: {type: enum, values: [shared, national, lab_internal]}
- id: dangerous_capability_eval
  category: test_method
  label: Dangerous-capability evaluations (cyber / CBRN)
  params:
    domains: {type: multi, values: [cyber, bio, chem, nuclear]}
- id: compute_threshold
  category: metric_definition
  label: Compute threshold for "frontier model"
  params:
    flop: {type: enum, values: ["1e25", "1e26"]}
- id: verifier
  category: verification_tech
  label: Who verifies results
  params:
    who: {type: enum, values: [national_institute, third_party, self_report]}
- id: model_access
  category: verification_tech
  label: Level of model access for testers
  params:
    level: {type: enum, values: [api_only, structured_access, weights]}
- id: incident_reporting
  category: governance
  label: Incident reporting
- id: export_controls
  category: political
  label: Export controls on models and chips
```

### 6.5 代表团配置示例（delegations/china.yaml，内容为占位）

```yaml
id: china
name: China
type: state                  # state | firm | expert_body | regional
playable: true
voices:
  - id: tc260_engineer
    label: Standards engineer (TC260)
    priorities: [workable_tests, domestic_framework_alignment]
  - id: regulator
    label: Regulator (security and content control)
    priorities: [security_control, no_foreign_model_access]
internal_resolution: veto_by_any

attendance:
  attend_threshold: 3
  base_willingness:
    un_multilateral: 5
    bilateral_us_china: 3
    likeminded_club: -10       # 未受邀时自然排除
    standards_body: 4
  conditions:
    - when: {agenda_includes: export_controls}
      modifier: -2
      reason: "Export controls are framed as containment."
    - when: {forum_exclusive: true, not_invited: true}
      action: consider_parallel_forum
  parallel_forum_propensity: 0.7
  track2_willingness: 6

red_lines:
  - id: no_weights_access
    when: {clause: model_access, param: level, equals: weights}
    voice: regulator
    source_ids: [C-07]
must_haves:
  - id: national_execution
    when: {clause: verifier, param: who, in: [national_institute]}
    weight: 2
    softenable_by: [mutual_recognition, sovereignty_respect]
    soften_amount: 1
    max_soften: 2
    source_ids: [C-08]

side_payment_values:
  capacity_support: 1
  shared_test_set: 1

trust_initial: 0
walkout_triggers:
  - {agenda_includes: human_rights_conditionality}

brief: |
  （此处写给 AI 的角色简报：立场、语气、可用事实、不能说的话。
    每个事实后面标 claims 编号。）
style: formal, cites domestic framework, avoids direct confrontation
```

> 其他代表团（欧盟、美国、前沿实验室、全球南方、独立评测机构）用同一结构。团队的主要工作量就在这里：**按资料填写出席条件、红线、必得项和简报，并登记来源**。

### 6.6 argument_tags.yaml 示例

```yaml
- id: verify_without_weights
  description: Proposes a way to verify results without handing over model weights
  examples: ["structured access", "secure enclave", "third-party API testing"]
- id: measurement_error
  description: Points out error bars, gaming or Goodhart effects of a metric
- id: mutual_recognition
  description: Proposes mutual recognition of national test results
- id: capacity_support
  description: Offers shared testing facilities or training
- id: sovereignty_respect
  description: Keeps testing under national institutions, only results are shared
```

### 6.7 claims.csv 模板

```csv
id,claim,used_in,source,confidence,notes
C-01,China is not a member of the International Network of AI Safety Institutes,attendance/china,NIST mission statement 2024,high,
C-02,The U.S. and UK did not sign the Paris AI Action Summit declaration (2025),attendance/us,,high,补来源链接
C-07,Chinese regulators will not accept foreign access to model weights,red_lines/china,,low,假设，需文献支撑
```

`confidence` 一栏用来标出团队最没把握的断言，dossier 和海报里要主动说明（课程要求）。

---

## 7. AI 角色与提示词约定

| 角色 | 调用时机 | 输入 | 输出（结构化） | 不允许 |
|---|---|---|---|---|
| 代表团（每个声音一个） | 被选为回应者时 | 角色简报、当前条款、最近对话、本方判定结果 | `speech`, `stance_on_clauses`, `amendments`, `tags_used` | 编造简报外事实；违背红线 |
| 主席 | 每轮开始/结束、进入报告和投票时 | 状态机状态 | `speech`, `next_speakers`（建议，程序可覆盖） | 投票；评价优劣 |
| 书记员 | 每循环结束 | 对话记录、条款列表、各方立场 | `summary`, `positions`, `open_issues` | 增删条款；判断是否“平衡” |
| 标签器 | 玩家每次发言后 | 玩家发言、标签列表 | `[{tag, confidence}]` | 输出列表外标签 |
| 拒信撰写 | 召集阶段有人拒绝时 | 判定理由 | 一段外交辞令 | 改变判定结果 |
| 审核器 | 公开平台评论提交时 | 评论文本 | `allow / block` | — |

通用要求：
- 所有模型输出必须是 JSON，程序校验失败则重试一次，再失败用模板兜底；
- 温度建议：代表团 0.7，书记员/标签器 0.2；
- 模型供应商通过一个统一接口调用，可替换（[建议] 抽象为 `LLMClient.complete(role, messages, schema)`）。

---

## 8. 系统架构

```
[Web 前端]
  ├─ 玩家界面：角色卡 / 召集面板 / 会场聊天 / 条款表单 / 投票 / 复盘
  ├─ 公开平台：提案列表 / 评分 / 排行榜
  └─ 管理界面：编辑配置、查看日志、下架内容
        │
[后端 Orchestrator（状态机）]
  ├─ 召集判定  ├─ 发言人选择  ├─ 条款管理  ├─ 投票判定
  ├─ 结局分类  ├─ 信任/松动计算  └─ 日志
        │
[LLM 接口层] ── 任意供应商
        │
[存储] sessions / clauses / votes / logs / proposals / ratings / config
```

**状态机** [建议]：

```
SEAT_SELECT → PRE_QUIZ → CONVENE → (CONVENE_RETRY)* →
  ┌→ NEGOTIATE(round 1..5) → REPORT → OBJECTION → VOTE ─┐
  └──────────────── fail & cycle < max ←────────────────┘
  → TRACK2 (可选，从 CONVENE 失败或 VOTE 失败进入) → RETURN_TO_TRACK1
  → OUTCOME → PUBLISH → DEBRIEF → POST_QUIZ → (REPLAY)
```

**纸质备用版** [已定]：同一套配置导出为角色卡、条款卡和判定表，由组员扮演主席，现场断网时可用。

---

## 9. 界面清单

| 页面 | 关键元素 |
|---|---|
| 选席位 | 代表团卡片、简介、难度提示 |
| 角色卡 | 授权、红线（玩家可见自己的）、必得项、技术事实、与各方关系 |
| 召集面板 | 场合/议程/形式/邀请名单选择；出席结果动画；拒信 |
| 会场 | 圆桌座位图（缺席者显示空椅子）、聊天区、桌面条款列表、剩余轮数、信任指示 |
| 条款表单 | 选议题、填参数、选核验方 |
| 报告与投票 | 报告正文、异议按钮、投票结果（逐个显示） |
| 结局页 | 结局类型、到场/缺席、票数 |
| 复盘页 | 时间线、论据影响、反事实提示、重玩按钮、后测 |
| 公开平台 | 排行榜、筛选、评分三题、短评 |

---

## 10. 日志与测试数据

为课程的两次结构化测试、revision log 和 dossier 提供数据：

- 每局记录：所选席位、召集选择、出席结果、每轮发言、标签、条款版本、投票、结局、用时、在哪一步停留最久；
- 前测/后测题（同一题）：**“说出三个影响 AI 安全规则的行动者，以及他们之间的一个取舍。”** 统计前后答出的有效行动者数量和是否提到取舍；
- 可选第二题（检验新机制）：**“为什么各方有时根本不愿坐到一起？”**
- 公开平台的评分和短评作为 Expo 当天的第三次测试数据；
- 导出为 CSV，便于写进 dossier。

---

## 11. MVP 范围与开发顺序 [建议]

按 12 月 1 日前要有可运行原型的节点倒排：

| 优先级 | 内容 | 说明 |
|---|---|---|
| P0 | 配置加载、状态机、谈判循环、书记员、2/3 投票、红线判定 | 能完整跑完一局 |
| P0 | 召集阶段（场合 + 议程两项选择）与出席判定 | 老师意见的核心 |
| P0 | 结局分类、简单复盘、日志导出 | 测试需要 |
| P1 | 论据标签与松动机制 | 体现工程知识的价值 |
| P1 | 技术渠道 Track 2 | Option B 的关键论点 |
| P1 | 公开平台：评分 + 排行榜 | Expo 展示 |
| P2 | 多声音代表团的内部协调、私下磋商、side-payment | 丰富度 |
| P2 | 平行会议与“标准分裂”结局 | 可以先用固定文本代替 |
| P2 | 管理界面、内容审核 | Expo 前补上 |

建议先做**纸质版跑一次**（组员扮演 AI 代表团），确认规则和时长，再接模型。

---

## 12. 默认参数与待定问题

| 参数 | 默认值 | 状态 |
|---|---|---|
| 每循环轮数 | 5 | [已定] |
| 通过门槛 | 2/3 | [已定] |
| 最大循环数 | 3 | [建议] |
| 投票模式 | 所有代表团 / 仅国家 | [待定]，两种都测 |
| 每轮回应人数 | 2–3 | [建议] |
| 默认代表团 | 中国（两个声音）、欧盟、美国、前沿实验室、全球南方、独立评测机构 | [已定]，可改 |
| 主席 | AI，不投票 | [已定] |
| 召集阶段选项数 | 场合 + 议程 + 形式 | [建议] |
| 能否同时参加两个场合 | 不允许 | [待定] |
| Track 2 次数 | 每局 1 次 | [建议] |
| 玩家是否能看到他人红线 | 看不到，私下磋商可得部分信息 | [建议] |
| 提案覆盖哪些指标 | 见议题目录 | [待定]，需团队选 3–4 个核心 |
| 红线严格程度 | 每方 1–2 条红线 + 2–3 个必得项 | [待定]，太松什么都过，太严什么都不过，需试玩调参 |

**仍需团队决定或补证据：**
1. 各代表团出席条件和红线的资料来源（目前多为假设）；
2. 中国“两个声音”分歧的证据；
3. Team work #2 所需的真实履约不足案例（可作为某个代表团的“历史包袱”写进简报）；
4. 资料中 2026 年中美 AI 对话（XIV Round）的性质与日期。

---

## 13. 与课程要求的对应

| A3 要求 | 本设计中的位置 |
|---|---|
| 问题陈述（用户 + 决策） | 1.2 |
| ≥ 8 个可信来源 | claims.csv + PPT Sources 页 |
| 系统图 | 代表团、场合、出席条件、信任和反馈关系可直接导出为系统图 |
| 明确的设计要求 | 第 2 节原则 + 第 5 节规则 |
| 可演示原型 | 第 8、11 节 |
| ≥ 2 次结构化测试 | walkthrough + adversarial（试图操纵书记员、诱导 AI 放弃红线、用空洞提案骗过投票），第 10 节提供数据 |
| Revision log | 本文档版本记录；v0.3 的修改：加入召集阶段和技术渠道（来源：11 月课堂讨论中老师的意见） |
| Dossier | 第 13 节与 claims 表为基础 |

---

## 附：版本记录

| 版本 | 修改 | 原因 |
|---|---|---|
| v0.1 | 模拟 AI 安全大会 + API 角色扮演平台 | 初始构想 |
| v0.2 | 加入 5 轮一报告、2/3 投票、公开平台评分和排行榜；书记员不做裁判、红线表、最多 3 次循环 | 组内讨论 + 防止 AI 附和、保证可复现 |
| v0.3 | 加入召集阶段（上桌）、出席条件、平行机制、技术渠道、结局分类、复盘重玩 | 老师意见：最大的问题是各国不愿坐在一起 |
