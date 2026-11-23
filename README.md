# Who Writes the Rules for AI?

An English-language browser simulation of an international AI safety summit. Choose a delegation, invite the other parties, and negotiate a test standard they can verify. The prototype uses simplified positions and tracks the evidence behind them in **Research**.

## Play

- **Hosted site**. Open <https://ray-oriental.github.io/who-writes-the-rules/>.
- **Offline**. Download `who-writes-the-rules.html` from [Releases](https://github.com/ray-oriental/who-writes-the-rules/releases/latest) and open it in Chrome or Edge. A local build produces the same file in `release/`.
- **From a checkout**. With Node.js 24 and npm installed, run the commands below and open the URL printed by Vite.

```sh
npm ci
npm run dev
```

The default **Offline templates** mode needs no account, key or internet connection. The browser saves your current game, gallery and completed sessions locally. **Admin** exports sessions as CSV or JSON and transfers gallery data between browsers.

## Paper backup

In **Settings**, open **Print cards** and choose **Print or save as PDF**. Give each participant their delegation card and use the clause cards to build a draft. The facilitator worksheet records who takes a seat, which rules apply and how the vote ends. The packet uses the same scenario configuration as the game and includes a simplified procedure for a human-led session.

## Team research

Open **Research** and pick a delegation or **Shared research**. Each dossier lists its owner, research questions, status, suggested sources and the claims that depend on them. Open a task or claim ID to link to that exact entry. A task lists its own owner, including whether it is unassigned. To claim a task, add your handle or initials to its `owner` and update `status` in that dossier's YAML file. Use one branch and pull request per dossier when working in parallel. Download **Claims CSV** to export the combined claims table. Step-by-step instructions for finding sources and opening a pull request, in Chinese and English: [Research guide](docs/RESEARCH-GUIDE.md). How evidence becomes game behaviour, and how to add a delegation: [Delegation guide](docs/DELEGATION-GUIDE.md).

The GitHub edit link appears when `repo_url` and `repo_branch` in `config/scenario.yaml` point to the team's repository and branch. [Configuration guide](docs/CONFIG-GUIDE.md)

## Editing delegations in the browser

Open **Team → Delegations** to edit a delegation or add one.
Fill in its identity, attendance, rules, brief and supporting sources.
Save to validate the whole configuration and reload with your changes.
Saving abandons the current game because its rules may have changed.
Edits stay in that browser only; they do not update the repository.
Use **Revert** to restore a shipped delegation or remove a local addition.
To share an edit, copy its YAML into `config/delegations/<id>.yaml` on GitHub,
or export a config pack and send it to the maintainer.
The maintainer runs `node tools/apply-config-pack.mjs pack.json` from the checkout,
then `npm run check-config`, reviews the changes and commits them.
Import a teammate's pack in the editor to try it in another browser.

## Optional model connection

**Local Ollama**. With Ollama running, start the game using `npm run dev`. In Settings select **OpenAI-compatible endpoint** and **Local Ollama**, enter an installed model such as `qwen3:4b`, leave the API key blank, and choose **Test connection**. Keep **Request JSON mode** selected. Open the Vite URL for this mode so Ollama accepts the browser origin. The downloaded HTML still opens directly in offline mode.

Choose **OpenAI-compatible endpoint** in Settings to enter an endpoint, model and key. The browser stores that key locally. The endpoint must accept requests from the page's origin. The local proxy can serve the same requests when the upstream provider blocks browser cross-origin requests. Set `LLM_BASE_URL`, `LLM_API_KEY` and optionally `LLM_MODEL` in your shell, then run `npm run proxy` from a checkout or `node llm-proxy.mjs` beside the Release copy. In Settings select **Local model proxy**, enter a model and test the connection. A failed game call falls back to an offline response.

## Build and verify

```sh
npm run typecheck
npm run check-config
npm test
npm run build
npm run build:single
npm run check:public
```

`dist/` contains the hosted build. `release/who-writes-the-rules.html` is the single-file build. For the browser smoke test, install Playwright 1.62.1 temporarily with `npm install --no-save --package-lock=false playwright@1.62.1`, run `npx playwright install chromium` and then `npm run test:browser`.

One GitHub Actions workflow verifies pull requests, deploys the verified build from `main` to GitHub Pages and attaches the HTML and optional proxy to releases for tags beginning with `v`. A fork needs **GitHub Actions** selected as its Pages source, and its own address in `repo_url`. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
