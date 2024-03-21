import { z } from 'zod'
import { ILoginSchema, IMessageSchema } from './types'

export const DBEmailOTPSchema = z.object({
  userid: z.number(),
  timeout: z.number(),
  timestamp: z.number(),
  email: z.string(),
  emailOtp: z.string()
})

export const DBPhoneOTPSchema = z.object({
  userid: z.number(),
  timeout: z.number(),
  timestamp: z.number(),
  phone: z.string(),
  phoneOtp: z.string()
})

export const DBOTPSchema = z.union([DBEmailOTPSchema, DBPhoneOTPSchema])

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

export const CreateOTPVerifSchema = z.object({
  otp: z.string().length(6)
})

export const CreatePhoneOTPSchema = z.object({
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

export function isEmailLoginSchema (data: ILoginSchema): data is z.infer<typeof EmailLoginSchema> {
  return Object.prototype.hasOwnProperty.call(data, 'email')
}

export function isEmailOTPSchema (data: z.infer<typeof DBOTPSchema>): data is z.infer<typeof DBEmailOTPSchema> {
  return Object.prototype.hasOwnProperty.call(data, 'email')
}

export function isPhoneOTPSchema (data: z.infer<typeof DBOTPSchema>): data is z.infer<typeof DBPhoneOTPSchema> {
  return Object.prototype.hasOwnProperty.call(data, 'phone')
}

export const WSMessageList = z.enum(['login', 'sendMessage', 'recvMessage'])

type WSMessageListType = z.infer<typeof WSMessageList>

// Define the return type of the function based on the key
type ReturnTypeMap<K extends WSMessageListType | undefined> = K extends undefined
  ? z.ZodType<{ type: WSMessageListType, data: z.ZodUnknown }>
  : K extends 'login'
    ? z.ZodType<{ type: z.ZodLiteral<"login">, data: ILoginSchema }>
    : K extends 'sendMessage'
      ? z.ZodType<{ type: z.ZodLiteral<'sendMessage'>, data: IMessageSchema }>
      : K extends 'recvMessage'
        ? z.ZodType<{ type: z.ZodLiteral<'recvMessage'>, data: IMessageSchema }>
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
