# 让资料改变游戏，以及新增一个代表团 · Turning evidence into behaviour, and adding a delegation

本指南接在 [研究资料指南](RESEARCH-GUIDE.md) 之后。那一份讲怎么查资料、怎么提交；这一份讲查到的资料如何真正改变代表团的行为，以及怎么新增一个代表团并给它配齐资料。每节先给中文，再给对应的英文。

This guide follows the [research guide](RESEARCH-GUIDE.md). That one covers finding and submitting evidence; this one covers how evidence actually changes a delegation's behaviour, and how to add a delegation with enough material behind it. Each section gives the Chinese text first, then the English.

---

## 1. 只维护资料是不够的 · Maintaining evidence is not enough

游戏里的代表团由两部分驱动，二者都不读 `claims` 和 `research`：

1. **规则引擎**决定一切结果：谁来开会、谁对哪条条款反对、谁被说动、谁投赞成、谁退场。它只读规则字段（出席、红线、必得项、投票门槛等）。
2. **语言模型**（或离线模板）只负责把引擎的决定说成外交辞令。它读角色简报、风格、事实和每条规则的 `say` 句子，不能改变立场。

`claims` 和 `research` 是给人看的证据账本：说明每条规则凭什么这样写，还缺什么证据。**查到资料之后，必须有人把结论改写进规则字段，游戏才会变。**一条断言从 `low` 升到 `high`，游戏行为不会有任何变化。

Two things drive a delegation, and neither reads `claims` or `research`:

1. **The rules engine** decides every outcome: who attends, who opposes which clause, who is persuaded, who votes yes, who walks out. It reads only the rule fields (attendance, red lines, must-haves, vote threshold and so on).
2. **The language model** (or the offline templates) only puts the engine's decisions into diplomatic words. It reads the brief, style, facts and each rule's `say` sentence, and it cannot change a position.

`claims` and `research` are the evidence ledger for people: why each rule is written the way it is, and what evidence is still missing. **Once a source is found, someone must rewrite the conclusion into the rule fields, or the game does not change.** Raising a claim from `low` to `high` changes nothing in play.

### 1.1 每个字段由谁读、起什么作用 · Who reads each field, and what it does

| 字段 · Field | 引擎 · Engine | 模型 · Model | 玩家看到 · Player sees | 作用 · Effect |
| --- | :---: | :---: | :---: | --- |
| `attendance` | ✔ | | 拒信、出席理由 · decline letters, reasons | 是否来开会 · whether it comes |
| `red_lines` | ✔ | `say` | 发言、复盘 · speeches, debrief | 碰到就反对并投反对票 · opposes and votes no when hit |
| `must_haves` | ✔ | `say` | 发言、复盘 · speeches, debrief | 加减分，可被论据软化 · adds or subtracts score; softened by arguments |
| `vote_threshold`, `trust_initial`, `side_payment_values` | ✔ | | 投票结果 · vote result | 投票门槛、初始信任、让步价值 · vote bar, starting trust, value of offers |
| `walkout_triggers` | ✔ | `say` | 退场 · walkout | 触发即离场 · leaves when triggered |
| `voices`, `internal_resolution` | ✔ | ✔ | 发言人 · who speaks | 内部多个声音如何合并 · how internal voices combine |
| `brief`, `style`, `facts` | | ✔ | 发言内容 · what is said | 模型能说什么、怎么说 · what the model may say and how |
| `summary`, `mandate`, `relations` | | | 角色卡 · role card | 给玩家的说明 · explanation for the player |
| `claims`, `research` | | | Research 页 · Research page | 证据账本 · evidence ledger |

`facts` 是模型**唯一**被允许引用的事实。没写进 `facts` 的资料，模型不会说，也不该编。

`facts` are the **only** facts the model may cite. Anything not in `facts` the model will not say, and must not invent.

### 1.2 从资料到规则的四步 · Four steps from evidence to rule

