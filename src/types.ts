import { z } from 'zod'
import ws from 'ws'

import { BaseUserSchema, RegisterSchema, DBOTPSchema, ChannelSchema, MessageSchema, BaseListingSchema, LoginSchema, CreateChannelSchema, PartialBaseListingSchema } from './schemas'

export interface PotentialCustomData {
  user: z.infer<typeof BaseUserSchema>
}

export interface TempWSStorage {
  v1: Map<number, ws>
}

export type IBaseUserSchema = z.infer<typeof BaseUserSchema>
export type IBaseListingSchema = z.infer<typeof BaseListingSchema>
export type IPartialListingSchema = z.infer<typeof PartialBaseListingSchema>
export type IRegisterSchema = z.infer<typeof RegisterSchema>
export type ILoginSchema = z.infer<typeof LoginSchema>
export type IOTPSchema = z.infer<typeof DBOTPSchema>
export type IChannelSchema = z.infer<typeof ChannelSchema>
export type IMessageSchema = z.infer<typeof MessageSchema>
export type ICreateChannelSchema = z.infer<typeof CreateChannelSchema>
