import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { v4 } from 'uuid'
import { z } from 'zod'

import { CreateListingSchema, CreateMessageSchema } from './schemas'
import { IBaseListingSchema, IChannelSchema, IMessageSchema } from './types'

export function generateToken (id: string | number, secret: string): string {
  if (typeof id === 'number') id = id.toString()
  return jwt.sign(id, secret)
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
  res.cookie('token', token, {maxAge: 1000 * 60 * 60 * 24 * 7})
  // res.setHeader("Authorization", token);
  return res
}

export function clearToken (res: Response): Response {
  res.clearCookie('token')
  // res.header("Authorization", "");
  return res
}

export function generateDBChannel (orgUserID: number, ...otherUserID: number[]): IChannelSchema {
  return {
    id: getCurrentMS(),
    creatorid: orgUserID,
    targetids: otherUserID,
    messages: []
  }
}

export function generateDBMessage (body: z.infer<typeof CreateMessageSchema>, senderid: number, channelid: number): IMessageSchema {
  return {
    id: getCurrentMS(),
    senderid,
    channelid,
    content: body.content

  }
}

export function generateListing (req: Request<any, any, z.infer<typeof CreateListingSchema>>, creatorid: number): IBaseListingSchema {
  return {
    id: getCurrentMS(),
    name: req.body.name,
    model: req.body.model,
    description: req.body.description,
    price: req.body.price,
    topview: req.body.topview,
	sideview: req.body.sideview,
	frontview: req.body.frontview,
	size: req.body.size,
    creatorid,
    location: req.ip ?? 'unknown'
  }
}
