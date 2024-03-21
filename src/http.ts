import express, { RequestHandler } from 'express'
import { MongoDBClient } from './mongodb/simplifiedClient'

import { bodyToJson, buildLoggedIn, buildZodSchemaVerif } from './middlewares'
import {
  CreateChannelSchema,
  CreateListingSchema,
  CreateMessageSchema,
  EmailOTP,
  LoginSchema,
  OTPVerifyingSchema,
  PhoneOTP,
  PhoneOTPSchema,
  RegisterSchema
} from './schemas'
import {
  clearToken,
  generateDBChannel,
  generateDBMessage,
  generateListing,
  generateToken,
  getCurrentMS,
  getOTP,
  getToken,
  getUnixTimestamp,
  setToken
} from './utils'
import { z } from 'zod'
import { TwilioClient } from './clients/twilio'
import { EmailClient } from './clients/email'
import ws from 'ws'
import { IBaseUserSchema } from './types'

interface ApiRouterOptions {
  optTimeout?: number
  mongodb: MongoDBClient
  twilio: TwilioClient
  email: EmailClient
  wsMap: Map<number, ws>
}

export function setupAPIRouter (options: ApiRouterOptions): express.Router {
  const apiRouter = express.Router()
  const otpTimeout = options.optTimeout ?? 300
  const mongoClient = options.mongodb
  const twilioClient = options.twilio
  const emailClient = options.email
  const wsMap = options.wsMap

  const isLoggedIn = buildLoggedIn(mongoClient)
  const isEmailVerified = buildLoggedIn(mongoClient, true)
  // const isPhoneVerified = buildLoggedIn(mongoClient, true, true)

  function sendToAlive (data: any, ...ids: number[]): void {
    for (const id of ids) {
      const ws = wsMap.get(id)
      if (ws != null) {
        ws.send(JSON.stringify(data))
      }
    }
  }

  // ========================
  //  Login/Register API
  // ========================

  const isLoginSchema = buildZodSchemaVerif(LoginSchema)
  apiRouter.post('/login', bodyToJson, isLoginSchema, (async (req, res) => {
    const token = getToken(req)

    if (token != null) {
      res.status(400).json({ error: 'Already logged in' })
      return
    }

    // find a user that matches username OR email AND password.
    const user = await mongoClient.usersCollection.findOne({
      $or: [{ username: req.body.username }, { email: req.body.email }],
      password: req.body.password
    })

    if (user == null) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    setToken(res, user.token).status(200).json({ token: user.token })
  }) as RequestHandler)

  const isRegisterSchema = buildZodSchemaVerif(RegisterSchema)
  apiRouter.post('/register', bodyToJson, isRegisterSchema, (async (req, res) => {
    // find if email or username is used
    const user = await mongoClient.usersCollection.findOne({ $or: [{ username: req.body.username }, { email: req.body.email }] })

    if (user != null) {
      res.status(400).json({ error: 'Email already in use' })
      return
    }

    const body = req.body as z.infer<typeof RegisterSchema>
    const token = generateToken()

    await mongoClient.usersCollection.insertOne({
      username: body.username,
      email: body.email,
      phone: body.phone,
      password: body.password,
      token,
      id: getCurrentMS(),
      emailVerified: false,
      phoneVerified: false
    })

    res.status(201).json({ token })
  }) as RequestHandler)

  apiRouter.get('/logout', isLoggedIn, (async (req, res) => {
    clearToken(res).status(200).send()
  }) as RequestHandler)

  // ========================
  //  Email and Phone OTP API
  // ========================

  apiRouter.post('/emailVerifyStart', isLoggedIn, (async (req, res) => {
    const token = getToken(req)
    const user = res.locals.user as IBaseUserSchema

    if (user.emailVerified) {
      res.status(400).json({ error: 'Email already verified' })
      return
    }

    const emailOtp = getOTP()
    const unixTimestamp = getUnixTimestamp()

    // TODO: send out email OTP to user's email.

    await emailClient.sendEmail(user.email, 'Email Verification', `Your email verification code is: ${emailOtp}`)

    await mongoClient.otpCollection.updateOne(
      { userToken: token },
      { $set: { userToken: token, email: user.email, emailOtp, timestamp: unixTimestamp, timeout: otpTimeout } },
      { upsert: true }
    )
    res.status(200).json({ otp: emailOtp })
  }) as RequestHandler)

  const isOTPVerifyingSchema = buildZodSchemaVerif(OTPVerifyingSchema)
  apiRouter.post('/emailVerifyFinish', isLoggedIn, bodyToJson, isOTPVerifyingSchema, (async (req, res) => {
    const token = getToken(req)

    // find otp and update it IFF otp is valid and not expired
    // do so with an aggregate
    const otp1 = await mongoClient.otpCollection.findOne({ userToken: token })

    const otp = otp1 as EmailOTP | null

    if (otp == null) {
      res.status(400).json({ error: 'No OTP found' })
      return
    }

    if (otp.emailOtp !== req.body.otp) {
      res.status(400).json({ error: 'Invalid OTP' })
      return
    }

    const unixTimestamp = getUnixTimestamp()

    if (unixTimestamp - otp.timestamp > otp.timeout) {
      res.status(400).json({ error: 'OTP expired' })
    } else {
      mongoClient.usersCollection.updateOne({ token }, { $set: { emailVerified: true } }).catch(console.error)
      res.status(200).send()
    }

    if (otp1 != null) {
      if (otp1.phone != null) {
        mongoClient.otpCollection.updateOne({ userToken: token }, { $unset: { email: '', emailOtp: '' } }).catch(console.error)
      } else {
        mongoClient.otpCollection.deleteOne({ userToken: token }).catch(console.error)
      }
    }
  }) as RequestHandler)

  const isPhoneOTPSchema = buildZodSchemaVerif(PhoneOTPSchema)
  apiRouter.post('/phoneVerifyStart', isLoggedIn, bodyToJson, isPhoneOTPSchema, (async (req, res) => {
    const token = getToken(req)

    const user = res.locals.user as IBaseUserSchema
    const phone = req.body.phone ?? user.phone

    if (phone === '' || phone == null) {
      res.status(400).json({ error: 'No phone number connected to account' })
      return
    }

    if (user.phoneVerified) {
      res.status(400).json({ error: 'Phone already verified' })
      return
    }

    const phoneOTP = getOTP()
    const unixTimestamp = getUnixTimestamp()

    // TODO: send phone OTP to user's phone

    await twilioClient.sendSms(phone, `Your phone verification code is: ${phoneOTP}`)

    await mongoClient.otpCollection.updateOne(
      { userToken: token },
      { $set: { userToken: token, phone: user.phone, phoneOtp: phoneOTP, timestamp: unixTimestamp, timeout: otpTimeout } },
      { upsert: true }
    )

    if (phone !== user.phone) {
      await mongoClient.usersCollection.updateOne({ token }, { $set: { phone } })
    }

    res.status(200).json({ otp: phoneOTP })
  }) as RequestHandler)

  apiRouter.post('/phoneVerifyFinish', isLoggedIn, bodyToJson, isOTPVerifyingSchema, (async (req, res) => {
    const token = getToken(req)

    // find otp and update it IFF otp is valid and not expired
    // do so with an aggregate
    const otp1 = await mongoClient.otpCollection.findOne({ userToken: token })

    const otp = otp1 as PhoneOTP | null

    if (otp == null) {
      res.status(400).json({ error: 'No OTP found' })
      return
    }

    if (otp.phoneOtp !== req.body.otp) {
      res.status(400).json({ error: 'Invalid OTP' })
      return
    }

    const unixTimestamp = getUnixTimestamp()

    if (unixTimestamp - otp.timestamp > otp.timeout) {
      res.status(400).json({ error: 'OTP expired' })
    } else {
      // set to phone verified good
      await mongoClient.usersCollection.updateOne({ token }, { $set: { phoneVerified: true } })

      res.status(200).send()
    }

    if (otp1 != null) {
      if (otp1.email != null) {
        // if email exists, simply delete phoneOTP and phone from otpCollection
        mongoClient.otpCollection.updateOne({ userToken: token }, { $unset: { phone: '', phoneOtp: '' } }).catch(console.error)
      } else {
        // else, delete the whole document
        mongoClient.otpCollection.deleteOne({ userToken: token }).catch(console.error)
      }
    }
  }) as RequestHandler)

  // ========================
  //  Channel and Message API
  // ========================

  apiRouter.get('/channel/:channelID', isLoggedIn, (async (req, res) => {
    const channelID = req.params.channelID

    const id = parseInt(channelID)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid channel ID' })
      return
    }

    const channel = await mongoClient.channelCollection.findOne({
      id
    })

    if (channel == null) {
      res.status(404).json({ error: 'Channel not found' })
      return
    }

    delete (channel as any)._id
    delete (channel as any).messages
    res.status(200).json(channel)
  }) as RequestHandler)

  apiRouter.get('/channel/:channelID/messages', isLoggedIn, (async (req, res) => {
    const channelID = req.params.channelID

    if (channelID == null) {
      res.status(400).json({ error: 'Invalid channel ID' })
      return
    }

    const id = parseInt(channelID)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid channel ID' })
      return
    }

    const channel = await mongoClient.channelCollection.findOne({
      id
    })

    if (channel == null) {
      res.status(404).json({ error: 'Channel not found' })
      return
    }

    res.status(200).json(channel.messages)
  }) as RequestHandler)
  const isCreateChannelSchema = buildZodSchemaVerif(CreateChannelSchema)
  apiRouter.post('/initMessage', isEmailVerified, bodyToJson, isCreateChannelSchema, (async (req, res) => {
    const otherIDs: number[] = req.body.targetids

    const cursor = await mongoClient.usersCollection.find({ id: { $in: otherIDs } })
    const otherUsers = await cursor.toArray()

    if (otherUsers.length < otherIDs.length) {
      res.status(400).json({
        error: 'Invalid target IDs',
        details: { invalidIDs: otherIDs.filter((id) => !otherUsers.some((user) => user.id === id)) }
      })
      return
    } else if (otherUsers.length > otherIDs.length) {
      res.status(502).json({ error: 'internal server error' })
      return
    }

    const channel = generateDBChannel(res.locals.user.id, ...otherIDs)

    // if channel does not currently exist, create it.
    // if it does, update it with the new message

    const cursor1 = await mongoClient.channelCollection.findOne({ creatorid: res.locals.user.id, targetids: { $all: otherIDs } })

    let msg
    let isNewChannel
    if (cursor1 == null) {
      msg = generateDBMessage(req.body.message, res.locals.user.id, channel.id)
      channel.messages.push(msg)
      await mongoClient.channelCollection.insertOne(channel)
      isNewChannel = true
    } else {
      msg = generateDBMessage(req.body.message, res.locals.user.id, cursor1.id)
      await mongoClient.channelCollection.updateOne({ id: cursor1.id }, { $push: { messages: msg } })
      isNewChannel = false
    }

    res.status(201).json({ id: msg.channelid, isNewChannel })
    sendToAlive({ type: 'recvMessage', data: msg }, ...otherIDs)
  }) as RequestHandler)

  const isMessageSchema = buildZodSchemaVerif(CreateMessageSchema)
  apiRouter.post('/channel/:channelID/message', isLoggedIn, bodyToJson, isMessageSchema, (async (req, res) => {
    const channelID = req.params.channelID

    const id = parseInt(channelID)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid channel ID' })
      return
    }

    const msg = generateDBMessage(req.body, res.locals.user.id, id)
    const channel = await mongoClient.channelCollection.findOneAndUpdate({ id }, { $push: { messages: msg } })

    if (channel === null) {
      res.status(404).json({ error: 'Channel not found' })
      return
    }

    res.status(201).json({ id: msg.id })
    sendToAlive({ type: 'recvMessage', data: msg }, ...channel.targetids)
  }) as RequestHandler)

  // ========================
  //  User API (data retrieval)
  // ========================

  apiRouter.get('/@me', isLoggedIn, (async (req, res) => {
    const user = res.locals.user

    delete user._id
    res.status(200).json(user)
  }) as RequestHandler)

  apiRouter.get('/@me/listings', isLoggedIn, (async (req, res) => {
    const user = res.locals.user

    const cursor = await mongoClient.listingCollection.find({ creatorid: user.id })

    const listings = await cursor.toArray()
    listings.forEach((listing) => {
      delete (listing as any)._id
    })

    res.status(200).json(listings)
  }) as RequestHandler)

  apiRouter.get('/user/:username', isLoggedIn, (async (req, res) => {
    const username = req.params.username
    if (username == null) {
      res.status(400).json({ error: 'Invalid username' })
      return
    }

    const user = await mongoClient.usersCollection.findOne({ username })

    if (user == null) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.status(200).json({ id: user.id, username: user.username })
  }) as RequestHandler)

  apiRouter.get('/user/:userid/listings', isLoggedIn, (async (req, res) => {
    const userid = req.params.userid

    const id = parseInt(userid)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid user ID' })
      return
    }

    const cursor = await mongoClient.listingCollection.find({ creatorid: id })

    const listings = await cursor.toArray()

    if (listings.length === 0) {
      res.status(404).json({ error: 'No listings found' })
      return
    }

    listings.forEach((listing) => delete (listing as any)._id)

    res.status(200).json(listings)
  }) as RequestHandler)

  // ========================
  // listing API
  // ========================

  const isListingSchema = buildZodSchemaVerif(CreateListingSchema)
  apiRouter.post('/listing', isLoggedIn, bodyToJson, isListingSchema, (async (req, res) => {
    const user = res.locals.user

    const listing = generateListing(req, user.id)

    await mongoClient.listingCollection.insertOne(listing)

    res.status(201).json({ id: listing.id })
  }) as RequestHandler)

  apiRouter.get('/listing/:id', (async (req, res) => {
    const idStr = req.params.id

    if (idStr == null) {
      res.status(400).json({ error: 'Invalid listing ID' })
      return
    }

    const id = parseInt(idStr)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid listing ID' })
      return
    }

    const listing = await mongoClient.listingCollection.findOne({ id })

    if (listing == null) {
      res.status(404).json({ error: 'Listing not found' })
      return
    }

    delete (listing as any)._id
    res.status(200).json(listing)
  }) as RequestHandler)

  return apiRouter
}
