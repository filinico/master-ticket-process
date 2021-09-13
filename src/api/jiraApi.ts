import axios, {AxiosError} from 'axios'
import * as core from '@actions/core'

export interface JiraContext {
  subDomain: string
  email: string
  token: string
  projectsIds: string[]
  projectsKeys: string[]
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
  expand?: string
  id?: string
  self?: string
  key: string
  fields: {
    summary?: string
    issuelinks?: {
      id: string
      self: string
      type: {
        id: string
      }
      outwardIssue: {
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

interface JiraIssueDescriptionContent {
  type: string
  attrs?: {
    isNumberColumnEnabled?: boolean
    layout?: string
    url?: string
  }
  content?: (JiraIssueDescriptionContent | JiraIssueDescriptionText)[]
}

interface JiraIssueDescriptionText {
  type: string
  text: string
  marks?: {
    type: string
  }[]
}

interface JiraCustomField {
  id?: string
  value?: string
  child?: {
    value: string
  }
}

interface JiraFields {
  summary?: string
  issuetype?: {
    id: string
  }
  project?: {
    id: string
  }
  description?: {
    type: string
    version: number
    content: JiraIssueDescriptionContent[]
  }
  fixVersions?: {
    id: string
  }[]
  customfield_23944?: JiraCustomField
  customfield_23710?: JiraCustomField
  customfield_21603?: JiraCustomField
  customfield_23713?: JiraCustomField
  customfield_23604?: JiraCustomField
  customfield_23599?: JiraCustomField
  customfield_12803?: JiraCustomField
}

interface JiraIssueUpdate {
  customfield_23713?: [
    {
      set: string
    }
  ]
  customfield_23604?: [
    {
      set: string
    }
  ]
  customfield_23599?: [
    {
      set: string
    }
  ]
  description?: [
    {
      set: {
        type: string
        version: number
        content: JiraIssueDescriptionContent[]
      }
    }
  ]
  fixVersions?: [
    {
      add: {id?: string}
    }
  ]
}

export interface JiraIssue {
  update: JiraIssueUpdate
  fields?: JiraFields
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
      core.error(JSON.stringify(error.toJSON))
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
      core.error(JSON.stringify(error.toJSON))
    }
    return Promise.reject(error)
  }
}

export const listProjectVersions = async (
  context: JiraContext,
  projectKey: string
): Promise<JiraVersion[]> => {
  const {subDomain, email, token} = context
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
      core.error(JSON.stringify(error.toJSON))
    }
    return Promise.reject(error)
  }
}

export const updateIssue = async (
  context: JiraContext,
  issueKey: string,
  data: JiraIssue
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
      core.error(JSON.stringify(error.toJSON))
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
    core.info(`createIssue:${JSON.stringify(data)}`)
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
      core.error(JSON.stringify(error.toJSON))
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
      core.error(JSON.stringify(error.toJSON))
    }
    return Promise.reject(error)
  }
}

export const generateReleaseNoteFromIssues = (
  issues: SearchedJiraIssue[]
): string => {
  return issues.map(i => `- ${i.key} ${i.fields.summary}`).join('\n')
}
