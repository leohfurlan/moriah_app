// Expo Router 5 consumes query-string's CommonJS named exports. Keep that
// interface while using the fixed, linear-time ESM decoder (0.5.0).
// A version/content mismatch fails installation instead of silently patching
// a different dependency. Remove with the coordinated Expo SDK upgrade.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../mobile/node_modules/query-string");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
if (version !== "7.1.3") throw new Error("Review query-string compatibility patch for the new version.");
const filename = path.join(root, "index.js");
const oldImport = "const decodeComponent = require('decode-uri-component');";
const newImport = "const decodeComponent = require('decode-uri-component').default;";
const source = fs.readFileSync(filename, "utf8");
if (!source.includes(oldImport) && !source.includes(newImport)) throw new Error("Unexpected query-string decoder import.");
fs.writeFileSync(filename, source.replace(oldImport, newImport));
console.log("query-string CommonJS adapter uses the patched ESM decoder.");
