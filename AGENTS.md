# ShiHanzi2: rules for agents

**This repo is ShiHanzi2, not ShiHanzi.** Most of ilkem's requests are not for this repo.

## Which app ilkem means (read this first)

ilkem's requests are for **ShiHanzi**, unless ilkem names ShiHanzi2.

| App | Repo | Folder on ilkem's PC | Live at | Other names ilkem uses |
|---|---|---|---|---|
| **ShiHanzi**: where ilkem's requests go | `ilkegits/moka2` | `C:\Users\ilkem\moka2` | https://ilkegits.github.io/moka2/ | ShiCards, Shihanzi, moka2 |
| ShiHanzi2: only when named | `ilkegits/moka` | `C:\Users\ilkem\HANZI` | https://ilkegits.github.io/moka/ | ShiCards2, Shihanzi2, moka |

- The trap: the repo called `moka` (folder `HANZI`) is ShiHanzi**2**. The repo called `moka2` is ShiHanzi, without the 2.
- A request that does not name an app goes to ShiHanzi (`moka2`), even when the session was opened in the `moka` repo or the `HANZI` folder. Clone or open `ilkegits/moka2` and make the change there.
- Change ShiHanzi2 only when ilkem says ShiHanzi2 (or ShiCards2) for that request. If `moka2` can't be reached from where you are, say so and stop; never make the change in ShiHanzi2 instead.
- ilkem dictates, so the names can come through garbled. Read any of them as ShiHanzi unless a "2" is clearly there.
- Why this is written down: on 2026-11-25, v4.70 to v4.73 (word bank + and Add card fixes) were asked for ShiHanzi but shipped to ShiHanzi2.

The rules below apply only to work ilkem asked for in ShiHanzi2.

## Ship without asking

ilkem's standing rule: when a change is finished and verified, **commit it and push it live. Do not ask first**, and never offer "commit?" or "push?" as a question or button.

1. Bump the version for app changes: `APP_VERSION` in `index.html`, `"version"` in `version.json` (same number, with short notes), and `CACHE` in `sw.js` (`moka-vNN`).
2. Commit with explicit paths. App releases use the message style `v1.NN: what changed`. Unrelated files go in their own commit.
3. Push `main` to `origin` (GitHub Pages serves https://ilkegits.github.io/moka/ from `main`). Git has no stored GitHub login on this machine, so push through gh:
   `git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main`
4. Wait until `gh api repos/ilkegits/moka/pages/builds/latest` reports `built` for the pushed commit, then confirm the live `version.json` shows the new version.

Still ask before force-pushes, rewriting history, or publishing anywhere other than this repo.
