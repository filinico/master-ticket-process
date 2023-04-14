import {
  createIssueLink,
  CreateIssueLink,
  SearchedJiraIssue
} from '../src/api/jiraApi'
import {linkIssues} from '../src/jiraUpdate'

jest.mock('../src/api/jiraApi', () => {
  const originalModule = jest.requireActual('../src/api/jiraApi')

  return {
    __esModule: true,
    ...originalModule,
    searchIssues: jest.fn(() => [{key: 'rm-1'}]),
    createIssueLink: jest.fn(() => {})
  }
})

const jiraContext = {
  subDomain: 'xxx',
  email: 'xxx@xx.com',
  token: 'xxx',
  projectsKeys: 'xx,xx'.split(','),
  projectsIds: '1,2'.split(','),
  masterProjectId: '1',
  masterProjectKey: 'xx',
  masterIssueType: 'xx'
}

test('Link issues to RM ticket', async () => {
  const fixVersion = 'v1.0.1'
  const extractedIssues: SearchedJiraIssue[] = [
    {
      key: 'xx-1',
      fields: {
        summary: 'test'
      }
    },
    {
      key: 'xx-2',
      fields: {
        summary: 'test',
        issuelinks: [
          {
            outwardIssue: {
              id: '',
              key: 'rm-1'
            },
            id: '',
            self: '',
            type: {
              id: ''
            }
          }
        ]
      }
    }
  ]
  await linkIssues(jiraContext, extractedIssues, fixVersion, false)
  const expectedLink: CreateIssueLink = {
    type: {
      name: 'Drives'
    },
    inwardIssue: {
      key: 'xx-1'
    },
    outwardIssue: {
      key: 'rm-1'
    }
  }
  expect(createIssueLink).toHaveBeenCalledTimes(1)
  expect(createIssueLink).toHaveBeenCalledWith(jiraContext, expectedLink)
})

test('No issues to be linked to RM ticket', async () => {
  const fixVersion = 'v1.0.1'
  const extractedIssues: SearchedJiraIssue[] = [
    {
      key: 'xx-1',
      fields: {
        summary: 'test',
        issuelinks: [
          {
            outwardIssue: {
              id: '',
              key: 'rm-1'
            },
            id: '',
            self: '',
            type: {
              id: ''
            }
          }
        ]
      }
    },
    {
      key: 'xx-2',
      fields: {
        summary: 'test',
        issuelinks: [
          {
            outwardIssue: {
              id: '',
              key: 'rm-1'
            },
            id: '',
            self: '',
            type: {
              id: ''
            }
          }
        ]
      }
    }
  ]
  await linkIssues(jiraContext, extractedIssues, fixVersion, false)
  expect(createIssueLink).not.toHaveBeenCalled()
})

test('Do not link issues for Major version', async () => {
  const fixVersion = 'v1.0.1'
  const extractedIssues: SearchedJiraIssue[] = [
    {
      key: 'xx-1',
      fields: {
        summary: 'test'
      }
    },
    {
      key: 'xx-2',
      fields: {
        summary: 'test'
      }
    }
  ]
  await linkIssues(jiraContext, extractedIssues, fixVersion, true)
  expect(createIssueLink).not.toHaveBeenCalled()
})
