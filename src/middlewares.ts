import { RequestHandler, Request } from "express";
import { MongoDBClient } from "./mongodb/simplifiedClient";
import { z } from "zod";
import { getToken } from "./utils";
import { PotentialCustomData } from "./types";

export const buildLoggedIn =
  (mongoClient: MongoDBClient): RequestHandler =>
  async (req, res, next) => {
    const token = getToken(req)

    if (token == null) {
      res.status(401).send({error: "Not logged in 1"});
      // res.redirect("/login");
      return;
    }

    const user = mongoClient.usersCollection.findOne({ token });

    if (!user) {
      res.status(401).send({error: "Not logged in 2"});
      // res.redirect("/login");
      return;
    }

    res.locals.user = user;
    next();
  };

export const redirIfLoggedIn =
  (mongoClient: MongoDBClient, redirUrl: string): RequestHandler =>
  async (req, res, next) => {
    const token = getToken(req);
    if (token != null) {
      const cursor = await mongoClient.usersCollection.findOne({ token });
      if (cursor != null) {
        res.redirect(redirUrl);
        return;
      }
    }

    next();
  };

export const bodyToJson: RequestHandler = (req, res, next) => {
  const contentType = req.headers["content-type"];

  if (contentType !== "application/json") {
    res.status(400).send({error: "Invalid content type"});
    return;
  }

  // handle streamed content
  let data = "";
  req.on("data", (chunk) => {
    data = data.concat(chunk);
  });

  req.on("end", () => {
    req.body = JSON.parse(data);
    next();
  });
};

/**
 * Assumes that the body is a JSON object and has already been parsed into a JS object
 *
 * @param schema A zod schema
 * @returns
 */
export const buildZodSchemaVerif =
  <Obj extends z.ZodObject<any>>(schema: Obj): RequestHandler =>
  async (req, res, next) => {
    const result = await schema.safeParseAsync(req.body);

    if (!result.success) {
      res.status(400).send({error: 'Schema is invalid', details: result.error.errors});
      return;
    }

    next();
  };


