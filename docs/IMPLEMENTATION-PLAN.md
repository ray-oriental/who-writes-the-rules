# Who Writes the Rules for AI? — 原型实现计划

## Context

课程 POL3610J A3（Option B）要做一个可演示的原型。设计依据是 [DESIGN.md](DESIGN.md)（v0.3，下称「策划」）。玩法是模拟一场国际 AI 安全会议：玩家先召集各方，再和 AI 扮演的代表团谈判，争取让一份量化提案拿到 2/3 支持。12 月 1 日前必须有能跑通的原型。

本计划交给「Fable 5.2 统领的 Codex GPT 集群 + Sonnet 集群」实现，用户提出的要求如下：
- 能跑、能用、稳定。断网或没有 API key 时也要能完整玩一局。
- 别人 clone 下来，或者下载 release 后，在自己电脑上能直接打开。
- 不要做复杂，界面要好看，并且和政治主张相匹配。

用户已经确认的决定：**界面用英文**（AI 发言语言单独做成配置项）；**GitHub 仓库公开**；**不做共享排行榜**，排行榜只存在本机，Expo 当天在同一台电脑上轮流评分。

## 核心架构决定

**整个游戏是一个纯静态单页应用，不需要后端。** 游戏引擎、配置和存储都在浏览器里运行，LLM 直接从浏览器调用。这样会有三种打开方式，用的是同一份代码：

| 方式 | 给谁 | 怎么做 |
|---|---|---|
| GitHub Pages 在线版 | 任何人点开就玩 | push 到 main 后由 Actions 自动部署 |
| Release 单文件 `who-writes-the-rules.html` | 下载后双击就能打开，不装任何东西，离线也能用 | 用 `vite-plugin-singlefile` 把所有 JS/CSS/配置内联成一个 HTML |
| clone 后开发 | 组员改配置、改代码 | `npm ci && npm run dev`，改 YAML 后热更新 |

**LLM 有三种模式，在 Settings 页切换：**
1. `mock`（默认）：确定性的模板生成器，不联网，不需要 key。它保证游戏永远能跑，也是测试和断网备用方案的基础。
2. `direct`：任何 OpenAI 兼容端点（`POST {baseURL}/chat/completions`），内置 DeepSeek、Kimi、通义（兼容模式）、OpenAI、本地 Ollama、Custom 几个预设。key 只存在本机 localStorage，界面要明确提示这一点。
3. `proxy`：附带一个零依赖脚本 `tools/llm-proxy.mjs`，用 `node tools/llm-proxy.mjs` 启动。它从环境变量 `LLM_API_KEY` / `LLM_BASE_URL` 读取配置，监听 `127.0.0.1:8787` 并加上 CORS 头。这一档用来解决某些服务商不允许浏览器跨域的问题，也避免 Expo 现场在浏览器里留下 key。

每次调用都设 30 秒超时。返回结果用 zod 校验，校验失败重试一次；再失败，**这一次调用**就退回 mock，界面上显示一个小的「offline fallback」标记。游戏本身不会因此中断。

**技术栈尽量少：** Vite + React 18 + TypeScript、`zod`、`js-yaml`、`vitest`。不引入 UI 框架、状态库或路由库：路由用自写的 hash 路由（file:// 和 Pages 下都能用），状态用 `useReducer` 加一个 controller。样式用纯 CSS 加 CSS 变量（design tokens），字体只用系统字体栈，不引用外部字体，保证单文件版能离线打开。

**规则在代码里，不在模型里（策划 §2.1）：** 出席判定、发言人选择、红线、必得项、松动、投票、结局分类全部是 `src/engine/` 里的纯函数，用种子随机数保证确定性。模型只负责「说话」和「写报告」。

## 仓库与目录

- 本地仓库目录命名为 `who-writes-the-rules`。`.stignore` 已经排除 `node_modules` 和 `.env`，所以不需要再改。完成后在工作区 `AGENTS.md` 的 Project map 里加一行。
- GitHub：在用户账号下建公开仓库 `who-writes-the-rules`，MIT 许可证。**创建仓库和第一次 push 属于外部动作，执行前要让用户确认。**
- 公开仓库的隐私门禁：仓库里不能出现个人姓名、邮箱或本机路径。CI 里加一步 grep，扫描 `sk-`、`api_key:` 这类密钥特征。

