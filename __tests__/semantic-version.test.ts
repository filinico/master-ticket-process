import {generateNextMinorVersion, generateNextPatchVersion, getVersionFromBranch} from '../src/semantic-version'

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

test('generate next minor version', async () => {
  const majorVersion = getVersionFromBranch("refs/heads/release/10.0", "release")
  expect(majorVersion).toEqual("10.0")
  const notReleaseBranch = getVersionFromBranch("refs/heads/test", "release")
  expect(notReleaseBranch).toEqual("refs/heads/test")
})