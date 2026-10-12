# Deployment checklist

This checklist is for the separate `field-signal-workbench` project only. Keep it separate from the existing research-tools repository and site. Do not change, reconnect, or deploy the research-tools project as part of this workflow.

The current project has `wrangler.json` configured with Worker name `field-signal-workbench`, static assets in `./public`, and compatibility date `2026-10-12`. This folder is its own Git repository on `main`. The public repository and Cloudflare Worker are connected only to this project. As of 2026-10-12, commit `cae0b5a0fc868a1819488b21ea7b698cfe2d5a17` is on GitHub `main`. Cloudflare shows the build titled `Add research workflow tools for analysts` as Ready. The public URL loads the five Analyst tools panels over HTTPS: `https://field-signal-workbench.dhring05.workers.dev/#lab`. Future pushes to `main` should trigger Cloudflare Builds. The existing open-access-research-tools repo and Worker remain separate.

## 1. Dedicated GitHub repository

The dedicated public repository is `https://github.com/dring-05/field-signal-workbench`, separate from `open-access-research-tools`.

## 2. Push only this project

Run these commands from the project directory, replacing the URL with the one copied from the new repository:

```sh
cd "/Users/dillonring/Documents/Codex/2026-09-29/s/outputs/field-signal-workbench"
git remote -v
git status --short
git log -1 --oneline
git rev-parse HEAD
git push -u origin main
```

Before committing, inspect `git status --short` and `git diff --cached --stat`. The staged paths should belong only to this workbench. Do not stage parent folders, browser data, credentials, or files from another repository. After pushing, compare the GitHub `main` commit SHA with local `git rev-parse HEAD`.

## 3. Review Cloudflare's GitHub access request

1. In the intended Cloudflare account, open **Workers & Pages** and create a new Worker/application for this project. Use the existing `wrangler.json` at the repository root.
2. If choosing Git integration, select only `dring-05/field-signal-workbench`. Confirm the repository and branch before connecting.
3. Read the GitHub authorization screen before accepting it. Check which account or organization, repositories, and permissions Cloudflare requests. Continue only if the scope is limited to the new repository and is acceptable. If it requests access to all repositories or otherwise broader permissions than expected, stop and ask the account owner to review it. Do not change GitHub organization settings to make the integration work without that review.
4. If the integration requires broader access, use the separate CLI deployment path below only after Cloudflare authentication is available. Do not put API tokens or credentials in project files.

## 4. Deploy the Worker

The project includes a Wrangler configuration, but Wrangler was not installed during inspection. A CLI deployment can be run from the repository root with:

```sh
npx wrangler deploy
```

If Wrangler asks to install its package, verify that the package is the official `wrangler` package before continuing. The command may prompt for Cloudflare login. Sign in to the intended account, verify the Worker name is `field-signal-workbench`, and review the deployment target before confirming. Do not paste credentials into the terminal command or save them in the repository.

For Git integration, verify the repository root and `wrangler.json` are selected, then deploy from the intended `main` commit. The static asset directory is `./public`; this project does not currently declare a build command.

## 5. Verify the published result

1. Wait for Cloudflare to report a successful deployment and copy the exact `workers.dev` URL shown for `field-signal-workbench`.
2. Open that URL in a fresh browser tab. Confirm the page title and Field Signals interface load over HTTPS.
3. Check the overview and primary navigation, then reload a non-root hash route to confirm the static app still loads.
4. Verify the deployed Git commit in Cloudflare matches the commit shown on GitHub, when using Git integration. For CLI deployment, confirm the successful deployment is for the expected Worker name and account.
5. Keep the public URL and deployment status with the project notes. Do not claim publication until the URL loads successfully from the public internet.

## Current setup status

- GitHub CLI is signed in to `dring-05`; the remote `main` SHA matches local commit `cae0b5a0fc868a1819488b21ea7b698cfe2d5a17`.
- Cloudflare Git integration points to `dring-05/field-signal-workbench`, root directory `/`, and deploy command `npx wrangler deploy`.
- Cloudflare build `ede8f463` completed with status Ready for `main`. The public HTTPS page was opened and checked at `/#lab`; all five new panels and jump navigation rendered.
