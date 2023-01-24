require('dotenv/config')

if (process.env.MOCKS === 'true') {
	require('./mocks/index.ts')
}

if (process.env.NODE_ENV === 'production') {
	require('./server-build')
} else {
	require('./server')
}
