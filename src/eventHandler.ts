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
  if (lastTagName) {
    core.info(`lastTagName:${lastTagName}`)
    const nextPatchVersion = generateNextPatchVersion(lastTagName)
    core.info(`nextPatchVersion:${nextPatchVersion}`)
    fixVersion = nextPatchVersion
    isMajorVersion = false
  }
  core.info(`fixVersion:${fixVersion}`)
  if (fixVersion) {
    await updateDeliveredIssues(
      releaseVersion,
      workspace,
      jiraContext,
      fixVersion,
      isMajorVersion,
      actionContext,
      tagPrefix
    )
    if (!isMajorVersion) {
      await updateGitHubReleaseReleaseNotes(
        releaseVersion,
        jiraContext,
        fixVersion,
        actionContext
      )
    }
  }
}

const updateDeliveredIssues = async (
  releaseVersion: string,
  workspace: string,
  jiraContext: JiraContext,
  version: string,
  isMajorVersion: boolean,
  actionContext: GitHubContext,
  tagPrefix: string
): Promise<void> => {
  const {projectsKeys} = jiraContext
  let previousVersion = releaseVersion
  if (isMajorVersion) {
    previousVersion = getPreviousVersion(releaseVersion)
  }
  const issueKeys = await extractJiraIssues(
    releaseVersion,
    projectsKeys.join(','),
    workspace,
    tagPrefix,
    previousVersion
  )
  await updateJira(jiraContext, issueKeys, version, isMajorVersion)
}

const updateGitHubReleaseReleaseNotes = async (
  releaseVersion: string,
  jiraContext: JiraContext,
  version: string,
  actionContext: GitHubContext
): Promise<void> => {
  const gitHubRelease = await getReleaseByTagName(actionContext, version)
  if (gitHubRelease && gitHubRelease.databaseId) {
    core.info(
      `gitHubRelease found: ${gitHubRelease.tagName} ${gitHubRelease.databaseId}`
    )
    const releaseNote = await generateReleaseNote(version, jiraContext)
    if (gitHubRelease.description !== releaseNote) {
      await updateRelease(
        actionContext,
        gitHubRelease.databaseId,
        releaseNote,
        version,
        `release/${releaseVersion}`,
        gitHubRelease.isDraft
      )
    }
  }
}

export const onReleasePublished = async (
  actionContext: GitHubContext,
  jiraContext: JiraContext,
  tagPrefix: string
): Promise<void> => {
  const {context} = actionContext
  const {
    payload: {
      release: {tag_name, target_commitish, prerelease, id}
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
  let previousPatchVersion: string | null = null
  if (isMajorVersion) {
    try {
      previousPatchVersion = await getLastTagName(
        actionContext,
        tagPrefix,
        getPreviousVersion(releaseVersion)
      )
    } catch (error) {
      core.error(error)
    }
  } else {
    previousPatchVersion = generatePreviousPatchVersion(tag_name)
  }
  let commitCount = 0
  let fileCount = 0
  if (previousPatchVersion) {
    try {
      const comparison = await compareTags(
        actionContext,
        previousPatchVersion,
        tag_name
      )
      commitCount = comparison.commitCount
      fileCount = comparison.fileCount
    } catch (error) {
      core.error(error)
    }
  } else {
    previousPatchVersion = ''
  }
  core.info(`previousPatchVersion:${previousPatchVersion}`)
  core.info(`commitCount:${commitCount}`)
  core.info(`fileCount:${fileCount}`)

  await updateMasterTicket(
    jiraContext,
    tag_name,
    releaseVersion,
    sha,
    previousPatchVersion,
    fileCount,
    commitCount
  )

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
  try {
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
  } catch (error) {
    core.error(error)
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

  const rmTicketVersionId = await createIfNotExistsJiraVersion(
    jiraContext,
    nextPatchVersion,
    parseInt(masterProjectId),
    masterProjectKey
  )

  if (rmTicketVersionId) {
    core.info(
      `request creation of master ticket version ${nextPatchVersion} with id  ${rmTicketVersionId}`
    )
    await createMasterTicket(
      nextPatchVersion,
      masterIssueType,
      masterProjectId,
      rmTicketVersionId,
      jiraContext
    )
  }
}
