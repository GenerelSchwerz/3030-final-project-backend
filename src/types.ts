import { z } from 'zod'
import { BaseUserSchema, RegisterSchema, DBOTPSchema, ChannelSchema, MessageSchema, BaseListingSchema } from './schemas'
import ws from 'ws'

export interface PotentialCustomData {
  user: z.infer<typeof BaseUserSchema>
}

export interface TempWSStorage {
  v1: Map<number, ws>
}

export type IBaseUserSchema = z.infer<typeof BaseUserSchema>
export type IBaseListingSchema = z.infer<typeof BaseListingSchema>
export type IRegisterSchema = z.infer<typeof RegisterSchema>
export type IOTPSchema = z.infer<typeof DBOTPSchema>
export type IChannelSchema = z.infer<typeof ChannelSchema>
export type IMessageSchema = z.infer<typeof MessageSchema>
