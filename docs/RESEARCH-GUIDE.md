# 补充研究资料并在 GitHub 上合并 · Adding research material and merging it on GitHub

本指南写给负责查资料的组员，不需要会写代码。每节先给中文，再给对应的英文。

This guide is for teammates who research sources. No coding is needed. Each section gives the Chinese text first, then the English.

- 字段的完整说明见 [配置指南](CONFIG-GUIDE.md)。 · Every field is described in the [configuration guide](CONFIG-GUIDE.md).
- 在线游戏：<https://ray-oriental.github.io/who-writes-the-rules/>，资料总览在 **Research**。 · Live game: <https://ray-oriental.github.io/who-writes-the-rules/>; the overview is under **Research**.

---

## 0. 一句话版本 · In one paragraph

在游戏的 **Research** 页挑一项状态为 **To find** 的任务，开一个 Issue 认领它。然后查到能直接证明这句话的原始文件，在 GitHub 网页上编辑对应的 YAML 文件，填好来源并修改状态，最后提交一个 Pull Request（PR）。CI 检查通过、维护者审过后合并，几分钟内网站自动更新。另一位组员独立复核后，才能把状态标为 `verified`。

Pick a task marked **To find** on the game's **Research** page and claim it by opening an Issue. Find an original document that directly supports the statement. Edit the matching YAML file in the GitHub web editor: fill in the source and update the status. Then open a pull request (PR). Once the CI checks pass and the maintainer has reviewed it, the PR is merged and the website updates within a few minutes. Only after another teammate has checked it independently may the status become `verified`.

---

## 1. 先弄懂三样东西 · Three things to understand first

### 1.1 断言与研究任务 · Claims and research needs

游戏里每条规则都是对现实世界的一句断言，比如“中国拒绝在官方议程里讨论出口管制”。资料分两种记录：

| 记录 | ID 格式 | 是什么 |
| --- | --- | --- |
| 断言 `claims` | `C-CN-05`、`C-GEN-03` | 规则所依赖的一句话，带来源、链接和可信度 |
| 研究任务 `research` | `R-CN-04`、`R-GEN-02` | 还没查清的问题，写明为什么要查、去哪查，以及关联哪几条断言 |

规则用 `source_ids` 指向断言，研究任务用 `claim_ids` 指向断言。你的工作通常是：完成一项研究任务，再把结果写进它关联的断言。

Every rule in the game is a statement about the real world, such as "China refuses to discuss export controls on an official agenda". Evidence is kept in two kinds of records:

| Record | ID format | What it is |
| --- | --- | --- |
| `claims` | `C-CN-05`, `C-GEN-03` | One statement a rule depends on, with its source, link and confidence |
| `research` | `R-CN-04`, `R-GEN-02` | An open question: why it matters, where to look, and which claims it settles |

Rules point to claims through `source_ids`; research needs point to claims through `claim_ids`. Your usual job is to answer one research need and write the result into the claims it names.

### 1.2 文件在哪 · Where the files are

| 内容 · Content | 文件 · File |
| --- | --- |
| 中国 · China | `config/delegations/china.yaml` |
| 美国 · United States | `config/delegations/us.yaml` |
| 欧盟 · European Union | `config/delegations/eu.yaml` |
| 前沿实验室 · Frontier AI laboratory | `config/delegations/frontier_lab.yaml` |
| 全球南方联盟 · Global South coalition | `config/delegations/global_south.yaml` |
| 独立评测机构 · Independent evaluation body | `config/delegations/evaluator.yaml` |
| 会场、议题等共享规则 · Shared rules (forums, clauses) | `config/general.yaml` |

每个文件末尾有 `claims:` 和 `research:` 两段。

Each file ends with two sections, `claims:` and `research:`.

### 1.3 状态怎么变 · How the status moves

| 状态 · Status | Research 页显示 · Shown on Research as | 谁来改、什么时候改 · Who sets it, and when |
| --- | --- | --- |
| `todo` | To find | 还没人查。 · Nobody has started. |
| `in_progress` | In progress | 你认领后开始查。 · You set it when you start. |
| `found` | Found · needs review | 你打开原文，确认它直接回答了问题。 · You opened the source and it answers the question. |
| `verified` | Verified | **另一位**组员独立读过原文并认同。不能自己复核自己的工作。 · **Another** teammate read the source independently and agrees. Never verify your own work. |

