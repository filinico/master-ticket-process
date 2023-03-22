import * as core from '@actions/core'
import * as github from '@actions/github'
import {onReleasePublished, onReleasePush} from './eventHandler'

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('GITHUB_TOKEN', {required: true})
    const tagPrefix = core.getInput('TAG_PREFIX', {required: true})

    if (!process.env.GITHUB_WORKSPACE) {
      core.setFailed(
        'Please use the "actions/checkout" action to checkout your repository.'
      )
      return
    }

    core.info(`GITHUB_WORKSPACE=${process.env.GITHUB_WORKSPACE}`)
    core.info(`Current dir=${__dirname}`)
    core.info(`GITHUB_EVENT_NAME=${process.env.GITHUB_EVENT_NAME}`)
    core.info(`GITHUB context=${JSON.stringify(github.context)}`)

    const octokit = github.getOctokit(githubToken)
    const gitHubContext = {
      octokit,
      context: github.context,
      workspace: process.env.GITHUB_WORKSPACE
    }
    const jiraContext = {
      subDomain: core.getInput('JIRA_SUBDOMAIN', {required: true}),
      email: core.getInput('JIRA_USER', {required: true}),
      token: core.getInput('JIRA_TOKEN', {required: true}),
      projectsIds: core
        .getInput('JIRA_PROJECTS_IDS', {required: true})
        .split(','),
      projectsKeys: core
        .getInput('JIRA_PROJECTS_KEYS', {required: true})
        .split(','),
      masterProjectId: core.getInput('JIRA_MASTER_PROJECT_ID', {
        required: true
      }),
      masterProjectKey: core.getInput('JIRA_MASTER_PROJECT_KEY', {
        required: true
      }),
      masterIssueType: core.getInput('JIRA_MASTER_ISSUE_TYPE', {required: true})
    }

    if (process.env.GITHUB_EVENT_NAME === 'push') {
      core.info(`start onReleasePush`)
      await onReleasePush(gitHubContext, jiraContext, tagPrefix)
      core.info(`releasePush finished`)
    } else if (
      process.env.GITHUB_EVENT_NAME === 'release' &&
      github.context.payload.action === 'released'
    ) {
      core.info(`start onReleasePublished`)
      await onReleasePublished(gitHubContext, jiraContext, tagPrefix)
      core.info(`releasePublished finished`)
    } else {
      core.error(
        `Trigger event type not supported. Can only react on push or release event with type released.`
      )
    }
  } catch (error) {
    core.info(`process terminated, an error happened:`)
    core.setFailed(error.message)
  }
}

run()
