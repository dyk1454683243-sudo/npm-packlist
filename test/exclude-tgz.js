// leftover npm pack results (*.tgz) are default-ignored, same class as *.orig
'use strict'

const Arborist = require('@npmcli/arborist')
const t = require('tap')
const packlist = require('../')

t.test('excludes .tgz package tarballs by default', async (t) => {
  const pkg = t.testdir({
    'package.json': JSON.stringify({
      name: 'test-package',
      version: '1.0.0',
    }),
    'index.js': 'module.exports = true\n',
    'test-package-1.0.0.tgz': 'previous npm pack result',
    fixtures: {
      'nested.tgz': 'nested tarball',
      'keep.js': 'module.exports = 1\n',
    },
  })

  const arborist = new Arborist({ path: pkg })
  const tree = await arborist.loadActual()
  const files = await packlist(tree)
  t.same(files, [
    'fixtures/keep.js',
    'index.js',
    'package.json',
  ])
})

t.test('can re-include .tgz files with negated .npmignore rules', async (t) => {
  const pkg = t.testdir({
    'package.json': JSON.stringify({
      name: 'test-package',
      version: '1.0.0',
    }),
    // defaultRules apply again in child walkers, so a nested ignore is the
    // relevant file for un-ignoring fixtures/nested.tgz
    '.npmignore': '!*.tgz\n',
    'index.js': 'module.exports = true\n',
    'test-package-1.0.0.tgz': 'intentionally packed tarball',
    fixtures: {
      '.npmignore': '!*.tgz\n',
      'nested.tgz': 'intentionally packed nested tarball',
      'keep.js': 'module.exports = 1\n',
    },
  })

  const arborist = new Arborist({ path: pkg })
  const tree = await arborist.loadActual()
  const files = await packlist(tree)
  t.same(files, [
    'fixtures/keep.js',
    'fixtures/nested.tgz',
    'index.js',
    'package.json',
    'test-package-1.0.0.tgz',
  ])
})
