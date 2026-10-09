/// <reference types="jest" />

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceRoots = ['app', 'components', 'context', 'constants', 'src', 'utils'];
const allowedLegacyFile = path.join('src', 'localization', 'legacyRtlMigration.ts');
const allowedRuntimeReloadFile = path.join('app', '_layout.tsx');

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) as Record<string, string>;
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return [];
      return sourceFiles(entryPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

describe('localization catalogs and runtime direction guardrails', () => {
  const en = readJson(path.join(projectRoot, 'src/localization/locales/en.json'));
  const files = sourceRoots.flatMap((root) => sourceFiles(path.join(projectRoot, root)));

  test('every literal translation call has a catalog entry', () => {
    const usedKeys = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
        usedKeys.add(match[1]);
      }
    }

    expect([...usedKeys].filter((key) => !(key in en))).toEqual([]);
  });

  test('global RTL and app reload APIs stay isolated to the one-time migration', () => {
    const violations: string[] = [];
    for (const file of files) {
      const relativePath = path.relative(projectRoot, file);
      if (relativePath === allowedLegacyFile || relativePath === allowedRuntimeReloadFile) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (/\bI18nManager\b|\bforceRTL\b|\breloadAsync\b/.test(source)) {
        violations.push(relativePath);
      }
    }
    expect(violations).toEqual([]);
  });

  test('components do not read i18next language directly', () => {
    const violations = files
      .filter((file) => !file.includes(`${path.sep}src${path.sep}localization${path.sep}`))
      .filter((file) => path.relative(projectRoot, file) !== path.join('context', 'LocaleContext.tsx'))
      .filter((file) => /i18n\.language/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(projectRoot, file));
    expect(violations).toEqual([]);
  });
});