1. **查**：完成研究任务，写好断言（见研究资料指南）。 · **Find**: answer the research need and write the claim (see the research guide).
2. **判断影响哪条规则**：看断言的 `used_in`，或者在文件里搜它的 ID 出现在哪些 `source_ids` 里。 · **Find the rule it affects**: read the claim's `used_in`, or search the file for which `source_ids` contain its ID.
3. **改规则**：把结论写成条件、分值或句子。数值没有资料能直接证明，这是正常的：写一个合理值，`confidence` 保持 `low`，在 `notes` 写“平衡参数”。 · **Change the rule**: express the finding as a condition, a score or a sentence. No source proves a number directly, and that is normal: choose a reasonable value, keep `confidence: low`, and note "balance parameter".
4. **试玩**：至少用两个不同席位各玩一局，确认行为和资料说的一致，再提 PR。PR 里写清“资料说什么 → 改了哪条规则 → 试玩结果”。 · **Playtest**: play at least once from two different seats, confirm the behaviour matches the evidence, then open the PR. In the PR, state "what the source says → which rule changed → what the playtest showed".

### 1.3 例子：中国邀请美国谈 AI 安全，现实吗？ · Example: is it realistic that China can invite the US to talk AI safety?

早期配置里，中国在任何会场邀请美国，只要议程不含出口管制，美国几乎都会来。那是三层东西叠在一起：

| 层 · Layer | 依据 · Basis | 可信度 · Confidence |
| --- | --- | --- |
| 中美之间存在官方 AI 对话渠道 · An official China–US AI channel exists | 2024 年 5 月日内瓦首次政府间 AI 对话（`C-US-02`），以及之后双方元首表态支持继续对话（`C-US-14`、`C-CN-15`） · The first intergovernmental AI dialogue in Geneva, May 2024, and later leader-level support for continuing it | high / medium |
| 玩家可以作为东道主随意发邀请 · The player can invite anyone as host | 教学上的简化（`C-GEN-01`） · A teaching simplification | low |
| 美国在各会场的出席意愿 · US willingness per forum | 早期是统一的 4 分（团队假设 `C-US-04`） · Originally a flat 4 (team assumption) | low |

所以当时的答案是：**渠道存在是真的，但“美国一定会来”是资料不够时的假设。** 这一轮内容更新已经按资料把它改掉了，现在的规则是（见 `us.yaml`、`china.yaml` 的 `attendance`）：

- 双边会场只适合做**风险沟通渠道**：议程只谈测试时，中美都会来；议程含验证安排时，美国减 2 分不来（日内瓦对话只产出了“保持沟通”，`C-US-13`、`C-US-14`）；议程含出口管制时，中国拒绝。双边会场只有两方，永远达不到法定人数，所以它通不过任何标准。
- 想通过标准，要去多边会场。美国在联合国会场遇到“治理”议程会减 1 分（`C-US-03`、`C-US-12`）。
- 中国会参加美国主导的“志同道合俱乐部”，但前提是邀请了全球南方、议程里有互认（`cn_club_with_recognition`）；不邀请全球南方则减 2 分（`cn_club_without_global_south`）。

Earlier, if China invited the US to any forum without export controls on the agenda, the US almost always attended. Three layers were stacked (table above), so the answer was: **the channel is real, but "the US will come" was an assumption made for lack of evidence.** This content pass replaced it with evidence-based rules (see `attendance` in `us.yaml` and `china.yaml`):

- The bilateral works as a **risk channel** only. With a tests-only agenda both attend. With verification on the agenda the US loses 2 points and stays away: Geneva produced only "keep talking" (`C-US-13`, `C-US-14`). With export controls on the agenda China refuses. A bilateral has two members and never reaches quorum, so it cannot adopt a standard.
- To pass a standard, go multilateral. The US loses 1 point at the UN when governance is on the agenda (`C-US-03`, `C-US-12`).
- China joins a US-led like-minded club only if the Global South is invited and mutual recognition is on the agenda (`cn_club_with_recognition`); without the Global South it loses 2 points (`cn_club_without_global_south`).

改这类规则的写法如下（这就是 `us.yaml` 里实际用的条件）· The rule is written like this (the condition actually used in `us.yaml`):

```yaml
attendance:
  attend_threshold: 3
  base_willingness: {un_multilateral: 4, bilateral_us_china: 4, likeminded_club: 5, standards_body: 4}
  conditions:
    - id: us_bilateral_risk_channel
      when: {forum: bilateral_us_china, agenda_includes: verification_tech}
      modifier: -2
      say: A bilateral channel is for risk communication; we will not negotiate verification arrangements there.
      source_ids: [C-US-13, C-US-14]
```

数值本身仍是平衡参数（`confidence: low`），条件和理由要以查到的资料为准。改完后，用中国的席位分别在双边会场和联合国会场试玩，看出席页给出的理由是否符合资料（拒信在 **Why some did not come** 里，法定人数不足时自动展开；要选专家渠道，先点开 **Meeting format … (change)**）。

