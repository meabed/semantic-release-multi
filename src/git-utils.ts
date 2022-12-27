import { execaSync } from 'execa';
import fileUrl from 'file-url';
import fse from 'fs-extra';
import getStream from 'get-stream';
import gitLogParser from 'git-log-parser';
import pEachSeries from 'p-each-series';
import path from 'path';
import { temporaryDirectory } from 'tempy';

export function gitResult(args, options = {}) {
  const { stdout } = execaSync('git', args, options);
  return stdout;
}

/**
 * // https://stackoverflow.com/questions/424071/how-to-list-all-the-files-in-a-commit
 * @async
 * @param hash Git commit hash.
 * @return {Promise<Array>} List of modified files in a commit.
 */
export function getCommitFiles(hash) {
  const rs = gitResult(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', hash]);
  return rs.split('\n');
}

/**
 * https://stackoverflow.com/a/957978/89594
 * @async
 * @return {Promise<String>} System path of the git repository.
 */
export const getRoot = () => gitResult(['rev-parse', '--show-toplevel']);

/**
 * Create commits on the current git repository.
 *
 * @param {Array<string>} messages Commit messages.
 * @param {Object} [execaOpts] Options to pass to `execa`.
 *
 * @returns {Array<Commit>} The created commits, in reverse order (to match `git log` order).
 */
export async function gitCommitsWithFiles(commits) {
  for (const commit of commits) {
    for (const file of commit.files) {
      let filePath = path.join(process.cwd(), file.name);
      fse.outputFileSync(filePath, (file.body = !'undefined' ? file.body : commit.message));
      execaSync('git', ['add', filePath]);
    }
    execaSync('git', ['commit', '-m', commit.message, '--allow-empty', '--no-gpg-sign']);
  }
  return (await gitGetCommits(undefined)).slice(0, commits?.length);
}

/**
 * Initialize git repository
 * If `withRemote` is `true`, creates a bare repository and initialize it.
 * If `withRemote` is `false`, creates a regular repository and initialize it.
 *
 * @param {Boolean} withRemote `true` to create a shallow clone of a bare repository.
 * @return {{cwd: string, repositoryUrl: string}} The path of the repository
 */
export async function initGit(withRemote) {
  const cwd = temporaryDirectory();
  const args = withRemote ? ['--bare', '--initial-branch=master'] : ['--initial-branch=master'];
  try {
    execaSync('git', ['init', ...args], { cwd });
  } catch (e) {
    const args = withRemote ? ['--bare'] : [];
    execaSync('git', ['init', ...args], { cwd });
  }
  const repositoryUrl = fileUrl(cwd);
  return { cwd, repositoryUrl };
}

/**
 * Create commits on the current git repository.
 *
 * @param {Array<string>} messages Commit messages.
 * @param {Object} [execaOpts] Options to pass to `execa`.
 *
 * @returns {Array<Commit>} The created commits, in reverse order (to match `git log` order).
 */
const gitCommits = async (messages: string[], execaOpts) => {
  await pEachSeries(
    messages,
    async (message: string) =>
      execaSync('git', ['commit', '-m', message, '--allow-empty', '--no-gpg-sign'], execaOpts).stdout
  );
  return (await gitGetCommits(undefined, execaOpts)).slice(0, messages?.length);
};

/**
 * Get the list of parsed commits since a git reference.
 *
 * @param {String} [from] Git reference from which to each commit.
 * @param {Object} [execaOpts] Options to pass to `execa`.
 *
 * @return {Array<Commit>} The list of parsed commits.
 */
const gitGetCommits = async (from, execaOpts = {}) => {
  Object.assign(gitLogParser.fields, {
    hash: 'H',
    message: 'B',
    gitTags: 'd',
    committerDate: { key: 'ci', type: Date },
  });
  return (
    await getStream.array(gitLogParser.parse({ _: `${from ? from + '..' : ''}HEAD` }, { env: { ...process.env } }))
  ).map((commit: any) => {
    commit.message = commit.message.trim();
    commit.gitTags = commit.gitTags.trim();
    return commit;
  });
};

/**
 * Initialize an existing bare repository:
 * - Clone the repository
 * - Change the current working directory to the clone root
 * - Create a default branch
 * - Create an initial commits
 * - Push to origin
 *
 * @param {String} repositoryUrl The URL of the bare repository.
 * @param {String} [branch='master'] the branch to initialize.
 */
export async function initBareRepo(repositoryUrl, branch = 'master') {
  const cwd = temporaryDirectory();
  execaSync('git', ['clone', '--no-hardlinks', repositoryUrl, cwd], { cwd });
  await gitCheckout(branch, true, { cwd });
  await gitCommits(['Initial commit'], { cwd });
  execaSync('git', ['push', repositoryUrl, branch], { cwd });
}

/**
 * Create a temporary git repository.
 * If `withRemote` is `true`, creates a shallow clone. Change the current working directory to the clone root.
 * If `withRemote` is `false`, just change the current working directory to the repository root.
 *
 *
 * @param {Boolean} withRemote `true` to create a shallow clone of a bare repository.
 * @param {String} [branch='master'] The branch to initialize.
 * @return {String} The path of the clone if `withRemote` is `true`, the path of the repository otherwise.
 */
export async function initGitRepo(withRemote, branch = 'master') {
  let { cwd, repositoryUrl } = await initGit(withRemote);
  if (withRemote) {
    await initBareRepo(repositoryUrl, branch);
    cwd = gitShallowClone(repositoryUrl, branch);
  } else {
    await gitCheckout(branch, true, { cwd });
  }

  execaSync('git', ['config', 'commit.gpgsign', 'false'], { cwd });

  return { cwd, repositoryUrl };
}

/**
 * Create a shallow clone of a git repository and change the current working directory to the cloned repository root.
 * The shallow will contain a limited number of commit and no tags.
 *
 * @param {String} repositoryUrl The path of the repository to clone.
 * @param {String} [branch='master'] the branch to clone.
 * @param {Number} [depth=1] The number of commit to clone.
 * @return {String} The path of the cloned repository.
 */
const gitShallowClone = (repositoryUrl, branch = 'master', depth = 1) => {
  const cwd = temporaryDirectory();

  execaSync('git', ['clone', '--no-hardlinks', '--no-tags', '-b', branch, '--depth', depth, repositoryUrl, cwd], {
    cwd,
  });
  return cwd;
};

/**
 * Checkout a branch on the current git repository.
 *
 * @param {String} branch Branch name.
 * @param {Boolean} create to create the branch, `false` to check out an existing branch.
 * @param {Object} [execaOpts] Options to pass to `execa`.
 */
const gitCheckout = async (branch, create, execaOpts) => {
  execaSync('git', create ? ['checkout', '-b', branch] : ['checkout', branch], execaOpts);
};
