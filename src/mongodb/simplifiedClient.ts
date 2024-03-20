import { Collection, Db, MongoClient, MongoClientOptions } from 'mongodb'
import { BaseUserSchema, ChannelSchema, OTPVerifying } from '../schemas'
import {z} from 'zod'

export class MongoDBClient {
  private readonly _client: MongoClient

  constructor (private readonly uri: string, private readonly options?: MongoClientOptions) {
    this._client = new MongoClient(uri, options)
  }

  async connect () {
    await this._client.connect()
  }

  async close () {
    await this._client.close()
  }

  get client (): MongoClient {
    return this._client
  }

  get uriDB (): Db {
    return this._client.db()
  }

  get loginCollection (): Collection {
    return this._client.db().collection('login')
  }

  get usersCollection (): Collection<z.infer<typeof BaseUserSchema>> {
    return this._client.db().collection('users')
  }


  get otpCollection (): Collection<OTPVerifying> {
    return this._client.db().collection('otp')
  }


  get channelCollection (): Collection<z.infer<typeof ChannelSchema>>{
    return this._client.db().collection('channels')
  }
}
