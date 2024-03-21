import * as dotenv from 'dotenv'

import express from 'express'
import http from 'http'
import ws from 'ws'

import { MongoDBClient } from './mongodb/simplifiedClient'
import { setupAPIRouter } from './http'
import { setupWebsocketServer } from './ws'
import { TwilioClient } from './clients/twilio'
import { EmailClient } from './clients/email'
import cookieParser from 'cookie-parser'

dotenv.config({ path: '.env.local' })

const port = process.env.PORT ?? 3000
const mongourl = process.env.MONGODB_URI

if (mongourl == null || mongourl === '') {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const twilioClient = TwilioClient.create()
const emailClient = EmailClient.create()
const mongoClient = new MongoDBClient(mongourl)
const app = express()
const serv = http.createServer(app)

const apiUri = '/api/v1'

const wsMap = new Map<number, ws>()
const httpAPIRouter = setupAPIRouter({ optTimeout: 300, mongodb: mongoClient, twilio: twilioClient, email: emailClient, wsMap })

setupWebsocketServer(serv, apiUri, mongoClient, wsMap)

app.use(cookieParser())
app.use(apiUri, httpAPIRouter)

serv.listen(port, () => {
  console.log('Server is running on port 3000')
})
