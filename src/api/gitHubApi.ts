import * as github from '@actions/github'
import {Context} from '@actions/github/lib/context'
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
query lastTagQuery($owner: String!, $repo: String!, $releaseVersion: String!) {
  repository(owner:$owner, name: $repo) {
    refs(refPrefix: "refs/tags/", first: 1, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}, query: $releaseVersion) {
      nodes {
        name
      }
    }
  }
}
  `

export const getLastTagName = async (
  actionContext: GitHubContext,
  releaseVersion: string
): Promise<string | null> => {
  const {octokit, context} = actionContext
  const lastTagResponse = await octokit.graphql(getLastTagNameQuery, {
    releaseVersion,
    owner: context.repo.owner,
    repo: context.repo.repo
  })
  const {
    repository: {
      refs: {nodes}
    }
  } = lastTagResponse as LastTagResponse
  if (nodes.length > 0) {
    return nodes[0].name
  } else {
    return null
  }
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
  const {octokit, context} = actionContext
  const getReleaseResponse: GetReleaseResponse = await octokit.graphql(
    getReleaseByTagNameQuery,
    {
      tagName,
      owner: context.repo.owner,
      repo: context.repo.repo
    }
  )
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