```
who-writes-the-rules/
  AGENTS.md                # 给实现 agent 的约束：目录所有权、命令、验收门禁
  README.md                # 三种打开方式、LLM 设置、怎么改配置
  docs/DESIGN.md           # 策划文档原文（v0.3），之后的修订记在 docs/REVISION-LOG.md
  docs/CONFIG-GUIDE.md     # 写给不写代码的组员：每个 YAML 字段的含义和示例
  config/                  # 结构沿用策划 §6.1，另加两个文件：
    scenario.yaml rules.yaml forums.yaml agenda_catalog.yaml convene.yaml
    argument_tags.yaml side_payments.yaml quiz.yaml claims.csv
    delegations/{china,eu,us,frontier_lab,global_south,evaluator}.yaml
    prompts/{delegate,rapporteur,tagger,decline_letter}.md
  src/engine/              # 纯 TS，不碰 DOM，不做网络请求
  src/llm/                 # client、mock、各角色的 prompt 组装与 schema
  src/game/                # controller（异步编排 engine 和 llm）、persistence
  src/platform/            # 本机提案库、评分、贝叶斯排名、CSV/JSON 导出
  src/ui/                  # screens/、components/、styles/tokens.css、fixtures.ts
  tests/                   # engine 单测、配置校验、整局模拟
  tools/llm-proxy.mjs
  .github/workflows/{ci.yml,pages.yml,release.yml}
```

- `convene.yaml`：召集面板里的 `agenda_scopes`（如 tests_only / tests_verification / tests_export_controls），每项对应允许出现的议题类别（category）；另有 `formats`（track1/track2）。
- `quiz.yaml`：学习题目（策划 §10），附 `enabled` 开关。当前只在结尾出现，全部可选，可跳过（开场前测已移除）。

## 配置加载与校验

- 用 `import.meta.glob('/config/**/*', { query: '?raw', eager: true })` 在构建时打包全部配置。这样单文件版自带配置，dev 模式下改 YAML 会热更新。
- `src/engine/configSchema.ts` 用 zod 定义所有文件的 schema，然后做交叉引用检查：红线和必得项引用的 clause/param 必须在 catalog 里存在；forum id、tag id、side payment id 必须存在；`source_ids` 必须出现在 claims.csv 里，找不到只给警告。
- 校验失败时**不让页面白屏**，而是显示 Config Errors 页面，列出文件名、字段路径和原因。
- `npm run check-config` 运行同一个校验器，供组员和 CI 使用。

在策划 §6.5 示例的基础上，配置 DSL 做两处补充：
- 条件匹配器 `when`（`src/engine/match.ts`），只支持这几种写法：`{clause, param?, equals|in|not_in|gte|lte}`、`{clause_present}`、`{clause_absent}`，以及召集用的 `{agenda_includes, forum, forum_exclusive, not_invited, format, annex_exists}`。每种写法都要有单测。
- 每条红线、必得项和出席条件加一个 `say:` 字段，写一句理由。mock 模式拿它生成发言，复盘页也用它展示原因。

## 引擎规则（确定性，细化策划 §5）

只列出策划里没写死、实现时必须统一的地方。

