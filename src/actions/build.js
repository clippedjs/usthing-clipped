// @flow
const fs = require('fs')
const minimist = require('minimist')
const {cwd, resolvePath} = require('../utils')
const {ncp, rimraf, mkdirp} = require('../utils/file-manipulation')
const {spawnFactory} = require('../utils/process-spawn')
const {dockerImageFactory} = require('../utils/docker')
const {getConfig, getClipPath} = require('./config')

/**
 * docker - Builds docker image from dist folder
 *
 * @async
 * @param {clippedConfig} [config={}]
 * @returns {Promise<void>}
 */
async function docker (config: clippedConfig = getConfig()) {
  const srcDockerImage: string = await getClipPath(config.type, 'docker-image')
  const dockerImageDest: string = resolvePath('dist', cwd)

  console.log('> Preparing Dockerfile')
  await ncp(srcDockerImage, dockerImageDest)

  console.log('> Start building image')
  const files = fs.readdirSync(dockerImageDest)
  // const tarStream = tar.pack(resolvePath('dist', cwd))
  await dockerImageFactory(
    // tarStream,
    {
      context: resolvePath('dist', cwd),
      src: files
    },
    {
      // NOTE: dockerode does not seem to support custom dockerfile in options?
      // f: srcDockerfile,
      t: config.name
    }
  )
}

/**
 * native - Builds dist folder from src folder
 *
 * @async
 * @param {clippedConfig} [config={}]
 * @returns {Promise<void>}
 */
async function native (config: clippedConfig = getConfig()) {
  await rimraf(resolvePath('./dist', cwd))
  await mkdirp(resolvePath('./dist', cwd))

  const wrapperPath = await getClipPath(config.type, 'wrapper')
  await spawnFactory('npm', ['install', '--prefix', wrapperPath])
  await spawnFactory(
    'npm',
    ['run', 'build', '--prefix', wrapperPath, '--', `--env.clippedTarget=${cwd}`],
    {stdio: 'inherit', 'NODE_ENV': 'production'}
  )
}

async function build (config: clippedConfig = getConfig()) {
  const argv: Object = minimist(process.argv, {default: {platform: 'native'}})
  // Make sure each platform only build once
  const platforms: Array<string> = [...new Set([].concat(argv['platform']))]
  await Promise.all(
    platforms.map(async (platform: string) => {
      switch (platform) {
        case 'docker':
          await native(config)
          await docker(config)
          break
        case 'native':
          await native(config)
          break
        default:
      }
    })
  )
}

if (!module.parent) {
  try {
    build()
  } catch (e) {
    console.error(e)
    process.exit(e)
  }
}

module.exports = build