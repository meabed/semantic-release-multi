import { logPluginVersion } from './log-plugin-version';
import { withOnlyPackageCommits } from './only-package-commits';
import { mapNextReleaseVersion, withOptionsTransforms } from './options-transforms';
import { versionToGitTag } from './version-to-git-tag';
import { compose } from 'ramda';
import { readPackageSync } from 'read-pkg';
import { wrapStep } from 'semantic-release-plugin-decorators';

export const analyzeCommits = wrapStep(
  'analyzeCommits',
  compose(logPluginVersion('analyzeCommits'), withOnlyPackageCommits),
  {
    wrapperName: 'semantic-release-multi',
  }
);

export const generateNotes = wrapStep(
  'generateNotes',
  compose(
    logPluginVersion('generateNotes'),
    withOnlyPackageCommits,
    withOptionsTransforms([mapNextReleaseVersion(versionToGitTag)])
  ),
  {
    wrapperName: 'semantic-release-multi',
  }
);

export const success = wrapStep(
  'success',
  compose(
    logPluginVersion('success'),
    withOnlyPackageCommits,
    withOptionsTransforms([mapNextReleaseVersion(versionToGitTag)])
  ),
  {
    wrapperName: 'semantic-release-multi',
  }
);

export const fail = wrapStep(
  'fail',
  compose(
    logPluginVersion('fail'),
    withOnlyPackageCommits,
    withOptionsTransforms([mapNextReleaseVersion(versionToGitTag)])
  ),
  {
    wrapperName: 'semantic-release-multi',
  }
);

export const tagFormat = readPackageSync().name + '-v${version}';

export default { analyzeCommits, generateNotes, success, fail, tagFormat };
