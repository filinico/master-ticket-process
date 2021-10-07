import {searchIssues} from '../src/api/jiraApi'
import {filterIssuesWithoutCurrentFixVersion} from '../src/jiraUpdate'

jest.mock('../src/api/jiraApi', () => {
  const originalModule = jest.requireActual('../src/api/jiraApi')

  return {
    __esModule: true,
    ...originalModule,
    searchIssues: jest.fn(() => ['x'])
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

test('Split issues into 2 batches', async () => {
  let issueKeys: string[] = []
  for (let i = 0; i < 6001; i++) {
    issueKeys.push('x')
  }
  const issues = await filterIssuesWithoutCurrentFixVersion(
    jiraContext,
    issueKeys,
    'x.x.x'
  )
  expect(issues).toStrictEqual(['x', 'x'])
  expect(searchIssues).toHaveBeenCalledTimes(2)
})

test('Split issues into 3 batches', async () => {
  let issueKeys: string[] = []
  for (let i = 0; i < 8001; i++) {
    issueKeys.push('x')
  }
  const issues = await filterIssuesWithoutCurrentFixVersion(
    jiraContext,
    issueKeys,
    'x.x.x'
  )
  expect(issues).toStrictEqual(['x', 'x', 'x'])
  expect(searchIssues).toHaveBeenCalledTimes(3)
})

test('Make only one call', async () => {
  let issueKeys: string[] = []
  for (let i = 0; i < 3999; i++) {
    issueKeys.push('x')
  }
  const issues = await filterIssuesWithoutCurrentFixVersion(
    jiraContext,
    issueKeys,
    'x.x.x'
  )
  expect(issues).toStrictEqual(['x'])
  expect(searchIssues).toHaveBeenCalledTimes(1)
})