The numbers themselves remain balance parameters (`confidence: low`); the conditions and reasons must follow the evidence. After a change, play the China seat in both the bilateral and the UN forum and check that the reasons shown on the attendance screen match the evidence (the letters are under **Why some did not come**, which opens by itself when quorum fails; to pick the expert channel, first open **Meeting format … (change)**).

---

## 2. 新增一个代表团 · Adding a delegation

### 2.1 先想清楚 · Decide first

在动手前，在 Issue 里写下四件事，让组内讨论：

1. **它代表谁**：一个国家、一个地区组织、一家公司还是一个专家机构（对应 `type`：`state`、`regional`、`firm`、`expert_body`）。
2. **为什么需要它**：它给谈判带来了哪种现有六方没有的利益或冲突。没有新冲突的代表团只会让游戏更长。
3. **玩家能不能扮演它**（`playable`），以及难度（`difficulty`：`easier`、`medium`、`harder`）。
4. **负责人**：谁维护这个文件（`owner`，写 GitHub 用户名）。

Before starting, write four things in an Issue for the group to discuss:

1. **Who it represents**: a state, a regional body, a company or an expert body (`type`: `state`, `regional`, `firm`, `expert_body`).
2. **Why it is needed**: which interest or conflict it adds that the current six lack. A delegation that adds no new conflict only makes the game longer.
3. **Whether players can take its seat** (`playable`) and how hard it is (`difficulty`: `easier`, `medium`, `harder`).
4. **Who maintains it** (`owner`, a GitHub username).

### 2.2 两种建法 · Two ways to create it

**方式一：游戏里的编辑器（推荐起步）** · **Option 1: the in-game editor (recommended to start)**

1. 打开 **Team → Delegations → Add a delegation**，填名称、2–4 个字母的徽章缩写和类型，点 **Start the draft**。 · Open **Team → Delegations → Add a delegation**, enter the name, a 2–4 letter badge and the type, then click **Start the draft**.
2. 编辑页顶部的 **What this delegation still needs** 会逐项列出缺什么，按它填。 · **What this delegation still needs** at the top of the editor lists what is missing; work through it.
3. 点 **Save in this browser**，在本机试玩。 · Click **Save in this browser** and playtest on your machine.
4. 新代表团还不在仓库里，所以 **Open on GitHub** 会打开“新建文件”页面。点 **Copy YAML**，粘贴进去，提交 PR。 · The delegation is not in the repository yet, so **Open on GitHub** opens a "new file" page. Click **Copy YAML**, paste it there, and open a PR.

**方式二：在 GitHub 上复制一个现有文件** · **Option 2: copy an existing file on GitHub**

1. 选一个最接近的代表团（国家选 `eu.yaml`，公司选 `frontier_lab.yaml`），打开后点 **Raw**，全选复制。 · Pick the closest delegation (`eu.yaml` for a state, `frontier_lab.yaml` for a company), open it, click **Raw** and copy everything.
2. 进入 `config/delegations/`，点 **Add file → Create new file**，文件名用小写加下划线，例如 `african_union.yaml`。文件名必须和 `id` 一致。 · In `config/delegations/`, click **Add file → Create new file**. Use lowercase with underscores, such as `african_union.yaml`; the name must match `id`.
3. 改 `id`、`name`、`short`，然后逐节替换内容。所有断言 ID 改成新缩写，例如 `C-AU-01`、`R-AU-01`。 · Change `id`, `name` and `short`, then replace every section. Rename all claim and research IDs to the new code, such as `C-AU-01` and `R-AU-01`.

只加这一个文件，游戏就能加载它（会排在座位顺序最后，并给出提示）。

This one file is enough for the game to load it (it is seated last, with a notice).

### 2.3 必须一起检查的其他文件 · Other files to check at the same time

