import { Hono } from 'hono';
import { App } from '@octokit/app';
import { Webhooks } from '@octokit/webhooks';

const app = new Hono();
let githubApp;
let webhookInstance;

// Get (and create if needed) the GitHub App
function getGitHubApp(env) {
  if (githubApp === undefined) {
    githubApp = new App({
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_PRIVATE_KEY,
      webhooks: {
        secret: env.WEBHOOK_SECRET
      }
    });
  }
  return githubApp;
}

// Get (and create if needed) the Webhook Instance
function getWebhooksInstance(secret) {
  if (webhookInstance === undefined) {
    webhookInstance = new Webhooks({
      secret: secret
    });
  }
  return webhookInstance;
}

// Dispatch a workflow to the Hyaline GitHub App config repo
async function dispatchWorkflow(workflowId, inputs, octokit, owner, repo) {
  try {
    console.log('dispatchWorkflow - dispatching', {
      workflowId,
      inputs,
      owner,
      repo
    });

    const response = await octokit.request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
      owner,
      repo,
      workflow_id: workflowId,
      ref: 'main',
      inputs: inputs,
      headers: {
        "x-github-api-version": "2022-11-28",
      },
    });

    return response;
  } catch (error) {
    console.error('dispatchWorkflow - failed', {
      workflowId,
      error
    });
    throw new Error(`Failed to dispatch workflow ${workflowId}: ${error.message}`);
  }
}

// See if we need to dispatch _check-pr for this pull_request event
async function handleCheckPrEvent(payload, githubApp, owner, repo) {
  const { action, pull_request } = payload;

  // Check if this is an event we care about for _check-pr
  const checkPrActions = ['opened', 'synchronize', 'reopened', 'ready_for_review'];
  const isEditedBaseChange = action === 'edited' && payload.changes?.base;

  if (!checkPrActions.includes(action) && !isEditedBaseChange) {
    console.debug('handleCheckPREvent - ignoring', { action });
    return;
  }

  // Check PR state - must be open and not draft
  if (pull_request.state !== 'open' || pull_request.draft) {
    console.log('handleCheckPREvent - ignoring', { state: pull_request.state, draft: pull_request.draft });
    return;
  }

  console.log('handleCheckPREvent - handling', {
    action,
    pr_number: pull_request.number
  });

  // Get installation ID and create authenticated Octokit instance
  const installationId = payload.installation?.id;
  if (!installationId) {
    throw new Error('No installation ID found in webhook payload');
  }

  const octokit = await githubApp.getInstallationOctokit(installationId);

  // Dispatch _check-pr workflow
  const inputs = {
    repo: payload.repository.name,
    pr_number: pull_request.number.toString()
  };

  await dispatchWorkflow('_check-pr.yml', inputs, octokit, owner, repo);

  console.log('handleCheckPREvent - dispatched', {
    pr_number: pull_request.number,
    action
  });
}

// See if we need to dispatch _extract for this pull_request event
async function handleExtractEvent(payload, githubApp, owner, repo) {
  const { action, pull_request } = payload;

  // Check if this is a closed and merged PR
  if (action !== 'closed' || !pull_request.merged) {
    console.log('handleExtractEvent - ignoring', {
      action,
      merged: pull_request.merged
    });
    return;
  }

  console.log('handleExtractEvent - handling', {
    action,
    pr_number: pull_request.number
  });

  // Get installation ID and create authenticated Octokit instance
  const installationId = payload.installation?.id;
  if (!installationId) {
    throw new Error('No installation ID found in webhook payload');
  }

  const octokit = await githubApp.getInstallationOctokit(installationId);

  // Dispatch _extract workflow
  const inputs = {
    repo: payload.repository.name,
    trigger_merge: 'true',
    merge_workflow_ref: 'main'
  };

  await dispatchWorkflow('_extract.yml', inputs, octokit, owner, repo);

  console.log('handleExtractEvent - dispatched', {
    pr_number: pull_request.number
  });
}

// Webhook endpoint
app.post('/webhooks', async (c) => {
  try {
    const signature = c.req.header('x-hub-signature-256');
    const body = await c.req.text();
    const eventType = c.req.header('x-github-event');
    const deliveryId = c.req.header('x-github-delivery');

    console.log('/webhooks - received', {
      eventType,
      deliveryId
    });

    // Validate required environment variables
    const requiredEnvVars = ['GITHUB_APP_ID', 'GITHUB_PRIVATE_KEY', 'WEBHOOK_SECRET'];
    for (const envVar of requiredEnvVars) {
      if (!c.env?.[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        return c.json({ error: `Missing configuration: ${envVar}` }, 500);
      }
    }

    // Get GitHub App and Webhooks instances
    const githubApp = getGitHubApp(c.env);
    const webhooks = getWebhooksInstance(c.env.WEBHOOK_SECRET);

    // Verify webhook signature
    const isValidSignature = await webhooks.verify(body, signature);
    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // Parse the payload
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      console.error('Failed to parse webhook payload:', error);
      return c.json({ error: 'Invalid JSON payload' }, 400);
    }

    const owner = payload.repository?.owner?.login;
    const repo = c.env.HYALINE_CONFIG_REPO || 'hyaline-github-app-config';

    // Handle pull_request events
    if (eventType === 'pull_request') {
      try {
        await Promise.all([
          handleCheckPrEvent(payload, githubApp, owner, repo),
          handleExtractEvent(payload, githubApp, owner, repo)
        ]);
      } catch (error) {
        console.error('Error processing PR event:', error);
        return c.json({ error: 'Failed to process PR event', details: error.message }, 500);
      }
    } else {
      console.log('/webhooks - ignoring event type', {
        eventType
      });
    }

    return c.body(null, 204);
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Global error handler
app.onError((err, c) => {
  console.error('Internal server error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;