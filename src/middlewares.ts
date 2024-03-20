import { RequestHandler } from 'express'
import { MongoDBClient } from './mongodb/simplifiedClient'
import { z } from 'zod'

export const buildLoggedIn = (mongoClient: MongoDBClient): RequestHandler => async (req, res, next) => {
  if (!req.cookies.session) {
    res.redirect('/login')
    return
  }

  const cursor = mongoClient.loginCollection.findOne({ session: req.cookies.session })

  if (!cursor) {
    res.redirect('/login')
    return
  }

  next()
}

export const bodyToJson: RequestHandler = (req, res, next) => {
  const contentType = req.headers['content-type']

  if (contentType !== 'application/json') {
    res.status(400).send('Invalid content type')
    return
  }

  // handle streamed content
  let data = ''
  req.on('data', chunk => {
    data += chunk
  })

  req.on('end', () => {
    req.body = JSON.parse(data)
    next()
  })
}

/**
 * Assumes that the body is a JSON object and parses it into a JS object
 *
 * @param schema A zod schema
 * @returns
 */
export const verifyZodSchema = (schema: z.ZodUnknown): RequestHandler => async (req, res, next) => {
  const result = await schema.safeParseAsync(req.body)

  if (!result.success) {
    res.status(400).send(result.error.errors)
    return
  }

  next()
}
