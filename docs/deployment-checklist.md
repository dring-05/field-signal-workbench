# Deployment checklist

This checklist is for the separate `field-signal-workbench` project only. Keep it separate from the existing research-tools repository and site. Do not change, reconnect, or deploy the research-tools project as part of this workflow.

The current project has `wrangler.json` configured with Worker name `field-signal-workbench`, static assets in `./public`, and compatibility date `2026-10-12`. This folder is its own Git repository on `main`. A public, empty GitHub repository named `dring-05/field-signal-workbench` has been created. No commit or push has been made yet. The bundled GitHub CLI reports an invalid saved token; Cloudflare authentication has not been verified. The site and existing open-access-research-tools repo remain separate.

## 1. Create a dedicated GitHub repository

The dedicated public repository is `https://github.com/dring-05/field-signal-workbench`. It is empty and separate from `open-access-research-tools`.

## 2. Initialize and push only this project

Run these commands from the project directory, replacing the URL with the one copied from the new repository:

```sh
cd "/Users/dillonring/Documents/Codex/2026-09-29/s/outputs/field-signal-workbench"
git init -b main
git add .gitignore README.md wrangler.json public docs tests
git status --short
git diff --cached --stat
git commit -m "Create Field Signals workbench"
git remote add origin https://github.com/OWNER/field-signal-workbench.git
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

## Current blockers to resolve during setup

- The local project has not yet been committed or pushed. GitHub CLI reports that the saved `dring-05` token is invalid, so sign in before pushing.
- Cloudflare account access and the Worker deployment are unverified. Wrangler is not installed as a standalone command; `npx` is available if needed.
