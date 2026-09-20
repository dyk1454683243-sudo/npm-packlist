'use strict'

const Arborist = require('@npmcli/arborist')
const path = require('path')
const t = require('tap')
const packlist = require('../')

const elfJS = `
module.exports = elf =>
  console.log("i'm a elf")
`

const packWorkspace = async (workspacePath, root) => {
  // this is how pacote / `npm pack --workspaces` loads the tree: Arborist is
  // rooted at the workspace package, so hoisted deps have edgesOut.to === null
  const arborist = new Arborist({ path: workspacePath })
  const tree = await arborist.loadActual()
  return packlist(tree, {
    path: workspacePath,
    prefix: root,
    workspaces: [workspacePath],
  })
}

t.test('includes hoisted bundledDependencies when packing a workspace', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['subpackage'],
    }),
    subpackage: {
      'package.json': JSON.stringify({
        name: 'subpackage',
        version: '1.0.0',
        main: 'index.js',
        files: ['index.js'],
        dependencies: {
          history: '1.0.0',
          leftover: '1.0.0',
        },
        bundleDependencies: ['history'],
      }),
      'index.js': elfJS,
      'secret.js': 'do not include',
    },
    node_modules: {
      history: {
        'package.json': JSON.stringify({
          name: 'history',
          version: '1.0.0',
          main: 'index.js',
          optionalDependencies: {
            optionaldep: '1.0.0',
          },
        }),
        'index.js': elfJS,
      },
      leftover: {
        'package.json': JSON.stringify({
          name: 'leftover',
          version: '1.0.0',
          main: 'index.js',
        }),
        'index.js': elfJS,
      },
      subpackage: t.fixture('symlink', '../subpackage'),
    },
  })

  const files = await packWorkspace(path.join(root, 'subpackage'), root)
  t.same(files, [
    'index.js',
    'node_modules/history/index.js',
    'node_modules/history/package.json',
    'package.json',
  ])
})

t.test('includes hoisted bundledDependencies using bundledDependencies spelling', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['subpackage'],
    }),
    subpackage: {
      'package.json': JSON.stringify({
        name: 'subpackage',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          history: '1.0.0',
        },
        bundledDependencies: ['history'],
      }),
      'index.js': elfJS,
    },
    node_modules: {
      history: {
        'package.json': JSON.stringify({
          name: 'history',
          version: '1.0.0',
          main: 'index.js',
        }),
        'index.js': elfJS,
      },
      subpackage: t.fixture('symlink', '../subpackage'),
    },
  })

  const files = await packWorkspace(path.join(root, 'subpackage'), root)
  t.same(files, [
    'index.js',
    'node_modules/history/index.js',
    'node_modules/history/package.json',
    'package.json',
  ])
})

t.test('includes hoisted scoped bundledDependencies', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['subpackage'],
    }),
    subpackage: {
      'package.json': JSON.stringify({
        name: 'subpackage',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          '@npmwombat/history': '1.0.0',
        },
        bundleDependencies: ['@npmwombat/history'],
      }),
      'index.js': elfJS,
    },
    node_modules: {
      '@npmwombat': {
        history: {
          'package.json': JSON.stringify({
            name: '@npmwombat/history',
            version: '1.0.0',
            main: 'index.js',
          }),
          'index.js': elfJS,
        },
      },
      subpackage: t.fixture('symlink', '../subpackage'),
    },
  })

  const files = await packWorkspace(path.join(root, 'subpackage'), root)
  t.same(files, [
    'index.js',
    'node_modules/@npmwombat/history/index.js',
    'node_modules/@npmwombat/history/package.json',
    'package.json',
  ])
})

t.test('includes transitive hoisted deps of a bundled workspace dependency', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['packages/subpackage'],
    }),
    packages: {
      subpackage: {
        'package.json': JSON.stringify({
          name: 'subpackage',
          version: '1.0.0',
          main: 'index.js',
          dependencies: {
            history: '1.0.0',
          },
          bundleDependencies: ['history'],
        }),
        'index.js': elfJS,
      },
    },
    node_modules: {
      history: {
        'package.json': JSON.stringify({
          name: 'history',
          version: '1.0.0',
          main: 'index.js',
          dependencies: {
            minizlib: '1.0.0',
          },
        }),
        'index.js': elfJS,
      },
      minizlib: {
        'package.json': JSON.stringify({
          name: 'minizlib',
          version: '1.0.0',
          main: 'index.js',
        }),
        'index.js': elfJS,
      },
      subpackage: t.fixture('symlink', '../packages/subpackage'),
    },
  })

  const files = await packWorkspace(path.join(root, 'packages', 'subpackage'), root)
  t.same(files, [
    'index.js',
    'node_modules/history/index.js',
    'node_modules/history/node_modules/minizlib/index.js',
    'node_modules/history/node_modules/minizlib/package.json',
    'node_modules/history/package.json',
    'package.json',
  ])
})