只查清了一部分时，不要标 `found`：把问题改窄，或者保持 `in_progress`，并在 `notes` 里写明查到了哪一步。

If only part of the question is settled, do not mark it `found`. Narrow the question or keep it `in_progress`, and say in `notes` how far you got.

---

## 2. 开始前 · Before you start

### 2.1 准备 · Setup

1. 注册 GitHub 账号。用户名会公开显示，可以不用真名。 · Create a GitHub account. Your username is public and does not have to be your real name.
2. 打开仓库 <https://github.com/ray-oriental/who-writes-the-rules>。 · Open the repository.
3. 如果维护者把你加为协作者，到邮箱或 <https://github.com/notifications> 接受邀请。没加也能贡献，GitHub 会自动帮你复制（fork）一份仓库。 · If the maintainer added you as a collaborator, accept the invitation in your email or at <https://github.com/notifications>. Without it you can still contribute: GitHub forks the repository for you automatically.

### 2.2 认领任务，避免撞车 · Claim a task so nobody duplicates it

1. 在游戏里打开 **Research**，选一个代表团，把 **Filter by status** 设为 **To find**。 · In the game, open **Research**, pick a delegation and set **Filter by status** to **To find**.
2. 记下任务 ID，例如 `R-CN-04`。点 ID 可以得到这一项的永久链接。 · Note the task ID, for example `R-CN-04`. Clicking the ID gives a permanent link to that entry.
3. 到仓库的 **Issues → New issue**，标题写 `R-CN-04 · <你的 GitHub 用户名>`，正文贴上那个链接。先在 Issues 里搜一下，确认没人认领过。 · In the repository go to **Issues → New issue**. Title it `R-CN-04 · <your GitHub username>` and paste the link in the body. Search Issues first to make sure nobody has claimed it.
4. **一个人同一时间只改一个文件。** 两个人同时改同一个 YAML 文件最容易冲突，组内可以按代表团分工。 · **Work on one file at a time.** Two people editing the same YAML file at once is the main cause of conflicts; splitting the work by delegation avoids it.

---

## 3. 查资料 · Finding the evidence

### 3.1 什么样的来源可以用 · What counts as a source

| 优先 · Prefer | 慎用 · Use with care | 不能用 · Do not use |
| --- | --- | --- |
| 政府、国际组织、标准机构发布的原始文件（法规、声明、新闻发布会实录、会议文件） · Primary documents from governments, international bodies and standards bodies (laws, statements, press-briefing transcripts, meeting papers) | 主流媒体报道、智库报告（找得到原文时引原文） · Major news outlets and think-tank reports (cite the original when it exists) | 没有出处的博客、AI 生成的总结、只有标题的二手转述 · Unsourced blogs, AI-generated summaries, second-hand headlines |
| 实验室或评测机构自己发布的技术报告、系统卡 · Technical reports and system cards published by the lab or evaluator itself | 学术论文（注意是否经过同行评审） · Academic papers (note whether peer-reviewed) | 需要登录或付费才能看的链接（组员和评分人打不开） · Links behind a login or paywall that teammates and markers cannot open |

### 3.2 检查清单 · Checklist

- 原文里能找到**直接支持**这句话的段落，而不只是相关话题。 · The document contains a passage that **directly supports** the statement, not just the same topic.
- 记下机构、文件标题、日期，必要时加上章节或段落号。 · Record the institution, title, date and, where useful, the section or paragraph.
- 名单、成员资格这类事实会随时间变化，必须写明日期。 · Rosters and memberships change over time, so always give the date.
- 政策文件能证明立场，但证明不了游戏里的数值（例如信任扣几分、出席意愿多少）。这类数值保留 `confidence: low`，在 `notes` 里写“平衡参数，待试玩”。 · A policy document can establish a position but not a game number (a trust penalty, a willingness score). Keep those at `confidence: low` and write "balance parameter, needs playtesting" in `notes`.
- 如果查到的内容**和现有规则矛盾**，照实写进 `notes`，并在 PR 里说明。规则怎么改由小组讨论决定，不要为了“对上”而改写断言。 · If the evidence **contradicts** the current rule, say so in `notes` and in the PR. The group decides how the rule changes; never bend the claim to fit.

