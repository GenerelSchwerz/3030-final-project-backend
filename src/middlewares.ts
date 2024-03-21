import { RequestHandler } from 'express'
import { z } from 'zod'

import { getToken } from './utils'
import { MongoDBClient } from './mongodb'

export const buildLoggedIn =
  <Ph extends boolean, Em extends Ph extends true ? true : boolean>(mongoClient: MongoDBClient, emailCheck?: Em, phoneCheck?: Ph): RequestHandler =>
    async (req, res, next) => {
      const token = getToken(req)

      console.log(req, req.cookies)
      const phoneC = phoneCheck === true
      const emailC = !phoneC ? emailCheck : true

      if (token == null) {
        res.status(401).send({ error: 'No token provided' })
        // res.redirect("/login");
        return
      }

      const user = await mongoClient.usersCollection.findOne({ token })

      if (user == null) {
        res.status(401).send({ error: 'Invalid token provided' })
        // res.redirect("/login");
        return
      }

      if (emailC === true && !user.emailVerified) {
        res.status(400).send({ error: 'Email not verified' })
        return
      }

      if (phoneC && !user.phoneVerified) {
        res.status(400).send({ error: 'Phone not verified' })
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
    res.status(400).send({ error: 'Invalid content type' })
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
        res.status(400).send({ error: 'Schema is invalid', details: result.error.errors })
        return
      }

      next()
    }