- **状态机：** 阶段依次为 `seat → convene → attendance → negotiate → report → vote → (negotiate | outcome) → debrief → postquiz`。Track 2 不另做一套阶段，而是给状态加 `track: 1|2`，复用 negotiate/report/vote，只是轮数改成 `track2.rounds`，议题限定在 `track2.scope` 之内。
- **出席判定：** 按策划 §5.2 的伪代码。Track 2 用 `track2_willingness` 代替 `base_willingness[forum]`。`trust_modifier` 直接等于 trust 值（范围 −3..+3）。信任代价写在 `rules.yaml` 的 `trust_effects: {excluded: -2, exclusive_forum_nonmember: -1}`。
- **平行会议：** 不用随机。只要某个被排除或拒绝出席的代表团 `parallel_forum_propensity ≥ rules.parallel_threshold`（默认 0.6），就标记出现了平行标准。平行条款集按该方的必得项自动生成。
- **流会：** 到场方（含玩家）少于 quorum 时可以重新召集，最多 `reconvene_attempts` 次，或者转入 Track 2。
- **发言人：** 被点名的一方优先；其余按冲突分排序（触犯红线计 10 分，缺失的必得项加上其权重），分数相同时选最久没发言的一方；每轮 2 到 `max_responders` 人。主席发言**用模板，不调用 LLM**，内容是宣布轮次和提醒剩余轮数，既省调用也更稳定。
- **条款：** 玩家通过表单提出、修改、撤回条款，每次改动都有版本留痕。表单只列出当前 agenda_scope 内的议题。AI 提出的修正案只会成为「建议」，玩家点一下才上桌。
- **论据标签与松动：** 置信度达到 `tagger_confidence_min` 才算数。标签对所有在场代表团生效。**同一标签在同一循环里对同一代表团只计一次**，防止刷屏。每个必得项最多松动 `max_soften`。每次松动记一条日志：哪句话、哪个标签、松动了谁的哪一项。
- **投票：** 先查红线，触犯任一条直接投 NO。否则计算 score = Σ满足的必得项 − Σ缺失的必得项 + 松动 + side payment + trust + Track 2 加成（提案里有条款与技术附件里的条款完全一致时加 `track2.bonus`）。score ≥ `vote_threshold` 投 YES。LLM 只能在 `|score − threshold| ≤ swing_band` 时返回 ±1 的调整，引擎会截断超出范围的值。多声音代表团按 `internal_resolution` 合并各声音的结果。v0.1 只有 YES/NO，不设弃权。
- **防空洞提案：** `rules.min_clauses_to_vote`（默认 2）。桌上条款不够时不能进入投票。
- **通过：** YES ≥ ceil(2/3 × 有投票权且到场的代表团数)。`voting_mode` 和 `iso_double` 按策划 §6.2 实现。退场方不计入。
- **退场：** 议程或条款触发 `walkout_triggers` 时，该方当场退场。
- **提前报告：** 进行到第 `allow_early_report_after`（默认 3）轮后，玩家可以要求提前出报告，节省 Expo 的时间。
- **结局：** 按以下优先级判定。通过的情况：有平行标准 → 标准分裂；有大国缺席 → 俱乐部标准；有大国投反对 → 纸面标准；以上都不满足 → 全面协议。未通过的情况：有 Track 2 附件 → 仅专家共识；否则 → 未达成协议。
- **反事实：** 对每个缺席的大国，依次只改一个召集选项（forum、agenda_scope、format、邀请名单），重新跑出席判定，列出能让它到场的最小改动。

引擎对外只暴露纯函数（`createGame`、`convene`、`playerMessage`、`recordSpeech`、`proposeClause`、`computeVotes`、`applySwing`、`finalizeVote`、`startTrack2`、`classifyOutcome`、`counterfactuals` 等），全部满足 state 输入、state 输出。

## LLM 角色（`src/llm/`）

| 角色 | 输入 | 输出 JSON | 说明 |
|---|---|---|---|
| delegate | 简报、引擎算出的本方对每条条款的立场（含红线和理由）、最近 8 条对话 | `{speech, amendment?: {template_id, params}}` | 立场由引擎给定，模型不能改；修正案要经过引擎校验 |
| tagger | 玩家这次的发言、标签表 | `[{tag, confidence}]`，最多 2 个 | mock 版按 argument_tags 里的 examples 做关键词匹配 |
| rapporteur | 本循环的对话、各方立场 | `{summary, positions[], open_issues[]}` | 条款清单由程序渲染，模型不能增删；玩家可以提一次异议，书记员据此修订一次 |
| decline_letter | 判定理由 | `{letter}` | 只负责把拒绝写成外交辞令 |
| swing | 摇摆区内的代表团、本循环对话 | `{adjust: -1\|0\|1, reason}` | 只对处在摇摆区的代表团调用 |

