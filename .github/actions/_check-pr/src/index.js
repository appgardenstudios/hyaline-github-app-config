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

async function checkPR() {
  try {
    // Get inputs
    const repo = core.getInput('repo');
    const pr_number = core.getInput('pr_number');
    const config = core.getInput('config');
    console.log(`repo: ${repo}, pr_number: ${pr_number}, config: ${config}`);

    // Get config path
    let configPath;
    if (config) {
      configPath = config;
    } else if (repo) {
      configPath = `./repos/${repo}.yml`;
    } else {
      throw new Error('either repo or config must be set');
    }

    // Check config path
    if (!fs.existsSync(configPath)) {
      // If config was provided and invalid, error, else skip (repo missing)
      if (config) {
        throw new Error(`config path not found: ${configPath}`);
      } else {
        console.log('No repo config found. Skipping');
        return
      }
    }

    // Get current documentation
    const documentationPath = await getCurrentDocumentation()

    // If no current documentation, skip
    if (!documentationPath) {
      console.log('No current documentation available. Skipping');
      return
    }

    // Run version
    console.log('Running hyaline version:');
    await exec.exec('hyaline', ['version']);

    // Run check pr
    console.log('Running hyaline check pr:');
    let args = [
      'check', 'pr',
      '--config', configPath,
      '--documentation', documentationPath,
      '--pull-request', `${github.context.repo.owner}/${repo}/${pr_number}`,
      '--output', './recommendations.json',
      '--output-current', './current-recommendations.json',
      '--output-previous', './previous-recommendations.json',
    ];
    if (core.isDebug()) {
      args.unshift('--debug');
    }
    await exec.exec('hyaline', args);

    // Upload artifact
    await artifact.uploadArtifact('check-recommendations', [
      'recommendations.json',
      'current-recommendations.json',
      'previous-recommendations.json',
    ], './');

    console.log('Check PR Complete');

  } catch (error) {
    core.error(error);
    throw error;
  }
}

(async () => {
  try {
    await checkPR();
  } catch (error) {
    core.setFailed(error.message);
  }
})();