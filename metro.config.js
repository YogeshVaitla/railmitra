const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add directories to Metro's ignore list to prevent ENOENT errors
// when Metro tries to read generated Android build files inside node_modules.
const defaultBlockList = config.resolver.blockList instanceof Array
    ? config.resolver.blockList
    : (config.resolver.blockList ? [config.resolver.blockList] : []);

config.resolver.blockList = [
    ...defaultBlockList,
    /.*\/android\/build\/.*/,
    /.*\/ios\/build\/.*/,
];

module.exports = config;
