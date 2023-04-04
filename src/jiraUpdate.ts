import {
  createIssue,
  createIssueLink,
  CreateIssueLink,
  createVersion,
  generateReleaseNoteFromIssues,
  JiraContext,
  JiraIssue,
  JiraVersion,
  listProjectVersions,
  SearchedJiraIssue,
  searchIssues,
  updateIssue
} from './api/jiraApi'
import * as core from '@actions/core'

interface FixVersionUpdates {
  [key: string]: JiraIssue
}

export const updateJira = async (
  context: JiraContext,
  issueKeys: string[],
  fixVersion: string,
  isMajorVersion: boolean
): Promise<void> => {
  if (!issueKeys || issueKeys.length < 1) {
    core.info(`No extracted issues to search in Jira.`)
    return
  }
  core.info(`fixVersion:[${fixVersion}]`)
  const extractedIssues = await filterIssues(
    context,
    issueKeys,
    fixVersion,
    false
  )
  core.info(
    `extractedIssuesKeysFromJira:[${extractedIssues
      .map(issue => issue.key)
      .join(',')}]`
  )
  const parentIssueKeys: string[] = []
  const currentIssues: SearchedJiraIssue[] = []
  for (const issue of extractedIssues) {
    if (issue.fields.issuetype?.subtask && issue.fields.parent) {
      parentIssueKeys.push(issue.fields.parent.key)
    } else {
      currentIssues.push(issue)
    }
  }
  core.info(`parentIssuesKeys:[${parentIssueKeys.join(',')}]`)
  core.info(
    `currentIssues:[${currentIssues.map(issue => issue.key).join(',')}]`
  )
  const parentIssues = await filterIssues(
    context,
    parentIssueKeys,
    fixVersion,
    false
  )
  const issues = currentIssues.concat(parentIssues)
  core.info(`foundIssues:[${issues.map(issue => issue.key).join(',')}]`)
  if (issues.length < 1) {
    core.info(`No extracted issues found in Jira`)
    return
  }
  await updateIssuesFixVersion(
    context,
    issues.map(issue => issue.key),
    fixVersion
  )

  await linkIssues(context, issues, fixVersion, isMajorVersion)
}

const updateIssuesFixVersion = async (
  context: JiraContext,
  issueKeys: string[],
  fixVersion: string
): Promise<void> => {
  const issuesToUpdate = await filterIssues(
    context,
    issueKeys,
    fixVersion,
    true
  )
  const issueKeysToUpdate = issuesToUpdate.map(issue => issue.key)
  core.info(`issueKeysToUpdateFixVersion:[${issueKeysToUpdate.join(',')}]`)
  if (issueKeysToUpdate.length < 1) {
    core.info(`No issues keys require fixVersion updates`)
    return
  }
  const {projectsIds, projectsKeys} = context
  const fixVersionUpdates: FixVersionUpdates = {}
  for (let i = 0; i < projectsKeys.length; i++) {
    const projectId = projectsIds[i]
    const projectKey = projectsKeys[i]
    const versionId = await createIfNotExistsJiraVersion(
      context,
      fixVersion,
      parseInt(projectId),
      projectKey
    )
    if (versionId) {
      const fixVersionUpdate: JiraIssue = {
        update: {
          customfield_24144: [
            {
              add: {id: versionId}
            }
          ]
        }
      }
      fixVersionUpdates[projectKey] = fixVersionUpdate
    }
  }
  for (const issueKey of issueKeysToUpdate) {
    core.info(`try updateIssue:[${issueKey}]`)
    let projectKey = null
    for (const currentProjectKey of projectsKeys) {
      if (issueKey.startsWith(currentProjectKey)) {
        projectKey = currentProjectKey
        break
      }
    }
    if (projectKey && fixVersionUpdates.hasOwnProperty(projectKey)) {
      await updateIssue(context, issueKey, fixVersionUpdates[projectKey])
    }
  }
}

const linkIssues = async (
  context: JiraContext,
  issues: SearchedJiraIssue[],
  fixVersion: string,
  isMajorVersion: boolean
): Promise<void> => {
  if (isMajorVersion) {
    core.info(`Do not link issues for Major version`)
    return
  }
  const masterTicketIssueKey = await getMasterTicketKey(context, fixVersion)
  if (!masterTicketIssueKey) {
    core.info(`RM ticket not found. Cannot link issues.`)
    return
  }
  const linkedIssues = issues.filter(i =>
    i.fields?.issuelinks?.find(
      j => j.outwardIssue?.key === masterTicketIssueKey
    )
  )
  const linkedIssueKeys = linkedIssues.map(issue => issue.key)
  core.info(`linkedIssueKeys:[${linkedIssueKeys.join(',')}]`)
  if (linkedIssueKeys.length < 1) {
    core.info(`No issues to be linked to RM ticket.`)
    return
  }
  for (const issueKey of linkedIssueKeys) {
    core.info(
      `try linkIssueToMasterTicket:[issue:${issueKey},masterTicketIssueKey:${masterTicketIssueKey}]`
    )
    await linkIssueToMasterTicket(context, masterTicketIssueKey, issueKey)
  }
}

