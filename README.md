# hyaline-github-app-config
Configuration for the Hyaline GitHub App

## Workflows

### [_audit.yml](.github/workflows/_audit.yml)
Audits documentation against configured rules. Requires that the `_current-documentation` artifact exists (created by the `_merge` workflow) to audit against.

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

### [_check-pr.yml](.github/workflows/_check-pr.yml)
Checks a pull request for documentation updates. Requires that the `_current-documentation` artifact exists (created by the `_merge` workflow) to check against.

**Usage:** Run automatically by the Hyaline GitHub App when a PR is ready for review and changes are made to the PR. Can also be run manually via workflow dispatch.

**Inputs:**
The workflow supports the following inputs:

- `repo` - (required) The repository name to check
- `pr_number` - (required) The pull request number to check
- `config` - (optional) The path to the hyaline configuration file. If not provided, will use `./repos/{repo}.yml`

**Artifacts produced:**
- `check-recommendations` - Contains `recommendations.json`, `current-recommendations.json`, and `previous-recommendations.json` with the PR check results

**More info:** See [_check-pr action](.github/actions/_check-pr)

### [_doctor.yml](.github/workflows/_doctor.yml)
Maintains the configuration repository by discovering repositories, generating configurations, validating existing configs, and creating pull requests with updates.

**Usage:** Run manually via workflow dispatch to keep the repository up to date. No prerequisites required.

**Inputs:** None

**Artifacts produced:** None (creates pull requests with configuration changes)

**More info:** See [_doctor action](.github/actions/_doctor)

### [_extract.yml](.github/workflows/_extract.yml)
Extracts documentation from a repository or site.

**Usage:** Run automatically by the Hyaline GitHub App when a PR is merged into the default branch. Can also be run manually via workflow dispatch. No prerequisites required. Can optionally trigger the merge workflow after extraction.

**Inputs:**
The workflow supports the following inputs (one of repo, site, or config is required):

- `repo` - (optional) The repository name. Will use config at `./repos/{repo}.yml`
- `site` - (optional) The site name. Will use config at `./sites/{site}.yml`
- `config` - (optional) The path to the hyaline configuration file relative to the root of the repository
- `trigger_merge` - (required) Whether to trigger the merge workflow after extraction
- `merge_workflow_ref` - (required) The branch or tag reference for the merge workflow (defaults to `main`)

**Artifacts produced:**
- `_extracted-documentation` - Contains `documentation.db` with the extracted documentation

**More info:** See [_extract action](.github/actions/_extract)

### [_manual_extract-all.yml](.github/workflows/_manual_extract-all.yml)
Triggers extraction for all valid repositories and sites that have been configured.

**Usage:** Run manually via workflow dispatch to extract documentation from all configured sources. No prerequisites required.

**Inputs:**
The workflow supports the following inputs:

- `extract_workflow_ref` - (required) The branch or tag reference for the extract workflow (defaults to `main`)
- `trigger_merge` - (required) Whether to trigger the merge workflow after each extraction
- `merge_workflow_ref` - (required) The branch or tag reference for the merge workflow (defaults to `main`)

**Artifacts produced:** None (triggers other workflows)

**More info:** See [_manual_extract-all action](.github/actions/_manual_extract-all)

### [_merge.yml](.github/workflows/_merge.yml)
Merges new extracted documentation databases into the current documentation dataset. Uses concurrency control to ensure only one merge runs at a time.

**Usage:** Run manually via workflow dispatch or triggered automatically by extract actions. Works with any available `_extracted-documentation` artifacts.

**Inputs:** None

**Artifacts produced:**
- `_current-documentation` - Contains `documentation.db` (the merged documentation database) and `checkpoint` (timestamp for tracking purposes)

**More info:** See [_merge action](.github/actions/_merge)

## Generated Workflows

The following workflows are automatically generated and maintained by the Doctor workflow based on the configurations found in the repository:

### Manual - Extract Repo
Generated and maintained by the Doctor workflow at `.github/workflows/_manual_extract_repo.yml` based on configurations in the `repos/` directory. Provides a dropdown interface to select and extract documentation from specific repositories.

**Usage:** Run manually via workflow dispatch to extract documentation from a specific repository. The dropdown options are automatically updated by the Doctor workflow.

**Inputs:**
- `repo` - (required) Repository name (dropdown of available repos)
- `trigger_merge` - (required) Whether to trigger the merge workflow (defaults to `true`)
- `merge_workflow_ref` - (required) The branch or tag reference for the merge workflow (defaults to `main`)

**Artifacts produced:**
- `_extracted-documentation` - Contains `documentation.db` with the extracted documentation

### Manual - Extract Site
Generated and maintained by the Doctor workflow at `.github/workflows/_manual_extract_site.yml` based on configurations in the `sites/` directory. Provides a dropdown interface to select and extract documentation from specific sites.

**Usage:** Run manually via workflow dispatch to extract documentation from a specific site. The dropdown options are automatically updated by the Doctor workflow.

**Inputs:**
- `site` - (required) Site name (dropdown of available sites)
- `trigger_merge` - (required) Whether to trigger the merge workflow (defaults to `true`)
- `merge_workflow_ref` - (required) The branch or tag reference for the merge workflow (defaults to `main`)

**Artifacts produced:**
- `_extracted-documentation` - Contains `documentation.db` with the extracted documentation

### Manual - Run Audit
Generated and maintained by the Doctor workflow at `.github/workflows/_manual_audit.yml` based on configurations in the `audits/` directory. Provides a dropdown interface to select and run specific audits.

**Usage:** Run manually via workflow dispatch to run a specific audit. The dropdown options are automatically updated by the Doctor workflow.

**Inputs:**
- `audit` - (required) Audit name (dropdown of available audits)
- `sources` - (optional) Sources to audit, comma-separated

**Artifacts produced:**
- `audit-results` - Contains `audit-results.json` with the audit results
