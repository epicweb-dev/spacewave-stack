import { faker } from '@faker-js/faker'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createPassword, createUser, downloadFile } from './seed-utils'

const prisma = new PrismaClient()

async function seed() {
	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	console.time('🧹 Cleaned up the database...')
	await prisma.user.deleteMany({ where: {} })
	console.timeEnd('🧹 Cleaned up the database...')

	const totalUsers = Math.floor(100)
	console.time(`👤 Created ${totalUsers} users...`)
	const users = await Promise.all(
		Array.from({ length: totalUsers }, async () => {
			const gender = faker.helpers.arrayElement(['female', 'male']) as
				| 'female'
				| 'male'
			const userData = createUser({ gender })
			const imageGender = gender === 'female' ? 'women' : 'men'
			const imageNumber = faker.datatype.number({ min: 0, max: 99 })
			const user = await prisma.user.create({
				data: {
					...userData,
					password: {
						create: createPassword(userData.username),
					},
					image: {
						create: {
							contentType: 'image/jpeg',
							file: {
								create: {
									blob: await downloadFile(
										`https://randomuser.me/api/portraits/${imageGender}/${imageNumber}.jpg`,
									),
								},
							},
						},
					},
				},
			})
			return user
		}),
	)
	console.timeEnd(`👤 Created ${totalUsers} users...`)

	const kodyUser = createUser()

	await prisma.user.create({
		data: {
			email: 'kody@kcd.dev',
			username: 'kody',
			name: 'Kody',
			image: {
				create: {
					contentType: 'image/png',
					file: {
						create: {
							blob: await downloadFile(
								`https://res.cloudinary.com/kentcdodds-com/image/upload/kentcdodds.com/misc/kody.png`,
							),
						},
					},
				},
			},
			password: {
				create: {
					hash: await bcrypt.hash('kodylovesyou', 10),
				},
			},
		},
	})

	console.timeEnd(`🌱 Database has been seeded`)
}

seed()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})

/*
eslint
	@typescript-eslint/no-unused-vars: "off",
*/
