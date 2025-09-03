# Hyaline GitHub App
The Hyaline GitHub App listens to Pull Request webhook events from configured repositories and triggers [_Check PR](../../workflows/_check-pr.yml) and [_Extract](../../workflows/_extract.yml) workflows in the forked configuration repository.

The GitHub App uses [Hono](https://hono.dev/), which is a batteries included JavaScript runtime that can be deployed to a variety of [platforms](https://hono.dev/docs/getting-started/basic).

## GitHub App Installation

### 1. Fork Config
Fork the [appgardenstudios/hyaline-github-app-config](https://github.com/appgardenstudios/hyaline-github-app-config) repository into your org or personal account. You will need to set this up as described in the main [README.md](../../../README.md).

### 2. Create GitHub App
Sign in to GitHub and create a new GitHub App in your organization or personal account. It MUST belong to the same account as the `hyaline-github-app-config` repository you forked above. You will need to supply/configure the following when creating the app:

- **GitHub App name** - Choose a valid name for this app (e.g. `hyaline-github-app-<my-org>`)
- **Homepage URL** - Use your own website or the URL for your forked configuration repo from Step 0
- **Webhook > Active** - Uncheck this for now (this will be configured in Step 4)
- **Permissions** - Leave this empty for now (this will be configured in Step 4)
- **Where can this GitHub App be installed?** - Leave this set to "Only on this account"

Once created do the following:

- Retrieve the `App ID` for later use
- Generate a `Private Key` and save it for later use

> [!IMPORTANT]  
> When you generate a private key, it will be in PKCS#1 format, but GitHub's `@octokit/app` expects PKCS#8. You will need to convert the file from PKCS#1 to PKCS#8. This can be done by running the following command to generate a PKCS#8 file:
>
> `openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in ./private-key.pem -out private-key-pkcs8.key`

### 3. Deploy GitHub App
Choose your desired platform and configure hono to deploy it. You will need to ensure the following environment variables are available to the running application:

- **GITHUB_APP_ID** - The `App ID` from Step 2 above.
- **GITHUB_PRIVATE_KEY** - The `Private Key` from Step 2 above.
- **WEBHOOK_SECRET** - A string used to verify that the caller is indeed GitHub. We recommend using a new UUIDv4.
- **HYALINE_CONFIG_REPO** - (Optional) The name of the forked configuration repository. If not set `hyaline-github-app-config` will be used.

Note that the endpoint will need to be reachable from GitHub's webhook servers (hooks in [GitHub's meta API endpoint](https://api.github.com/meta)).

Once deployed save the following:

- The `Webhook URL` (`https://<deployed app domain>/webhooks`)
- The `Webhook Secret` generated above

### 4. Configure GitHub App
Configure the GitHub App to send events to the deployed app. Do the following:

- Check the **Webhook > Active** option
- Set **Webhook > Webhook URL** to `Webhook URL` from Step 3 above
- Set **Webhook > Secret** to `Webhook Secret` from Step 3 above
- Set **Repository permissions > Actions** to be `Read and write`
- Set **Repository permissions > Pull requests** to be `Read-only`
- Check the **Subscribe to events > Pull request** option

### 5. Install GitHub App
Go to your organization or personal account settings and install the GitHub app for the repositories you want to use Hyaline with. You will need to give it access to at least the `hyaline-github-app-config` repo you forked so that the GitHub app can use the configuration you set up. Once installed you should see webhook calls being dispatched.

## Running Locally
To run the app locally you will need a working installed GitHub App (follow the instructions above to install).

Once installed, do the following:

1. Visit [smee.io](https://smee.io/) and start a new channel
2. Run `SMEE_WEBHOOK_URL=<Webhook Proxy URL> npm run dev` to start the local development server
3. Update the installed GitHub App's **Webhook > Webhook URL** to be `<Webhook Proxy URL>`
4. Trigger a webhook by opening/updating a non-draft PR or merging a PR to the default branch. You will see logs in the console