export const filterIssues = async (
  context: JiraContext,
  issueKeys: string[],
  fixVersion: string,
  withoutFixVersion: boolean
): Promise<SearchedJiraIssue[]> => {
  const {projectsKeys} = context
  const batchSize = 100
  let issueKeysResult: SearchedJiraIssue[] = []
  if (!issueKeys || issueKeys.length < 1) {
    return issueKeysResult
  }
  let start = 0
  let end = 0
  do {
    end = start + batchSize
    const currentBatch = issueKeys.slice(start, end)
    const groupedIssues = currentBatch.join(',')
    let searchIssuesWithoutCurrentFixVersion = `project in (${projectsKeys.join(
      ','
    )}) AND issuekey in (${groupedIssues})`
    if (withoutFixVersion) {
      searchIssuesWithoutCurrentFixVersion = `${searchIssuesWithoutCurrentFixVersion}  AND ("Release Version(s)[Version Picker (multiple versions)]" not in (${fixVersion}) OR "Release Version(s)[Version Picker (multiple versions)]" is EMPTY)`
    }
    core.info(`searchIssuesQuery:[${searchIssuesWithoutCurrentFixVersion}]`)
    const currentResult = await searchIssues(
      context,
      searchIssuesWithoutCurrentFixVersion,
      ['issuelinks', 'issuetype', 'parent']
    )
    core.info(
      `currentResult:[${currentResult.map(issue => issue.key).join(',')}]`
    )
    issueKeysResult = issueKeysResult.concat(currentResult)
    start = end
  } while (end < issueKeys.length)
  return issueKeysResult
}

const listIssuesSummaryWithFixVersion = async (
  context: JiraContext,
  fixVersion: string
): Promise<SearchedJiraIssue[]> => {
  const {projectsKeys} = context
  const issuesWithFixVersion = `project in (${projectsKeys.join(
    ','
  )}) AND "Release Version(s)[Version Picker (multiple versions)]" in (${fixVersion})`
  core.info(`searchIssuesQuery:[${issuesWithFixVersion}]`)
  return await searchIssues(context, issuesWithFixVersion, ['summary'])
}

export const getMasterTicketKey = async (
  context: JiraContext,
  fixVersion: string
): Promise<string | null> => {
  const {masterProjectKey} = context
  const masterTicketQuery = `project = ${masterProjectKey} AND "Release Version(s)[Version Picker (multiple versions)]" in (${fixVersion})`
  core.info(`masterTicketQuery:[${masterTicketQuery}]`)
  const issues = await searchIssues(context, masterTicketQuery, ['summary'])
  let masterTicketIssueKey: string | null = null
  if (issues && issues.length === 1) {
    masterTicketIssueKey = issues[0].key
  }
  core.info(`masterTicketIssueKey:${masterTicketIssueKey}`)
  return masterTicketIssueKey
}

const linkIssueToMasterTicket = async (
  context: JiraContext,
  masterTicketKey: string,
  issueKey: string
): Promise<void> => {
  const issueLink: CreateIssueLink = {
    type: {
      name: 'Drives'
    },
    inwardIssue: {
      key: issueKey
    },
    outwardIssue: {
      key: masterTicketKey
    }
  }
  await createIssueLink(context, issueLink)
}

export const createIfNotExistsJiraVersion = async (
  context: JiraContext,
  fixVersion: string,
  projectId: number,
  projectKey: string
): Promise<string | null | undefined> => {
  const versions = await listProjectVersions(context, projectKey)
  const result = versions.filter(i => i.name === fixVersion)
  if (!result || result.length === 0) {
    const requestedVersion: JiraVersion = {
      name: fixVersion,
      archived: false,
      released: false,
      projectId
    }
    core.info(`version not found. start create version:[${requestedVersion}]`)
    const version = await createVersion(context, requestedVersion)
    if (version) {
      core.info(`version created:[${version.id}]`)
      return version.id
    }
  } else {
    const version = result[0]
    core.info(`version found:[${version.id}]`)
    return version.id
  }
  return null
}

