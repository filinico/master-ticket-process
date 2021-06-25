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
      const {
        lastTagName,
        fixVersion,
        prerelease,
        extractedJiraIssues,
        issueKeys,
        masterTicketIssueKey,
        linkedIssueKeys
      } = await onReleasePush(gitHubContext, jiraContext, tagPrefix)
      core.setOutput(
        'LAST_TAG_NAME',
        lastTagName ? lastTagName : 'lastTagName not found'
      )
      core.setOutput(
        'FIX_VERSION',
        fixVersion ? fixVersion : 'fixVersion not found'
      )
      core.setOutput(
        'PRE_RELEASE',
        prerelease ? 'is prerelease' : 'is not prerelease'
      )
      core.setOutput(
        'EXTRACTED_ISSUE_KEYS',
        extractedJiraIssues ? extractedJiraIssues : 'no issue keys extracted'
      )
      core.setOutput(
        'ISSUE_KEYS',
        issueKeys && issueKeys.length > 0
          ? issueKeys.join(',')
          : 'no issue keys found'
      )
      core.setOutput(
        'MASTER_TICKET_ISSUE_KEY',
        masterTicketIssueKey
          ? masterTicketIssueKey
          : 'masterTicketIssueKey not found'
      )
      core.setOutput(
        'LINKED_ISSUE_KEYS',
        linkedIssueKeys && linkedIssueKeys.length > 0
          ? linkedIssueKeys.join(',')
          : 'no linkedIssueKeys keys found'
      )
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
