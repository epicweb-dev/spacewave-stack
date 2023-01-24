import {
	json,
	redirect,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
	type DataFunctionArgs,
} from '@remix-run/node'
import {
	Form,
	useActionData,
	useFormAction,
	useLoaderData,
	useNavigation,
} from '@remix-run/react'
import { useEffect, useRef } from 'react'
import { z } from 'zod'
import { authenticator, requireUserId } from '~/utils/auth.server'
import { prisma } from '~/utils/db.server'
import { getFieldsFromSchema, preprocessFormData, useForm } from '~/utils/forms'
import { getUserImgSrc } from '~/utils/misc'
import {
	emailSchema,
	nameSchema,
	usernameSchema,
} from '~/utils/user-validation'

const MAX_SIZE = 1024 * 1024 * 5 // 5MB

const ProfileFormSchema = z.object({
	profileFile: z.instanceof(File).optional(),
	name: nameSchema.optional(),
	username: usernameSchema.optional(),
	email: emailSchema.optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	zip: z.string().optional(),
	country: z.string().optional(),
})

export async function loader({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			username: true,
			email: true,
			imageId: true,
		},
	})
	if (!user) {
		await authenticator.logout(request, { redirectTo: '/' })
		return redirect('/') // this is just here for types...
	}
	return json({ user, fieldMetadatas: getFieldsFromSchema(ProfileFormSchema) })
}

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const contentLength = Number(request.headers.get('Content-Length'))
	if (
		contentLength &&
		Number.isFinite(contentLength) &&
		contentLength > MAX_SIZE
	) {
		return json(
			{
				status: 'error',
				errors: {
					formErrors: [],
					fieldErrors: { profileFile: ['File too large'] },
				},
			} as const,
			{ status: 400 },
		)
	}
	const formData = await unstable_parseMultipartFormData(
		request,
		unstable_createMemoryUploadHandler({ maxPartSize: MAX_SIZE }),
	)
	const result = ProfileFormSchema.safeParse(
		preprocessFormData(formData, ProfileFormSchema),
	)

	if (!result.success) {
		return json({ status: 'error', errors: result.error.flatten() } as const, {
			status: 400,
		})
	}

	const { profileFile, name, username, email } = result.data
	const hasProfileFile = profileFile?.size && profileFile.size > 0

	if (email) {
		// TODO: send a confirmation email
	}

	async function getImageInsert() {
		if (!hasProfileFile) return undefined

		const newPrismaPhoto = {
			contentType: profileFile.type,
			file: {
				create: {
					blob: Buffer.from(await profileFile.arrayBuffer()),
				},
			},
		}
		return {
			upsert: {
				create: newPrismaPhoto,
				update: newPrismaPhoto,
			},
		}
	}

	const previousUserPhoto = hasProfileFile
		? await prisma.user.findUnique({
				where: { id: userId },
				select: { imageId: true },
		  })
		: undefined

	await prisma.user.update({
		select: { id: true },
		where: { id: userId },
		data: {
			name,
			username,
			image: await getImageInsert(),
		},
	})

	if (previousUserPhoto?.imageId) {
		void prisma.image
			.delete({
				where: { fileId: previousUserPhoto.imageId },
			})
			.catch(() => {}) // ignore the error, maybe it never existed?
	}

	return json({ status: 'success' } as const)
}

const labelClassName = 'block text-sm font-medium text-gray-700'
const inputClassName = 'w-full rounded border border-gray-500 px-2 py-1 text-lg'
const fieldClassName = 'flex gap-1 flex-col'

function usePreviousValue<Value>(value: Value): Value {
	const ref = useRef<Value>(value)
	useEffect(() => {
		ref.current = value
	}, [value])
	return ref.current
}

export default function EditUserProfile() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const formRef = useRef<HTMLFormElement>(null)
	const navigation = useNavigation()
	const formAction = useFormAction()

	const prevNav = usePreviousValue(navigation)
	const wasSubmitting =
		prevNav.state === 'submitting' &&
		prevNav.formAction === formAction &&
		prevNav.formMethod === 'post'
	const isSubmitting =
		navigation.state === 'submitting' &&
		navigation.formAction === formAction &&
		navigation.formMethod === 'post'

	const wasSubmittingButIsNoLonger = wasSubmitting && !isSubmitting

	useEffect(() => {
		if (!formRef.current) return
		if (!wasSubmittingButIsNoLonger) return
		if (actionData?.status !== 'success') return
		formRef.current.reset()
	}, [actionData?.status, wasSubmittingButIsNoLonger])

	const { form, fields } = useForm({
		name: 'edit-profile',
		errors: actionData?.status === 'error' ? actionData.errors : null,
		fieldMetadatas: data.fieldMetadatas,
	})

	return (
		<div className="container m-auto">
			<Form
				method="post"
				className="flex flex-col gap-4"
				encType="multipart/form-data"
				{...form.props}
			>
				<div className={fieldClassName}>
					<img
						src={getUserImgSrc(data.user.imageId)}
						alt={data.user.username}
						className="h-24 w-24 rounded-full object-cover"
					/>
					<label className={labelClassName} {...fields.profileFile.labelProps}>
						Change your Profile Photo
					</label>
					<input
						className={inputClassName}
						{...fields.profileFile.props}
						type="file"
					/>
					{fields.profileFile.errorUI}
				</div>
				<div className={fieldClassName}>
					<label className={labelClassName} {...fields.username.labelProps}>
						Username
					</label>
					<input
						className={inputClassName}
						defaultValue={data.user.username}
						{...fields.username.props}
					/>
					{fields.username.errorUI}
				</div>
				<div className={fieldClassName}>
					<label className={labelClassName} {...fields.name.labelProps}>
						Name
					</label>
					<input
						className={inputClassName}
						defaultValue={data.user.name ?? ''}
						{...fields.name.props}
					/>
					{fields.name.errorUI}
				</div>
				<div className={fieldClassName}>
					<label className={labelClassName} {...fields.email.labelProps}>
						Email
					</label>
					<input
						className={inputClassName}
						defaultValue={data.user.email ?? ''}
						{...fields.email.props}
					/>
					{fields.email.errorUI}
				</div>

				{form.errorUI}

				<div>
					<button
						type="submit"
						className="flex items-center justify-center rounded-md bg-blue-500 px-4 py-3 font-medium text-white hover:bg-blue-600"
					>
						Submit
					</button>
				</div>
			</Form>
		</div>
	)
}
