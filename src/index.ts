import express, { RequestHandler } from 'express'
import * as dotenv from 'dotenv'
import { MongoDBClient } from './mongodb/simplifiedClient'

import { bodyToJson, buildLoggedIn, verifyZodSchema } from './middlewares'
import { LoginSchema } from './schemas'


dotenv.config({path: '.env.local'})


const port = process.env.PORT || 3000
const mongourl = process.env.MONGODB_URI

if (!mongourl) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const app = express()
const apiRouter = express.Router()

const mongoClient = new MongoDBClient(mongourl)


const isLoggedIn = buildLoggedIn(mongoClient)


const isLoginSchema = verifyZodSchema(LoginSchema)
apiRouter.post('/login', bodyToJson, isLoginSchema, (req, res) => {
  res.send('Hello World')
})

app.use('/api/v1', apiRouter)

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