---

## 4. 写成 YAML · Writing it in YAML

### 4.1 例子：完成一项任务 · Example: completing a task

下面的来源是占位符，演示格式用，不是真实资料。 · The source below is a placeholder that shows the format; it is not real evidence.

**之前 · Before**

```yaml
  - id: C-CN-08
    claim: A TC260 engineer and regulator can be represented as distinct voices with a regulator veto.
    used_in: [voices, internal_resolution]
    source: ""
    confidence: low
    notes: Team assumption about internal preference differences and decision authority.
```

```yaml
  - id: R-CN-04
    question: What documents demonstrate a substantive TC260 engineer–regulator disagreement and authority to veto a joint negotiating position?
    why: voices, internal_resolution/veto_by_any, and regulator-owned red lines depend on C-CN-08.
    status: todo
    owner: ""
    leads: [TC260 working-group minutes]
    claim_ids: [C-CN-08]
```

**之后 · After**

```yaml
  - id: C-CN-08
    claim: A TC260 engineer and regulator can be represented as distinct voices with a regulator veto.
    used_in: [voices, internal_resolution]
    source: "<Institution>, <Document title>, <Day Month Year>, section <n>"
    url: https://example.org/the-document-you-opened
    confidence: medium
    notes: "Section <n> shows <what it shows>. It does not show <what it does not show>."
```

```yaml
  - id: R-CN-04
    question: What documents demonstrate a substantive TC260 engineer–regulator disagreement and authority to veto a joint negotiating position?
    why: voices, internal_resolution/veto_by_any, and regulator-owned red lines depend on C-CN-08.
    status: found
    owner: your-github-handle
    leads: [TC260 working-group minutes, "https://example.org/the-document-you-opened"]
    notes: "Found by your-github-handle. Settles the disagreement; the veto rule is still an assumption."
    claim_ids: [C-CN-08]
```

### 4.2 每个字段 · Field by field

**断言 `claims` · Claims**

| 字段 · Field | 怎么填 · How to fill it |
| --- | --- |
| `id` | 不要改。新增时取本文件下一个编号，全仓库唯一。 · Never change it. For a new one, take the next number in the file; IDs are unique across the repository. |
| `claim` | 一句可以被证实或证伪的话，范围越窄越好。 · One statement that can be proved or disproved; the narrower the better. |
| `used_in` | 依赖它的规则 ID，一般不用改。 · IDs of the rules that depend on it; usually leave as is. |
| `source` | 机构，标题，日期，章节。没找到就留 `""`。 · Institution, title, date, section. Leave `""` if not found. |
| `url` | 你**亲自打开过**的链接。 · A link you **actually opened**. |
| `confidence` | `high`：原文直接写明；`medium`：需要合理推断；`low`：团队假设。 · `high`: stated outright; `medium`: needs a reasonable inference; `low`: team assumption. |
| `notes` | 原文证明了什么、**没证明**什么。 · What the source shows and what it does **not** show. |

**研究任务 `research` · Research needs**

| 字段 · Field | 怎么填 · How to fill it |
| --- | --- |
| `status` | 见 1.3。 · See 1.3. |
| `owner` | 你的 GitHub 用户名或缩写，不写真名。 · Your GitHub username or initials, not your real name. |
| `leads` | 找过的线索和链接，每项一条。 · Leads and links you tried, one per item. |
| `notes` | 进展、结论、复核记录（谁在哪天复核）。 · Progress, conclusion, review record (who checked it, and when). |
| `claim_ids` | 它要回答的断言，一般不用改。 · The claims it settles; usually leave as is. |

### 4.3 新增一条 · Adding a new entry

