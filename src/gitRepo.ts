import {exec} from 'promisify-child-process'

export const extractJiraIssues = async (
  releaseVersion: string
): Promise<string[]> => {
  const {stdout} = await exec(`./../extract-issues -r ${releaseVersion}`)
  const issueKeysCommaSeparated = stdout as string | null
  let issueKeys: string[] = []
  if (issueKeysCommaSeparated) {
    issueKeys = issueKeysCommaSeparated.split(',')
  }
  return issueKeys
}
