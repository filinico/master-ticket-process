import {
  createRelease,
  getLastTagName,
  getReleaseByTagName,
  GitHubContext,
  updateRelease
} from './api/gitHubApi'
import {
  generateNextMinorVersion,
  generateNextPatchVersion,
  getVersionFromBranch
} from './semantic-version'
import {
  createIfNotExistsJiraVersion,
  createMasterTicket,
  generateReleaseNote,
  updateJira,
  updateMasterTicket
} from './jiraUpdate'
import {JiraContext} from './api/jiraApi'
import {extractJiraIssues} from './gitRepo'
import * as core from '@actions/core'

export const onReleasePush = async (
  actionContext: GitHubContext,
  jiraContext: JiraContext,
  tagPrefix: string
): Promise<void> => {
  const {context, workspace} = actionContext
  const {
    payload: {ref}
  } = context
  const releaseVersion = getVersionFromBranch(ref, 'release')
  core.info(`Release version:${releaseVersion}`)
  const lastTagName = await getLastTagName(
    actionContext,
    `${tagPrefix}${releaseVersion}`
  )
  core.info(`lastTagName:${lastTagName}`)
  let fixVersion: string | null = null
  let prerelease = false
  let draft = true
  let releaseId
  if (!lastTagName) {
    const gitHubMajorVersion = await getReleaseByTagName(
      actionContext,
      `${tagPrefix}${releaseVersion}.0`
    )
    if (gitHubMajorVersion) {
      fixVersion = gitHubMajorVersion.tagName
      prerelease = gitHubMajorVersion.isPrerelease
      draft = gitHubMajorVersion.isDraft
      releaseId = gitHubMajorVersion.databaseId
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
      draft = gitHubRelease.isDraft
      releaseId = gitHubRelease.databaseId
    }
  }
  core.info(`fixVersion:${fixVersion}`)
  if (fixVersion) {
    await updateDeliveredIssues(
      releaseVersion,
      workspace,
      jiraContext,
      fixVersion,
      prerelease,
      draft,
      releaseId,
      actionContext,
      tagPrefix
    )
  }
}

const updateDeliveredIssues = async (
  releaseVersion: string,
  workspace: string,
  jiraContext: JiraContext,
  version: string,
  prerelease: boolean,
  draft: boolean,
  releaseId: number | undefined,
  actionContext: GitHubContext,
  tagPrefix: string
): Promise<void> => {
  const {projectsKeys} = jiraContext
  const issueKeys = await extractJiraIssues(
    releaseVersion,
    projectsKeys.join(','),
    workspace,
    tagPrefix
  )
  await updateJira(jiraContext, issueKeys, version, prerelease)
  if (!prerelease && releaseId) {
    const releaseNote = await generateReleaseNote(version, jiraContext)
    await updateRelease(
      actionContext,
      releaseId,
      releaseNote,
      version,
      `release/${releaseVersion}`,
      draft,
      prerelease
    )
  }
}

export const onReleasePublished = async (
  actionContext: GitHubContext,
  jiraContext: JiraContext,
  tagPrefix: string
): Promise<void> => {
  const {context, workspace} = actionContext
  const {
    payload: {
      release: {tag_name, target_commitish, prerelease, id, draft}
    },
    sha
  } = context
  core.info(`tag_name:${tag_name}`)
  core.info(`target_commitish:${target_commitish}`)
  core.info(`prerelease:${prerelease}`)
  core.info(`id:${id}`)
  core.info(`revision:${sha}`)
  const releaseVersion = getVersionFromBranch(target_commitish, 'release')
  core.info(`Release version:${releaseVersion}`)
  await updateDeliveredIssues(
    releaseVersion,
    workspace,
    jiraContext,
    tag_name,
    prerelease,
    draft,
    id,
    actionContext,
    tagPrefix
  )

  await updateMasterTicket(jiraContext, tag_name, releaseVersion, sha)

  await createNextVersion(
    tag_name,
    target_commitish,
    actionContext,
    jiraContext
  )
}

const createNextVersion = async (
  currentVersion: string,
  releaseBranch: string,
  actionContext: GitHubContext,
  jiraContext: JiraContext
): Promise<void> => {
  const nextPatchVersion = generateNextPatchVersion(currentVersion)
  core.info(`nextPatchVersion:${nextPatchVersion}`)
  const nextGitHubRelease = await getReleaseByTagName(
    actionContext,
    nextPatchVersion
  )
  if (!nextGitHubRelease) {
    core.info(
      `request creation of new release :${nextPatchVersion} for ${releaseBranch}`
    )
    await createRelease(actionContext, nextPatchVersion, releaseBranch)
  }
  const {
    projectsIds,
    projectsKeys,
    masterProjectId,
    masterProjectKey,
    masterIssueType
  } = jiraContext

  for (let i = 0; i < projectsKeys.length; i++) {
    const projectId = projectsIds[i]
    const projectKey = projectsKeys[i]
    await createIfNotExistsJiraVersion(
      jiraContext,
      nextPatchVersion,
      parseInt(projectId),
      projectKey
    )
  }

  const masterTicketVersion = await createIfNotExistsJiraVersion(
    jiraContext,
    nextPatchVersion,
    parseInt(masterProjectId),
    masterProjectKey
  )

  if (masterTicketVersion && masterTicketVersion.id) {
    core.info(
      `request creation of master ticket version ${nextPatchVersion} with id  ${masterTicketVersion.id}`
    )
    await createMasterTicket(
      nextPatchVersion,
      masterIssueType,
      masterProjectId,
      masterTicketVersion.id,
      jiraContext
    )
  }
}
