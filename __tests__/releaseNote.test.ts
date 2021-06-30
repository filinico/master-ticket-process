import {generateReleaseNoteFromIssues, SearchedJiraIssue} from '../src/api/jiraApi'

const issues: SearchedJiraIssue[] = [
  {
    key: 'XX-1234',
    fields: {
      summary: 'New awesome feature 1'
    }
  },
  {
    key: 'XX-4567',
    fields: {
      summary: 'Extend great feature 2'
    }
  },
  {
    key: 'XX-666',
    fields: {
      summary: 'Fix feature 1'
    }
  }
]

const expectedReleaseNote = '' +
  '- XX-1234 New awesome feature 1\n' +
  '- XX-4567 Extend great feature 2\n' +
  '- XX-666 Fix feature 1'

test('generate release note from issues', async () => {
  const releaseNote = generateReleaseNoteFromIssues(issues)
  expect(releaseNote).toEqual(expectedReleaseNote)
})