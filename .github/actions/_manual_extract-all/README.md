# _manual_extract-all
The `_manual_extract-all` action is a JavaScript action that triggers extraction for all repositories and sites using [Hyaline](https://github.com/appgardenstudios/hyaline).

This action performs the following tasks:
- Validates all configurations in the `repos/` and `sites/` directories using `hyaline validate config`
- Triggers the `_extract` workflow for each valid configuration that has extraction enabled
- Skips configurations that are invalid, missing the extract section, or have extraction disabled

## Usage
This action can be run on `ubuntu-latest` and `macos-latest` (and should work on `windows-latest`) GitHub Actions runners. When running on self-hosted GitHub Actions runners you will need to install `NodeJS` using the version specified in [action.yml](./action.yml).

For a usage example, see [_manual_extract-all.yml](../../workflows/_manual_extract-all.yml).

## Inputs
The action supports the following inputs:

- `extract_workflow_ref` - (required) The branch or tag reference for the extract workflow (defaults to `main`)
- `trigger_merge` - (required) Whether to trigger the merge workflow after each extraction
- `merge_workflow_ref` - (required) The branch or tag reference for the merge workflow (defaults to `main`)

## Developing

### Local Development
The action is contained in `index.js` and requires NodeJS v20.