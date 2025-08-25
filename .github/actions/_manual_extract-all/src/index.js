const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const githubToken = process.env.HYALINE_CONFIG_GITHUB_TOKEN || '';
const octokit = github.getOctokit(githubToken);

/**
 * Validate a config file and check if extract is enabled
 * 
 * @param {string} configPath 
 * @returns {Promise<boolean>} true if extract is valid and enabled
 */
async function shouldExtract(configPath) {
  // Check if it's a .yml file
  const filename = path.basename(configPath);
  const parts = filename.split('.');
  if (parts.length !== 2 || parts[1] !== 'yml') {
    return false;
  }
  
  const outputPath = `./validation-${filename}.json`;
  
  try {
    await exec.exec('hyaline', ['validate', 'config', '--config', configPath, '--output', outputPath]);
    const validationResult = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    
    if (!validationResult.valid) {
      console.log(`Skipping ${configPath}: invalid config - ${validationResult.error}`);
      return false;
    }
    
    if (!validationResult.detail.extract.present) {
      console.log(`Skipping ${configPath}: extract section missing`);
      return false;
    }
    
    if (validationResult.detail.extract.disabled) {
      console.log(`Skipping ${configPath}: extract disabled`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to validate ${configPath}: ${error.message}`);
    return false;
  } finally {
    // Clean up temp file
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }
}

async function extractAll() {
  try {
    // Get inputs
    const extract_workflow_ref = core.getInput('extract_workflow_ref');
    const trigger_merge = core.getBooleanInput('trigger_merge');
    const merge_workflow_ref = core.getInput('merge_workflow_ref');
    console.log(`extract_workflow_ref: ${extract_workflow_ref}, trigger_merge: ${trigger_merge}, merge_workflow_ref: ${merge_workflow_ref}`);
    
    // Get and trigger repos
    const repos = fs.readdirSync(path.join('.', 'repos'));
    for (let i = 0; i < repos.length; i++) {
      const filename = repos[i];
      const configPath = path.join('.', 'repos', filename);
      if (await shouldExtract(configPath)) {
        const repoName = path.basename(filename, '.yml');
        console.log('Triggering _extract workflow for repo:', repoName);
        await octokit.rest.actions.createWorkflowDispatch({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          workflow_id: '_extract.yml',
          ref: extract_workflow_ref,
          inputs: {
            repo: repoName,
            trigger_merge,
            merge_workflow_ref,
          }
        });
      }
    }

    // Get and trigger sites
    const sites = fs.readdirSync(path.join('.', 'sites'));
    for (let i = 0; i < sites.length; i++) {
      const filename = sites[i];
      const configPath = path.join('.', 'sites', filename);
      if (await shouldExtract(configPath)) {
        const siteName = path.basename(filename, '.yml');
        console.log('Triggering _extract workflow for site:', siteName);
        await octokit.rest.actions.createWorkflowDispatch({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          workflow_id: '_extract.yml',
          ref: extract_workflow_ref,
          inputs: {
            site: siteName,
            trigger_merge,
            merge_workflow_ref,
          }
        });
      }
    }

    console.log('Extract All Complete');

  } catch(error) {
    core.error(error);
    throw error;
  }
}

(async () => {
  try {
    await extractAll();
  } catch (error) {
    core.setFailed(error.message);
  }
})();