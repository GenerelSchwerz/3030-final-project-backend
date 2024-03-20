import express, { RequestHandler } from 'express'
import * as dotenv from 'dotenv'
import { MongoDBClient } from './mongodb/simplifiedClient'

import { bodyToJson, buildLoggedIn, verifyZodSchema } from './middlewares'

dotenv.config({path: '.env.local'})

const app = express()

const port = process.env.PORT || 3000

const mongourl = process.env.MONGODB_URI

console.log(mongourl, 'hi')

const apiRouter = express.Router()

if (!mongourl) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const mongoClient = new MongoDBClient(mongourl)

apiRouter.post('/', bodyToJson, (req, res) => {
  res.send('Hello World')
})

app.use('/api/v1', apiRouter)

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
