import express from "express";
import http from "http";
import ws from "ws";
import { MongoDBClient } from "./mongodb/simplifiedClient";
import * as dotenv from "dotenv";
import { setupAPIRouter } from "./http";
import { setupWebsocketServer } from "./ws";
import { TwilioClient } from "./clients/twilio";
import { EmailClient } from "./clients/email";

dotenv.config({ path: ".env.local" });

const port = process.env.PORT || 3000;
const mongourl = process.env.MONGODB_URI;

if (!mongourl) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const twilioClient = TwilioClient.create();
const emailClient = EmailClient.create();
const mongoClient = new MongoDBClient(mongourl);
const app = express();
const serv = http.createServer(app);

const wsMap = new Map<number,  ws>();
const wsAPIServer = setupWebsocketServer(serv, app, mongoClient, wsMap);
const httpAPIRouter = setupAPIRouter({ optTimeout: 300, mongodb: mongoClient, twilio: twilioClient, email: emailClient, wsMap });

app.use("/api/v1", httpAPIRouter);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

serv.listen(port, () => {
  console.log("Server is running on port 3000");
});