t.test('includes another workspace package hoisted as a bundled dependency', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['packages/*'],
    }),
    packages: {
      app: {
        'package.json': JSON.stringify({
          name: 'app',
          version: '1.0.0',
          main: 'index.js',
          dependencies: {
            lib: '1.0.0',
          },
          bundleDependencies: ['lib'],
        }),
        'index.js': elfJS,
      },
      lib: {
        'package.json': JSON.stringify({
          name: 'lib',
          version: '1.0.0',
          main: 'index.js',
          files: ['index.js'],
        }),
        'index.js': elfJS,
        'secret.js': 'do not include',
      },
    },
    node_modules: {
      app: t.fixture('symlink', '../packages/app'),
      lib: t.fixture('symlink', '../packages/lib'),
    },
  })

  const files = await packWorkspace(path.join(root, 'packages', 'app'), root)
  t.same(files, [
    'index.js',
    'node_modules/lib/index.js',
    'node_modules/lib/package.json',
    'package.json',
  ])
})

t.test('skips a bundled dep that is not installed anywhere in the tree', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['subpackage'],
    }),
    subpackage: {
      'package.json': JSON.stringify({
        name: 'subpackage',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          history: '1.0.0',
        },
        bundleDependencies: ['history'],
      }),
      'index.js': elfJS,
    },
    node_modules: {
      subpackage: t.fixture('symlink', '../subpackage'),
    },
  })

  const files = await packWorkspace(path.join(root, 'subpackage'), root)
  t.same(files, [
    'index.js',
    'package.json',
  ])
})

t.test('still includes a bundled dep installed in the workspace node_modules', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['subpackage'],
    }),
    subpackage: {
      'package.json': JSON.stringify({
        name: 'subpackage',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          history: '1.0.0',
        },
        bundleDependencies: ['history'],
      }),
      'index.js': elfJS,
      node_modules: {
        history: {
          'package.json': JSON.stringify({
            name: 'history',
            version: '1.0.0',
            main: 'index.js',
          }),
          'index.js': elfJS,
        },
      },
    },
    node_modules: {
      subpackage: t.fixture('symlink', '../subpackage'),
    },
  })

  const files = await packWorkspace(path.join(root, 'subpackage'), root)
  t.same(files, [
    'index.js',
    'node_modules/history/index.js',
    'node_modules/history/package.json',
    'package.json',
  ])
})

t.test('includes cyclic hoisted bundled dependencies without looping', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['subpackage'],
    }),
    subpackage: {
      'package.json': JSON.stringify({
        name: 'subpackage',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          a: '1.0.0',
        },
        bundleDependencies: ['a'],
      }),
      'index.js': elfJS,
    },
    node_modules: {
      a: {
        'package.json': JSON.stringify({
          name: 'a',
          version: '1.0.0',
          main: 'index.js',
          dependencies: {
            b: '1.0.0',
          },
        }),
        'index.js': elfJS,
      },
      b: {
        'package.json': JSON.stringify({
          name: 'b',
          version: '1.0.0',
          main: 'index.js',
          dependencies: {
            a: '1.0.0',
          },
        }),
        'index.js': elfJS,
      },
      subpackage: t.fixture('symlink', '../subpackage'),
    },
  })

  const files = await packWorkspace(path.join(root, 'subpackage'), root)
  t.same(files, [
    'index.js',
    'node_modules/a/index.js',
    'node_modules/a/node_modules/b/index.js',
    'node_modules/a/node_modules/b/package.json',
    'node_modules/a/package.json',
    'package.json',
  ])
})

t.test('remaps a bundled dep whose path is the parent directory', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'parent',
      version: '1.0.0',
      main: 'p.js',
    }),
    'p.js': elfJS,
    pkg: {
      'package.json': JSON.stringify({
        name: 'pkg',
        version: '1.0.0',
        main: 'index.js',
        bundleDependencies: ['parent'],
      }),
      'index.js': elfJS,
    },
  })

  const pkgDir = path.join(root, 'pkg')
  const parentNode = {
    path: root,
    package: { name: 'parent', version: '1.0.0', main: 'p.js' },
    isLink: false,
    isProjectRoot: false,
    edgesOut: new Map(),
  }
  parentNode.target = parentNode
  const tree = {
    path: pkgDir,
    package: { name: 'pkg', version: '1.0.0', bundleDependencies: ['parent'] },
    isProjectRoot: true,
    edgesOut: new Map([['parent', { to: parentNode, peer: false, dev: false }]]),
    workspaces: null,
  }

  const files = await packlist(tree, { path: pkgDir })
  t.ok(files.includes('index.js'))
  t.ok(files.includes('package.json'))
  t.ok(files.includes('node_modules/parent/p.js'))
  t.ok(files.includes('node_modules/parent/package.json'))
  t.notOk(files.some((f) => f.startsWith('../')), 'does not emit paths that escape the package')
})

