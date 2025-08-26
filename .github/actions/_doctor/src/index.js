const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const hyalineGitHubToken = process.env.HYALINE_GITHUB_TOKEN || '';
const hyalineOctokit = github.getOctokit(hyalineGitHubToken);

const configGitHubToken = process.env.HYALINE_CONFIG_GITHUB_TOKEN || '';
const configOctokit = github.getOctokit(configGitHubToken);

const configDefaultBranch = github.context.payload.repository?.default_branch || 'main';

/**
 * Get the llm block of the hyaline config.
 *
 * @returns {string}
 */
function getLLM() {
  return `llm:
  provider: \${HYALINE_LLM_PROVIDER}
  model: \${HYALINE_LLM_MODEL}
  key: \${HYALINE_LLM_TOKEN}
`;
}

/**
 * Get the github block of the hyaline config.
 *
 * @returns {string}
 */
function getGitHub() {
  return `github:
  token: \${HYALINE_GITHUB_TOKEN}
`
}

/**
 * Get the extract block of the hyaline config.
 * 
 * @param {string} owner
 * @param {string} name
 * @param {string} defaultBranch
 * @returns {string}
 */
function getExtract(owner, name, defaultBranch) {
  return `extract:
  source:
    id: ${name}
    description: Documentation for Repository ${owner}/${name}
  crawler:
    type: git
    options:
      repo: https://github.com/${owner}/${name}.git
      branch: ${defaultBranch}
      clone: true
      auth:
        type: http
        options:
          username: git
          password: \${HYALINE_GITHUB_TOKEN}
    include:
      - "**/*.md"
    exclude:
      - ".github/**/*"
  extractors:
    - type: md
      include:
        - "**/*.md"
`
}

/**
 * Get the check block of the hyaline config.
 * Note that we return blank if we can't map the language.
 *
 * @param {string} name 
 * @param {string | null | undefined} language 
 * @returns {string}
 */
function getCheck(name, language) {
  let include, exclude;

  // Map language to include/exclude statements
  switch(language?.toLowerCase()) {
    case 'go':
      include = ['**/*.go', 'go.mod'];
      exclude = ['**/*_test.go'];
      break;
    case 'javascript':
      include = ['**/*.js', 'package.json'];
      exclude = ['**/*.test.js', '**/*.spec.js'];
      break;
    case 'python':
      include = ['**/*.py', 'requirements.txt', 'setup.py', 'pyproject.toml'];
      exclude = ['**/test_*.py', '**/*_test.py', '**/tests/**'];
      break;
    case 'typescript':
      include = ['**/*.ts', '**/*.tsx', 'package.json', 'tsconfig.json'];
      exclude = ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx', '**/*.d.ts'];
      break;
    case 'java':
      include = ['**/*.java', 'pom.xml', 'build.gradle', '*.gradle'];
      exclude = ['**/Test*.java', '**/*Test.java', '**/tests/**', '**/test/**'];
      break;
    case 'c#':
      include = ['**/*.cs', '**/*.csproj', '**/*.sln'];
      exclude = ['**/Test*.cs', '**/*Test.cs', '**/*Tests.cs', '**/tests/**'];
      break;
    case 'c++':
      include = ['**/*.cpp', '**/*.cc', '**/*.cxx', '**/*.hpp', '**/*.h', '**/*.hh', 'CMakeLists.txt', 'Makefile'];
      exclude = ['**/test_*.cpp', '**/*_test.cpp', '**/tests/**'];
      break;
    case 'php':
      include = ['**/*.php', 'composer.json'];
      exclude = ['**/Test*.php', '**/*Test.php', '**/tests/**', '**/*_test.php'];
      break;
    case 'c':
      include = ['**/*.c', '**/*.h', 'Makefile', 'CMakeLists.txt'];
      exclude = ['**/test_*.c', '**/*_test.c', '**/tests/**'];
      break;
    case 'ruby':
      include = ['**/*.rb', 'Gemfile', 'Rakefile', '*.gemspec'];
      exclude = ['**/test_*.rb', '**/*_test.rb', '**/*_spec.rb', '**/spec/**', '**/test/**'];
      break;
    case 'rust':
      include = ['**/*.rs', 'Cargo.toml'];
      exclude = ['**/tests/**', '**/test_*.rs'];
      break;
    case 'r':
      include = ['**/*.R', '**/*.r', 'DESCRIPTION', 'NAMESPACE'];
      exclude = ['**/test_*.R', '**/*_test.R', '**/tests/**'];
      break;
    case 'kotlin':
      include = ['**/*.kt', '**/*.kts', 'build.gradle.kts', 'build.gradle'];
      exclude = ['**/Test*.kt', '**/*Test.kt', '**/test/**', '**/tests/**'];
      break;
    case 'swift':
      include = ['**/*.swift', 'Package.swift'];
      exclude = ['**/Test*.swift', '**/*Test.swift', '**/*Tests.swift', '**/Tests/**'];
      break;
    case 'scala':
      include = ['**/*.scala', 'build.sbt', '*.sbt'];
      exclude = ['**/Test*.scala', '**/*Test.scala', '**/*Spec.scala', '**/test/**', '**/tests/**'];
      break;
    case 'dart':
      include = ['**/*.dart', 'pubspec.yaml'];
      exclude = ['**/test_*.dart', '**/*_test.dart', '**/test/**', '**/tests/**'];
      break;
    case 'elixir':
      include = ['**/*.ex', '**/*.exs', 'mix.exs'];
      exclude = ['**/test_*.ex', '**/*_test.exs', '**/test/**'];
      break;
  }

  // If we mapped to nothing, disable check
  if (!include || !exclude) {
    return `check:
  disabled: true
`;
  }

  return `check:
  code:
    include:
      - "${include.join('"\n      - "')}"
    exclude:
      - "${exclude.join('"\n      - "')}"
  documentation:
    include:
      - source: "${name}"
        document: "**/*"
  options:
    detectDocumentationUpdates:
      source: ${name}
`
}

