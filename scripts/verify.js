const fs = require('node:fs');
const path = require('node:path');

const PKG_DIR = path.resolve(__dirname, '..', 'pkg');
const EXPECTED_NAME = 'mattpocock-skills-unofficial-plugin';

const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function assertExists(filePath, description) {
  assert(fs.existsSync(filePath), `Missing ${description}: ${path.relative(PKG_DIR, filePath)}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// package.json checks
const packageJsonPath = path.join(PKG_DIR, 'package.json');
assertExists(packageJsonPath, 'package manifest');

if (fs.existsSync(packageJsonPath)) {
  const pkg = readJson(packageJsonPath);
  assert(pkg.name === EXPECTED_NAME, `Package name must be "${EXPECTED_NAME}", got "${pkg.name}"`);
  assert(typeof pkg.version === 'string' && pkg.version.length > 0, 'Package version must be set');
  assert(pkg.private === undefined, 'Package must not have a "private" flag');
  assert(pkg.publishConfig?.access === 'public', 'Package must have publishConfig.access set to "public"');
  assert(pkg.omp && typeof pkg.omp === 'object', 'Package manifest must have an "omp" field');
  assert(
    typeof pkg.omp.name === 'string' && pkg.omp.name.length > 0,
    'OMP manifest "omp.name" must be a non-empty string'
  );
  assert(
    typeof pkg.omp.version === 'string' && pkg.omp.version.length > 0,
    'OMP manifest "omp.version" must be a non-empty string'
  );
  const ompSkills = pkg.omp.skills;
  assert(
    (typeof ompSkills === 'string' && ompSkills.length > 0) ||
    (Array.isArray(ompSkills) && ompSkills.length > 0),
    'OMP manifest "omp.skills" must be a non-empty string or array'
  );
}

// Claude plugin manifest checks
const pluginManifestPath = path.join(PKG_DIR, '.claude-plugin', 'plugin.json');
assertExists(pluginManifestPath, 'Claude plugin manifest');

if (fs.existsSync(pluginManifestPath)) {
  const manifest = readJson(pluginManifestPath);
  assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'Claude plugin manifest must have a name');
  assert(typeof manifest.version === 'string' && manifest.version.length > 0, 'Claude plugin manifest must have a version');
  assert(
    typeof manifest.skills === 'string' && manifest.skills.length > 0,
    'Claude plugin manifest "skills" must be a non-empty string path'
  );
}

// skills tree checks
const skillsDir = path.join(PKG_DIR, 'skills');
assertExists(skillsDir, 'skills directory');

if (fs.existsSync(skillsDir)) {
  const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter(e => e.isDirectory());
  assert(skillDirs.length > 0, 'skills directory must contain at least one skill directory');

  for (const entry of skillDirs) {
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    assertExists(skillPath, `SKILL.md for skill "${entry.name}"`);
  }
}

// documentation and license checks
assertExists(path.join(PKG_DIR, 'README.md'), 'README');
assertExists(path.join(PKG_DIR, 'LICENSE'), 'LICENSE');

if (errors.length > 0) {
  console.error('Package verification failed:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log('Package verification passed.');
