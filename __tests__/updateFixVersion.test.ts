import {
  createVersion,
  JiraIssue,
  JiraVersion,
  listProjectVersions,
  SearchedJiraIssue,
  searchIssues,
  updateIssue
} from '../src/api/jiraApi'
import {updateIssuesFixVersion} from '../src/jiraUpdate'

jest.mock('../src/api/jiraApi', () => {
  const originalModule = jest.requireActual('../src/api/jiraApi')

  return {
    __esModule: true,
    ...originalModule,
    searchIssues: jest
      .fn((): SearchedJiraIssue[] => [])
      .mockImplementationOnce((): SearchedJiraIssue[] => [
        {key: 'x1-2', fields: {}},
        {key: 'x2-1', fields: {}},
        {key: 'x3-1', fields: {}}
      ]),
    listProjectVersions: jest.fn(() => []),
    createVersion: jest
      .fn((): JiraVersion | null => null)
      .mockImplementationOnce((): JiraVersion | null => ({
        id: '1',
        archived: false,
        released: false,
        name: 'test'
      }))
      .mockImplementationOnce(() => ({
        id: '2',
        archived: false,
        released: false,
        name: 'test'
      })),
    updateIssue: jest.fn(() => {})
  }
})

const jiraContext = {
  subDomain: 'xxx',
  email: 'xxx@xx.com',
  token: 'xxx',
  projectsKeys: 'x1,x2,x3'.split(','),
  projectsIds: '1,2,3'.split(','),
  masterProjectId: '1',
  masterProjectKey: 'xx',
  masterIssueType: 'xx'
}

test('Update fix version of issues from 2 out of 3 projects', async () => {
  await updateIssuesFixVersion(
    jiraContext,
    ['x1-1', 'x1-2', 'x2-1', 'x2-2', 'x3-1'],
    'v1.0.1'
  )
  const expectedVersion1Update: JiraIssue = {
    update: {
      customfield_24144: [
        {
          add: {id: '1'}
        }
      ]
    }
  }
  const expectedVersion2Update: JiraIssue = {
    update: {
      customfield_24144: [
        {
          add: {id: '2'}
        }
      ]
    }
  }
  expect(listProjectVersions).toHaveBeenCalledTimes(3)
  expect(createVersion).toHaveBeenCalledTimes(3)
  expect(updateIssue).toHaveBeenCalledTimes(2)
  expect(updateIssue).toHaveBeenCalledWith(
    jiraContext,
    'x1-2',
    expectedVersion1Update
  )
  expect(updateIssue).toHaveBeenCalledWith(
    jiraContext,
    'x2-1',
    expectedVersion2Update
  )
})

test('The are no issues to be updated', async () => {
  await searchIssues(jiraContext, '', [])
  await updateIssuesFixVersion(
    jiraContext,
    ['x1-1', 'x1-2', 'x2-1', 'x2-2', 'x3-1'],
    'v1.0.1'
  )
  expect(listProjectVersions).not.toHaveBeenCalled()
  expect(createVersion).not.toHaveBeenCalled()
  expect(updateIssue).not.toHaveBeenCalled()
})
