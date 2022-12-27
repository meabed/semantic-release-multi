import { overA } from './lens-utils';
import { compose, composeWith, lensProp } from 'ramda';

type TC = {
  commits: string[] | number[];
  nextRelease: {
    version: string;
  };
  lastRelease: {
    version: string;
  };
  version: any;
};

const commits = lensProp<TC, 'commits'>('commits');
const nextRelease = lensProp<TC, 'nextRelease'>('nextRelease');
const version = lensProp<TC, 'version'>('version');

export const mapCommits = (fn) => overA(commits, async (commits) => await fn(commits));

export const mapNextReleaseVersion = overA(compose(nextRelease, version));

export const withOptionsTransforms = (transforms) => (plugin) => async (pluginConfig, config) => {
  return plugin(pluginConfig, await composeWith(transforms)(config));
};
