import { z } from 'zod'

export interface OTPVerifying {
  token: string
  timeout: number
  timestamp: number /* unix timestamp */
  email?: string
  emailOtp?: string
  phone?: string
  phoneOtp?: string
}
export interface EmailOTP {
  token: string
  timeout: number
  timestamp: number /* unix timestamp */
  email: string
  emailOtp: string
}

export interface PhoneOTP {
  token: string
  timeout: number
  timestamp: number /* unix timestamp */
  phone: string
  phoneOtp: string
}

export const BaseListingSchema = z.object({
  title: z.string(),
  description: z.string(),
  price: z.number(),
  location: z.string(), // TODO: impl. lat. and lng.
  id: z.number(),
  creatorid: z.number()
})

export const CreateListingSchema = z.object({
  title: z.string(),
  description: z.string(),
  price: z.number()
})

// Define a schema for the case where email is provided
export const EmailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

// Define a schema for the case where username is provided
export const UsernameLoginSchema = z.object({
  username: z.string(),
  password: z.string()
})

// Combine email and username schemas into a single schema
export const LoginSchema = z.union([EmailLoginSchema, UsernameLoginSchema])

export function isEmailLoginSchema (data: z.infer<typeof LoginSchema>): data is z.infer<typeof EmailLoginSchema> {
  return Object.prototype.hasOwnProperty.call(data, 'email')
}

export const RegisterSchema = z.object({
  username: z.string(),
  email: z.string().email(),
  phone: z.optional(z.string()),
  password: z.string()
})

export const BaseUserSchema = z.object({
  username: z.string(),
  email: z.string().email(),
  phone: z.optional(z.string()),
  password: z.string(),
  id: z.number(),
  token: z.string(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean()
})

export const OTPVerifyingSchema = z.object({
  otp: z.string().length(6)
})

export const PhoneOTPSchema = z.object({
  phone: z.optional(z.string())
})

export const CreateMessageSchema = z.object({
  content: z.string()
})

export const MessageSchema = z.object({
  id: z.number(),
  senderid: z.number(),
  channelid: z.number(),
  content: z.string()
})

export const CreateChannelSchema = z.object({
  targetids: z.array(z.number()),
  message: CreateMessageSchema
})

export const ChannelSchema = z.object({
  id: z.number(),
  creatorid: z.number(),
  targetids: z.array(z.number()),
  messages: z.array(MessageSchema)
})

export type IBaseUserSchema = z.infer<typeof BaseUserSchema>

export const WSMessageList = z.enum(['login', 'sendMessage', 'recvMessage'])
export type WSMessageListType = z.infer<typeof WSMessageList>

// Define the return type of the function based on the key
type ReturnTypeMap<K extends WSMessageListType | undefined> = K extends undefined
  ? z.ZodType<{ type: WSMessageListType, data: z.ZodUnknown }>
  : K extends 'login'
    ? z.ZodType<{ type: 'login', data: z.infer<typeof LoginSchema> }>
    : K extends 'sendMessage'
      ? z.ZodType<{ type: 'sendMessage', data: z.infer<typeof MessageSchema> }>
      : K extends 'recvMessage'
        ? z.ZodType<{ type: 'recvMessage', data: z.infer<typeof MessageSchema> }>
        : never

// me when not knowing proper typing:
export const WebsocketMessageSchema = <K extends WSMessageListType>(key?: K): ReturnTypeMap<K> => {
  if (key == null) return z.object({}) as any

  switch (key) {
    case 'login':
      return z.object({ type: z.literal('login'), data: LoginSchema }) as any
    case 'sendMessage':
      return z.object({ type: z.literal('sendMessage'), data: MessageSchema }) as any
    case 'recvMessage':
      return z.object({ type: z.literal('recvMessage'), data: MessageSchema }) as any
    default:
      throw new Error('error')
  }
}