- 新断言：复制一条现有断言，改成下一个 ID（如 `C-CN-10`），再把这个 ID 加进相关规则的 `source_ids`。 · New claim: copy an existing one, give it the next ID (such as `C-CN-10`), and add that ID to the affected rule's `source_ids`.
- 新任务：复制一条现有任务，改成下一个 ID（如 `R-CN-09`），`status: todo`，`claim_ids` 指向它要回答的断言。 · New research need: copy an existing one, give it the next ID (such as `R-CN-09`), set `status: todo`, and point `claim_ids` at the claims it settles.

### 4.4 YAML 易错点 · YAML pitfalls

- 缩进只用空格，和上下行对齐。不能用 Tab。 · Indent with spaces only, aligned with neighbouring lines. Never use tabs.
- 句子里出现 `冒号加空格`（`: `）、以 `#`、`[`、`{`、`*` 开头，或包含引号时，整句用双引号包起来。 · Wrap a sentence in double quotes if it contains a colon followed by a space, starts with `#`, `[`, `{` or `*`, or contains quotes.
- 链接写在 `leads` 列表里时加引号：`["https://..."]`。 · Quote a link inside the `leads` list: `["https://..."]`.
- 只改你要改的行，不要重新排版整段。 · Change only the lines you need; do not reformat whole sections.
- 内容用英文写（游戏界面是英文）。 · Write the content in English, because the game's interface is in English.

---

## 5. 提交：三种方式 · Submitting: three ways

### 方式 A：在 GitHub 网页上改（推荐） · Option A: edit on the GitHub website (recommended)

不用安装任何东西，改动最干净，最好审。 · Nothing to install, and it gives the smallest, easiest-to-review change.

1. 打开要改的文件，例如 <https://github.com/ray-oriental/who-writes-the-rules/blob/main/config/delegations/china.yaml>。游戏的 Research 页上，每个档案旁的 **Edit on GitHub** 会直接打开它的编辑页。 · Open the file, for example the link above. On the game's Research page, **Edit on GitHub** next to each dossier opens its editor directly.
2. 点右上角的铅笔图标 ✏️。如果你不是协作者，GitHub 会提示先 fork，点确认。 · Click the pencil icon ✏️ at the top right. If you are not a collaborator, GitHub asks to fork first; confirm.
3. 用 `Ctrl+F` 找到你的 ID（如 `R-CN-04`），按第 4 节修改。 · Find your ID with `Ctrl+F` and edit as in section 4.
4. 点 **Preview** 看改动，确认只有你想改的几行变了。 · Click **Preview** and check that only the lines you meant to change are changed.
5. 点 **Commit changes…**。提交说明写一行，如 `Research R-CN-04: source for C-CN-08`。选 **Create a new branch…**（协作者）或直接 **Propose changes**（非协作者）。 · Click **Commit changes…**. Write a one-line message such as `Research R-CN-04: source for C-CN-08`. Choose **Create a new branch…** (collaborators) or **Propose changes** (others).
6. 在下一页点 **Create pull request**，按第 6 节写说明。 · On the next page click **Create pull request** and write the description as in section 6.

### 方式 B：在游戏的编辑器里改 · Option B: the in-game editor

适合不放心手写 YAML 的组员。缺点是导出会**重新排版整个文件**，PR 里会显示几百行改动，审核困难，也容易和别人冲突。只在这个文件没有别人同时在改时使用。`config/general.yaml` 不能用这种方式改。

Useful if you are unsure about writing YAML. The drawback: the export **reformats the whole file**, so the PR shows hundreds of changed lines, which is hard to review and easily conflicts with others. Use it only when nobody else is editing that file. `config/general.yaml` cannot be edited this way.

