import {
  createIssueLink,
  CreateIssueLink,
  createVersion,
  JiraContext,
  JiraVersion,
  listProjectVersions,
  SearchedJiraIssue,
  searchIssues,
  UpdateFixVersion,
  updateIssue
} from './api/jiraApi'
import * as core from '@actions/core'

export const updateJira = async (
  context: JiraContext,
  issueKeys: string[],
  fixVersion: string,
  prerelease: boolean
): Promise<void> => {
  if (!issueKeys || issueKeys.length === 0) {
    return
  }
  core.info(`fixVersion:[${fixVersion}]`)
  const issues = await filterIssuesWithoutCurrentFixVersion(
    context,
    issueKeys,
    fixVersion
  )
  if (!issues || issues.length === 0) {
    return
  }
  const masterTicketIssueKey = await getMasterTicketKey(context, fixVersion)
  const linkedIssues = issues.filter(i =>
    i.fields?.issuelinks?.find(j => j.inwardIssue.key === masterTicketIssueKey)
  )
  const linkedIssueKeys = linkedIssues.map(issue => issue.key)
  core.info(`linkedIssueKeys:[${linkedIssueKeys.join(',')}]`)
  const currentIssueKeys = issues.map(issue => issue.key)
  core.info(`currentIssueKeys:[${currentIssueKeys.join(',')}]`)
  const version = await getJiraVersion(context, fixVersion)
  const fixVersionUpdate: UpdateFixVersion = {
    update: {
      fixVersions: [
        {
          add: {id: version.id}
        }
      ]
    }
  }
  for (const issueKey of currentIssueKeys) {
    core.info(`start updateIssue:[${issueKey}]`)
    await updateIssue(context, issueKey, fixVersionUpdate)
    if (
      !prerelease &&
      masterTicketIssueKey &&
      !linkedIssueKeys.find(i => i === issueKey)
    ) {
      core.info(
        `start linkIssueToMasterTicket:[issue:${issueKey},masterTicketIssueKey:${masterTicketIssueKey}]`
      )
      await linkIssueToMasterTicket(context, masterTicketIssueKey, issueKey)
    }
  }
}

const filterIssuesWithoutCurrentFixVersion = async (
  context: JiraContext,
  issueKeys: string[],
  fixVersion: string
): Promise<SearchedJiraIssue[]> => {
  const {projectKey} = context
  const groupedIssues = issueKeys.join(',')
  const searchIssuesWithoutCurrentFixVersion = `project = ${projectKey} AND fixVersion not in (${fixVersion}) AND issuekey in (${groupedIssues})`
  core.info(`searchIssuesQuery:[${searchIssuesWithoutCurrentFixVersion}]`)
  const issues = await searchIssues(
    context,
    searchIssuesWithoutCurrentFixVersion,
    ['issuelinks']
  )
  return issues
}

const getMasterTicketKey = async (
  context: JiraContext,
  fixVersion: string
): Promise<string | null> => {
  const {masterProjectKey} = context
  const masterTicketQuery = `project = ${masterProjectKey} AND fixVersion in (${fixVersion})`
  core.info(`masterTicketQuery:[${masterTicketQuery}]`)
  const issues = await searchIssues(context, masterTicketQuery, ['summary'])
  let masterTicketIssueKey: string | null = null
  if (issues && issues.length === 1) {
    masterTicketIssueKey = issues[0].key
  }
  core.info(`masterTicketIssueKey:${masterTicketIssueKey}`)
  return masterTicketIssueKey
}

const linkIssueToMasterTicket = async (
  context: JiraContext,
  masterTicketKey: string,
  issueKey: string
): Promise<void> => {
  const {masterIssueType} = context
  const issueLink: CreateIssueLink = {
    type: {
      name: masterIssueType
    },
    inwardIssue: {
      key: masterTicketKey
    },
    outwardIssue: {
      key: issueKey
    }
  }
  await createIssueLink(context, issueLink)
}

const getJiraVersion = async (
  context: JiraContext,
  fixVersion: string
): Promise<JiraVersion> => {
  const {projectId} = context
  const versions = await listProjectVersions(context)
  const result = versions.filter(i => i.name === fixVersion)
  let version: JiraVersion
  if (!result || result.length === 0) {
    const requestedVersion: JiraVersion = {
      name: fixVersion,
      archived: false,
      released: false,
      projectId: parseInt(projectId)
    }
    core.info(`version not found. start create version:[${requestedVersion}]`)
    version = await createVersion(context, requestedVersion)
    core.info(`version created:[${version.id}]`)
  } else {
    version = result[0]
    core.info(`version found:[${version.id}]`)
  }
  return version
}
