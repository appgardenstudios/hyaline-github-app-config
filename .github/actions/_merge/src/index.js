const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const io = require('@actions/io');
const {DefaultArtifactClient} = require('@actions/artifact');

const artifact = new DefaultArtifactClient();
const githubToken = process.env.HYALINE_CONFIG_GITHUB_TOKEN || '';
const octokit = github.getOctokit(githubToken);

const EXTRACT_ARTIFACT_NAME = '_extracted-documentation';
const MERGE_ARTIFACT_NAME = '_current-documentation';

/**
 * @typedef {Object} LastRun
 * @property {string} checkpoint - The last run's checkpoint or blank
 * @property {string} documentationPath - The path to the last run's documentation.db or blank
 */

/**
 * Gets the last run information (if any) and returns the checkpoint and the path to the documentation db.
 * 
 * @returns {Promise<LastRun>}
 */
async function getLastRun() {
  let checkpoint = '';
  let documentationPath = '';

  // Get the latest _merge artifact so we can get the checkpoint info
  const {data: priorRun} = await octokit.rest.actions.listArtifactsForRepo({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    name: MERGE_ARTIFACT_NAME,
    per_page: 1,
  });
  console.log('Getting prior run. Found:', priorRun.artifacts.length);

  // If we have a last run artifact download it to get the last run info
  if (priorRun.artifacts.length > 0) {
    const artifactId = priorRun.artifacts[0].id;
    const runId = priorRun.artifacts[0].workflow_run?.id || 0;
    console.log(`Downloading previous merge run artifact: ${artifactId} (${runId})`);

    // Download the artifact
    const downloadPrefix = `.${path.sep}_tmp${path.sep}${artifactId}`;
    console.log('Downloading artifact to:', downloadPrefix);
    await artifact.downloadArtifact(artifactId, {
      path: downloadPrefix,
      findBy: {
        token: githubToken,
        workflowRunId: runId,
        repositoryOwner: github.context.repo.owner,
        repositoryName: github.context.repo.repo,
      }
    });
    checkpoint = fs.readFileSync(`${downloadPrefix}${path.sep}checkpoint`).toString();
    documentationPath = `${downloadPrefix}${path.sep}documentation.db`;
  }

  console.log(`Last Run Checkpoint: ${checkpoint}, Documenation (${documentationPath})`);
  return {checkpoint, documentationPath};
}

 /**
 * @typedef {Object} ToMerge
 * @property {Array<string>} paths - A list of paths to the extracted documentation to be merged (in oldest -> newest order)
 * @property {string} newCheckpoint - The new checkpoint (or blank if none)
 */

/**
 * Takes in a checkpoint, downloads documentation that needs to be extracted
 * that was created after the checkpoint, and returns a list of documentation
 * paths to be merged in oldest to newest order.
 * 
 * @param {string} checkpoint The checkpoint date/time (or blank) 
 * @returns {Promise<ToMerge>}
 */
async function getDocumentation(checkpoint) {
  console.log('Getting documentation using checkpoint:', checkpoint);
  const paths = [];
  let newCheckpoint = '';

  /**
   * @typedef {object} Artifact
   * @property {number} artifactId - Artifact ID.
   * @property {number} runId - Run ID.
   */

  /** @type {Array<Artifact>} */
  const artifacts = [];

  // Get all documentation to merge
  // @ts-ignore
  await octokit.paginate(octokit.rest.actions.listArtifactsForRepo, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    name: EXTRACT_ARTIFACT_NAME,
  }, (response, done) => {
    // Only try to get checkpoint and artifacts if there are artifacts
    if (response.data.length > 0 ) {
      // If we don't have a checkpoint yet, set checkpoint to the first artifact returned
      if (!newCheckpoint) {
        newCheckpoint = response.data[0].created_at || '';
      }

      // Get artifacts that are after the checkpoint and mark that this is our lastPage
      // if there is an artifact created before our checkpoint.
      let lastPage = false;
      for (let i = 0; i < response.data.length; i++) {
        const artifact = response.data[i];
        const created_at = artifact.created_at || '';
        console.log(`Examining ${EXTRACT_ARTIFACT_NAME} created_at`, created_at);

        // Only add artifact if we have no checkpoint OR
        // checkpoint date is before this artifact's created date
        if (checkpoint && created_at <= checkpoint) {
          lastPage = true;
          break;
        } else {
          console.log(`Adding ${EXTRACT_ARTIFACT_NAME} to merge. Artifact: ${artifact.id}, Run: ${artifact.workflow_run?.id}, Created: ${created_at}`);
          artifacts.push({
            artifactId: artifact.id,
            runId: artifact.workflow_run?.id || 0,
          })
        }
      }

      // If we found an artifact that was before our checkpoint, say we are done.
      if (lastPage) {
        console.log('Stopping pagination past checkpoint', checkpoint);
        done();
      }
    }
    return response;
  });

  // Process our artifacts in reverse order so newer trumps older
  artifacts.reverse()

  // Loop through and download our artifacts sequentially to preserve order
  // as well as being polite and not slamming the API.
  for (let i = 0; i < artifacts.length; i++) {
    const {artifactId, runId} = artifacts[i];

    // Download the artifact
    const downloadPrefix = `.${path.sep}_tmp${path.sep}${runId}`;
    console.log('Downloading artifact:', downloadPrefix);
    await artifact.downloadArtifact(artifactId, {
      path: downloadPrefix,
      findBy: {
        token: githubToken,
        workflowRunId: runId,
        repositoryOwner: github.context.repo.owner,
        repositoryName: github.context.repo.repo,
      }
    });

    // Add to path
    paths.push(`${downloadPrefix}${path.sep}documentation.db`);
  }

  return {paths, newCheckpoint};
}

