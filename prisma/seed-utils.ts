import type * as P from '@prisma/client'
import { faker } from '@faker-js/faker'
import bcrypt from 'bcryptjs'
import { type PrismaClient } from '@prisma/client'

export async function downloadFile(url: string) {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Failed to fetch image with status ${response.status}`)
	}
	const blob = Buffer.from(await response.arrayBuffer())
	return blob
}

export function createPassword(username: string = faker.internet.userName()) {
	return {
		hash: bcrypt.hashSync(username.toUpperCase(), 10),
	}
}

export function createUser({
	gender = faker.helpers.arrayElement(['female', 'male']) as 'female' | 'male',
}: {
	gender?: 'male' | 'female'
} = {}): Omit<P.User, 'id' | 'createdAt' | 'updatedAt' | 'imageId'> {
	const firstName = faker.name.firstName(gender)
	const lastName = faker.name.lastName()

	const username = faker.helpers.unique(faker.internet.userName, [
		firstName.toLowerCase(),
		lastName.toLowerCase(),
	])
	return {
		username,
		name: `${firstName} ${lastName}`,
		email: `${username}@example.com`,
	}
}

export const oneDay = 1000 * 60 * 60 * 24
export function createDateRange({
	start,
	end,
	maxDays,
}: {
	start: Date
	end: Date
	maxDays: number
}) {
	const randomStart = faker.date.between(start, end.getTime() - oneDay * 2)
	const endStartRange = randomStart.getTime() + oneDay
	const endEndRange = Math.min(endStartRange + oneDay * maxDays, end.getTime())
	return {
		startDate: randomStart,
		endDate: faker.date.between(endStartRange, endEndRange),
	}
}

export const lockifyFakerImage = (imageUrl: string) =>
	imageUrl.replace(/\?(\d+)/, '?lock=$1')

export async function insertImage(prisma: PrismaClient, imageUrl: string) {
	const image = await prisma.image.create({
		data: {
			contentType: 'image/jpeg',
			file: {
				create: {
					blob: await downloadFile(lockifyFakerImage(imageUrl)),
				},
			},
		},
		select: { fileId: true },
	})
	return image.fileId
}
