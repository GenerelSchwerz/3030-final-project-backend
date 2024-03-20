import express from "express";
import http from "http";
import ws from "ws";
import { MongoDBClient } from "./mongodb/simplifiedClient";
import * as dotenv from "dotenv";
import { setupAPIRouter } from "./http";
import { setupWebsocketServer } from "./ws";

dotenv.config({ path: ".env.local" });

const port = process.env.PORT || 3000;
const mongourl = process.env.MONGODB_URI;

if (!mongourl) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const mongoClient = new MongoDBClient(mongourl);
const app = express();  
const serv = http.createServer(app);



const httpAPIRouter = setupAPIRouter(mongoClient, { optTimeout: 300 });
setupWebsocketServer(serv, httpAPIRouter, mongoClient);

app.use("/api/v1", httpAPIRouter);

app.get("/", (req, res) => {
    res.send("Hello World!");
})

serv.listen(port, () => {
  console.log("Server is running on port 3000");
});