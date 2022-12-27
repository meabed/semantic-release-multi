import { andThen, identity, memoizeWith, pipeWith, unapply } from "ramda";
import { pkgUpSync } from "pkg-up";
import { readPackage } from "read-pkg";
import path from "path";
import pLimit from "p-limit";
import { getCommitFiles, getRoot } from "./git-utils";
import { mapCommits } from "./options-transforms";

const debug = (...args) => console.debug(`[semantic-release:multi]`, ...args);

const memoizedGetCommitFiles = memoizeWith(identity, getCommitFiles);

/**
 * Get the normalized PACKAGE root path, relative to the git PROJECT root.
 */
const getPackagePath = () => {
  const packagePath = pkgUpSync();
  const gitRoot = getRoot();

  return path.relative(gitRoot, path.resolve(packagePath, ".."));
};

const withFiles = async (commits) => {
  const limit = pLimit(Number(process.env.SRM_MAX_THREADS) || 500);
  return Promise.all(
    commits.map((commit) =>
      limit(async () => {
        const files = memoizedGetCommitFiles(commit.hash);
        return { ...commit, files };
      })
    )
  );
};

const onlyPackageCommits = async (commits) => {
  const packagePath = getPackagePath();
  debug('Filter commits by package path: "%s"', packagePath);
  const commitsWithFiles = await withFiles(commits);
  // Convert package root path into segments - one for each folder
  const packageSegments = packagePath.split(path.sep);

  return commitsWithFiles.filter(({ files, subject }) => {
    // Normalise paths and check if any changed files' path segments start
    // with that of the package root.
    const packageFile = files.find((file) => {
      const fileSegments = path.normalize(file).split(path.sep);
      // Check the file is a *direct* descendent of the package folder (or the folder itself)
      return packageSegments.every(
        (packageSegment, i) => packageSegment === fileSegments[i]
      );
    });

    if (packageFile) {
      debug(
        'Including commit "%s" because it modified package file "%s".',
        subject,
        packageFile
      );
    }

    return !!packageFile;
  });
};

// Async version of Ramda's `tap`
const tapA = (fn) => async (x) => {
  await fn(x);
  return x;
};

const pipePromises = unapply(pipeWith(andThen));

const logFilteredCommitCount =
  (logger) =>
  async ({ commits }) => {
    const { name } = await readPackage();

    logger.log(
      "Found %s commits for package %s since last release",
      commits?.length || 0,
      name
    );
  };

const withOnlyPackageCommits = (plugin) => async (pluginConfig, config) => {
  const { logger } = config;

  return plugin(
    pluginConfig,
    await pipePromises(
      mapCommits(onlyPackageCommits),
      tapA(logFilteredCommitCount(logger))
    )(config)
  );
};

export { withOnlyPackageCommits, onlyPackageCommits, withFiles };
