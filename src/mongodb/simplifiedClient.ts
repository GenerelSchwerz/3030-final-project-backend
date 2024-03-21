import { Collection, Db, MongoClient, MongoClientOptions } from 'mongodb'
import { IBaseListingSchema, IBaseUserSchema, IChannelSchema, IOTPSchema } from '../types'

export class MongoDBClient {
  private readonly _client: MongoClient

  constructor (private readonly uri: string, private readonly options?: MongoClientOptions) {
    this._client = new MongoClient(uri, options)
  }

  async connect (): Promise<void> {
    await this._client.connect()
  }

  async close (): Promise<void> {
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

  get usersCollection (): Collection<IBaseUserSchema> {
    return this._client.db().collection('users')
  }

  get otpCollection (): Collection<IOTPSchema> {
    return this._client.db().collection('otp')
  }

  get channelCollection (): Collection<IChannelSchema> {
    return this._client.db().collection('channels')
  }

  get listingCollection (): Collection<IBaseListingSchema> {
    return this._client.db().collection('listings')
  }
}
