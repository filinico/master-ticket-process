import {generateNextMinorVersion, generateNextPatchVersion, getVersionFromBranch} from '../src/semantic-version'
import {convertScriptResults} from '../src/gitRepo'

test('generate next patch version', async () => {
  const nextPatchVersion1 = generateNextPatchVersion("v1.0.0")
  expect(nextPatchVersion1).toEqual("v1.0.1")
  const nextPatchVersion2 = generateNextPatchVersion("v1.1.2")
  expect(nextPatchVersion2).toEqual("v1.1.3")
})

test('generate next minor version', async () => {
  const nextMinorVersion1 = generateNextMinorVersion("v1.0.0")
  expect(nextMinorVersion1).toEqual("v1.1.0")
  const nextMinorVersion2 = generateNextMinorVersion("vrs10.5.8")
  expect(nextMinorVersion2).toEqual("vrs10.6.8")
})

test('get version from branch', async () => {
  const majorVersion = getVersionFromBranch("refs/heads/release/10.0", "release")
  expect(majorVersion).toEqual("10.0")
  const notReleaseBranch = getVersionFromBranch("refs/heads/test", "release")
  expect(notReleaseBranch).toEqual("refs/heads/test")
})

test('convert script results to array', async () => {
  const result1 = convertScriptResults("XX-123, XX-456\n")
  expect(result1).toEqual(["XX-123","XX-456"])
  const result2 = convertScriptResults("\r\n")
  expect(result2).toEqual([])
  const result3 = convertScriptResults(" \n ")
  expect(result3).toEqual([])
  const result4 = convertScriptResults("* [new tag]                 6.123.210601.161706.b68de5e -> 6.123.210601.161706.b68de5e")
  expect(result4).toEqual([])
})