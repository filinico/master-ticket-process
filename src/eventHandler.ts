import {
  compareTags,
  createRelease,
  getLastTagName,
  getReleaseByTagName,
  GitHubContext,
  updateRelease
} from './api/gitHubApi'
import {
  checkMajorVersion,
  generateNextMinorVersion,
  generateNextPatchVersion,
  generatePreviousPatchVersion,
  getPreviousVersion,
  getVersionFromBranch,
  verifyNumbering
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
  if (!(ref as string).includes('release')) {
    throw new Error(
      `The workflow is triggered on ${ref} instead of a release branch. Workflow will not be executed.`
    )
  }
  const releaseVersion = getVersionFromBranch(ref, 'release')
  core.info(`Release version:${releaseVersion}`)
  const lastTagName = await getLastTagName(
    actionContext,
    tagPrefix,
    releaseVersion
  )
  let fixVersion = `${tagPrefix}${releaseVersion}.0`
  let isMajorVersion = true
  let draft = true
  let releaseId = null
  if (lastTagName) {
    core.info(`lastTagName:${lastTagName}`)
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
      isMajorVersion = false
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
      isMajorVersion,
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
  isMajorVersion: boolean,
  draft: boolean,
  releaseId: number | undefined | null,
  actionContext: GitHubContext,
  tagPrefix: string
): Promise<void> => {
  const {projectsKeys} = jiraContext
  let previousVersion = releaseVersion
  if (isMajorVersion) {
    previousVersion = getPreviousVersion(releaseVersion)
  }
  await extractJiraIssues(
    releaseVersion,
    projectsKeys.join(','),
    workspace,
    tagPrefix,
    previousVersion
  )
  /*
  await updateJira(jiraContext, issueKeys, version, isMajorVersion)
  if (!isMajorVersion && releaseId) {
    const releaseNote = await generateReleaseNote(version, jiraContext)
    await updateRelease(
      actionContext,
      releaseId,
      releaseNote,
      version,
      `release/${releaseVersion}`,
      draft
    )
  }
  */
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
  if (!(target_commitish as string).includes('release')) {
    throw new Error(
      `Tag is based on ${target_commitish} instead of a release branch. Workflow will not be executed.`
    )
  }
  if (prerelease) {
    throw new Error(
      `The release published is a pre-release version. This workflow is for production release only. Workflow will not be executed.`
    )
  }
  const releaseVersion = getVersionFromBranch(target_commitish, 'release')
  if (!verifyNumbering(tag_name, tagPrefix, releaseVersion)) {
    throw new Error(
      `Tag ${tag_name} do not comply to correct versioning using prefix ${tagPrefix}. Workflow will not be executed.`
    )
  }
  const isMajorVersion = checkMajorVersion(tag_name)
  core.info(`Release version:${releaseVersion}`)
  await updateDeliveredIssues(
    releaseVersion,
    workspace,
    jiraContext,
    tag_name,
    isMajorVersion,
    draft,
    id,
    actionContext,
    tagPrefix
  )
  let previousPatchVersion: string | null
  if (isMajorVersion) {
    previousPatchVersion = await getLastTagName(
      actionContext,
      tagPrefix,
      getPreviousVersion(releaseVersion)
    )
  } else {
    previousPatchVersion = generatePreviousPatchVersion(tag_name)
  }
  let commitCount = 0
  let fileCount = 0
  if (previousPatchVersion) {
    const comparison = await compareTags(
      actionContext,
      previousPatchVersion,
      tag_name
    )
    commitCount = comparison.commitCount
    fileCount = comparison.fileCount
  } else {
    previousPatchVersion = ''
  }
  core.info(`previousPatchVersion:${previousPatchVersion}`)
  core.info(`commitCount:${commitCount}`)
  core.info(`fileCount:${fileCount}`)
  /*
  await updateMasterTicket(
    jiraContext,
    tag_name,
    releaseVersion,
    sha,
    previousPatchVersion,
    fileCount,
    commitCount
  )
  */
  /*
  await createNextVersion(
    tag_name,
    target_commitish,
    actionContext,
    jiraContext
  )
  *
   */
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