/**
 * Get the config file for a repository.
 *
 * @param {string} owner 
 * @param {string} name 
 * @param {string | null | undefined} language 
 * @param {string} defaultBranch
 * @returns {string}
 */
function getConfig(owner, name, defaultBranch, language) {
  return `${getLLM()}

${getGitHub()}

${getExtract(owner, name, defaultBranch)}

${getCheck(name, language)}
`
}

/**
 * Get configuration names from a list of paths.
 * Note that only configurations ending in `.yml` are returned.
 * 
 * @param {Array<string>} paths 
 * @returns {Array<string>}
 */
function getConfigNames(paths) {
  paths.sort();
  return paths.map(configPath => {
      const filename = path.basename(configPath);
      const parts = filename.split('.');
      if (parts.length === 2 && parts[1] === 'yml') {
        return parts[0];
      }
    }).filter(config => config != undefined);
}

/**
 * Get an Extract wrapper for a given type and options.
 *
 * @param {Array<string>} options 
 * @returns {string}
 */
function getExtractWrapper(type, options) {
  const name = type.charAt(0).toUpperCase() + type.slice(1)
  return `name: Manual - Extract ${name}

on:
  workflow_dispatch:
    inputs:
      ${type}:
        description: '${name} Name'
        type: choice
        required: true
        options:
          - ${options.join('\n          - ')}
      trigger_merge:
        description: 'Trigger Merge Workflow'
        type: boolean
        default: true
      merge_workflow_ref:
        description: 'Merge Workflow Ref (Branch or Tag)'
        type: string
        default: ${configDefaultBranch}
        required: true

permissions: {}

jobs:
  extract:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          token: \${{ secrets.HYALINE_CONFIG_GITHUB_TOKEN }}
      - name: Setup Hyaline CLI
        uses: appgardenstudios/hyaline-actions/setup@v1
      - name: Extract
        uses: ./.github/actions/_extract
        with:
          ${type}: \${{ inputs.${type} }}
          trigger_merge: \${{ inputs.trigger_merge }}
          merge_workflow_ref: \${{ inputs.merge_workflow_ref }}
        env:
          HYALINE_GITHUB_TOKEN: \${{ secrets.HYALINE_GITHUB_TOKEN }}
`;
}

