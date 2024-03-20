import { MongoClient, MongoClientOptions, ServerApiVersion } from 'mongodb'


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

  get client () {
    return this._client
  }

  get uriDB () {
    return this._client.db()
  }

  get loginCollection () {
    return this._client.db().collection('login')
  }

  get usersCollection () {
    return this._client.db().collection('users')
  }
}