| 文件 · File | 要做什么 · What to do |
| --- | --- |
| `config/scenario.yaml` → `seats` | 把新 ID 放进座位顺序（决定圆桌上的位置）。 · Add the new ID to the seat order (its place at the round table). |
| `config/rules.yaml` → `quorum` | 法定人数是固定数字（现在是 4）。多了一方后，考虑是否调高。 · Quorum is a fixed number (currently 4). With one more seat, consider raising it. |
| `config/rules.yaml` → `major_powers` | 只有中美欧算大国，影响结局类型。新代表团是大国才加。 · Only China, the US and the EU count as major powers, which shapes the outcome type. Add the new one only if it is one. |
| `config/forums.yaml` | 双边会场的 `members_fixed` 只有中美，新代表团进不去，这是对的。如果它属于某个会场，检查这个会场的设定。 · The bilateral forum's `members_fixed` is China and the US only, so the new one cannot join it, which is correct. If it belongs to a forum, check that forum. |
| 其他代表团的 `relations` · Other delegations' `relations` | 可选：给现有六方各加一句它们怎么看新代表团。 · Optional: add one line to each existing delegation on how it sees the newcomer. |
| `config/argument_tags.yaml`, `config/side_payments.yaml` | 只能引用这里已有的论点和让步。需要新的就在这里加，并在 PR 里说明。 · A delegation can only use the arguments and offers listed here. Add a new one here if needed, and say so in the PR. |

### 2.4 一个“够用”的代表团需要什么 · What a complete delegation needs

下面是最低要求。编辑器的 **What this delegation still needs** 会检查其中大部分。

This is the minimum. **What this delegation still needs** in the editor checks most of it.

| 部分 · Section | 最低要求 · Minimum | 写法提示 · Tips |
| --- | --- | --- |
| 身份 · Identity | `name`, `short`, `type`, `playable`, `difficulty`, `owner`, `summary`, `mandate` | `summary` 一句话，出现在选席卡片上。 · `summary` is one sentence shown on the seat card. |
| 事实 · Facts | 3–5 条，每条有 `source_ids` · 3–5, each with `source_ids` | 只写查证过的事实，模型只会用这些。 · Verified facts only; the model uses nothing else. |
| 关系 · Relations | 对其他每一方各一句 · One line per other delegation | 写态度，不写分数。 · Attitude, not numbers. |
| 出席 · Attendance | `attend_threshold`；**`base_willingness` 必须写全四个会场**；`track2_willingness`；`parallel_forum_propensity`；1–3 条 `conditions` · threshold; **all four forums in `base_willingness`**; Track 2 willingness; parallel-forum propensity; 1–3 conditions | 漏写一个会场等于意愿 0，它在那里永远不来。 · A forum left out counts as 0, so it never attends there. |
| 红线 · Red lines | 0–2 条 · 0–2 | 真正不可谈判的才算。太多会让任何文本都过不了。 · Only what is truly non-negotiable. Too many and no text can pass. |
| 必得项 · Must-haves | 2–3 条，带 `weight`（1–3）和 `softenable_by` · 2–3, with `weight` (1–3) and `softenable_by` | `softenable_by` 写哪种论点能让它让步，玩家的发言才有作用。 · `softenable_by` names the arguments that move it; without it, statements have no effect. |
| 投票 · Voting | `vote_threshold`, `trust_initial`, `side_payment_values` | 大国目前用 3，其他方用 2。分数越高越难争取。 · Major powers use 3 now, the others 2. Higher is harder to win. |
| 退场 · Walkouts | 0–1 条 · 0–1 | 可选。 · Optional. |
| 声音 · Voices | 内部有明显分歧时才加，否则 `voices: []` · Only with a real internal split; otherwise `voices: []` | 加了就要写 `internal_resolution`。 · If added, set `internal_resolution`. |
| 简报 · Brief | `brief` 5–8 句，`style` 1 句 · `brief` 5–8 sentences, `style` one | 写立场、能用的事实（按断言 ID）、绝不能说的话。 · Position, usable facts (by claim ID), things never to say. |
| 断言 · Claims | 每条规则至少被一条断言支撑 · Every rule backed by at least one claim | 事实类尽量 `high`，数值类保持 `low`。 · Facts aim for `high`; numbers stay `low`. |
| 研究任务 · Research | 每条 `low` 断言至少一项任务 · At least one task per `low` claim | 问题要具体，写出线索。 · Ask a concrete question and give leads. |

每条红线、必得项、出席条件和退场条件都要有 `say`（用代表团自己的口吻）和 `source_ids`。

Every red line, must-have, attendance condition and walkout trigger needs a `say` sentence in the delegation's own voice, and `source_ids`.

### 2.5 新代表团的研究任务清单 · Starter research list for a new delegation

新建时先把这六项写进 `research`（把 `XX` 换成缩写），状态都是 `todo`。它们正好对应上面每一部分规则：

When you create it, add these six to `research` (replace `XX` with its code), all `todo`. Each maps to one part of the rules above:

