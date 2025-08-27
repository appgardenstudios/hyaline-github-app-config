# _check-pr
The `_check-pr` action is a JavaScript action that checks a pull request for documentation updates using [Hyaline](https://github.com/appgardenstudios/hyaline).

This action runs the following hyaline commands:
- `hyaline version` to document which version was used
- `hyaline check pr` to check the PR for needed documentation updates

## Usage
This action can be run on `ubuntu-latest` and `macos-latest` (and should work on `windows-latest`) GitHub Actions runners. When running on self-hosted GitHub Actions runners you will need to install `NodeJS` using the version specified in [action.yml](./action.yml).

For a usage example, see [_check-pr.yml](../../workflows/_check-pr.yml).

## Inputs
The action supports the following inputs:

- `repo` - (required) The repository name to check
- `pr_number` - (required) The pull request number to check
- `config` - (optional) The path to the hyaline configuration file. If not provided, will use `./repos/{repo}.yml`

## Artifacts
This action downloads the following artifacts:

- `_current-documentation` - The current documentation database created by the [_merge](../_merge) action

This action produces the following artifacts:

- `check-recommendations` - Contains `recommendations.json`, `current-recommendations.json`, and `previous-recommendations.json` with the PR check results

## Developing

### Local Development
The action is contained in `index.js` and requires NodeJS v20.