import {exec} from 'promisify-child-process'
import * as core from '@actions/core'

export const extractJiraIssues = async (
  releaseVersion: string,
  githubWorkspace: string
): Promise<string[]> => {
  await exec(`chmod +x ${__dirname}/../extract-issues`)
  await exec(`cd ${githubWorkspace}`)
  const listRepo = await exec(`ls -l`)
  core.info(`listRepo:--${listRepo.stdout}--`)
  const tags = await exec(`git tag --list --sort=-version:refname "5.*"`)
  core.info(`tags:--${tags.stdout}--`)
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