t.test('path-walks hoisted deps when a non-root tree has no edgesOut', async (t) => {
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['subpackage'],
    }),
    subpackage: {
      'package.json': JSON.stringify({
        name: 'subpackage',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          history: '1.0.0',
        },
        bundleDependencies: ['history'],
      }),
      'index.js': elfJS,
    },
    node_modules: {
      history: {
        'package.json': JSON.stringify({
          name: 'history',
          version: '1.0.0',
          main: 'index.js',
        }),
        'index.js': elfJS,
      },
    },
  })

  const workspacePath = path.join(root, 'subpackage')
  const tree = {
    path: workspacePath,
    package: {
      name: 'subpackage',
      version: '1.0.0',
      main: 'index.js',
      dependencies: { history: '1.0.0' },
      bundleDependencies: ['history'],
    },
    isProjectRoot: false,
    workspaces: null,
  }

  const files = await packlist(tree, {
    path: workspacePath,
    prefix: root,
    workspaces: [workspacePath],
  })
  t.same(files, [
    'index.js',
    'node_modules/history/index.js',
    'node_modules/history/package.json',
    'package.json',
  ])
})

t.test('skips peer and dev edges and nodes with no target', async (t) => {
  const root = t.testdir({
    pkg: {
      'package.json': JSON.stringify({
        name: 'pkg',
        version: '1.0.0',
        main: 'index.js',
        bundleDependencies: ['history', 'peerdep', 'devdep', 'broken'],
      }),
      'index.js': elfJS,
    },
    node_modules: {
      history: {
        'package.json': JSON.stringify({
          name: 'history',
          version: '1.0.0',
          main: 'index.js',
        }),
        'index.js': elfJS,
      },
      peerdep: {
        'package.json': JSON.stringify({
          name: 'peerdep',
          version: '1.0.0',
        }),
        'index.js': elfJS,
      },
      devdep: {
        'package.json': JSON.stringify({
          name: 'devdep',
          version: '1.0.0',
        }),
        'index.js': elfJS,
      },
    },
  })

  const pkgDir = path.join(root, 'pkg')
  const historyPath = path.join(root, 'node_modules', 'history')
  const historyNode = {
    path: historyPath,
    package: { name: 'history', version: '1.0.0', main: 'index.js' },
    isLink: false,
    isProjectRoot: false,
    edgesOut: new Map(),
  }
  historyNode.target = historyNode

  const tree = {
    path: pkgDir,
    package: {
      name: 'pkg',
      version: '1.0.0',
      bundleDependencies: ['history', 'peerdep', 'devdep', 'broken'],
    },
    isProjectRoot: true,
    edgesOut: new Map([
      ['history', { to: historyNode, peer: false, dev: false }],
      ['peerdep', { to: { path: path.join(root, 'node_modules', 'peerdep'), target: null }, peer: true, dev: false }],
      ['devdep', { to: { path: path.join(root, 'node_modules', 'devdep'), target: null }, peer: false, dev: true }],
      ['broken', { to: { path: historyPath, isLink: false, target: null }, peer: false, dev: false }],
    ]),
    workspaces: null,
  }

  const files = await packlist(tree, { path: pkgDir })
  t.same(files, [
    'index.js',
    'node_modules/history/index.js',
    'node_modules/history/package.json',
    'package.json',
  ])
})

t.test('remaps hoisted bundled deps when Arborist already resolved the edge', async (t) => {
  // loading the workspace from the monorepo root finds the hoisted node, but
  // node.path is outside the workspace directory. those files must still land
  // under node_modules/<name> in the pack list, not ../../node_modules/...
  const root = t.testdir({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      version: '1.0.0',
      workspaces: ['subpackage'],
    }),
    subpackage: {
      'package.json': JSON.stringify({
        name: 'subpackage',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          history: '1.0.0',
        },
        bundleDependencies: ['history'],
      }),
      'index.js': elfJS,
    },
    node_modules: {
      history: {
        'package.json': JSON.stringify({
          name: 'history',
          version: '1.0.0',
          main: 'index.js',
        }),
        'index.js': elfJS,
      },
      subpackage: t.fixture('symlink', '../subpackage'),
    },
  })

  const workspacePath = path.join(root, 'subpackage')
  const arborist = new Arborist({ path: root })
  const tree = await arborist.loadActual()
  const workspace = [...tree.inventory.values()].find((n) => n.path === workspacePath)
  t.ok(workspace, 'found workspace node in root tree')
  const files = await packlist(workspace, {
    path: workspacePath,
    prefix: root,
    workspaces: [workspacePath],
  })
  t.same(files, [
    'index.js',
    'node_modules/history/index.js',
    'node_modules/history/package.json',
    'package.json',
  ])
})
