import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { spawn } from 'child_process'
import inquirer from 'inquirer'
import which from 'which'
import { replaceInFile } from 'replace-in-file'

const here = (...s: Array<string>) => path.join(__dirname, ...s)
const getRandomString = (length: number) =>
	crypto.randomBytes(length).toString('hex')

export default async function init() {
	const rootDir = here('..')
	const DIR_NAME = path.basename(rootDir)
	const SUFFIX = getRandomString(2)
	const { appName, flyAppName, emailAddress } = await inquirer.prompt([
		{
			type: 'input',
			name: 'appName',
			message: 'What is the name of your app (what you display to users)?',
			default: DIR_NAME,
		},
		{
			type: 'input',
			name: 'flyAppName',
			message: 'What is the name of your app (what you use to deploy)?',
			default: (DIR_NAME + '-' + SUFFIX)
				// get rid of anything that's not allowed in an app name
				.replace(/[^a-zA-Z0-9-_]/g, '-'),
		},
		{
			type: 'input',
			name: 'emailAddress',
			message: `What email should we use for sending emails from this app?`,
			default: `hello@example.com`,
		},
	])
	const { default: ora } = await import('ora')

	let spinner = ora('Replacing names').start()
	const filesToReplace = [
		here('..', 'fly.toml'),
		here('..', 'package.json'),
		here('..', 'README.md'),
		here('..', 'app/**/*.*'),
		here('..', 'test/**/*.*'),
		here('..', 'tests/**/*.*'),
	]
	await Promise.all([
		replaceInFile({
			files: filesToReplace,
			from: 'REPLACE_WITH_APP_NAME',
			to: appName,
		}),
		replaceInFile({
			files: filesToReplace,
			from: 'spacewave-stack',
			to: flyAppName,
		}),
		replaceInFile({
			files: filesToReplace,
			from: 'hello@example.com',
			to: emailAddress,
		}),
	])
	spinner.succeed('Replaced names')

	spinner = ora('🏃‍♀️  Running setup').start()
	await fs.promises.copyFile(
		path.join(rootDir, '.env.example'),
		path.join(rootDir, '.env'),
	)
	await exec('npm run setup', { cwd: rootDir })
	spinner.succeed('✅  Setup complete')

	spinner = ora('🏃‍♀️  Installing E2E Deps').start()
	await exec('npm run test:e2e:install', { cwd: rootDir })
	spinner.succeed('✅  Installed E2E Deps')

	spinner = ora('🏃‍♀️  Running validate script').start()
	await exec('npm run validate', { cwd: rootDir })
	spinner.succeed('✅  Validate script complete')

	const flyIsInstalled = which.sync('fly', { nothrow: true })
	const flyIsLoggedIn =
		flyIsInstalled &&
		(await exec('fly auth whoami', { cwd: rootDir, stdio: 'ignore' }).then(
			() => true,
			() => false,
		))

	const todos = [
		flyIsInstalled
			? null
			: 'Install Fly: https://fly.io/docs/hands-on/install-flyctl/',
		flyIsLoggedIn
			? null
			: 'Login to Fly: https://fly.io/docs/hands-on/sign-up/',
		`Sign up for mailgun: https://signup.mailgun.com/new/signup`,
		`Create your Mailgun domain and Mailgun sending key and hang onto that: https://help.mailgun.com/hc/en-us/articles/203380100-Where-can-I-find-my-API-key-and-SMTP-credentials-`,
		`Create apps for production/staging:\n    fly apps create ${flyAppName}\n    fly apps create ${flyAppName}-staging`,
		`Create app secrets for production/staging:\n    fly secrets set SESSION_SECRET=$(openssl rand -hex 32) ENCRYPTION_SECRET=$(openssl rand -hex 32) MAILGUN_DOMAIN=<YOUR_MAILGUN_DOMAIN> MAILGUN_SENDING_KEY=<YOUR_MAILGUN_MAILGUN_SENDING_KEY> --app ${flyAppName}\n    fly secrets set SESSION_SECRET=$(openssl rand -hex 32) ENCRYPTION_SECRET=$(openssl rand -hex 32) MAILGUN_DOMAIN=<YOUR_MAILGUN_DOMAIN> MAILGUN_SENDING_KEY=<YOUR_MAILGUN_MAILGUN_SENDING_KEY> --app ${flyAppName}-staging`,
		`Create volumes for production/staging:\n    fly volumes create data --size 1 --app ${flyAppName}\n    fly volumes create data --size 1 --app ${flyAppName}-staging`,
		`Create a GitHub repo for your app: https://repo.new/`,
		`Add FLY_API_TOKEN to your GitHub repo secrets (https://docs.github.com/en/actions/security-guides/encrypted-secrets):\n    https://web.fly.io/user/personal_access_tokens/new`,
		`Commit and push your code to GitHub:\n    git add .\n    git commit -m "Initial commit"\n    git remote add origin <ORIGIN_URL>\n    git push -u origin master`,
		`Setup custom domain on fly:\n    https://fly.io/apps/${flyAppName}/certificates`,
	]
		.filter(Boolean)
		.join('\n- ')

	console.log(
		`
Great! Now here's your TODO list:
${todos}

Happy shipping! 🚀
	`.trim(),
	)
}

init()

async function exec(
	command: string,
	{
		cwd,
		stdio = 'inherit',
	}: { cwd?: string; stdio?: 'ignore' | 'inherit' } = {},
) {
	const child = spawn(command, { shell: true, stdio, cwd })
	await new Promise((res, rej) => {
		child.on('exit', code => {
			if (code === 0) {
				res(code)
			} else {
				rej(code)
			}
		})
	})
}
