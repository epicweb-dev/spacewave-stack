import type { DataFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Form, useCatch, useLoaderData, useParams } from '@remix-run/react'
import invariant from 'tiny-invariant'
import { prisma } from '~/utils/db.server'
import { getUserImgSrc, useOptionalUser } from '~/utils/misc'

export async function loader({ params }: DataFunctionArgs) {
	invariant(params.username, 'Missing username')
	const user = await prisma.user.findUnique({
		where: { username: params.username },
		select: {
			id: true,
			username: true,
			name: true,
			imageId: true,
			createdAt: true,
		},
	})
	if (!user) {
		throw new Response('not found', { status: 404 })
	}
	return json({ user })
}

export default function UserRoute() {
	const data = useLoaderData<typeof loader>()
	const loggedInUser = useOptionalUser()
	const isOwnProfile = loggedInUser?.id === data.user.id

	return (
		<div>
			<h1>{data.user.name ?? data.user.username}</h1>
			{isOwnProfile ? (
				<>
					<Form action="/logout" method="post">
						<button className="flex items-center justify-center rounded-md bg-blue-500 px-4 py-3 font-medium text-white hover:bg-blue-600">
							Logout of {loggedInUser.name}
						</button>
					</Form>
				</>
			) : null}
			{data.user.imageId ? (
				<img
					src={getUserImgSrc(data.user.imageId)}
					alt={data.user.name ?? data.user.username}
				/>
			) : null}
		</div>
	)
}

export function CatchBoundary() {
	const caught = useCatch()
	const params = useParams()

	if (caught.status === 404) {
		return <div>User "{params.username}" not found</div>
	}

	throw new Error(`Unexpected caught response with status: ${caught.status}`)
}

export function ErrorBoundary({ error }: { error: Error }) {
	console.error(error)

	return <div>An unexpected error occurred: {error.message}</div>
}
