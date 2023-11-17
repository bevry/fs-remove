// builtin
import {
	stat as _stat,
	rm as _rm,
	unlink as _unlink,
	readdir as _readdir,
} from 'fs'
import { exec } from 'child_process'
import { versions } from 'process'
const nodeVersion = String(versions.node || '0')

// external
import accessible, { W_OK } from '@bevry/fs-accessible'
import Errlop from 'errlop'
import versionCompare from 'version-compare'

/** Remove a file or directory. */
export default async function remove(
	path: string | Array<string>
): Promise<void> {
	if (Array.isArray(path)) {
		return Promise.all(path.map((i) => remove(i))).then(() => {})
	}

	// sanity check
	if (path === '' || path === '/') {
		throw new Error('will not remove root directory')
	}

	// check exists
	try {
		await accessible(path)
	} catch (err: any) {
		// if it doesn't exist, then we don't care
		return
	}

	// check writable
	try {
		await accessible(path, W_OK)
	} catch (err: any) {
		if (err.code === 'ENOENT') {
			// if it doesn't exist, then we don't care (this may not seem necessary due to the earlier accessible check, however it is necessary, testen would fail on @bevry/json otherwise)
			return
		}
		throw new Errlop(`unable to remove the non-writable path: ${path}`, err)
	}

	// attempt removal
	return new Promise(function (resolve, reject) {
		function next(err: any) {
			if (err && err.code === 'ENOENT') return resolve()
			if (err) {
				return reject(
					new Errlop(
						`failed to remove the accessible and writable path: ${path}`,
						err
					)
				)
			}
			return resolve()
		}

		// modern versions have a command that works on files and directories
		if (versionCompare(nodeVersion, '14.14.0') >= 0) {
			// use rm builtin via dynamic import (necessary as older versions will fail as you can't import something that doesn't exist
			import('fs').then(function ({ rm: _rm }) {
				_rm(path, { recursive: true, force: true, maxRetries: 10 }, next)
			})
			return
		}

		// older versions require a different command for files and directories, so determine which it is
		_stat(path, function (err, stat) {
			if (err) return next(err)
			const isDirectory = stat.isDirectory()

			// is file
			if (!isDirectory) {
				_unlink(path, next)
				return
			}

			// is directory
			if (
				versionCompare(nodeVersion, '12.16.0') >= 0 &&
				versionCompare(nodeVersion, '16') < 0
			) {
				// use rmdir builtin via dynamic import (necessary as older versions will fail as you can't import something that doesn't exist
				import('fs').then(function ({ rmdir: _rmdir }) {
					_rmdir(path, { recursive: true, maxRetries: 10 }, next)
				})
			} else if (
				versionCompare(nodeVersion, '12.10.0') >= 0 &&
				versionCompare(nodeVersion, '12.16.0') < 0
			) {
				// use rmdir builtin via dynamic import (necessary as older versions will fail as you can't import something that doesn't exist
				import('fs').then(function ({ rmdir: _rmdir }) {
					// as any is to workaround that type definition is only for the latest version
					_rmdir(path, { recursive: true, maxBusyTries: 10 } as any, next)
				})
			} else {
				// no builtin option exists, so use workaround
				exec(`rm -rf ${JSON.stringify(path)}`, next)
			}
		})
	})
}