1. 游戏里打开 **Team → Delegations**，点一个代表团。 · In the game, open **Team → Delegations** and choose a delegation.
2. 在左侧选 **Claims** 或 **Research**，在表单里填写。 · Choose **Claims** or **Research** on the left and fill in the form.
3. 点 **Save in this browser**。保存时会检查整份配置；有错误会列出来，按提示修好。（改动只存在你自己的浏览器里，别人看不到。） · Click **Save in this browser**. Saving checks the whole configuration and lists any errors to fix. (The change lives only in your browser; nobody else sees it.)
4. 点 **Copy YAML**。 · Click **Copy YAML**.
5. 点 **Open on GitHub**，进入编辑页后 `Ctrl+A` 全选，`Ctrl+V` 粘贴，再按方式 A 的第 5、6 步提交。 · Click **Open on GitHub**, select all with `Ctrl+A`, paste with `Ctrl+V`, then follow steps 5 and 6 of Option A.
6. PR 合并后，回到编辑器点 **Discard my edits**，让浏览器重新使用仓库里的版本。 · After the PR is merged, click **Discard my edits** so your browser uses the repository version again.

### 方式 C：本地 Git（熟悉 Git 的组员） · Option C: local Git (if you know Git)

需要 Node.js 24 和 Git。 · Requires Node.js 24 and Git.

```bash
# 非协作者先在网页上 Fork，再克隆自己的副本 · Others: fork on the website first, then clone your copy
git clone https://github.com/<your-username>/who-writes-the-rules.git
cd who-writes-the-rules
npm ci
git switch -c research/R-CN-04
# 编辑 YAML · edit the YAML
npm run check-config
npm run dev        # 可选：在 Research 页预览 · optional: preview on the Research page
git add config/delegations/china.yaml
git commit -m "Research R-CN-04: source for C-CN-08"
git push -u origin research/R-CN-04
```

然后在 GitHub 页面上点 **Compare & pull request**。下次开始新任务前先同步：

Then click **Compare & pull request** on GitHub. Before the next task, sync first:

```bash
git switch main
git pull https://github.com/ray-oriental/who-writes-the-rules.git main
git push origin main
```

---

## 6. 写 Pull Request · Writing the pull request

标题 · Title：`Research R-CN-04: <一句话结论 · one-line finding>`

正文模板（复制后填写） · Description template (copy and fill in):

```markdown
Closes #<issue number>

**Task**: R-CN-04 → C-CN-08
**Status**: todo → found
**Source**: <institution, title, date, section>, <link>
**What it shows**: <one or two sentences>
**What it does not show**: <one sentence>
**Does it contradict a rule?** No / Yes: <which rule and how>

- [ ] I opened the source myself
- [ ] Only the lines for this task changed
- [ ] No real names, emails or private links
```

写上 `Closes #编号`，PR 合并时会自动关闭对应的认领 Issue。

Writing `Closes #number` closes the claiming Issue automatically when the PR is merged.

提交后，页面下方会出现 **Verify and publish the summit** 检查：

After you submit, a check called **Verify and publish the summit** appears at the bottom of the PR:

- ✅ 绿色：格式和引用都没问题，等人审核即可。 · Green: format and references are fine; wait for review.
- ❌ 红色：点 **Details**，找到 `check-config` 或 `test` 那一步的报错，通常会写明文件、字段和原因。在 PR 的 **Files changed** 里点 `…` → **Edit file** 修好再提交，检查会自动重跑。看不懂就在 PR 里留言求助。 · Red: click **Details** and read the error in the `check-config` or `test` step; it usually names the file, field and problem. Fix it via **Files changed** → `…` → **Edit file** and commit; the check reruns automatically. If unsure, ask in a PR comment.

非协作者第一次提交 PR 时，检查可能要等维护者点 **Approve and run** 才会开始。

For a first-time contributor who is not a collaborator, the check may wait until the maintainer clicks **Approve and run**.

---

## 7. 审核、复核与合并 · Review, verification and merging

### 7.1 审核人看什么 · What the reviewer checks

1. 打开链接，找到原文里对应的段落。 · Open the link and find the passage.
2. `claim` 说的和原文一致，没有夸大。 · The `claim` matches the source and does not overstate it.
3. `confidence` 合理：`high` 必须是原文直接写明。 · `confidence` is fair: `high` only when the source states it outright.
4. **Files changed** 里只有这项任务相关的行。 · **Files changed** shows only the lines for this task.
5. 没有真名、邮箱、个人链接。 · No real names, emails or personal links.