/**
 * Call hyaline to merge the documentation databases into a current database.
 * 
 * @param {Array<string>} paths - Paths to merge in order of merge. Must be at least 2.
 * @returns {Promise<string>} The path to the new current DB
 */
async function mergeDocumentation(paths) {
  let newCurrentDB = path.join('.', 'documentation.db');

  // Format input path pairs
  const inputs = [];
  paths.forEach(path => inputs.push('--input', path))

  // Run merge documentation
  console.log('Running hyaline merge documentation:');
  let args = [
    'merge', 'documentation',
    ...inputs,
    '--output', newCurrentDB,
  ];
  if (core.isDebug()) {
    args.unshift('--debug');
  }
  await exec.exec('hyaline', args);

  return newCurrentDB;
}

/**
 * Upload the artifact
 * 
 * @param {*} currentDB 
 * @param {*} checkpoint 
 */
async function uploadArtifact(currentDB, checkpoint) {
  console.log('uploadArtifact', currentDB, checkpoint);

  // Move path to be correct if it is not so that the zip file is consistent
  if (currentDB != path.join('.', 'documentation.db')) {
    await io.mv(currentDB, path.join('.', 'documentation.db'));
  }

  // Write out checkpoint
  fs.writeFileSync(path.join('.', 'checkpoint'), checkpoint);

  // Upload artifact
  await artifact.uploadArtifact(MERGE_ARTIFACT_NAME, ['documentation.db', 'checkpoint'], '.');
}

async function merge() {
  try {
    // Run hyaline version
    console.log('Running hyaline version:');
    await exec.exec('hyaline', ['version']);

    // Get last run info
    const lastRun = await getLastRun();    

    // Get documentation to merge
    const {paths, newCheckpoint} = await getDocumentation(lastRun.checkpoint);
    
    if (!lastRun.documentationPath) {
      // If there is no currentDB and nothing to merge, we are done
      if (paths.length == 0) {
        console.log('No current documentation and no extractions to merge');
      // If there is no currentDB and only 1 to merge, just upload it
      } else if (paths.length == 1) {
        console.log('No current documentation and 1 extraction to merge');
        await uploadArtifact(paths[0], newCheckpoint);
      // If there is no currentDB and >1 to merge, merge and upload
      } else {
        console.log(`No current documentation and ${paths.length} extractions to merge`);
        const newCurrentDB = await mergeDocumentation(paths);
        await uploadArtifact(newCurrentDB, newCheckpoint);
      }
    } else {
      // If there is a currentDB and nothing to merge, upload currentDB
      if (paths.length == 0) {
        console.log('Current documentation and no extractions to merge');
        await uploadArtifact(lastRun.documentationPath, lastRun.checkpoint);
      // If there is a currentDB and >0 to merge, merge and upload
      } else {
        console.log(`Current documentation and ${paths.length} extractions to merge`);
        const newCurrentDB = await mergeDocumentation([lastRun.documentationPath, ...paths]);
        await uploadArtifact(newCurrentDB, newCheckpoint);
      }
    }

    console.log('Merge Complete');

  } catch (error) {
    core.error(error);
    throw error;
  }
}

(async () => {
  try {
    await merge();
  } catch (error) {
    core.setFailed(error.message);
  }
})();