export const updateMasterTicket = async (
  jiraContext: JiraContext,
  version: string,
  releaseVersion: string,
  revision: string,
  previousPatchVersion: string,
  fileCount: number,
  commitCount: number
): Promise<void> => {
  const masterTicketKey = await getMasterTicketKey(jiraContext, version)
  if (masterTicketKey) {
    await updateIssue(jiraContext, masterTicketKey, {
      update: {
        customfield_23713: [
          {
            set: `https://github.com/coupa/treasury_tm5/releases/tag/${version}`
          }
        ],
        customfield_23604: [
          {
            set: `https://github.com/coupa/treasury_tm5/tree/release/${releaseVersion}`
          }
        ],
        customfield_23599: [
          {
            set: revision
          }
        ],
        customfield_23991: [
          {
            set: `https://github.com/coupa/treasury_tm5/compare/${previousPatchVersion}...${version}`
          }
        ],
        customfield_23983: [
          {
            set: commitCount
          }
        ],
        customfield_23984: [
          {
            set: fileCount
          }
        ],
        description: [
          {
            set: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'table',
                  attrs: {
                    isNumberColumnEnabled: false,
                    layout: 'default'
                  },
                  content: [
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: 'GitHub Tag',
                                  marks: [
                                    {
                                      type: 'strong'
                                    }
                                  ]
                                },
                                {
                                  type: 'text',
                                  text: ' '
                                },
                                {
                                  type: 'text',
                                  text: '(tag on final commit) *',
                                  marks: [
                                    {
                                      type: 'em'
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        },
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: version
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: 'Branch',
                                  marks: [
                                    {
                                      type: 'strong'
                                    }
                                  ]
                                },
                                {
                                  type: 'text',
                                  text: ' '
                                },
                                {
                                  type: 'text',
                                  text: '(From GitHub for current release) *',
                                  marks: [
                                    {
                                      type: 'em'
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        },
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'inlineCard',
                                  attrs: {
                                    url: `https://github.com/coupa/treasury_tm5/tree/release/${releaseVersion}`
                                  }
                                },
                                {
                                  type: 'text',
                                  text: ' '
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: 'Commit',
                                  marks: [
                                    {
                                      type: 'strong'
                                    }
                                  ]
                                },
                                {
                                  type: 'text',
                                  text: ' '
                                },
                                {
                                  type: 'text',
                                  text: '(required in the “Revision” field) *',
                                  marks: [
                                    {
                                      type: 'em'
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        },
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: revision
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: 'Automation Test',
                                  marks: [
                                    {
                                      type: 'strong'
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        },
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: `https://jenkins.bellin.cloud/view/E2E-Tests-State/job/Coupa_treasury_tm5/job/e2e_test/job/release%2F${releaseVersion}/`,
                                  marks: [
                                    {
                                      type: 'link',
                                      attrs: {
                                        href: `https://jenkins.bellin.cloud/view/E2E-Tests-State/job/Coupa_treasury_tm5/job/e2e_test/job/release%2F${releaseVersion}/`
                                      }
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: 'GitHub Diff',
                                  marks: [
                                    {
                                      type: 'strong'
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        },
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: `https://github.com/coupa/treasury_tm5/compare/${previousPatchVersion}...${version}`,
                                  marks: [
                                    {
                                      type: 'link',
                                      attrs: {
                                        href: `https://github.com/coupa/treasury_tm5/compare/${previousPatchVersion}...${version}`
                                      }
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    },
                    {
                      type: 'tableRow',
                      content: [
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: 'Artifact',
                                  marks: [
                                    {
                                      type: 'strong'
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        },
                        {
                          type: 'tableCell',
                          attrs: {},
                          content: [
                            {
                              type: 'paragraph',
                              content: [
                                {
                                  type: 'text',
                                  text: ' '
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      },
      fields: {}
    })
  }
}

export const createMasterTicket = async (
  version: string,
  masterIssueType: string,
  masterProjectId: string,
  masterTicketVersionId: string,
  jiraContext: JiraContext
): Promise<void> => {
  const masterTicket = await getMasterTicketKey(jiraContext, version)
  if (!masterTicket) {
    await createIssue(jiraContext, {
      update: {},
      fields: {
        summary: `${version} Master Ticket`,
        issuetype: {
          id: masterIssueType
        },
        project: {
          id: masterProjectId
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
        customfield_23944: {
          value: 'DU'
        },
        customfield_23710: {
          value: 'Power App',
          child: {
            value: 'Treasury Management (CTM)'
          }
        },
        customfield_21603: {
          value: 'Treasury Management (CTM)'
        },
        customfield_24144: [
          {
            id: masterTicketVersionId
          }
        ]
      }
    })
  }
}

export const generateReleaseNote = async (
  fixVersion: string,
  jiraContext: JiraContext
): Promise<string> => {
  const issues = await listIssuesSummaryWithFixVersion(jiraContext, fixVersion)
  return generateReleaseNoteFromIssues(issues)
}
