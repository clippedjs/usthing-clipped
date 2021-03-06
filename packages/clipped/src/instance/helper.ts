import * as path from 'path'
import * as fs from 'fs-extra'
import * as childProcess from 'child_process';
import {castArray, merge, isPlainObject, isFunction} from 'lodash'
import * as fsEditor from 'mem-fs-editor'
import * as memFs from 'mem-fs'
import * as prompt from 'prompts'
import * as yarnInstall from 'yarn-install'

import {Clipped} from '.'
import {cloneRepo, exec, toArgs, spawn} from '../utils'

declare module '.' {
  interface Clipped {
    fs: {
      copy(opt: {src: string, dest: string} | {src: string, dest: string}[]): Promise<void>,  // eslint-disable-line no-undef, typescript/no-use-before-define
      remove(opt: {path: string} | {path: string}[]): Promise<void>,  // eslint-disable-line no-undef, typescript/no-use-before-define
      move(opt: {src: string, dest: string, opt?: any} | {src: string, dest: string, opt?: any}[]): Promise<void>,  // eslint-disable-line no-undef, typescript/no-use-before-define
      mkdir(opt: {path: string} | {path: string}[]): Promise<void>,  // eslint-disable-line no-undef, typescript/no-use-before-define
      emptydir(opt: {path: string} | {path: string}[]): Promise<void>,  // eslint-disable-line no-undef, typescript/no-use-before-define
      copyTpl(opt: {src: string, dest: string, context?: any, tplOptions?: any, options?: any, opt?: any} | {src: string, dest: string, context?: any, tplOptions?: any, options?: any, opt?: any}[]): Promise<void>,  // eslint-disable-line no-undef, typescript/no-use-before-define
    }

    exec(cmd: string, opt?: object): Promise<any>; // eslint-disable-line no-undef, typescript/no-use-before-define
    spawn(cmd: string, args?: any[], opt?: childProcess.SpawnOptions): Promise<any>; // eslint-disable-line no-undef, typescript/no-use-before-define
    print(...msg: any[]): void; // eslint-disable-line no-undef, typescript/no-use-before-define
    prompt: prompts,
    editPkg(mutator: Object | Function): Promise<any>
    install(deps: string[], opt?: any): Promise<any>
  }
}

/**
 * ResolvePath - Resolve path from cwd
 *
 * @export
 * @param {Clipped} this
 * @param {...string[]} dirs
 * @returns {string}
 */
export function resolvePath(this: Clipped, ...dirs: string[]): string {
  return path.join((this && this.config && this.config.context) || process.cwd(), ...dirs)
}

// Filesystem manipulations
function operations(callback: Function): (s: any) => Promise<any> {
  return async function (operations: Object | Object[]) {
    await Promise.all(castArray(operations).map(
      operation => callback(operation)
    ))
  }
}

const fsOperations = {
  copy: operations(({src, dest}: {src: string, dest: string}) => fs.copy(src, dest)),
  remove: operations(({path}: {path: string}) => fs.remove(path)),
  move: operations(({src, dest, opt = {}}: {src: string, dest: string, opt: any}) => fs.move(src, dest, opt)),
  mkdir: operations(({path}: {path: string}) => fs.ensureDir(path)),
  emptydir: operations(({path}: {path: string}) => fs.emptyDir(path)),
  copyTpl: operations(
    ({src, dest, context, tplOptions = {}, options = {}, opt = {}}: {src: string, dest: string, context: any, tplOptions: any, options: any, opt: any}) =>
      new Promise(resolve => {
        const editor = fsEditor.create(memFs.create())
        editor.copyTpl(src, dest, context, tplOptions, {...options, ...opt})
        editor.commit(resolve)
      })
  )
}


/**
 * installDeps - install dependencies
 *
 * @param {Clipped} this
 * @param {string[]} deps
 * @param {*} opt
 * @returns
 */
function installDeps (this: Clipped, deps: string[], opt: any = {}) {
  return yarnInstall({
    cwd: this.config.context,
    deps,
    ...opt
  })
}

/**
 * editPkg - writes to pacakge.json
 *
 * @param {Clipped} this
 * @param {(Object | Function)} mutator
 * @returns Promise<any>
 */
function editPkg(this: Clipped, mutator: Object | Function): Promise<any> {
  if (isPlainObject(mutator)) {
    merge(this.config.packageJson, mutator)
  } else if (isFunction(mutator)) {
    mutator(this.config.packageJson)
  }
  return require('write-pkg')(this.config.context, this.config.packageJson.toConfig())
}

const logger = console

export function initHelper(clipped: typeof Clipped): void {
  clipped.prototype.resolve = resolvePath

  clipped.prototype.clone = cloneRepo

  clipped.prototype.exec = exec
  clipped.prototype.spawn = spawn

  clipped.prototype.toArgs = toArgs

  clipped.prototype.fs = fsOperations

  clipped.prototype.logger = logger

  clipped.prototype.log = logger.log

  clipped.prototype.print = console.log

  clipped.prototype.prompt = prompt

  clipped.prototype.editPkg = editPkg

  clipped.prototype.install = installDeps

  Object.assign(clipped.prototype, clipped.prototype.fs)
}
