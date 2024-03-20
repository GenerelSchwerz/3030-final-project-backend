import e from 'express'
import { z, ZodObject} from 'zod'


export type OTPVerifying = {
    token: string,
    timeout: number,
    timestamp: number /* unix timestamp */
    email?: string,
    emailOtp?: string
    phone?: string,
    phoneOtp?: string
}
export type EmailOTP = {
    token: string,
    timeout: number,
    timestamp: number /* unix timestamp */
    email: string,
    emailOtp: string
}

export type PhoneOTP = {
    token: string,
    timeout: number,
    timestamp: number /* unix timestamp */
    phone: string,
    phoneOtp: string
}

export const LoginSchema = z.object({
  username: z.string(),
  password: z.string()
})

export const RegisterSchema = z.object({
    username: z.string(),
    email: z.string().email(),
    phone: z.string(),
    password: z.string(),
    
})

export const BaseUserSchema = z.object({
    username: z.string(),
    email: z.string().email(),
    phone: z.string(),
    password: z.string(),
    token: z.string(),
    emailVerified: z.boolean(),
    phoneVerified: z.boolean()
})


export const OTPVerifyingSchema = z.object({
    otp: z.string().length(6)
})