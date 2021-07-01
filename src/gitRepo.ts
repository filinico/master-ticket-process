import {exec} from 'promisify-child-process'
import * as core from '@actions/core'

export const extractJiraIssues = async (
  releaseVersion: string,
  githubWorkspace: string
): Promise<string[]> => {
  await exec(`chmod +x ${__dirname}/../extract-issues`)
  await exec(`cd ${githubWorkspace}`)
  const {stdout, stderr} = await exec(
    `${__dirname}/../extract-issues -r ${releaseVersion}`
  )
  core.info(`issueKeysCommaSeparated:--${stdout}--`)
  if (stderr) {
    core.error(stderr.toString())
  }
  const issueKeysCommaSeparated = stdout as string | null
  return convertScriptResults(issueKeysCommaSeparated)
}

export const convertScriptResults = (
  issueKeysCommaSeparated: string | null
): string[] => {
  let issueKeys: string[] = []
  if (issueKeysCommaSeparated && issueKeysCommaSeparated.includes(',')) {
    const searchRegExp = /\s/g
    const resultsFormatted = issueKeysCommaSeparated.replace(searchRegExp, '')
    if (resultsFormatted !== '') {
      issueKeys = resultsFormatted.split(',')
    }
  }
  return issueKeys
}
