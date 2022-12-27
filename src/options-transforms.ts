import { compose, composeWith, lensProp } from "ramda";
import { overA } from "./lens-utils";

type TC = {
  commits: string[];
  nextRelease: string;
  version: string;
};
const commits = lensProp<TC, "commits">("commits");
const nextRelease = lensProp<TC, "nextRelease">("nextRelease");
const version = lensProp<TC, "version">("version");

export const mapCommits = (fn) =>
  overA(commits, async (commits) => await fn(commits));

export const mapNextReleaseVersion = overA(
  compose(nextRelease, version as any)
);

export const withOptionsTransforms =
  (transforms) => (plugin) => async (pluginConfig, config) => {
    return plugin(pluginConfig, await composeWith(transforms)(config));
  };
