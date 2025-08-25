# _audit
The `_audit` action is a JavaScript action that audits documentation against a configuration using [Hyaline](https://github.com/appgardenstudios/hyaline).

This action runs the following hyaline commands:
- `hyaline version` to document which version was used
- `hyaline audit documentation` to audit the current documentation against the specified configuration

## Usage
This action can be run on `ubuntu-latest` and `macos-latest` (and should work on `windows-latest`) GitHub Actions runners. When running on self-hosted GitHub Actions runners you will need to install `NodeJS` using the version specified in [action.yml](./action.yml).

For a usage example, see [_audit.yml](../../workflows/_audit.yml).

## Inputs
The action supports the following inputs (one of audit, repo, site, or config is required):

- `audit` - (optional) The audit name. Will use config at `./audits/{audit}.yml`
- `repo` - (optional) The repository name. Will use config at `./repos/{repo}.yml`
- `site` - (optional) The site name. Will use config at `./sites/{site}.yml`
- `config` - (optional) The path to the hyaline configuration file relative to the root of the repository
- `sources` - (optional) Sources to audit, comma-separated

## Artifacts
This action downloads the following artifacts:

- `_current-documentation` - The current documentation database created by the [_merge](../_merge) action

This action produces the following artifacts:

- `audit-results` - Contains `audit-results.json` with the audit results

## Developing

### Local Development
The action is contained in `index.js` and requires NodeJS v20.