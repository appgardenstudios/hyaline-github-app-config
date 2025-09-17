# _update-hyaline
The `_update-hyaline` action is a composite action that updates the Hyaline configuration repository by merging changes from an upstream repository.

This action performs the following tasks:
- Adds and fetches from the upstream repository
- Determines the default branches for both origin and upstream
- Checks if updates are available by comparing commits
- Merges upstream changes into the local repository (with optional unrelated history connection)
- Pushes the updated changes back to the origin repository
- Annotates the workflow run with the results of running update

## Usage
This action can be run on `ubuntu-latest` and `macos-latest` (and should work on `windows-latest`) GitHub Actions runners.

For a usage example, see [_update-hyaline.yml](../../workflows/_update-hyaline.yml).

## Inputs

### `upstream`
**Required** The upstream repository URL to fetch updates from.

### `connect_upstream_history`
**Optional** Whether to connect upstream history using `--allow-unrelated-histories`. Usually only set to `true` during initial installation. Default: `false`.