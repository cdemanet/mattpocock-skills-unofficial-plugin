const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const UPSTREAM = path.join(ROOT, 'upstream');
const PKG = path.join(ROOT, 'pkg');

const upstreamPkg = JSON.parse(fs.readFileSync(path.join(UPSTREAM, 'package.json'), 'utf8'));
const upstreamManifest = JSON.parse(fs.readFileSync(path.join(UPSTREAM, '.claude-plugin', 'plugin.json'), 'utf8'));
const PLUGIN_VERSION = process.env.PLUGIN_VERSION || upstreamPkg.version;

// Clean and recreate the publish directory
fs.rmSync(PKG, { recursive: true, force: true });
fs.mkdirSync(PKG, { recursive: true });

// Build the OMP-compatible skills directory.
// OMP's skill providers scan direct subdirectories of the configured skills
// directory for SKILL.md files. The upstream manifest lists category-scoped paths
// such as "./skills/engineering/ask-matt", so we flatten the active skills to the
// top level of pkg/skills/ while preserving each skill's internal files.
const upstreamSkills = Array.isArray(upstreamManifest.skills) ? upstreamManifest.skills : [];
if (upstreamSkills.length === 0) {
  throw new Error('Upstream plugin manifest does not list any skills');
}

const skillNames = new Set();
const skillsDir = path.join(PKG, 'skills');
fs.mkdirSync(skillsDir, { recursive: true });

for (const skillPath of upstreamSkills) {
  const normalized = path.normalize(skillPath);
  const parts = normalized.split(path.sep);
  // Expect paths like "skills/engineering/ask-matt" or "./skills/engineering/ask-matt"
  if (parts.length < 2 || parts[0] !== 'skills') {
    throw new Error(`Unexpected skill path in upstream manifest: ${skillPath}`);
  }
  const skillName = parts[parts.length - 1];
  if (skillNames.has(skillName)) {
    throw new Error(
      `Duplicate skill name after flattening categories: "${skillName}" from ${skillPath}. ` +
      'Two upstream skills share the same leaf directory name.'
    );
  }
  skillNames.add(skillName);

  const srcDir = path.join(UPSTREAM, ...parts);
  const destDir = path.join(skillsDir, skillName);
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Upstream skill directory does not exist: ${srcDir}`);
  }
  copyDir(srcDir, destDir);
}

// Write the Claude plugin manifest.
// Claude Code accepts arrays of skill paths, but OMP's claude-plugins provider only
// reads "skills" as a string. Because we have flattened the skills to the top
// level, a single string path works for both.
fs.mkdirSync(path.join(PKG, '.claude-plugin'), { recursive: true });
fs.writeFileSync(
  path.join(PKG, '.claude-plugin', 'plugin.json'),
  JSON.stringify(
    {
      name: upstreamManifest.name,
      description: upstreamManifest.description ?? upstreamPkg.description,
      version: PLUGIN_VERSION,
      skills: './skills'
    },
    null,
    2
  ) + '\n'
);

// Copy the MIT license exactly as required by the license terms
fs.copyFileSync(path.join(UPSTREAM, 'LICENSE'), path.join(PKG, 'LICENSE'));

// Write a short README that points to upstream and explains install
fs.writeFileSync(
  path.join(PKG, 'README.md'),
  `# Matt Pocock Skills — Unofficial OMP Plugin

This npm package is an **unofficial community distribution** of the [mattpocock/skills](https://github.com/mattpocock/skills) skill tree, packaged as an [OMP](https://omp.sh)-compatible plugin. It is maintained by [xloouis](https://github.com/xloouis) and is not affiliated with Matt Pocock.

## Install

\`\`\`bash
omp install mattpocock-skills-unofficial-plugin
\`\`\`

For a project-scoped install:

\`\`\`bash
omp install mattpocock-skills-unofficial-plugin --scope=project
\`\`\`

## License

MIT. See [LICENSE](./LICENSE). Original work Copyright (c) 2026 Matt Pocock.
`
);

// Write the npm package manifest that will be published.
// The "omp" key is the native OMP manifest; it tells OMP this is a plugin and
// where to find skills. We also keep .claude-plugin/plugin.json for Claude Code
// compatibility.
fs.writeFileSync(
  path.join(PKG, 'package.json'),
  JSON.stringify(
    {
      name: 'mattpocock-skills-unofficial-plugin',
      version: PLUGIN_VERSION,
      description: "Unofficial community distribution of Matt Pocock's agent skills as an OMP plugin",
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'git+https://github.com/xloouis/mattpocock-skills-unofficial-plugin.git'
      },
      files: ['.claude-plugin', 'skills', 'README.md', 'LICENSE'],
      keywords: ['omp', 'oh-my-pi', 'pi-package', 'plugin', 'skills', 'claude', 'unofficial', 'mattpocock'],
      publishConfig: { access: 'public' },
      omp: {
        name: 'mattpocock-skills-unofficial-plugin',
        description: "Unofficial community distribution of Matt Pocock's agent skills as an OMP plugin",
        version: PLUGIN_VERSION,
        skills: ['./skills']
      }
    },
    null,
    2
  ) + '\n'
);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log(`Built ${upstreamSkills.length} skills into ${path.relative(ROOT, PKG)}`);
