# _merge
The `_merge` action is a JavaScript action that merges extracted documentation databases using [Hyaline](https://github.com/appgardenstudios/hyaline).

This action runs the following hyaline commands:
- `hyaline version` to document which version was used  
- `hyaline merge documentation` to merge multiple documentation databases into a single current database

This action performs the following tasks:
- Downloads the previous merged documentation (if any) to establish a checkpoint
- Identifies new extracted documentation created since the last merge
- Downloads all new extracted documentation databases
- Merges all databases in chronological order to create a current documentation database
- Uploads the merged result as the `_current-documentation` artifact

## Usage
This action can be run on `ubuntu-latest` and `macos-latest` (and should work on `windows-latest`) GitHub Actions runners. When running on self-hosted GitHub Actions runners you will need to install `NodeJS` using the version specified in [action.yml](./action.yml).

For a usage example, see [_merge.yml](../../workflows/_merge.yml).

## Artifacts
This action downloads the following artifacts:

- `_current-documentation` - The previous merged documentation database (if available)
- `_extracted-documentation` - All extracted documentation databases created since the last merge

This action produces the following artifacts:

- `_current-documentation` - Contains `documentation.db` (the merged documentation database) and `checkpoint` (timestamp for tracking purposes)

## Developing

### Local Development
The action is contained in `index.js` and requires NodeJS v20.