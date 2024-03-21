import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER } from './constants'
import twilio from 'twilio'

export class TwilioClient {
  public client: twilio.Twilio

  constructor (public readonly accountSid: string, public readonly authToken: string, public defaultNumber: string) {
    this.client = twilio(accountSid, authToken)
  }

  static create (): TwilioClient {
    return new TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER)
  }

  public async sendSms (to: string, body: string, from = this.defaultNumber): Promise<string> {
    // verify that the phone number is valid
    if (to.match(/^\+1\d{10}$/) == null) {
      throw new Error('Invalid phone number')
    }

    // send the message
    console.log(`Sending message to ${to}: ${body}`)

    const data = await this.client.messages.create({ from, to, body })

    console.log(`Message sent with sid: ${data.sid}`)
    // return the message sid
    return data.sid
  }
}
