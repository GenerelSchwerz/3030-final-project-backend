import { RequestHandler } from "express";
import { MongoDBClient } from "./mongodb/simplifiedClient";
import { z } from "zod";

export const buildLoggedIn =
  (mongoClient: MongoDBClient): RequestHandler =>
  async (req, res, next) => {
    if (!req.cookies || req.cookies.token) {
      res.status(401).send({error: "Not logged in"});
      // res.redirect("/login");
      return;
    }

    const cursor = mongoClient.usersCollection.findOne({ token: req.cookies.token });

    if (!cursor) {
      res.status(401).send({error: "Not logged in"});
      // res.redirect("/login");
      return;
    }

    next();
  };

export const redirIfLoggedIn =
  (mongoClient: MongoDBClient, redirUrl: string): RequestHandler =>
  async (req, res, next) => {
    if (req.cookies.token) {
      const cursor = await mongoClient.usersCollection.findOne({ token: req.cookies.token });
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
