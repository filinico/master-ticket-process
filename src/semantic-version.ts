const MinorVersionIndex = 1
const PatchVersionIndex = 2

export const generateNextPatchVersion = (versionNumber: string): string => {
  return generateVersion(versionNumber, PatchVersionIndex)
}

export const generateNextMinorVersion = (versionNumber: string): string => {
  return generateVersion(versionNumber, MinorVersionIndex)
}

export const generatePreviousPatchVersion = (versionNumber: string): string => {
  return generateVersion(versionNumber, PatchVersionIndex, false)
}

const generateVersion = (
  versionNumber: string,
  versionIndex: number,
  nextVersion = true
): string => {
  const versions = versionNumber.split('.')
  const currentVersion = parseInt(versions[versionIndex])
  let versionGenerated
  if (nextVersion) {
    versionGenerated = currentVersion + 1
  } else {
    versionGenerated = currentVersion - 1
  }
  versions[versionIndex] = versionGenerated.toString()
  return versions.join('.')
}

export const getVersionFromBranch = (
  branchName: string,
  branchType: string
): string => {
  if (branchName.includes(branchType)) {
    const sourceBranchSuffixArray = branchName.split('/')
    if (sourceBranchSuffixArray.length > 1)
      return sourceBranchSuffixArray[sourceBranchSuffixArray.length - 1]
  }
  return branchName
}

export const verifyNumbering = (
  tagName: string,
  tagPrefix: string
): boolean => {
  const regex = `^${tagPrefix}[0-9]{1,2}.[0-9]{1,2}.[0-9]{1,4}$`
  return !!tagName.match(new RegExp(regex, 'g'))
}

export const checkMajorVersion = (tagName: string): boolean =>
  tagName.endsWith('.0')
