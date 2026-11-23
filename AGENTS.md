# ShiHanzi: rules for agents

## Ship without asking

ilkem's standing rule: when a change is finished and verified, **commit it and push it live. Do not ask first**, and never offer "commit?" or "push?" as a question or button.

1. Bump the version for app changes: `APP_VERSION` in `index.html`, `"version"` in `version.json` (same number, with short notes), and `CACHE` in `sw.js` (`moka-vNN`).
2. Commit with explicit paths. App releases use the message style `v1.NN: what changed`. Unrelated files go in their own commit.
3. Push `main` to `origin` (GitHub Pages serves https://ilkegits.github.io/moka/ from `main`). Git has no stored GitHub login on this machine, so push through gh:
   `git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main`
4. Wait until `gh api repos/ilkegits/moka/pages/builds/latest` reports `built` for the pushed commit, then confirm the live `version.json` shows the new version.

Still ask before force-pushes, rewriting history, or publishing anywhere other than this repo.
