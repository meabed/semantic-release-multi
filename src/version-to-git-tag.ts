import { readPackageSync } from "read-pkg";

export async function versionToGitTag(version) {
  if (!version) {
    return null;
  }

  const { name } = readPackageSync();
  return `${name}-v${version}`;
}

export default versionToGitTag;
