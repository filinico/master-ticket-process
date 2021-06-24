import * as core from '@actions/core'
import * as github from '@actions/github'
import {onReleasePublished, onReleasePush} from './eventHandler'

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('GITHUB_TOKEN', {required: true})
    const tagPrefix = core.getInput('TAG_PREFIX', {required: true})

    const octokit = github.getOctokit(githubToken)
    const gitHubContext = {
      octokit,
      context: github.context
    }
    const jiraContext = {
      subDomain: core.getInput('JIRA_SUBDOMAIN', {required: true}),
      email: core.getInput('JIRA_USER', {required: true}),
      token: core.getInput('JIRA_TOKEN', {required: true}),
      projectId: core.getInput('JIRA_PROJECT_ID', {required: true}),
      projectKey: core.getInput('JIRA_PROJECT_KEY', {required: true}),
      masterProjectId: core.getInput('JIRA_MASTER_PROJECT_ID', {
        required: true
      }),
      masterProjectKey: core.getInput('JIRA_MASTER_PROJECT_KEY', {
        required: true
      }),
      masterIssueType: core.getInput('JIRA_MASTER_ISSUE_TYPE', {required: true})
    }

    if (process.env.GITHUB_EVENT_NAME === 'push') {
      await onReleasePush(gitHubContext, jiraContext, tagPrefix)
    } else if (
      process.env.GITHUB_EVENT_NAME === 'release' &&
      github.context.action === 'published'
    ) {
      await onReleasePublished(gitHubContext, jiraContext)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
