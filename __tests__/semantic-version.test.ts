import {
  generateNextMinorVersion,
  generateNextPatchVersion,
  generatePreviousPatchVersion,
  getVersionFromBranch,
  checkMajorVersion,
  verifyNumbering
} from '../src/semantic-version'

test('generate next patch version', async () => {
  const nextPatchVersion1 = generateNextPatchVersion('v1.0.0')
  expect(nextPatchVersion1).toEqual('v1.0.1')
  const nextPatchVersion2 = generateNextPatchVersion('v1.1.2')
  expect(nextPatchVersion2).toEqual('v1.1.3')
})

test('generate next minor version', async () => {
  const nextMinorVersion1 = generateNextMinorVersion('v1.0.0')
  expect(nextMinorVersion1).toEqual('v1.1.0')
  const nextMinorVersion2 = generateNextMinorVersion('vrs10.5.8')
  expect(nextMinorVersion2).toEqual('vrs10.6.8')
})

test('generate previous patch version', async () => {
  const nextPatchVersion1 = generatePreviousPatchVersion('v1.0.1')
  expect(nextPatchVersion1).toEqual('v1.0.0')
  const nextPatchVersion2 = generatePreviousPatchVersion('v1.1.2')
  expect(nextPatchVersion2).toEqual('v1.1.1')
})

test('get version from branch', async () => {
  const majorVersion = getVersionFromBranch(
    'refs/heads/release/10.0',
    'release'
  )
  expect(majorVersion).toEqual('10.0')
  const notReleaseBranch = getVersionFromBranch('refs/heads/test', 'release')
  expect(notReleaseBranch).toEqual('refs/heads/test')
})

test('comply to version numbering', async () => {
  expect(verifyNumbering('v1.0.10', 'v', '1.0')).toBe(true)
  expect(verifyNumbering('v35.56.100', 'v', '35.56')).toBe(true)
  expect(verifyNumbering('v32.0.1', 'v', '32.0')).toBe(true)
  expect(verifyNumbering('v33.0.10', 'v', '33.0')).toBe(true)
  expect(verifyNumbering('v66.6.6666', 'v', '66.6')).toBe(true)
})

test('is a major version', async () => {
  expect(verifyNumbering('v10.0.0', 'v', '10.0')).toBe(true)
  expect(checkMajorVersion('v10.0.0')).toBe(true)
})

test("don't comply to version numbering", async () => {
  expect(verifyNumbering('pr1.0.10', 'v', '1.0')).toBe(false)
  expect(verifyNumbering('v359.56.100', 'v', '359.57')).toBe(false)
  expect(verifyNumbering('v32.0.0-alpha', 'v', '32.0')).toBe(false)
  expect(verifyNumbering('v33.100.10', 'v', '33.101')).toBe(false)
  expect(verifyNumbering('v66.6.66669', 'v', '66.6')).toBe(false)
  expect(verifyNumbering('5.66.6.66669', 'v', '66.6')).toBe(false)
  expect(verifyNumbering('566.6.66669', 'v', '566.6')).toBe(false)
  expect(verifyNumbering('v32.0.1', 'v', '33.0')).toBe(false)
})
