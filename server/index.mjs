import app from './app.mjs'

const PORT = Number(process.env.PORT ?? 3001)

app.listen(PORT, () => {
  console.log(`Manastack API listening on http://localhost:${PORT}`)
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other API process or run npm run dev:fresh.`)
  } else {
    console.error(err)
  }
  process.exit(1)
})
