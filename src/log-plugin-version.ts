import { readPackage } from "read-pkg";
import Debug from "debug";
const debug = Debug("semantic-release:multi");

export const logPluginVersion =
  (type) => (plugin) => async (pluginConfig, config) => {
    if (config.options.debug) {
      const { version } = await readPackage();
      debug.log("Running %o version %o", type, version);
    }

    return plugin(pluginConfig, config);
  };

export default logPluginVersion;
