import { v4 } from 'uuid'

export function generateToken (): string {
  return v4()
}

export function getUnixTimestamp (): number {
  return Math.floor(Date.now() / 1000)
}

export function getOTP(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}