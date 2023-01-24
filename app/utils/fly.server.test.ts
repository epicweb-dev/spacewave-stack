import { type SpyInstance, vi } from 'vitest'
import fsExtra from 'fs-extra'
import path from 'path'
import os from 'os'
import { ensurePrimary } from './fly.server'
import invariant from 'tiny-invariant'

const envVars = ['FLY', 'FLY_LITEFS_DIR', 'FLY_REGION'].reduce(
	(acc, key) => ({
		...acc,
		[key]: process.env[key],
	}),
	{} as Record<string, string | undefined>,
)

let tempDir: string

beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {})
	tempDir = path.join(os.tmpdir(), Math.random().toString(36).slice(2))
	vi.resetModules()
})

afterEach(async () => {
	await fsExtra.remove(tempDir)
	;(console.log as unknown as SpyInstance).mockRestore()
	Object.entries(envVars).forEach(([key, value]) => {
		process.env[key] = value
	})
})

test('ensurePrimary throws a fly-replay response to the primary instance when not the primary', async () => {
	process.env.FLY = 'true'
	process.env.FLY_LITEFS_DIR = path.join(tempDir, 'litefs')
	process.env.FLY_REGION = 'test'
	const primary = Math.random().toString(36).slice(2)
	await fsExtra.ensureDir(process.env.FLY_LITEFS_DIR)
	await fsExtra.writeFile(
		path.join(process.env.FLY_LITEFS_DIR, '.primary'),
		primary,
	)
	const response = await ensurePrimary().catch(response => response)
	invariant(response instanceof Response, 'response is not a Response')
	expect(response.status).toBe(409)
	expect(response.headers.get('fly-replay')).toBe(`instance=${primary}`)
})

test('ensurePrimary does nothing when running on the primary', async () => {
	const hostname = os.hostname()
	process.env.FLY = 'true'
	process.env.FLY_LITEFS_DIR = path.join(tempDir, 'litefs')
	process.env.FLY_REGION = 'test'
	await fsExtra.ensureDir(process.env.FLY_LITEFS_DIR)
	await fsExtra.writeFile(
		path.join(process.env.FLY_LITEFS_DIR, '.primary'),
		hostname,
	)
	await ensurePrimary()
})
