# _doctor
The `_doctor` action is a JavaScript action that maintains and validates the Hyaline configuration repository using [Hyaline](https://github.com/appgardenstudios/hyaline).

This action performs the following tasks:
- Validates environment variables and secrets are properly set
- Discovers repositories accessible to the GitHub token and generates configurations for new ones
- Creates or updates manual workflow files for extracting and auditing
- Validates all existing configuration files using `hyaline validate config`
- Creates a pull request with any changes or validation errors found

## Usage
This action can be run on `ubuntu-latest` and `macos-latest` (and should work on `windows-latest`) GitHub Actions runners. When running on self-hosted GitHub Actions runners you will need to install `NodeJS` using the version specified in [action.yml](./action.yml).

For a usage example, see [_doctor.yml](../../workflows/_doctor.yml).

## Developing

### Local Development
The action is contained in `index.js` and requires NodeJS v20.