有问题就在具体行上留言（点行号旁的 `+`），或选 **Request changes**。

Comment on a specific line (the `+` next to the line number) or choose **Request changes** if something is wrong.

### 7.2 标记 verified · Marking verified

`verified` 必须由**另一位**组员完成：独立读原文，同意后开一个只改状态的小 PR，`status: verified`，并在 `notes` 末尾加 `Verified by <handle>, <date>.`

`verified` must come from **another** teammate: read the source independently, and if you agree, open a small PR that only sets `status: verified` and appends `Verified by <handle>, <date>.` to `notes`.

### 7.3 合并（维护者） · Merging (maintainer)

1. 检查为绿色、至少一人审过后，点 **Squash and merge**。 · Once the check is green and at least one person has reviewed it, click **Squash and merge**.
2. 合并到 `main` 后，网站在几分钟内自动更新，Research 页的进度条会变化。 · After merging into `main`, the website updates within minutes and the Research progress bars change.
3. 想给离线版也更新，就发一个新版本：推一个 `v0.1.1` 这样的标签，Release 会自动生成。 · To refresh the offline download too, push a tag such as `v0.1.1`; the release is built automatically.

### 7.4 遇到冲突 · Resolving a conflict

两个 PR 改了同一个文件的相邻行时，后合并的那个会显示 **This branch has conflicts**。

When two PRs change nearby lines of the same file, the later one shows **This branch has conflicts**.

1. 点 **Resolve conflicts**。 · Click **Resolve conflicts**.
2. 在 `<<<<<<<`、`=======`、`>>>>>>>` 之间**两边的内容都保留**（通常是两个人各改了不同的任务），删掉这三行标记。 · Between `<<<<<<<`, `=======` and `>>>>>>>`, **keep both sides** (usually each person edited a different task) and delete the three marker lines.
3. 点 **Mark as resolved** → **Commit merge**，等检查重新变绿。 · Click **Mark as resolved** → **Commit merge** and wait for the check to turn green again.
4. 用方式 B 提交的 PR 冲突通常太大，网页上改不动：关掉它，在最新版本上重新做一次你的改动。 · A conflicting PR from Option B is usually too large to fix on the website: close it and redo your change on the latest version.

---

## 8. 公开仓库的规矩 · Rules for a public repository

- 仓库是公开的，任何人都能看到全部历史。 · The repository is public, and anyone can read its full history.
- 不写真名、学号、邮箱、手机号、本机文件路径；`owner` 只写 GitHub 用户名或缩写。 · No real names, student IDs, emails, phone numbers or local file paths; `owner` holds a GitHub username or initials only.
- 不提交 API key、密码或任何登录信息。 · Never commit an API key, password or login details.
- 不上传受版权保护的全文或 PDF，只写引用信息和链接。 · Do not upload copyrighted full texts or PDFs; cite and link instead.
- 不小心提交了个人信息，立即告诉维护者。提交历史需要维护者清理，只再提交一次删除是不够的。 · If you commit personal information by mistake, tell the maintainer at once. It stays in the history and needs the maintainer to remove it; another commit that deletes it is not enough.

---

## 9. 速查 · Quick reference

| 我想… · I want to… | 做法 · How |
| --- | --- |
| 看还有哪些没查 · See what is still open | 游戏 **Research** → **Filter by status** = **To find** |
| 认领任务 · Claim a task | **Issues → New issue**，标题 `R-XX-NN · handle` |
| 改资料 · Edit evidence | 文件页 ✏️ → 修改 → **Commit changes** → **Create pull request** |
| 检查格式 · Check the format | PR 底部的检查；本地运行 `npm run check-config` · The check at the bottom of the PR; locally `npm run check-config` |
| 复核别人的资料 · Verify someone else's work | 读原文 → 小 PR 只改 `status: verified` 和 `notes` · Read the source → small PR changing only `status: verified` and `notes` |
| 导出全部断言 · Export every claim | Research 页 **Download claims CSV** |
| 问问题 · Ask a question | 在 PR 或 Issue 里留言 · Comment on the PR or Issue |
