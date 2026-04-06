const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const configPath = path.join(root, "_config.yml");
const swPath = path.join(root, "sw.js");

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const version =
  now.getFullYear() +
  pad(now.getMonth() + 1) +
  pad(now.getDate()) +
  pad(now.getHours()) +
  pad(now.getMinutes());

// Update _config.yml
const config = fs.readFileSync(configPath, "utf8");
const updatedConfig = config.replace(
  /^asset_version:\s*".*"/m,
  `asset_version: "${version}"`
);
fs.writeFileSync(configPath, updatedConfig, "utf8");

// Update sw.js query strings
const sw = fs.readFileSync(swPath, "utf8");
const updatedSw = sw.replace(/\?v=\d+/g, `?v=${version}`);
fs.writeFileSync(swPath, updatedSw, "utf8");

console.log(`asset_version bumped to ${version} (_config.yml + sw.js)`);
