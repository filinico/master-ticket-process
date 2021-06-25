import {exec} from 'promisify-child-process'
import * as core from '@actions/core'

export const extractJiraIssues = async (
  releaseVersion: string,
  githubWorkspace: string
): Promise<string[]> => {
  await exec(`chmod +x ${__dirname}/../extract-issues`)
  await exec(`cd ${githubWorkspace}`)
  const currentPath = await exec(`pwd`)
  core.info(`listRepo:--${currentPath.stdout}--`)
  if (currentPath.stderr) {
    core.error(currentPath.stderr.toString())
  }
  const fetchTags = await exec(`git fetch --prune --unshallow --tags"`)
  if (fetchTags.stderr) {
    core.error(fetchTags.stderr.toString())
  }
  const tags = await exec(`git tag --list --sort=-version:refname "5.*"`)
  core.info(`tags:--${tags.stdout}--`)
  if (tags.stderr) {
    core.error(tags.stderr.toString())
  }
  const {stdout, stderr} = await exec(
    `${__dirname}/../extract-issues -r ${releaseVersion}`
  )
  if (stderr) {
    core.error(stderr.toString())
  }
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
