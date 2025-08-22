const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const githubToken = process.env.HYALINE_GITHUB_TOKEN || '';
const octokit = github.getOctokit(githubToken);

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
 * @returns {string}
 */
function getExtract(owner, name) {
  return `extract:
  source:
    id: ${name}
    description: Documentation for Repository ${owner}/${name}
  crawler:
    type: git
    options:
      repo: https://github.com/${owner}/${name}.git
      branch: main
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
      exclude = ['**/*.test.js'];
      break;
  }

  // If we mapped to nothing return nothing to check
  if (!include || !exclude) {
    return '';
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
 * @returns {string}
 */
function getConfig(owner, name, language) {
  return `${getLLM()}

${getGitHub()}

${getExtract(owner, name)}

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
        default: main
        required: true

jobs:
  extract:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
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

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
      - name: Setup Hyaline CLI
        uses: appgardenstudios/hyaline-actions/setup@v1
      - name: Audit
        uses: ./.github/actions/_audit
        with:
          audit: \${{ inputs.audit }}
          sources: \${{ inputs.sources }}
        env:
          HYALINE_GITHUB_TOKEN: \${{ secrets.HYALINE_GITHUB_TOKEN }}
          HYALINE_LLM_PROVIDER: \${{ vars.HYALINE_LLM_PROVIDER }}
          HYALINE_LLM_MODEL: \${{ vars.HYALINE_LLM_MODEL }}
          HYALINE_LLM_TOKEN: \${{ secrets.HYALINE_LLM_TOKEN }}`;
}

/**
 * Get a PR Body based on changes
 * 
 * @param {Array<string>} changes 
 * @returns 
 */
function getPRBody(changes) {
  return `# Changes
  - ${changes.join('\n  - ')}
`;
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
    const orgRepos = await octokit.paginate(octokit.rest.repos.listForOrg, {
      org: owner,
      type: 'sources',
    });
    orgRepos.forEach(repo => {
      console.log(`Examining ${repo.full_name}`);

      // If there is no config, create one
      const filename = `.${path.sep}repos${path.sep}${repo.name}.yml`;
      if (!fs.existsSync(filename)) {
        console.log(`Creating ${filename}, language: ${repo.language}`);
        fs.writeFileSync(filename, getConfig(owner, repo.name, repo.language));
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

    // Branch and add changes
    if (changes.length > 0) {
      console.log(`${changes.length} potential changes detected`);
      const branch = `doctor-${Date.now()}`;
      
      await exec.exec('git', ['config', 'user.name', '"github-actions[bot]"']);
      await exec.exec('git', ['config', 'user.email', '"github-actions[bot]@users.noreply.github.com"']);
      await exec.exec('git', ['checkout', '-b', branch]);
      await exec.exec('git', ['add', '.']);
      
      // If there are actually changes, commit, push, and open PR
      const output = await exec.getExecOutput('git', ['status', '-s']);
      if (output.stdout.trim()) {
        console.log(`Committing changes to branch ${branch}`);
        await exec.exec('git', ['commit', '-m', '"Doctor changes"']);
        await exec.exec('git', ['push', 'origin', branch]);
        const result = await octokit.rest.pulls.create({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          base: 'main',
          head: branch,
          title: 'Doctor - Configuration Update',
          body: getPRBody(changes),
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