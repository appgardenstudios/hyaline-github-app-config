const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const github = require('@actions/github');

const githubToken = process.env.HYALINE_GITHUB_TOKEN || '';
const octokit = github.getOctokit(githubToken);

async function extractAll() {
  try {
    // Get inputs
    const extract_workflow_ref = core.getInput('extract_workflow_ref');
    const trigger_merge = core.getBooleanInput('trigger_merge');
    const merge_workflow_ref = core.getInput('merge_workflow_ref');
    console.log(`extract_workflow_ref: ${extract_workflow_ref}, trigger_merge: ${trigger_merge}, merge_workflow_ref: ${merge_workflow_ref}`);
    
    // Get and trigger repos
    const repos = fs.readdirSync(`.${path.sep}repos${path.sep}`);
    for (let i = 0; i < repos.length; i++) {
      const filename = path.basename(repos[i]);
      const parts = filename.split('.');
      // Only trigger if the file looks like <name>.yml
      if (parts.length === 2 && parts[1] === 'yml') {
        console.log('Triggering _extract workflow for repo:', parts[0]);
        await octokit.rest.actions.createWorkflowDispatch({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          workflow_id: '_extract.yml',
          ref: extract_workflow_ref,
          inputs: {
            repo: parts[0],
            trigger_merge,
            merge_workflow_ref,
          }
        });
      }
    }

    // Get and trigger sites
    const sites = fs.readdirSync(`.${path.sep}sites${path.sep}`);
    for (let i = 0; i < sites.length; i++) {
      const filename = path.basename(sites[i]);
      const parts = filename.split('.');
      // Only trigger if the file looks like <name>.yml
      if (parts.length === 2 && parts[1] === 'yml') {
        console.log('Triggering _extract workflow for site:', parts[0]);
        await octokit.rest.actions.createWorkflowDispatch({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          workflow_id: '_extract.yml',
          ref: extract_workflow_ref,
          inputs: {
            site: parts[0],
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