/**
 * Get an audit wrapper for the given options.
 * 
 * @param {Array<string>} options 
 * @returns {string}
 */
function getAuditWrapper(options) {
  return `name: Manual - Run Audit

on:
  workflow_dispatch:
    inputs:
      audit:
        description: 'Audit Name'
        type: choice
        required: true
        options:
          - ${options.join('\n          - ')}
      sources:
        description: 'Sources (Comma Separated)'
        type: string

permissions: {}

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          token: \${{ secrets.HYALINE_CONFIG_GITHUB_TOKEN }}
      - name: Setup Hyaline CLI
        uses: appgardenstudios/hyaline-actions/setup@v1
      - name: Audit
        uses: ./.github/actions/_audit
        with:
          audit: \${{ inputs.audit }}
          sources: \${{ inputs.sources }}
        env:
          HYALINE_CONFIG_GITHUB_TOKEN: \${{ secrets.HYALINE_CONFIG_GITHUB_TOKEN }}
          HYALINE_LLM_PROVIDER: \${{ vars.HYALINE_LLM_PROVIDER }}
          HYALINE_LLM_MODEL: \${{ vars.HYALINE_LLM_MODEL }}
          HYALINE_LLM_TOKEN: \${{ secrets.HYALINE_LLM_TOKEN }}`;
}

/**
 * Validate config files in a directory
 * 
 * @param {string} directory 
 * @returns {Promise<string[]>} validation errors
 */
async function validateConfigs(directory) {
  const validationErrors = [];
  
  if (!fs.existsSync(directory)) {
    return validationErrors;
  }
  
  const configFiles = fs.readdirSync(directory).filter(file => file.endsWith('.yml'));
  
  for (const configFile of configFiles) {
    const configPath = `./${directory}/${configFile}`;
    const outputPath = `./validation-${configFile}.json`;
    
    try {
      await exec.exec('hyaline', ['validate', 'config', '--config', configPath, '--output', outputPath]);
      const validationResult = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      if (!validationResult.valid) {
        validationErrors.push(`${configPath}: ${validationResult.error}`);
      }
      fs.unlinkSync(outputPath); // Clean up temp file
    } catch (error) {
      console.error(`Failed to validate ${configPath}`, error);
    }
  }
  
  return validationErrors;
}

/**
 * Get a PR Body based on changes and validation errors
 * 
 * @param {Array<string>} changes 
 * @param {Array<string>} validationErrors 
 * @returns 
 */
function getPRBody(changes, validationErrors = []) {
  let body = '';
  
  if (changes.length > 0) {
    body += `## Changes
  - ${changes.join('\n  - ')}

`;
  }
  
  if (validationErrors.length > 0) {
    body += `## Validation Errors
  - ${validationErrors.join('\n  - ')}

`;
  }
  
  body += `Note: Documentation extraction or checking can be disabled by setting \`disabled: true\` for \`extract\` or \`check\`, respectively.
`;
  
  return body;
}

