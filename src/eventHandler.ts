import {
  createRelease,
  getLastTagName,
  getReleaseByTagName,
  GitHubContext
} from './api/gitHubApi'
import {
  generateNextMinorVersion,
  generateNextPatchVersion,
  getVersionFromBranch
} from './semantic-version'
import {updateJira} from './jiraUpdate'
import {createIssue, createVersion, JiraContext} from './api/jiraApi'
import {extractJiraIssues} from './gitRepo'

interface OnReleasePushResults {
  lastTagName: string | null
  fixVersion: string | null
  extractedJiraIssues?: string | null
  issueKeys?: string[] | null
  prerelease: boolean
  masterTicketIssueKey?: string | null
  linkedIssueKeys?: string[] | null
}

export const onReleasePush = async (
  actionContext: GitHubContext,
  jiraContext: JiraContext,
  tagPrefix: string
): Promise<OnReleasePushResults> => {
  const {context} = actionContext
  const {
    payload: {ref}
  } = context
  const releaseVersion = getVersionFromBranch(ref, 'release')
  const lastTagName = await getLastTagName(
    actionContext,
    `${tagPrefix}${releaseVersion}`
  )
  let fixVersion: string | null = null
  let prerelease = false
  if (!lastTagName) {
    const gitHubMajorVersion = await getReleaseByTagName(
      actionContext,
      `${tagPrefix}${releaseVersion}.0`
    )
    if (gitHubMajorVersion) {
      fixVersion = gitHubMajorVersion.tagName
      prerelease = gitHubMajorVersion.isPrerelease
    }
  } else if (lastTagName) {
    const nextPatchVersion = generateNextPatchVersion(lastTagName)
    let gitHubRelease = await getReleaseByTagName(
      actionContext,
      nextPatchVersion
    )
    if (!gitHubRelease) {
      const nextMinorVersion = generateNextMinorVersion(lastTagName)
      gitHubRelease = await getReleaseByTagName(actionContext, nextMinorVersion)
    }
    if (gitHubRelease) {
      fixVersion = gitHubRelease.tagName
      prerelease = gitHubRelease.isPrerelease
    }
  }
  let onReleasePushResults: OnReleasePushResults = {
    lastTagName,
    fixVersion,
    prerelease
  }
  if (fixVersion) {
    const extractedJiraIssues = await extractJiraIssues(releaseVersion)
    const {issueKeys, masterTicketIssueKey, linkedIssueKeys} = await updateJira(
      jiraContext,
      extractedJiraIssues,
      fixVersion,
      prerelease
    )
    onReleasePushResults = {
      ...onReleasePushResults,
      issueKeys,
      masterTicketIssueKey,
      linkedIssueKeys
    }
  }
  return onReleasePushResults
}

export const onReleasePublished = async (
  actionContext: GitHubContext,
  jiraContext: JiraContext
): Promise<void> => {
  const {context} = actionContext
  const {
    payload: {
      release: {tag_name, target_commitish, prerelease}
    }
  } = context
  const releaseVersion = getVersionFromBranch(target_commitish, 'release')
  const issueKeys = await extractJiraIssues(releaseVersion)
  await updateJira(jiraContext, issueKeys, tag_name, prerelease)
  const nextPatchVersion = generateNextPatchVersion(tag_name)
  await createRelease(actionContext, nextPatchVersion, target_commitish)
  const {projectId, masterProjectId, masterIssueType} = jiraContext
  const version = {
    name: tag_name,
    archived: false,
    released: false
  }
  await createVersion(jiraContext, {
    ...version,
    projectId: parseInt(projectId)
  })
  const masterTicketVersion = await createVersion(jiraContext, {
    ...version,
    projectId: parseInt(masterProjectId)
  })
  await createIssue(jiraContext, {
    update: {},
    fields: {
      summary: `${tag_name} Master Ticket`,
      issuetype: {
        id: masterIssueType
      },
      project: {
        id: masterProjectId.toString()
      },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                text: 'Not released yet.',
                type: 'text'
              }
            ]
          }
        ]
      },
      fixVersions: [
        {
          id: masterTicketVersion.id ? masterTicketVersion.id.toString() : ''
        }
      ]
    }
  })
}
