import { Request, Response } from 'express'
import { v4 } from 'uuid'

import { BaseListingSchema, ChannelSchema, CreateListingSchema, CreateMessageSchema, MessageSchema } from './schemas'
import { z } from 'zod'

export function generateToken (): string {
  return v4()
}

export function getUnixTimestamp (): number {
  return Math.floor(Date.now() / 1000)
}

export function getCurrentMS (): number {
  return Date.now()
}

export function getOTP (): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function getToken (req: Request): string | undefined {
  return req?.cookies?.token
}

export function setToken (res: Response, token: string): Response {
  res.cookie('token', token)
  // res.setHeader("Authorization", token);
  return res
}

export function clearToken (res: Response): Response {
  res.clearCookie('token')
  // res.header("Authorization", "");
  return res
}

export function generateDBChannel (orgUserID: number, ...otherUserID: number[]): z.infer<typeof ChannelSchema> {
  return {
    id: getCurrentMS(),
    creatorid: orgUserID,
    targetids: otherUserID,
    messages: []
  }
}

export function generateDBMessage (body: z.infer<typeof CreateMessageSchema>, senderid: number, channelid: number): z.infer<typeof MessageSchema> {
  return {
    id: getCurrentMS(),
    senderid,
    channelid,
    content: body.content

  }
}

export function generateListing (req: Request<any, any, z.infer<typeof CreateListingSchema>>, creatorid: number): z.infer<typeof BaseListingSchema> {
  return {
    id: getCurrentMS(),
    title: req.body.title,
    description: req.body.description,
    price: req.body.price,
    creatorid,
    location: req.ip ?? 'unknown'
  }
}
