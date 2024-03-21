import ws from 'ws'
import http from 'http'
import express from 'express'
import { MongoDBClient } from './mongodb/simplifiedClient'
import { WSMessageList, WebsocketMessageSchema, isEmailLoginSchema } from './schemas'
import { once } from 'events'

const handleWSLogin = async (ws: ws, mongoClient: MongoDBClient, wsMap: Map<number, ws>): Promise<number | undefined> => {
  const first: [data: ws.RawData, isBinary: boolean] = (await once(ws, 'message')) as any

  // first, parse the data to json

  let data
  try {
    data = JSON.parse((first[0] as any).toString('utf-8'))
  } catch (err) {
    ws.send(JSON.stringify({ error: 'Invalid data', details: err }))
    ws.close()
    return
  }

  const res0 = await WebsocketMessageSchema('login').safeParseAsync(data)

  if (!res0.success) {
    ws.send(JSON.stringify({ error: 'Invalid data', details: res0.error }))
    ws.close()
    return
  }

  const data0 = res0.data.data
  // find user in db

  let user

  if (isEmailLoginSchema(data0)) {
    user = await mongoClient.usersCollection.findOne({ email: data0.email, password: data0.password })
  } else {
    user = await mongoClient.usersCollection.findOne({ username: data0.username, password: data0.password })
  }

  if (user == null) {
    ws.send(JSON.stringify({ error: 'Invalid username or password' }))
    ws.close()
    return
  }

  // user is valid, send token

  // tslint:disable-next-line: no-string-literal
  delete (user as any)._id

  wsMap.set(user.id, ws)
  ws.send(JSON.stringify(user))
  return user.id
}

function wsMessageHandler (this: ws, data: ws.RawData, isBinary: boolean): void {
  let data0
  let msgType
  try {
    data0 = JSON.parse((data as any).toString('utf-8'))
    msgType = WSMessageList.safeParse(data0.type)
  } catch (err) {
    this.send(JSON.stringify({ error: 'Invalid data', details: err }))
    this.close()
    return
  }

  if (!msgType.success) {
    this.send(JSON.stringify({ error: 'Invalid data', details: msgType.error }))
    this.close()
    return
  }

  switch (msgType.data) {
    case 'login':
      this.send(JSON.stringify({ error: 'Already logged in' }))
      break
    case 'sendMessage':
      this.send(JSON.stringify({ error: 'Not implemented' }))
      break
    default:
      this.send(JSON.stringify({ error: 'Invalid type' }))
  }
}

export function setupWebsocketServer (
  server: http.Server,
  httpRouter: express.Router,
  mongoClient: MongoDBClient,
  wsMap = new Map()
): ws.Server {
  const wss = new ws.Server({ server })

  // const isLoginSchema = buildZodSchemaVerif(LoginSchema);
  wss.on('connection', (ws, req) => {
    void handleWSLogin(ws, mongoClient, wsMap)
      .then((wsid) => {
        if (wsid == null) return

        ws.on('message', wsMessageHandler)
        ws.once('close', () => {
          ws.off('message', wsMessageHandler)
          wsMap.delete(wsid)
        })
      })
      .catch(console.error)
  })

  return wss
}
