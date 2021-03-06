const path = require('path');
const { existsSync } = require('fs');
const MultiEntryPlugin = require('webpack/lib/MultiEntryPlugin');
const { getMaterials } = require('../utils');
const getMaterialLists = require('../getMaterialLists');
const { getMaterialList } = require('../utils')
const cwd = process.cwd();
const webpackHotClient = require.resolve('webpack-hot-client/client');
const cachedChunks = {};
let watchingHandler;
let warned = false;
function warnOnce(msg) {
  if (!warned) {
    console.log('[WARN]', msg);
    warned = true;
  }
}

module.exports = async (ctx) => {
  const { params } = ctx;
  const { blockName, material } = params;
  if (!blockName) {
    return ctx.render('403.hbs');
  }

  const materials = getMaterials(cwd);
  let type;
  try {
    type = materials[material].type;
  } catch (err) {
    warnOnce('使用默认物料类型 react');
    type = 'react';
  }

  const currentMaterial = material;
  const entryPath = path.resolve(
    cwd,
    currentMaterial,
    'blocks',
    params.blockName,
    'src/index.js'
  );

  if (!existsSync(entryPath)) {
    return ctx.render('404.hbs');
  }

  const chunkName = currentMaterial + '/' + params.blockName;
  if (!(chunkName in cachedChunks)) {
    ctx.compiler.running = false;
    ctx.compiler.apply(
      new MultiEntryPlugin(cwd, [webpackHotClient, entryPath], chunkName)
    );
    // wait until bundle ok
    await new Promise((resolve, reject) => {
      const watchOpts = {
        aggregateTimeout: 20,
      };
      if (watchingHandler) {
        watchingHandler.close(() => {
          watchingHandler = ctx.compiler.watch(watchOpts, handler);
        });
      } else {
        watchingHandler = ctx.compiler.watch(watchOpts, handler);
      }

      function handler(err, stats) {
        if (err) {
          resolve(err);
        } else {
          cachedChunks[chunkName] = [entryPath];
          resolve();
        }
      }
    });
    ctx.compiler.running = true;
  }

  const materialList = getMaterialList(material);

  const state = {
    layoutJS: '/DEMOLAYOUT.js',
    blockJS: `/${chunkName}.js`,
    blockName: `${chunkName}`,
    isReact: type === 'react',
    isVue: type === 'vue',
    blocks: materialList.blocks,
    layouts: materialList.layouts,
    isBlock: true
  };
  return ctx.render('block.hbs', state);
};