- prompt 放在 `config/prompts/*.md`，用 `{{var}}` 占位，组员不改代码就能调整。
- 温度：delegate 0.7，其余 0.2。如果端点支持，就开启 `response_format: json_object`（Settings 里有开关）。解析时提取第一个 JSON 对象。
- 同一轮里几个回应者的调用并行发出，缩短等待。
- AI 发言语言由 `scenario.yaml` 的 `ai_language` 控制，默认 `en`。

## 界面（英文，桌面优先，1280px 为主，1024px 也要能用）

**视觉方向：** 克制、像正式的外交文件。底色是米白纸张色，主色是墨蓝，强调色只有一种用于表决的颜色；界面文字用无衬线字体，**报告、拒信、提案用衬线字体，段落编号模仿正式决议草案的格式**。各代表团用中性的字母徽章（CN / EU / US / LAB / GS / EVAL）加低饱和色区分，**不用国旗**。动画都很短，并遵守 `prefers-reduced-motion`。只做浅色主题，因为 Expo 用投影。

**核心意象是圆桌：** 用 SVG 画一张圆桌，缺席的代表团显示空椅子，退场的代表团显示被推开的椅子。召集、谈判、结局三个页面共用这张圆桌。这直接回应了「谁肯上桌」这条主张。

页面清单对应策划 §9：
1. **Seat**：代表团卡片、简短的 How to play 和 Start as China 快速开始 → 进入**Role card**（授权、本方红线和必得项、技术事实、与各方的关系；细节折叠）→ 直接召集。每个游戏界面进度条旁有 Restart（需确认），下面一行 Your task 说明该做什么。
2. **Convene**：选择 forum、agenda scope、format，勾选邀请名单 → **Attendance**：椅子逐个亮起或空出，出席结果优先显示；拒信和触发原因折叠在 Why some did not come 里（法定人数不足时自动展开）。会议形式收在 Meeting format（change）里。
3. **Negotiate**（三栏布局）：左栏是圆桌，带出席和信任指示；中栏是对话记录，玩家消息下方显示命中的标签，比如 `verify_without_weights → softened China`；右栏是桌上条款和 AI 建议的修正案。底部是输入框、点名下拉框、Propose clause 抽屉、side payment 按钮，顶部显示 `Round 3/5 · Cycle 1/3`，进度芯片显示 Clauses n/2 和 Votes likely x/y，计时器只用于显示；各方立场折叠在 Who supports it。
4. **Report**：衬线字体的决议草案、异议按钮 → **Vote**：逐个亮出各方投票，每票附带理由。
5. **Outcome**：结局类型、到场和缺席情况、票型。
6. **Debrief**：先给结果和一个主要操作，时间线、「你的哪句话改变了谁」、反事实提示、全部代表团红线的揭晓折叠在后面；可选后测（可 Skip 或 Finish）；**Replay with different convening**（保留席位，回到召集阶段，结束后和上一局并排对比）。
7. **Gallery**（本机公开平台）：通过的提案和 Track 2 附件；三道评分题（1–5 分）加短评，同一台电脑可以多次评分，每次评完有 "Next viewer" 按钮；按 `(C·m + Σ)/(C + n)` 排名；可按结局类型筛选；同时显示会场票数；支持 JSON 导出和导入，用于手动合并多台设备的数据。
8. **Settings**：LLM 模式和预设、Test connection 按钮、kiosk 开关（局终后显示一个大的 New game 按钮）。**Admin**（`#/admin`）：导出全部日志（CSV/JSON）、删除提案或评分、清空数据、查看配置校验报告。
9. **Print cards**（P2）：把配置渲染成可打印的角色卡、条款卡和判定表，用打印样式输出，作为纸质备用版。

**持久化：** localStorage 里每个 key 都带 schema 版本号。每完成一步自动存档，刷新后可以继续当前这局；存档解析失败时就开一局新的，不报错。

**日志：** 每局记录策划 §10 列出的全部字段，加上每次状态切换的时间戳，用来算出「在哪一步停留最久」。

## 内容（占位配置）

六个代表团都按策划 §6.5 的结构写一份占位配置，每份文件开头标明 `# PLACEHOLDER — rewrite from sources`。不确定的断言在 claims.csv 里标 `confidence: low`。

