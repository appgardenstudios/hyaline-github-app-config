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
 * Validate a config file and check if check is enabled
 * 
 * @param {string} configPath 
 * @returns {Promise<boolean>} true if check is valid and enabled
 */
async function validateConfig(configPath) {
  const filename = path.basename(configPath);
  const outputPath = path.join('.', `validation-${filename}.json`);
  
  try {
    await exec.exec('hyaline', ['validate', 'config', '--config', configPath, '--output', outputPath]);
    const validationResult = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    
    if (!validationResult.valid) {
      throw new Error(`Configuration validation failed: ${validationResult.error}. Run the Doctor workflow to fix validation issues.`);
    }
    
    if (!validationResult.detail.check.present) {
      throw new Error(`Check has not been configured for ${configPath}.`);
    }
    
    if (validationResult.detail.check.disabled) {
      core.notice(`Check is disabled for ${configPath}. Skipping.`);
      return false;
    }
    
    return true;
  } finally {
    // Clean up temp file
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }
}

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
      configPath = path.join('.', 'repos', `${repo}.yml`);
    } else {
      throw new Error('either repo or config must be set');
    }

    // Check config path
    if (!fs.existsSync(configPath)) {
      if (repo) {
        throw new Error(`Configuration file not found for repo: ${repo}. Run the Doctor workflow to generate missing configurations.`);
      } else {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
    }

    // Validate config and check if check is enabled
    const shouldCheck = await validateConfig(configPath);
    if (!shouldCheck) {
      return;
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
      '--output', path.join('.', 'recommendations.json'),
      '--output-current', path.join('.', 'current-recommendations.json'),
      '--output-previous', path.join('.', 'previous-recommendations.json'),
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
    ], '.');

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