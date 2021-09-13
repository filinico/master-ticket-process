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

export const updateJira = async (
  context: JiraContext,
  issueKeys: string[],
  fixVersion: string,
  prerelease: boolean
): Promise<void> => {
  if (!issueKeys || issueKeys.length === 0) {
    return
  }
  core.info(`fixVersion:[${fixVersion}]`)
  const issues = await filterIssuesWithoutCurrentFixVersion(
    context,
    issueKeys,
    fixVersion
  )
  if (!issues || issues.length === 0) {
    return
  }
  const masterTicketIssueKey = await getMasterTicketKey(context, fixVersion)
  const linkedIssues = issues.filter(i =>
    i.fields?.issuelinks?.find(
      j => j.outwardIssue?.key === masterTicketIssueKey
    )
  )
  const linkedIssueKeys = linkedIssues.map(issue => issue.key)
  core.info(`linkedIssueKeys:[${linkedIssueKeys.join(',')}]`)
  const currentIssueKeys = issues.map(issue => issue.key)
  core.info(`currentIssueKeys:[${currentIssueKeys.join(',')}]`)
  const {projectsIds, projectsKeys} = context
  const fixVersionUpdates: JiraIssue[] = []
  for (let i = 0; i < projectsKeys.length; i++) {
    const projectId = projectsIds[i]
    const projectKey = projectsKeys[i]
    const version = await createIfNotExistsJiraVersion(
      context,
      fixVersion,
      parseInt(projectId),
      projectKey
    )
    const fixVersionUpdate: JiraIssue = {
      update: {
        fixVersions: [
          {
            add: {id: version.id}
          }
        ]
      }
    }
    fixVersionUpdates.push(fixVersionUpdate)
  }

  for (const issueKey of currentIssueKeys) {
    core.info(`start updateIssue:[${issueKey}]`)
    let index = 0
    for (let i = 0; i < projectsKeys.length; i++) {
      if (issueKey.startsWith(projectsKeys[i])) {
        index = i
        break
      }
    }
    await updateIssue(context, issueKey, fixVersionUpdates[index])
    if (
      !prerelease &&
      masterTicketIssueKey &&
      !linkedIssueKeys.find(i => i === issueKey)
    ) {
      core.info(
        `start linkIssueToMasterTicket:[issue:${issueKey},masterTicketIssueKey:${masterTicketIssueKey}]`
      )
      await linkIssueToMasterTicket(context, masterTicketIssueKey, issueKey)
    }
  }
}

const filterIssuesWithoutCurrentFixVersion = async (
  context: JiraContext,
  issueKeys: string[],
  fixVersion: string
): Promise<SearchedJiraIssue[]> => {
  const {projectsKeys} = context
  const groupedIssues = issueKeys.join(',')
  const searchIssuesWithoutCurrentFixVersion = `project in (${projectsKeys.join(
    ','
  )}) AND (fixVersion not in (${fixVersion}) OR fixVersion is EMPTY) AND issuekey in (${groupedIssues})`
  core.info(`searchIssuesQuery:[${searchIssuesWithoutCurrentFixVersion}]`)
  return await searchIssues(context, searchIssuesWithoutCurrentFixVersion, [
    'issuelinks'
  ])
}

const listIssuesSummaryWithFixVersion = async (
  context: JiraContext,
  fixVersion: string
): Promise<SearchedJiraIssue[]> => {
  const {projectsKeys} = context
  const issuesWithFixVersion = `project in (${projectsKeys.join(
    ','
  )}) AND fixVersion in (${fixVersion})`
  core.info(`searchIssuesQuery:[${issuesWithFixVersion}]`)
  return await searchIssues(context, issuesWithFixVersion, ['summary'])
}

export const getMasterTicketKey = async (
  context: JiraContext,
  fixVersion: string
): Promise<string | null> => {
  const {masterProjectKey} = context
  const masterTicketQuery = `project = ${masterProjectKey} AND fixVersion in (${fixVersion})`
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
): Promise<JiraVersion> => {
  const versions = await listProjectVersions(context, projectKey)
  const result = versions.filter(i => i.name === fixVersion)
  let version: JiraVersion
  if (!result || result.length === 0) {
    const requestedVersion: JiraVersion = {
      name: fixVersion,
      archived: false,
      released: false,
      projectId
    }
    core.info(`version not found. start create version:[${requestedVersion}]`)
    version = await createVersion(context, requestedVersion)
    core.info(`version created:[${version.id}]`)
  } else {
    version = result[0]
    core.info(`version found:[${version.id}]`)
  }
  return version
}

export const updateMasterTicket = async (
  jiraContext: JiraContext,
  version: string,
  releaseVersion: string,
  revision: string,
  previousPatchVersion: string
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
        fixVersions: [
          {
            id: masterTicketVersionId
          }
        ],
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
        customfield_12803: {
          id: masterTicketVersionId
        }
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
