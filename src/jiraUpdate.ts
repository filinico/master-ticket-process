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

interface UpdateJiraResults {
  issueKeys: string[] | null
  masterTicketIssueKey: string | null
  linkedIssueKeys: string[] | null
}

export const updateJira = async (
  context: JiraContext,
  issueKeys: string[],
  fixVersion: string,
  prerelease: boolean
): Promise<UpdateJiraResults> => {
  if (!issueKeys || issueKeys.length === 0) {
    return {
      issueKeys,
      masterTicketIssueKey: null,
      linkedIssueKeys: null
    }
  }
  const issues = await filterIssuesWithoutCurrentFixVersion(
    context,
    issueKeys,
    fixVersion
  )
  if (!issues || issues.length === 0) {
    return {
      issueKeys,
      masterTicketIssueKey: null,
      linkedIssueKeys: null
    }
  }
  const masterTicketIssueKey = await getMasterTicketKey(context, fixVersion)
  const linkedIssues = issues.filter(i =>
    i.fields?.issuelinks?.find(j => j.inwardIssue.key === masterTicketIssueKey)
  )
  const linkedIssueKeys = linkedIssues.map(issue => issue.key)
  const currentIssueKeys = issues.map(issue => issue.key)
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
    await updateIssue(context, issueKey, fixVersionUpdate)
    if (
      !prerelease &&
      masterTicketIssueKey &&
      !linkedIssueKeys.find(i => i === issueKey)
    ) {
      await linkIssueToMasterTicket(context, masterTicketIssueKey, issueKey)
    }
  }

  return {
    issueKeys,
    masterTicketIssueKey,
    linkedIssueKeys
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
  const {issues} = await searchIssues(
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
  const {issues} = await searchIssues(context, masterTicketQuery, ['summary'])
  let masterTicketIssueKey: string | null = null
  if (issues && issues.length === 1) {
    masterTicketIssueKey = issues[0].key
  }
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
    version = await createVersion(context, requestedVersion)
  } else {
    version = result[0]
  }
  return version
}
