const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const {DefaultArtifactClient} = require('@actions/artifact');

const artifact = new DefaultArtifactClient();
const configGitHubToken = process.env.HYALINE_CONFIG_GITHUB_TOKEN || '';
const configOctokit = github.getOctokit(configGitHubToken);

/**
 * Returns the path to the current documentation, or blank
 * 
 * @returns {Promise<string>}
 */
async function getCurrentDocumentation() {
  const {data: currentArtifact} = await configOctokit.rest.actions.listArtifactsForRepo({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    name: '_current-documentation',
    per_page: 1,
  });
  console.log('Getting current documentation. Found:', currentArtifact.artifacts.length);

  // If we found an artifact, download it and return the path
  if (currentArtifact.artifacts.length > 0) {
    const artifactId = currentArtifact.artifacts[0].id;
    const runId = currentArtifact.artifacts[0].workflow_run?.id || 0;
    console.log(`Downloading latest _current-documentation artifact: ${artifactId} (${runId})`);

    // Download the artifact
    const downloadPrefix = `.${path.sep}_tmp${path.sep}${artifactId}`;
    console.log('Downloading artifact to:', downloadPrefix);
    await artifact.downloadArtifact(artifactId, {
      path: downloadPrefix,
      findBy: {
        token: configGitHubToken,
        workflowRunId: runId,
        repositoryOwner: github.context.repo.owner,
        repositoryName: github.context.repo.repo,
      }
    });
    return `${downloadPrefix}${path.sep}documentation.db`;
  }

  return '';
}

async function audit() {
  try {
    // Get inputs
    const audit = core.getInput('audit');
    const repo = core.getInput('repo');
    const site = core.getInput('site');
    const config = core.getInput('config');
    const sources = core.getInput('sources');
    console.log(`audit: ${audit}, repo: ${repo}, site: ${site}, config: ${config}, sources: ${sources}`);
  
    // Get config path
    let configPath;
    if (audit) {
      configPath = `.${path.sep}audits${path.sep}${audit}.yml`;
    } else if (repo) {
      configPath = `.${path.sep}repos${path.sep}${repo}.yml`;
    } else if (site) {
      configPath = `.${path.sep}sites${path.sep}${site}.yml`;
    } else if (config) {
      configPath = config;
    } else {
      throw new Error("one of audit, repo, site, or config must be set");
    }

    // Check config
    if (!fs.existsSync(configPath)) {
      throw new Error(`config not found: ${configPath}`);
    }

    // Get latest documentation
    const documentationPath = await getCurrentDocumentation();

    // Skip if latest documentation not found
    if (!documentationPath) {
      console.log('No current documentation available. Skipping');
      return
    }

    // Run version
    console.log('Running hyaline version:');
    await exec.exec('hyaline', ['version']);

    // Run audit documentation
    console.log('Running hyaline audit documentation:');
    let args = [
      'audit', 'documentation',
      '--config', configPath,
      '--documentation', documentationPath,
      '--output', path.join('.', 'audit-results.json'),
    ];
    if (sources) {
      const sourceArgs = [];
      sources.split(',').forEach(source => sourceArgs.push('--source', source.trim()));
      args.push(...sourceArgs);
    }
    if (core.isDebug()) {
      args.unshift('--debug');
    }
    await exec.exec('hyaline', args);

    // Upload artifact
    console.log('Uploading audit-results');
    await artifact.uploadArtifact('audit-results', [
      'audit-results.json',
    ], '.');

    console.log('Audit Complete');

    // Display audit results summary
    const auditResults = JSON.parse(fs.readFileSync(path.join('.', 'audit-results.json'), 'utf8'));
    const totalRules = auditResults.results.length;
    const passedRules = auditResults.results.filter(result => result.pass).length;
    
    await core.summary
      .addHeading(`Audit Results - ${Math.round(passedRules/totalRules * 100)}% passed`)
      .addTable([
        [{data: 'Rule', header: true}, {data: 'Result', header: true}],
        ...auditResults.results.map(result => [
          result.rule,
          result.pass ? 'Pass ✅' : 'Fail ❌'
        ])
      ])
      .write();
  } catch(error) {
    core.error(error);
    throw error;
  }
}

(async () => {
  try {
    await audit();
  } catch (error) {
    core.setFailed(error.message);
  }
})();