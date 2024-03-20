import { Request, Response } from 'express';
import { v4 } from 'uuid'

import { ChannelSchema } from './schemas';
import { z } from 'zod';

export function generateToken (): string {
  return v4()
}

export function getUnixTimestamp (): number {
  return Math.floor(Date.now() / 1000)
}

export function getCurrentMS (): number {
  return Date.now()

}

export function getOTP(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function getToken(req: Request): string | undefined {
  return req.headers.authorization
  // return req?.cookies?.token;
}

export function setToken(res: Response, token: string): Response {
  // res.cookie("token", token);
  res.setHeader("Authorization", token);
  return res
}

export function clearToken(res: Response): Response {
  // res.clearCookie("token");
  res.header("Authorization", "");
  return res;
}


export function generateChannel(orgUserID: number, ...otherUserID: number[]): z.infer<typeof ChannelSchema> {
  return {
    id: getCurrentMS(),
    creatorid: orgUserID,
    targetids: otherUserID,
    messages: []
  }
}