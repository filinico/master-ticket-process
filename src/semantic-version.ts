const MinorVersionIndex = 1
const PatchVersionIndex = 2

export const generateNextPatchVersion = (versionNumber: string): string => {
  return generateNextVersion(versionNumber, PatchVersionIndex)
}

export const generateNextMinorVersion = (versionNumber: string): string => {
  return generateNextVersion(versionNumber, MinorVersionIndex)
}

const generateNextVersion = (
  versionNumber: string,
  versionIndex: number
): string => {
  const versions = versionNumber.split('.')
  const nextVersion = parseInt(versions[versionIndex]) + 1
  versions[versionIndex] = nextVersion.toString()
  return versions.join('.')
}

export const getVersionFromBranch = (
  branchName: string,
  branchType: string
): string => {
  if (branchName.includes(branchType)) {
    const sourceBranchSuffixArray = branchName.split('/')
    if (sourceBranchSuffixArray.length > 1) return sourceBranchSuffixArray[1]
  }
  return branchName
}
