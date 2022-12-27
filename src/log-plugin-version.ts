import Debug from 'debug';
import { readPackageSync } from 'read-pkg';

const debug = Debug('semantic-release:multi');

export const logPluginVersion = (type) => (plugin) => (pluginConfig, config) => {
  if (config.options.debug) {
    const { version } = readPackageSync();
    debug.log('Running %o version %o', type, version);
  }

  return plugin(pluginConfig, config);
};
