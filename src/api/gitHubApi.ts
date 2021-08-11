import * as github from '@actions/github'
import {Context} from '@actions/github/lib/context'
import * as OctokitTypes from '@octokit/types'
import * as yaml from 'js-yaml'

type GitHub = ReturnType<typeof github.getOctokit>

export interface GitHubContext {
  octokit: GitHub
  context: Context
  workspace: string
  config?: GitHubActionConfig
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
  draft: boolean,
  prerelease: boolean
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
    prerelease
  })
}

const fetchContent = async (
  actionContext: GitHubContext,
  repoPath: string
): Promise<string> => {
  const {octokit, context} = actionContext
  const response: OctokitTypes.OctokitResponse<any> = await octokit.repos.getContent(
    {
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: repoPath,
      ref: context.sha
    }
  )
  if (!response.data.content) {
    return Promise.reject(new Error('fetchContent wrong Path'))
  }

  return Buffer.from(response.data.content, response.data.encoding).toString()
}

interface GitHubActionConfig {
  projectsDoneColumns?: {
    [key: string]: number
  }
}

export const loadConfig = async (
  actionContext: GitHubContext,
  configPath: string
): Promise<GitHubActionConfig> => {
  const configurationContent: string = await fetchContent(
    actionContext,
    configPath
  )
  const config:
    | string
    | number
    | object
    | null
    | undefined = yaml.load(configurationContent, {filename: configPath})
  if (!config || typeof config != 'object') {
    return Promise.reject(new Error('Config yml projectsDoneColumns missing'))
  } else {
    return config as GitHubActionConfig
  }
}

interface ProjectCard {
  url: string
  id: number
  node_id: string
  note: string
  creator: {
    login: string
    id: number
    node_id: string
    avatar_url: string
    gravatar_id: string
    url: string
    html_url: string
    followers_url: string
    following_url: string
    gists_url: string
    starred_url: string
    subscriptions_url: string
    organizations_url: string
    repos_url: string
    events_url: string
    received_events_url: string
    type: string
    site_admin: boolean
  }
  created_at: string
  updated_at: string
  archived: boolean
  column_url: string
  content_url: string
  project_url: string
}

const listCardsFromProjectColumn = async (
  actionContext: GitHubContext,
  projectColumnId: number
): Promise<ProjectCard[]> => {
  const {octokit} = actionContext
  const response = await octokit.projects.listCards({
    column_id: projectColumnId,
    archived_state: 'not_archived'
  })
  return response.data as ProjectCard[]
}

const archiveProjectCard = async (
  actionContext: GitHubContext,
  projectCardId: number
): Promise<void> => {
  const {octokit} = actionContext
  await octokit.projects.updateCard({
    card_id: projectCardId,
    archived: true
  })
}

export const archivePRCardsFromProject = async (
  actionContext: GitHubContext,
  releaseBranch: string
): Promise<void> => {
  const {config} = actionContext
  if (
    !config?.projectsDoneColumns &&
    !config?.projectsDoneColumns?.hasOwnProperty(releaseBranch)
  ) {
    return Promise.reject(new Error('Config projectsDoneColumns missing'))
  }
  const projectColumnId = config.projectsDoneColumns[releaseBranch]
  const cards = await listCardsFromProjectColumn(actionContext, projectColumnId)
  for (const card of cards) {
    await archiveProjectCard(actionContext, card.id)
  }
}