| ID | 问题 · Question | 支撑哪些规则 · Supports |
| --- | --- | --- |
| R-XX-01 | 它发布过哪些关于 AI 安全测试或评估的官方立场？ · What official positions has it published on AI safety testing or evaluation? | `summary`, `mandate`, `facts`, `brief` |
| R-XX-02 | 它参加或拒绝过哪些 AI 治理会议和网络，理由是什么？ · Which AI governance meetings and networks has it joined or declined, and why? | `attendance` |
| R-XX-03 | 它在模型权重、访问权限和出口管制上的公开立场是什么？ · What are its public positions on model weights, access and export controls? | `red_lines`, `walkout_triggers` |
| R-XX-04 | 它希望由谁执行测试、谁来核验、结果是否互认？ · Who does it want to run tests, who should check them, and should results be recognised across borders? | `must_haves` |
| R-XX-05 | 它和其他六方的合作与分歧有哪些有记录的例子？ · What documented examples of cooperation and disagreement does it have with the other six? | `relations`, `trust_initial` |
| R-XX-06 | 它内部是否有立场明显不同的机构，谁有最终决定权？ · Does it have internal bodies with clearly different positions, and who decides? | `voices`, `internal_resolution` |

### 2.6 试玩和平衡 · Playtest and balance

1. **扮演它**玩一局：角色卡是否讲清了它要什么？ · **Play as it**: does the role card make clear what it wants?
2. **用中国和美国各玩一局**，把它邀请进来：出席页的理由是否合理？它在“The room”里的倾向会不会被合适的论点改变？ · **Play as China and as the US** with it invited: are the attendance reasons sensible? Does its leaning in "The room" respond to the right arguments?
3. 看复盘页：它投票的理由是否和资料一致？（复盘各部分是折叠的，逐项展开。） · Read the debrief: do its vote reasons match the evidence? (Debrief sections are folded; open them one by one.)
4. 好的代表团**既不是永远赞成，也不是永远反对**：合理的打法能争取到它，草率的打法会失去它。 · A good delegation is **neither always yes nor always no**: careful play wins it, careless play loses it.
5. 想重来时点进度条旁的 **Restart**（确认一次，不会清除 Gallery 数据），不需要清理浏览器数据。 · To start over, use **Restart** beside the progress bar (one confirmation; gallery data is kept). There is no need to clear site data.
6. 可玩席位测试：每个代表团小组可以加一个 `tests/playable-<id>.test.ts`，离线跑一个获胜打法和一个天真打法，断言各自的结局。现有的例子是 `tests/playable-cnus.test.ts`（中国、美国）、`tests/playable-eugs.test.ts`（欧盟、全球南方）、`tests/playable-labeval.test.ts`（实验室、评估机构的投票），CI 会运行它们。改了数值后如果这些测试失败，说明某个席位的获胜打法被你改坏了，要么调整数值，要么在 PR 里说明为什么该改测试。 · Playable-seat tests: each delegation group may add `tests/playable-<id>.test.ts`, which plays a winning strategy and a naive strategy offline and asserts each outcome. The existing examples are `tests/playable-cnus.test.ts` (China, US), `tests/playable-eugs.test.ts` (EU, Global South) and `tests/playable-labeval.test.ts` (how the lab and the evaluator vote), and CI runs them. If one fails after you change a number, you broke a seat's winning strategy: adjust the number, or explain in the PR why the test should change.

### 2.7 提交时的预期 · What to expect when you submit

按 [研究资料指南](RESEARCH-GUIDE.md) 第 5、6 节提 PR。新增代表团会改变座位数和所需票数，所以 CI 里有几项检查**预计会失败**：

- `tests/simulation.test.ts` 写死了六方时所需的票数；
- `tests/browser-smoke.mjs` 写死了 Research 页有 7 个档案链接。

这不是你的错。在 PR 里说明“新增代表团，预计测试需要更新”，由维护者更新测试后再合并。除这两处之外的报错仍需要你修。

Open the PR as in sections 5 and 6 of the [research guide](RESEARCH-GUIDE.md). A new delegation changes the number of seats and the votes needed, so some CI checks are **expected to fail**:

- `tests/simulation.test.ts` fixes the votes needed with six delegations;
- `tests/browser-smoke.mjs` fixes the Research page at seven dossier links.

This is not your mistake. Say "adds a delegation; tests need updating" in the PR, and the maintainer updates the tests before merging. Any other error is still yours to fix.
