import * as github from '@actions/github'
import {Context} from '@actions/github/lib/context'
import {verifyNumbering} from '../semantic-version'
import * as core from '@actions/core'
type GitHub = ReturnType<typeof github.getOctokit>

export interface GitHubContext {
  octokit: GitHub
  context: Context
  workspace: string
}

interface LastTagResponse {
  repository: {
    refs: {
      nodes: {
        name: string
      }[]
      pageInfo: {
        endCursor: string
        hasNextPage: boolean
      }
    }
  }
}

const getLastTagNameQuery = `
query lastTagQuery($owner: String!, $repo: String!, $tagPrefix: String!) {
  repository(owner:$owner, name: $repo) {
    refs(refPrefix: "refs/tags/", first: 10, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}, query: $tagPrefix) {
      nodes {
        name
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}
  `

const getLastTagQueryWithPagination = `
query lastTagQueryWithPagination($owner: String!, $repo: String!, $tagPrefix: String!, $lastCursor: String!) {
  repository(owner: $owner, name: $repo) {
    refs(
      refPrefix: "refs/tags/"
      first: 10
      orderBy: {field: TAG_COMMIT_DATE, direction: DESC}
      query: $tagPrefix
      after: $lastCursor
    ) {
      nodes {
        name
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}
  `

export const getLastTagName = async (
  actionContext: GitHubContext,
  tagPrefix: string,
  releaseVersion: string
): Promise<string | null> => {
  const {octokit, context} = actionContext
  core.info(`getLastTagName query`)
  const lastTagResponse = await octokit.graphql(getLastTagNameQuery, {
    tagPrefix: `${tagPrefix}${releaseVersion}`,
    owner: context.repo.owner,
    repo: context.repo.repo
  })
  const {
    repository: {
      refs: {
        nodes,
        pageInfo: {endCursor, hasNextPage}
      }
    }
  } = lastTagResponse as LastTagResponse
  let lastTagName
  if (nodes.length > 0) {
    lastTagName = getLastTagNameVerified(tagPrefix, releaseVersion, nodes)
    if (lastTagName) {
      return lastTagName
    }
    core.info(`tag not found, continue search`)
    let nextPageToContinue = hasNextPage
    let lastCursor = endCursor
    while (nextPageToContinue) {
      const lastTagNameFromNextPage = await getLastTagNameFromNextPage(
        actionContext,
        tagPrefix,
        releaseVersion,
        lastCursor
      )
      if (lastTagNameFromNextPage.lastTagName) {
        return lastTagNameFromNextPage.lastTagName
      } else {
        core.info(`tag not found, continue search`)
        nextPageToContinue = lastTagNameFromNextPage.hasNextPage
        lastCursor = lastTagNameFromNextPage.endCursor
      }
    }
  }
  core.info(`no tag found`)

  return null
}

interface LastTagNameFromNextPage {
  lastTagName: string | null
  endCursor: string
  hasNextPage: boolean
}

const getLastTagNameFromNextPage = async (
  actionContext: GitHubContext,
  tagPrefix: string,
  releaseVersion: string,
  lastCursor: string
): Promise<LastTagNameFromNextPage> => {
  const {octokit, context} = actionContext
  core.info(`lastTagQueryWithPagination ${lastCursor}`)
  const lastTagPaginationResponse = await octokit.graphql(
    getLastTagQueryWithPagination,
    {
      tagPrefix: `${tagPrefix}${releaseVersion}`,
      owner: context.repo.owner,
      repo: context.repo.repo,
      lastCursor
    }
  )
  const {
    repository: {
      refs: {
        nodes,
        pageInfo: {endCursor, hasNextPage}
      }
    }
  } = lastTagPaginationResponse as LastTagResponse
  const lastTagName = getLastTagNameVerified(tagPrefix, releaseVersion, nodes)
  return {
    lastTagName,
    endCursor,
    hasNextPage
  }
}

const getLastTagNameVerified = (
  tagPrefix: string,
  releaseVersion: string,
  nodes: {name: string}[]
): string | null => {
  if (nodes.length > 0) {
    let lastTagName
    for (const item of nodes) {
      lastTagName = item.name
      core.info(`check tag ${lastTagName}`)
      if (verifyNumbering(lastTagName, tagPrefix, releaseVersion)) {
        core.info(`found tag ${lastTagName}`)
        return lastTagName
      }
    }
  }
  return null
}

interface GetReleaseResponse {
  repository: {
    release: GitHubRelease
  }
}

export interface GitHubRelease {
  databaseId?: number
  name: string
  tagName: string
  publishedAt: string
  isPrerelease: boolean
  isDraft: boolean
}

const getReleaseByTagNameQuery = `
query getReleaseByTagName($owner: String!, $repo: String!, $tagName: String!) {
  repository(owner:$owner, name: $repo) {
    release(tagName: $tagName) {
      databaseId
      name
      tagName
      publishedAt
      isPrerelease
      isDraft
    }
  }
}
  `

export const getReleaseByTagName = async (
  actionContext: GitHubContext,
  tagName: string
): Promise<GitHubRelease | null> => {
  core.info(`getReleaseByTagName ${tagName}`)
  const {octokit, context} = actionContext
  const getReleaseResponse: GetReleaseResponse = await octokit.graphql(
    getReleaseByTagNameQuery,
    {
      tagName,
      owner: context.repo.owner,
      repo: context.repo.repo
    }
  )
  core.info(`releaseId ${getReleaseResponse?.repository?.release?.databaseId}`)
  return getReleaseResponse?.repository?.release
}

export const createRelease = async (
  actionContext: GitHubContext,
  tagName: string,
  targetBranch: string
): Promise<void> => {
  const {octokit, context} = actionContext
  await octokit.repos.createRelease({
    owner: context.repo.owner,
    repo: context.repo.repo,
    tag_name: tagName,
    target_commitish: targetBranch,
    name: tagName,
    prerelease: false,
    draft: true
  })
}

export const updateRelease = async (
  actionContext: GitHubContext,
  releaseId: number,
  releaseNote: string,
  tagName: string,
  targetBranch: string,
  draft: boolean
): Promise<void> => {
  const {octokit, context} = actionContext
  await octokit.repos.updateRelease({
    owner: context.repo.owner,
    repo: context.repo.repo,
    release_id: releaseId,
    body: releaseNote,
    tag_name: tagName,
    target_commitish: targetBranch,
    name: tagName,
    draft,
    prerelease: false
  })
}

interface CommitsComparison {
  fileCount: number
  commitCount: number
}

export const compareTags = async (
  actionContext: GitHubContext,
  previousTag: string,
  currentTag: string
): Promise<CommitsComparison> => {
  core.info(`compareTags ${previousTag} ${currentTag}`)
  const {octokit, context} = actionContext
  const {
    data: {total_commits, files}
  } = await octokit.repos.compareCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    base: previousTag,
    head: currentTag,
    per_page: 1
  })
  core.info(
    `comparison commitCount=${total_commits}, fileCount=${
      files ? files.length : 0
    }`
  )
  return {
    commitCount: total_commits,
    fileCount: files ? files.length : 0
  }
}
