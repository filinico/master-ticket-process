import axios, {AxiosError} from 'axios'
import * as core from '@actions/core'

export interface JiraContext {
  subDomain: string
  email: string
  token: string
  projectId: string
  projectKey: string
  masterProjectId: string
  masterProjectKey: string
  masterIssueType: string
}

interface AuthHeaders {
  headers: {
    Authorization: string
    Accept: string
  }
}

export interface JiraIssues {
  expand: string
  startAt: number
  maxResults: number
  total: number
  issues: SearchedJiraIssue[]
}

export interface SearchedJiraIssue {
  expand: string
  id: string
  self: string
  key: string
  fields: {
    summary?: string
    issuelinks?: {
      id: string
      self: string
      type: {
        id: string
      }
      inwardIssue: {
        id: string
        key: string
      }
    }[]
  }
}

export interface CreateIssueLink {
  type: {
    name: string
  }
  inwardIssue: {
    key: string
  }
  outwardIssue: {
    key: string
  }
}

export interface JiraIssue {
  update: {}
  fields: {
    summary: string
    issuetype: {
      id: string
    }
    project: {
      id: string
    }
    description: {
      type: string
      version: number
      content: {
        type: string
        content: {
          type: string
          text: string
        }[]
      }[]
    }
    fixVersions: {
      id: string
    }[]
  }
}

export interface CreatedIssue {
  id: string
  key: string
  self: string
  transition: {
    status: number
    errorCollection: {
      errorMessages: string[]
      errors: {}
      status: number
    }
  }
}

export interface JiraVersion {
  self?: string
  id?: string
  name: string
  archived: boolean
  released: boolean
  startDate?: string
  releaseDate?: string
  userStartDate?: string
  userReleaseDate?: string
  projectId?: number
  description?: string
  overdue?: boolean
}

export interface UpdateFixVersion {
  update: {
    fixVersions: [
      {
        add: {id?: string}
      }
    ]
  }
}

const getAuthHeaders = (email: string, token: string): AuthHeaders => {
  return {
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString(
        'base64'
      )}`,
      Accept: 'application/json'
    }
  }
}

export const searchIssues = async (
  context: JiraContext,
  jQLQuery: string,
  properties: string[]
): Promise<SearchedJiraIssue[]> => {
  const {subDomain, email, token} = context
  try {
    core.info('request searchIssues')
    const response = await axios.post(
      `https://${subDomain}.atlassian.net/rest/api/3/search`,
      {
        jql: jQLQuery,
        maxResults: 15,
        fieldsByKeys: true,
        fields: properties,
        startAt: 0
      },
      getAuthHeaders(email, token)
    )
    core.info(`searchIssues successful`)
    let issues: SearchedJiraIssue[] = []
    if (response?.data?.issues && response?.data?.issues.length > 0) {
      issues = response.data.issues
    }
    return issues
  } catch (error: unknown | AxiosError) {
    core.error('error during searchIssues request')
    if (axios.isAxiosError(error)) {
      core.error(error.message)
    }
    return Promise.reject(error)
  }
}

export const createVersion = async (
  context: JiraContext,
  version: JiraVersion
): Promise<JiraVersion> => {
  const {subDomain, email, token} = context
  try {
    core.info('request createVersion')
    const response = await axios.post(
      `https://${subDomain}.atlassian.net/rest/api/3/version`,
      version,
      getAuthHeaders(email, token)
    )
    core.info(`createVersion successful`)
    return response?.data
  } catch (error: unknown | AxiosError) {
    core.error('error during createVersion request')
    if (axios.isAxiosError(error)) {
      core.error(error.message)
    }
    return Promise.reject(error)
  }
}

export const listProjectVersions = async (
  context: JiraContext
): Promise<JiraVersion[]> => {
  const {subDomain, email, token, projectKey} = context
  try {
    core.info(`request listProjectVersions ${projectKey}`)
    const response = await axios.get(
      `https://${subDomain}.atlassian.net/rest/api/3/project/${projectKey}/versions`,
      getAuthHeaders(email, token)
    )
    core.info(`listProjectVersions successful`)
    return response?.data
  } catch (error: unknown | AxiosError) {
    core.error('error during listProjectVersions request')
    if (axios.isAxiosError(error)) {
      core.error(error.message)
    }
    return Promise.reject(error)
  }
}

export const updateIssue = async (
  context: JiraContext,
  issueKey: string,
  data: UpdateFixVersion
): Promise<void> => {
  const {subDomain, email, token} = context
  try {
    core.info(`request updateIssue ${issueKey}`)
    await axios.put(
      `https://${subDomain}.atlassian.net/rest/api/3/issue/${issueKey}`,
      data,
      getAuthHeaders(email, token)
    )
    core.info(`updateIssue ${issueKey} successful`)
  } catch (error: unknown | AxiosError) {
    core.error('error during updateIssue request')
    if (axios.isAxiosError(error)) {
      core.error(error.message)
    }
    return Promise.reject(error)
  }
}

export const createIssue = async (
  context: JiraContext,
  data: JiraIssue
): Promise<CreatedIssue> => {
  const {subDomain, email, token} = context
  try {
    core.info('request createIssue')
    const response = await axios.post(
      `https://${subDomain}.atlassian.net/rest/api/3/issue`,
      data,
      getAuthHeaders(email, token)
    )
    core.info(`createIssue successful`)
    return response?.data
  } catch (error: unknown | AxiosError) {
    core.error('error during createIssue request')
    if (axios.isAxiosError(error)) {
      core.error(error.message)
    }
    return Promise.reject(error)
  }
}

export const createIssueLink = async (
  context: JiraContext,
  data: CreateIssueLink
): Promise<void> => {
  const {subDomain, email, token} = context
  try {
    core.info(`request createIssueLink`)
    await axios.post(
      `https://${subDomain}.atlassian.net/rest/api/3/issueLink`,
      data,
      getAuthHeaders(email, token)
    )
    core.info(`createIssueLink successful`)
  } catch (error: unknown | AxiosError) {
    core.error('error during createIssueLink request')
    if (axios.isAxiosError(error)) {
      core.error(error.message)
    }
    return Promise.reject(error)
  }
}
