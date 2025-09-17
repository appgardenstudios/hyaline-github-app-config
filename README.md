# hyaline-github-app-config
Configuration for the Hyaline GitHub App

## Available Workflows
The following workflows are available.

### [Doctor](.github/workflows/_doctor.yml)
Maintains the configuration repository by checking for updates, discovering repositories, generating configurations, validating existing configs, and creating pull requests with updates.

**Usage:** Run manually via workflow dispatch to keep the repository up to date.

**Inputs:** None

**Artifacts produced:** None (creates pull requests with configuration changes)

**More info:** See [_doctor action](.github/actions/_doctor)

### [Extract All](.github/workflows/_manual_extract-all.yml)
Triggers extraction for all valid repositories and sites that have been configured.

**Usage:** Run manually via workflow dispatch to extract documentation from all configured sources.

**Inputs:**
The workflow supports the following inputs:

- `trigger_merge` - (required) Whether to trigger the merge workflow after each extraction

**Artifacts produced:** None (triggers other workflows)

**More info:** See [_manual_extract-all action](.github/actions/_manual_extract-all)

## Generated Workflows
The following workflows are automatically generated and maintained by the Doctor workflow based on the configurations found in the repository:

### Extract Repo
Generated and maintained by the Doctor workflow at `.github/workflows/_manual_extract_repo.yml` based on configurations in the `repos/` directory. Provides a dropdown interface to select and extract documentation from a specific repository.

**Usage:** Run manually via workflow dispatch to extract documentation from a specific repository. The dropdown options are automatically updated by the Doctor workflow.

**Inputs:**
- `repo` - (required) Repository name (dropdown of available repos)
- `trigger_merge` - (required) Whether to trigger the merge workflow (defaults to `true`)

**Artifacts produced:**
- `_extracted-documentation` - Contains `documentation.db` with the extracted documentation

### Extract Site
Generated and maintained by the Doctor workflow at `.github/workflows/_manual_extract_site.yml` based on configurations in the `sites/` directory. Provides a dropdown interface to select and extract documentation from a specific site.

**Usage:** Run manually via workflow dispatch to extract documentation from a specific site. The dropdown options are automatically updated by the Doctor workflow.

**Inputs:**
- `site` - (required) Site name (dropdown of available sites)
- `trigger_merge` - (required) Whether to trigger the merge workflow (defaults to `true`)

**Artifacts produced:**
- `_extracted-documentation` - Contains `documentation.db` with the extracted documentation

### [Install Hyaline](.github/workflows/_install-hyaline.yml)
Performs installation for the Hyaline GitHub App, including updating hyaline and running the Doctor to initialize configuration.

**Usage:** Run manually via workflow dispatch to install the Hyaline GitHub App configuration. This is typically only used during initial setup.

**Inputs:** None

**Artifacts produced:** None (updates the repository directly and triggers the Doctor)