async function doctor() {
  try {
    // Check Secrets and Env Vars
    const envErrors = [];
    if (!process.env.HYALINE_GITHUB_TOKEN) {
      envErrors.push('HYALINE_GITHUB_TOKEN not set')
    }
    if (!process.env.HYALINE_LLM_PROVIDER) {
      envErrors.push('HYALINE_LLM_PROVIDER not set')
    }
    if (!process.env.HYALINE_LLM_MODEL) {
      envErrors.push('HYALINE_LLM_MODEL not set')
    }
    if (!process.env.HYALINE_LLM_TOKEN) {
      envErrors.push('HYALINE_LLM_TOKEN not set')
    }
    if (envErrors.length != 0) {
      throw new Error(`The following secrets and env variables are not set: ${envErrors.join(', ')}`)
    }

    // Track changes
    const changes = [];

    // Check repos
    const owner = github.context.repo.owner;
    let repositories = await hyalineOctokit.paginate(hyalineOctokit.rest.repos.listForAuthenticatedUser, {
      type: 'all',
    });
    
    repositories.forEach(repo => {
      if (repo.fork || repo.owner.login !== owner) {
        console.log(`Skipping ${repo.full_name}`);
        return;
      }

      console.log(`Examining ${repo.full_name}`);

      // If there is no config, create one
      const filename = `.${path.sep}repos${path.sep}${repo.name}.yml`;
      if (!fs.existsSync(filename)) {
        console.log(`Creating ${filename}, language: ${repo.language}`);
        fs.writeFileSync(filename, getConfig(owner, repo.name, repo.default_branch, repo.language));
        changes.push(`Generated a config for repo ${repo.name}`);
      }
    });

    // Create Repo Wrappers
    const repos = fs.readdirSync(`.${path.sep}repos${path.sep}`);
    const repoNames = getConfigNames(repos);
    if (repoNames.length > 0) {
      const workflow = `.${path.sep}.github${path.sep}workflows${path.sep}_manual_extract_repo.yml`;
      fs.writeFileSync(workflow, getExtractWrapper('repo', repoNames));
      changes.push('Ensure the Manual - Extract Repo workflow is up-to-date');
    }

    // Create Site Wrappers
    const sites = fs.readdirSync(`.${path.sep}sites${path.sep}`);
    const siteNames = getConfigNames(sites);
    if (siteNames.length > 0) {
      const workflow = `.${path.sep}.github${path.sep}workflows${path.sep}_manual_extract_site.yml`;
      fs.writeFileSync(workflow, getExtractWrapper('site', siteNames));
      changes.push('Ensure the Manual - Extract Site workflow is up-to-date');
    }

    // Create Audit Wrappers
    const audits = fs.readdirSync(`.${path.sep}audits${path.sep}`);
    const auditNames = getConfigNames(audits);
    if (auditNames.length > 0) {
      const workflow = `.${path.sep}.github${path.sep}workflows${path.sep}_manual_audit.yml`;
      fs.writeFileSync(workflow, getAuditWrapper(auditNames));
      changes.push('Ensure the Manual - Run Audit workflow is up-to-date');
    }

    // Validate config files
    console.log('Validating config files...');
    const repoValidationErrors = await validateConfigs('repos');
    const siteValidationErrors = await validateConfigs('sites');
    const validationErrors = [...repoValidationErrors, ...siteValidationErrors];

    // Branch and add changes
    if (changes.length > 0 || validationErrors.length > 0) {
      console.log(`${changes.length} potential changes detected, ${validationErrors.length} validation errors found`);
      const branch = `doctor-${Date.now()}`;
      
      await exec.exec('git', ['config', 'user.name', '"Hyaline"']);
      await exec.exec('git', ['config', 'user.email', '"hyaline-bot@users.noreply.github.com"']);
      await exec.exec('git', ['checkout', '-b', branch]);
      await exec.exec('git', ['add', '.']);
      
      // If there are actually changes, commit, push, and open PR
      const output = await exec.getExecOutput('git', ['status', '-s']);
      const hasFileChanges = !!output.stdout.trim();
      
      if (hasFileChanges || validationErrors.length > 0) {
        // If we have validation errors but no file changes, make an empty commit
        if (!hasFileChanges && validationErrors.length > 0) {
          console.log('No file changes but validation errors found, making empty commit');
          await exec.exec('git', ['commit', '--allow-empty', '-m', '"Doctor validation errors"']);
        } else {
          console.log(`Committing changes to branch ${branch}`);
          await exec.exec('git', ['commit', '-m', '"Doctor changes"']);
        }
        
        await exec.exec('git', ['push', 'origin', branch]);
        const result = await configOctokit.rest.pulls.create({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          base: configDefaultBranch,
          head: branch,
          title: 'Doctor - Configuration Update',
          body: getPRBody(changes, validationErrors),
        });
        const prURL = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/pull/${result.data.number}`;
        console.log(`Created PR ${prURL}`);
      }
    }

    console.log('Doctor Complete');

  } catch (error) {
    core.error(error);
    throw error;
  }
}

(async () => {
  try {
    await doctor();
  } catch (error) {
    core.setFailed(error.message);
  }
})();
