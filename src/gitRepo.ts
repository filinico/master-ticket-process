import {exec} from 'promisify-child-process'

export const extractJiraIssues = async (
  releaseVersion: string,
  githubWorkspace: string
): Promise<string[]> => {
  await exec(`chmod +x ${__dirname}/../extract-issues`)
  await exec(`cd ${githubWorkspace}`)
  const {stdout} = await exec(
    `${__dirname}/../extract-issues -r ${releaseVersion}`
  )
  const issueKeysCommaSeparated = stdout as string | null
  let issueKeys: string[] = []
  if (
    issueKeysCommaSeparated &&
    issueKeysCommaSeparated !== '' &&
    issueKeysCommaSeparated !== ' '
  ) {
    issueKeys = issueKeysCommaSeparated.split(',')
  }
  return issueKeys
}
