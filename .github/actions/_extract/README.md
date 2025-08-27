# _extract
The `_extract` action is a JavaScript action that extracts documentation from repositories or sites using [Hyaline](https://github.com/appgardenstudios/hyaline).

This action runs the following hyaline commands:
- `hyaline version` to document which version was used
- `hyaline extract documentation` to extract documentation from the specified source

## Usage
This action can be run on `ubuntu-latest` and `macos-latest` (and should work on `windows-latest`) GitHub Actions runners. When running on self-hosted GitHub Actions runners you will need to install `NodeJS` using the version specified in [action.yml](./action.yml).

For a usage example, see [_extract.yml](../../workflows/_extract.yml).

## Inputs
The action supports the following inputs (one of repo, site, or config is required):

- `repo` - (optional) The repository name. Will use config at `./repos/{repo}.yml`
- `site` - (optional) The site name. Will use config at `./sites/{site}.yml`
- `config` - (optional) The path to the hyaline configuration file relative to the root of the repository
- `trigger_merge` - (required) Whether to trigger the merge workflow after extraction
- `merge_workflow_ref` - (required) The branch or tag reference for the merge workflow (defaults to `main`)

## Artifacts
This action produces the following artifacts:

- `_extracted-documentation` - Contains `documentation.db` with the extracted documentation

## Developing

### Local Development
The action is contained in `index.js` and requires NodeJS v20.