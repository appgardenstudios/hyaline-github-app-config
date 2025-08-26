const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const {DefaultArtifactClient} = require('@actions/artifact');

const artifact = new DefaultArtifactClient();

const githubToken = process.env.HYALINE_CONFIG_GITHUB_TOKEN || '';
const octokit = github.getOctokit(githubToken);

async function extract() {
  try {
    // Get inputs
    const repo = core.getInput('repo');
    const site = core.getInput('site');
    const config = core.getInput('config');
    const trigger_merge = core.getBooleanInput('trigger_merge');
    const merge_workflow_ref = core.getInput('merge_workflow_ref');
    console.log(`repo: ${repo}, site: ${site}, config: ${config}, trigger_merge: ${trigger_merge}, merge_workflow_ref: ${merge_workflow_ref}`);

    // Get config path
    let configPath;
    if (repo) {
      configPath = `./repos/${repo}.yml`;
    } else if (site) {
      configPath = `./sites/${site}.yml`;
    } else if (config) {
      configPath = config;
    } else {
      throw new Error("one of repo, site, or config must be set");
    }

    // Run version
    console.log('Running hyaline version:');
    await exec.exec('hyaline', ['version']);

    // Run extract documentation
    console.log('Running hyaline extract documentation:');
    let args = [
      'extract', 'documentation',
      '--config', configPath,
      '--output', './documentation.db',
    ];
    if (core.isDebug()) {
      args.unshift('--debug');
    }
    await exec.exec('hyaline', args);

    // Upload artifact
    console.log('Uploading _extracted-documentation');
    await artifact.uploadArtifact('_extracted-documentation',['documentation.db'], './');

    // Trigger merge if asked to
    // We do this here instead of in the calling workflow because only 1 _merge can be
    // active at a time while we allow concurrent runs of _extract.
    if (trigger_merge) {
      console.log('Triggering _merge workflow');
      await octokit.rest.actions.createWorkflowDispatch({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        workflow_id: '_merge.yml',
        ref: merge_workflow_ref,
      });
    }

  } catch(error) {
    core.error(error);
    throw error;
  }
}

(async () => {
  try {
    await extract();
  } catch (error) {
    core.setFailed(error.message);
  }
})();