### [Update Hyaline](.github/workflows/_update-hyaline.yml)
Updates the configuration repository from the upstream Hyaline GitHub App configuration repository (i.e. https://github.com/appgardenstudios/hyaline-github-app-config).

**Usage:** Run manually via workflow dispatch to update the Hyaline GitHub App configuration from the upstream repository.

**Inputs:** None

**Artifacts produced:** None (updates the repository directly)

**More info:** See [_update-hyaline action](.github/actions/_update-hyaline)

### Run Audit
Generated and maintained by the Doctor workflow at `.github/workflows/_manual_audit.yml` based on configurations in the `audits/` directory. Provides a dropdown interface to select and run a specific audit.

Note: This workflow requests `models: read` permissions for the action's `GITHUB_TOKEN` in order to allow access to [GitHub Models](https://github.com/features/models). However, GitHub Models access is only used when the `HYALINE_LLM_PROVIDER` is configured to be `github-models` and `HYALINE_LLM_TOKEN` isn't set.

**Usage:** Run manually via workflow dispatch to run a specific audit. The dropdown options are automatically updated by the Doctor workflow.

**Inputs:**
- `audit` - (required) Audit name (dropdown of available audits)
- `sources` - (optional) Sources to audit, comma-separated

**Artifacts produced:**
- `audit-results` - Contains `audit-results.json` with the audit results


## Internal Workflows
The following workflows are used by the GitHub App for internal purposes. Note that workflows starting with `_` are considered internal.

### [_Audit](.github/workflows/_audit.yml)
Audits documentation against configured rules. Requires that the `_current-documentation` artifact exists (created by the `_merge` workflow) to audit against.

Note: This workflow requests `models: read` permissions for the action's `GITHUB_TOKEN` in order to allow access to [GitHub Models](https://github.com/features/models). However, GitHub Models access is only used when the `HYALINE_LLM_PROVIDER` is configured to be `github-models` and `HYALINE_LLM_TOKEN` isn't set.

**Usage:** Run manually via workflow dispatch to audit documentation quality against a configuration.

**Inputs:**
The workflow supports the following inputs (one of audit, repo, site, or config is required):

- `audit` - (optional) The audit name. Will use config at `./audits/{audit}.yml`
- `repo` - (optional) The repository name. Will use config at `./repos/{repo}.yml`
- `site` - (optional) The site name. Will use config at `./sites/{site}.yml`
- `config` - (optional) The path to the hyaline configuration file relative to the root of the repository
- `sources` - (optional) Sources to audit, comma-separated

**Artifacts produced:**
- `audit-results` - Contains `audit-results.json` with the audit results

**More info:** See [_audit action](.github/actions/_audit)

### [_Check PR](.github/workflows/_check-pr.yml)
Checks a pull request for documentation updates. Requires that the `_current-documentation` artifact exists (created by the `_merge` workflow) to check against.

**Usage:** Run automatically by the Hyaline GitHub App when a PR is ready for review and changes are made to the PR. Can also be run manually via workflow dispatch.

Note: This workflow requests `models: read` permissions for the action's `GITHUB_TOKEN` in order to allow access to [GitHub Models](https://github.com/features/models). However, GitHub Models access is only used when the `HYALINE_LLM_PROVIDER` is configured to be `github-models` and `HYALINE_LLM_TOKEN` isn't set.

**Inputs:**
The workflow supports the following inputs:

- `repo` - (required) The repository name to check
- `pr_number` - (required) The pull request number to check
- `config` - (optional) The path to the hyaline configuration file. If not provided, will use `./repos/{repo}.yml`

**Artifacts produced:**
- `check-recommendations` - Contains `recommendations.json`, `current-recommendations.json`, and `previous-recommendations.json` with the PR check results

**More info:** See [_check-pr action](.github/actions/_check-pr)

### [_Extract](.github/workflows/_extract.yml)
Extracts documentation from a repository or site.

**Usage:** Run automatically by the Hyaline GitHub App when a PR is merged into the default branch. Can also be run manually via workflow dispatch. Can optionally trigger the merge workflow after extraction.

**Inputs:**
The workflow supports the following inputs (one of repo, site, or config is required):

- `repo` - (optional) The repository name. Will use config at `./repos/{repo}.yml`
- `site` - (optional) The site name. Will use config at `./sites/{site}.yml`
- `config` - (optional) The path to the hyaline configuration file relative to the root of the repository
- `trigger_merge` - (required) Whether to trigger the merge workflow after extraction (defaults to true)
- `merge_workflow_ref` - (optional) The branch or tag reference for the merge workflow (defaults to default branch)

**Artifacts produced:**
- `_extracted-documentation` - Contains `documentation.db` with the extracted documentation

**More info:** See [_extract action](.github/actions/_extract)

### [_Merge](.github/workflows/_merge.yml)
Merges new extracted documentation databases into the current documentation dataset. Uses concurrency control to ensure only one merge runs at a time.

**Usage:** Run manually via workflow dispatch or triggered automatically by extract actions. Works with any available `_extracted-documentation` artifacts.

**Inputs:** None

**Artifacts produced:**
- `_current-documentation` - Contains `documentation.db` (the merged documentation database) and `checkpoint` (timestamp for tracking purposes)

**More info:** See [_merge action](.github/actions/_merge)

## Apps

### [Hyaline GitHub App](.github/apps/_hyaline/)
The Hyaline GitHub App listens to Pull Request webhook events from configured repositories and triggers [_Check PR](./.github/workflows/_check-pr.yml) and [_Extract](./.github/workflows/_extract.yml) workflows in your `hyaline-github-app-config` repo instance.

Note that it is only necessary to deploy and use this app if you are unable to use the public Hyaline GitHub App available on GitHub.

## GitHub App Installation

**Prerequisite(s)**
- A GitHub organization or personal account
- One or more documentation sources (e.g. git repo, documentation website, etc...)
- A [supported LLM Provider](https://www.hyaline.dev/documentation/reference/config/)

Note that the Hyaline GitHub App will trigger workflows in the configuration repository located in your organization or personal account, meaning that you stay in control of your configuration and data. If you wish you can also run your own copy of the Hyaline GitHub app (located in the [configuration repository](https://github.com/appgardenstudios/hyaline-github-app-config)) to prevent any data whatsoever from leaving your organization and being sent to us.

### 1. Create GitHub App Config Repo
All of your configuration for the Hyaline GitHub App will live in a single repository in your organization or personal account. The easiest way to set this up is to go to the [hyaline-github-app-config](https://github.com/appgardenstudios/hyaline-github-app-config) repository, click "Use this template," and create a new repository called `hyaline-github-app-config` in the organization or personal account that you will install the GitHub App into.

Create from template (or otherwise clone/push) the [hyaline-github-app-config](https://github.com/appgardenstudios/hyaline-github-app-config) repository into your organization or personal account. Note that the repository name MUST remain `hyaline-github-app-config` in order to use the hosted version of the Hyaline GitHub App.

Please see GitHub's documentation on [how to create a repository from a template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template).

### 2. Setup Secrets and Environment Variables
You will need to setup the following secrets and environment variables in your `hyaline-github-app-config` repo instance.

Note: Since Hyaline uses GitHub Personal Access Tokens (PATs) issued by you to act on your behalf, it is recommended to create a dedicated service account to use when issuing PATs. This is so that the comments made by Hyaline on pull requests will use the service account name instead of an individual's name. The service account will need read access to each repository that the GitHub App has access to, and write access to your `hyaline-github-app-config` repo instance.

#### Secrets
The following repository secrets should be created in your `hyaline-github-app-config` repo instance:

**HYALINE_GITHUB_TOKEN** - A GitHub Personal Access Token (PAT) that will be used to extract repo documentation and comment on pull requests (this will be referenced as the value for `github.token` and `extract.crawler.options.auth.password` in the configs via environment substitution). This token should be scoped to the repositories that Hyaline will be extracting documentation from or checking PRs for. It will need to have the following permissions:
- Metadata: Read - Required by GitHub for all PATs
- Contents: Read - Used for extracting documentation from the in-scope repositories
- Pull requests: Read and Write - Used for creating/updating the Pull Request comment containing Hyaline's recommendations

Note that this PAT will include access to public repositories in the organization or personal account as well as any private repositories that were explicitly added to the scope of the PAT.

**HYALINE_CONFIG_GITHUB_TOKEN** - A GitHub Personal Access Token (PAT) that will be used to manage the GitHub App's configuration. This token should be scoped to your `hyaline-github-app-config` repo instance. It will need to have the following permissions:
- Metadata: Read - Required by GitHub for all PATs
- Actions: Read and Write - Used by extract workflows in the config to trigger the merge workflow once extraction is complete
- Contents: Read and Write - Used to clone the configuration in workflows and used by the doctor to push suggested changes to a branch for review
- Pull requests: Read and Write - Used by the doctor to open a pull request with suggested changes
- Workflows: Read and Write - Used by the doctor to push suggested changes to extract and audit workflows to a branch for review

**HYALINE_LLM_TOKEN** - An LLM provider API token used in auditing and checking PRs. This will need to come from the LLM provider and will be referenced as the value for `llm.key` in the configs (using environment substitution).

#### Environment Variables
The following repository variables should be created in your `hyaline-github-app-config` repo instance:

**HYALINE_LLM_PROVIDER** - The LLM provider to be used. This will be referenced as the value for `llm.provider` in the configs (using environment substitution). Please see [configuration reference](https://www.hyaline.dev/documentation/reference/config/) for supported values.

**HYALINE_LLM_MODEL** - The LLM model to be used. This will be referenced as the value for `llm.provider` in the configs (using environment substitution). Please see [configuration reference](https://www.hyaline.dev/documentation/reference/config/) for supported values.

### 3. Run Install
To bootstrap the repository in preparation for the Github App installation you will need to run the `Install` workflow and review/edit/merge the generated pull request.

Manually trigger the `Install` workflow in your `hyaline-github-app-config` repo instance and ensure that it completes successfully. It will run `Update Hyaline` to ensure your `hyaline-github-app-config` repo is properly connected and up-to-date. It also runs `Doctor` to generate a pull request with a set of suggested changes and configuration updates based on the repositories in scope of the `HYALINE_GITHUB_TOKEN` generated above.

### 4. Review/Merge the Doctor PR
Review (editing as necessary) and merge the pull request generated by the `Install` workflow to the default (`main`) branch. You can view [how to extract documentation](https://www.hyaline.dev/documentation/how-to/extract-documentation/) and [how to check pull request](https://www.hyaline.dev/documentation/how-to/check-pull-request/)

Note that you can explicitly disable unwanted extractions or checks by adding `disabled: true` to the `extract` or `check` section of the configuration (see [configuration reference](https://www.hyaline.dev/documentation/reference/config/) for more details).

### 5. Run Extract All
Manually trigger the `Extract All` workflow in your `hyaline-github-app-config` repo instance and ensure that it completes successfully. This will run an extract on all configured repositories and merge the documentation together into a single current data set for use in audits and checks.

### 6. Install GitHub App
Install the [Hyaline GitHub App (hyaline.dev)](https://github.com/apps/hyaline-dev) into your organization or personal account. Only grant it access to repositories that you want Hyaline to extract and check pull requests on in addition to your `hyaline-github-app-config` repo instance.

### 7. Verify Installation
You can verify the installation of the GitHub App by opening a non-draft PR in one of the repositories in your organization. Once you do you should see the workflow `_Check PR` kicked off in your `hyaline-github-app-config` repo instance and a comment on the pull request with Hyaline's documentation update recommendations. Then, once the pull request is merged, you should see a corresponding workflow run of `_Extract` followed by a workflow run of `_Merge` in your `hyaline-github-app-config` repo instance.