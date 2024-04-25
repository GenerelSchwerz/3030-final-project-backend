import { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

import { getToken } from './utils'
import { MongoDBClient } from './mongodb'


const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY
if (JWT_SECRET_KEY == null || JWT_SECRET_KEY === '') {
  throw new Error('Invalid/Missing environment  variable: JWT_SECRET_KEY')
}


export const buildLoggedIn =
  <Ph extends boolean, Em extends Ph extends true ? true : boolean>(mongoClient: MongoDBClient, emailCheck?: Em, phoneCheck?: Ph): RequestHandler =>
    async (req, res, next) => {
      const token = getToken(req)

      const phoneC = phoneCheck === true
      const emailC = !phoneC ? emailCheck : true

      if (token == null) {
        res.status(401).json({ error: 'No token provided' })
        // res.redirect("/login");
        return
      }

      const verified = jwt.verify(token, JWT_SECRET_KEY)

      if (verified == null) {
        res.status(401).json({ error: 'Invalid token provided' })
      }

      const user = await mongoClient.usersCollection.findOne({ token })

      if (user == null) {
        res.status(401).json({ error: 'Invalid token provided' })
        // res.redirect("/login");
        return
      }

      if (emailC === true && !user.emailVerified) {
        res.status(400).json({ error: 'Email not verified' })
        return
      }

      if (phoneC && !user.phoneVerified) {
        res.status(400).json({ error: 'Phone not verified' })
        return
      }

      res.locals.user = user
      next()
    }

export const redirIfLoggedIn =
  (mongoClient: MongoDBClient, redirUrl: string): RequestHandler =>
    async (req, res, next) => {
      const token = getToken(req)
      if (token != null) {
        const cursor = await mongoClient.usersCollection.findOne({ token })
        if (cursor != null) {
          res.redirect(redirUrl)
          return
        }
      }

      next()
    }

export const bodyToJson: RequestHandler = (req, res, next) => {
  const contentType = req.headers['content-type']

  if (contentType !== 'application/json') {
    console.log(contentType)
    res.status(400).json({ error: 'Invalid content type' })
    return
  }

  // handle streamed content
  let data = ''
  req.on('data', (chunk) => {
    data = data.concat(chunk)
  })

  req.on('end', () => {
    req.body = JSON.parse(data)
    next()
  })
}

/**
 * Assumes that the body is a JSON object and has already been parsed into a JS object
 *
 * @param schema A zod schema
 * @returns
 */
export const buildZodSchemaVerif =
  <Obj extends z.ZodType<any>>(schema: Obj): RequestHandler =>
    async (req, res, next) => {
      const result = await schema.safeParseAsync(req.body)

      if (!result.success) {
        res.status(400).json({ error: 'Schema is invalid', details: result.error.errors })
        return
      }

      next()
    }
