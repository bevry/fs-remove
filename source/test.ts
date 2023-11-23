// builtin
import { tmpdir } from 'os'
import { join } from 'path'

// external
import { equal, deepEqual } from 'assert-helpers'
import kava from 'kava'
import write from '@bevry/fs-write'
import { isAccessible } from '@bevry/fs-accessible'
import promiseErrback from 'promise-errback'

// local
import remove from './index.js'

kava.suite('@bevry/fs-remove', function (suite, test) {
	test('works as expected', function (done) {
		promiseErrback(
			Promise.resolve().then(async function () {
				// prepare the paths
				const root = join(tmpdir(), `bevry-fs-remove-${Math.random()}`)
				const dir1 = join(root, 'dir1')
				const dir2 = join(root, 'dir2')
				const file1 = join(dir1, 'nested1', 'file1.txt')
				const file2 = join(dir2, 'nested2', 'file2.txt')
				const data1 = String(Math.random())
				const data2 = String(Math.random())

				// create the paths
				await write(file1, data1)
				await write(file2, data2)
				deepEqual(
					await isAccessible([file1, file2]),
					[true, true],
					'is present when it is present'
				)

				// remove the paths
				await remove([file1, dir2])
				deepEqual(
					await isAccessible([file1, dir1, file2, dir2]),
					[false, true, false, false],
					'removals were as expected'
				)
			}),
			done
		)
	})
})