**平衡目标**由整局模拟测试保证：
- 合理打法能在 3 个循环内通过。合理打法指：不要求交出权重、提出互认、由本国执行、议程不含出口管制。
- 天真打法会失败或触发退场，比如要求交出权重，或者把出口管制放进议程。
- 空洞提案过不了。

## 实施阶段与分工

每个 agent 在自己的 git worktree 和分支上工作，通过 PR 合入 main。**目录所有权互不重叠**，同一目录同一时间只有一个写入者。

| 阶段 | 内容 | 建议执行方 | 拥有目录 |
|---|---|---|---|
| A 契约（串行，先完成） | 项目脚手架、tsconfig/eslint/vitest、`src/engine/types.ts`、`configSchema.ts`、china.yaml 加最小可用的配置集、CI 骨架、README 骨架、AGENTS.md | Codex（Fable 验收） | 全仓 |
| B1 引擎 | match、attendance、responders、clauses、soften、voting、outcome、counterfactual、machine，以及全部单测 | Codex GPT | `src/engine`、`tests/engine` |
| B2 LLM 层 | client（3 种模式）、mock、各角色 schema 和 prompt 组装、`llm-proxy.mjs` | Codex GPT | `src/llm`、`config/prompts`、`tools` |
| B3 界面 | tokens、组件、圆桌 SVG、全部页面；用 `fixtures.ts` 里的假状态驱动，不等引擎完成 | Sonnet 集群 | `src/ui` |
| B4 内容 | 另外 5 个代表团、claims.csv、quiz.yaml、CONFIG-GUIDE.md | Sonnet 或 Codex | `config/`（不含 prompts）、`docs/CONFIG-GUIDE.md` |
| C 集成（串行） | controller、persistence、platform、debrief、导出，并把 UI 接上真实状态 | Codex 写逻辑，Sonnet 打磨界面 | `src/game`、`src/platform`，`src/ui` 只改接线部分 |
| D 发布 | 整局模拟测试、Playwright 冒烟测试、pages/release 工作流、隐私门禁、建立 GitHub 仓库（需用户确认） | Codex，Fable 验收 | `.github`、`tests` |

**优先级：** A、B1、B2、B3、C 和一局完整的 mock 游戏是 P0。Track 2、论据标签、Gallery、复盘反事实是 P1，它们都是主张的核心，必须在 Expo 前完成。私下磋商、玩家扮演多声音中的一个声音、AI 方的报告异议、主席 LLM、Print cards 是 P2，都可以砍。

## 验证

1. `npm ci`、`npm run typecheck`、`npm run lint`、`npm test`、`npm run check-config` 全部通过，CI 在每个 PR 上运行这几步。
2. `tests/simulation.test.ts`：用 mock LLM 和固定种子，按脚本跑完三种打法（合理、天真、空洞），断言各自的结局类型；另外断言同一种子跑两次结果完全一致。
3. 对抗测试（对应课程要求的 adversarial walkthrough）有单测覆盖，至少包括：反复刷同一标签不会继续加分；LLM 返回超出摇摆区的调整会被截断；修正案不能绕过红线；书记员输出的条款不会进入提案。
4. `npm run build` 生成的 dist 能用 `npx vite preview` 正常打开；`npm run build:single` 生成的单个 HTML 在 Chrome 和 Edge 里**通过 file:// 双击打开**，能用 mock 模式完整玩一局，刷新后能继续，Gallery 能评分。
5. 用真实 key（比如 DeepSeek）分别在 direct 模式和 proxy 模式各跑一局；拔掉网络后游戏能继续，并显示 fallback 标记。
6. Playwright 冒烟测试只在 CI 上跑 chromium：用 mock 模式从 Seat 点到 Debrief。
7. 在一个干净目录（或另一台电脑）上 `git clone`、`npm ci`、`npm run dev` 能直接跑起来；打上 tag `v0.1.0` 后，Release 里自动出现 `who-writes-the-rules.html` 和 `llm-proxy.mjs`，Pages 的链接可以访问。
8. 时长检查：用 mock 模式玩一局，从召集到结局 ≤ 12 分钟（策划 §3）。
