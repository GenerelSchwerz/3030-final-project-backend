import express, { RequestHandler } from "express";
import * as dotenv from "dotenv";
import { MongoDBClient } from "./mongodb/simplifiedClient";

import { bodyToJson, buildLoggedIn, buildZodSchemaVerif } from "./middlewares";
import {
  BaseUserSchema,
  EmailOTP,
  LoginSchema,
  OTPVerifying,
  OTPVerifyingSchema,
  PhoneOTP,
  PhoneOTPSchema,
  RegisterSchema,
} from "./schemas";
import { clearToken, generateToken, getCurrentMS, getOTP, getToken, getUnixTimestamp, setToken } from "./utils";
import { z } from "zod";

interface ApiRouterOptions {
  optTimeout: number;
}

export function setupAPIRouter(mongoClient: MongoDBClient, options: ApiRouterOptions): express.Router {
  const apiRouter = express.Router();
  const otpTimeout = options.optTimeout || 300;

  const isLoggedIn = buildLoggedIn(mongoClient);

  const isLoginSchema = buildZodSchemaVerif(LoginSchema);
  apiRouter.post("/login", bodyToJson, isLoginSchema, async (req, res) => {
    const token = getToken(req);

    if (token != null) {
      res.status(400).send({ error: "Already logged in" });
      return;
    }

    const user = await mongoClient.usersCollection.findOne({ username: req.body.username, password: req.body.password })

    if (user == null) {
      res.status(401).send({ error: "Invalid username or password" });
      return;
    }

    setToken(res, user.token).status(200).send({ token: user.token });
  });

  const isRegisterSchema = buildZodSchemaVerif(RegisterSchema);
  apiRouter.post("/register", bodyToJson, isRegisterSchema, async (req, res) => {
    const user = await mongoClient.usersCollection.findOne({ email: req.body.email });

    if (user != null) {
      res.status(400).send({ error: "Email already in use" });
      return;
    }

    const body = req.body as z.infer<typeof RegisterSchema>;
    const token = generateToken();

    await mongoClient.usersCollection.insertOne({
      username: body.username,
      email: body.email,
      phone: body.phone,
      password: body.password,
      token,
      id: getCurrentMS(),
      emailVerified: false,
      phoneVerified: false,
    });

    res.status(201).send({ token });
  });

  apiRouter.post("/emailVerifyStart", isLoggedIn, async (req, res) => {
    const token = getToken(req);
    const user = res.locals.user;

    if (user.emailVerified) {
      res.status(400).send({ error: "Email already verified" });
      return;
    }

    const emailOtp = getOTP();
    const unixTimestamp = getUnixTimestamp();

    // TODO: send out email OTP to user's email.

    console.log({ userToken: token, email: user.email, emailOtp, timestamp: unixTimestamp, timeout: otpTimeout });
    await mongoClient.otpCollection.updateOne(
      { userToken: token },
      { $set: { userToken: token, email: user.email, emailOtp, timestamp: unixTimestamp, timeout: otpTimeout } },
      { upsert: true }
    );
    res.status(200).send({ otp: emailOtp });
  });

  const isOTPVerifyingSchema = buildZodSchemaVerif(OTPVerifyingSchema);
  apiRouter.post("/emailVerifyFinish", isLoggedIn, bodyToJson, isOTPVerifyingSchema, async (req, res) => {
    const token = getToken(req);

    // find otp and update it IFF otp is valid and not expired
    // do so with an aggregate
    const otp1 = await mongoClient.otpCollection.findOne({ userToken: token });

    const otp = otp1 as EmailOTP | null;

    if (otp == null) {
      res.status(400).send({ error: "No OTP found" });
      return;
    }

    if (otp.emailOtp !== req.body.otp) {
      res.status(400).send({ error: "Invalid OTP" });
      return;
    }

    const unixTimestamp = getUnixTimestamp();

    if (unixTimestamp - otp.timestamp > otp.timeout) {
      res.status(400).send({ error: "OTP expired" });
      return;
    }

    res.status(200).send();

    mongoClient.usersCollection.updateOne({ token }, { $set: { emailVerified: true } }).catch(console.error);
    if (otp1 != null) {
      if (otp1.phone != null) {
        mongoClient.otpCollection.updateOne({ userToken: token }, { $unset: { email: "", emailOtp: "" } }).catch(console.error);
      } else {
        mongoClient.otpCollection.deleteOne({ userToken: token }).catch(console.error);
      }
    }
  });

  const isPhoneOTPSchema = buildZodSchemaVerif(PhoneOTPSchema);
  apiRouter.post("/phoneVerifyStart", isLoggedIn, bodyToJson, isPhoneOTPSchema, async (req, res) => {
    const token = getToken(req);
    
    const user = res.locals.user;
    const phone = req.body.phone ?? user.phone;

    if (phone === "" || phone == null) {
      res.status(400).send({ error: "No phone number connected to account" });
      return;
    }

    if (user.phoneVerified) {
      res.status(400).send({ error: "Phone already verified" });
      return;
    }

    const phoneOTP = getOTP();
    const unixTimestamp = getUnixTimestamp();

    // TODO: send phone OTP to user's phone

    await mongoClient.otpCollection.updateOne(
      { userToken: token },
      { $set: { userToken: token, phone: user.phone, phoneOtp: phoneOTP, timestamp: unixTimestamp, timeout: otpTimeout } },
      { upsert: true }
    );

    if (phone !== user.phone) {
      await mongoClient.usersCollection.updateOne({ token }, { $set: { phone } });
    }

    res.status(200).send({ otp: phoneOTP });
  });

  apiRouter.post("/phoneVerifyFinish", isLoggedIn, bodyToJson, isOTPVerifyingSchema, async (req, res) => {
    const token = getToken(req);

    // find otp and update it IFF otp is valid and not expired
    // do so with an aggregate
    const otp1 = await mongoClient.otpCollection.findOne({ userToken: token });

    const otp = otp1 as PhoneOTP | null;

    if (otp == null) {
      res.status(400).send({ error: "No OTP found" });
      return;
    }

    if (otp.phoneOtp !== req.body.otp) {
      res.status(400).send({ error: "Invalid OTP" });
      return;
    }

    const unixTimestamp = getUnixTimestamp();

    if (unixTimestamp - otp.timestamp > otp.timeout) {
      res.status(400).send({ error: "OTP expired" });
      return;
    }

    // set to phone verified good
    await mongoClient.usersCollection.updateOne({ token }, { $set: { phoneVerified: true } });

    res.status(200).send();

    if (otp1 != null) {
      if (otp1.email != null) {
        // if email exists, simply delete phoneOTP and phone from otpCollection
        mongoClient.otpCollection.updateOne({ userToken: token }, { $unset: { phone: "", phoneOtp: "" } }).catch(console.error);
      } else {
        // else, delete the whole document
        mongoClient.otpCollection.deleteOne({ userToken: token }).catch(console.error);
      }
    }
  });

  apiRouter.get("/channel/:channelID", isLoggedIn, async (req, res) => {
    const channelID = req.params;

    const channel = await mongoClient.channelCollection.findOne({
      channelID,
    });

    if (channel == null) {
      res.status(404).send({ error: "Channel not found" });
      return;
    }

    delete (channel as any)["_id"];
    delete (channel as any)["messages"];
    res.status(200).send(channel);
  });

  apiRouter.get("/channel/:channelID/messages", isLoggedIn, async (req, res) => {
    const channelID = req.params.channelID;

    if (channelID == null) {
      res.status(400).send({ error: "Invalid channel ID" });
      return;
    }

    const channel = await mongoClient.channelCollection.findOne({
      id: channelID,
    });

    if (channel == null) {
      res.status(404).send({ error: "Channel not found" });
      return;
    }

    res.status(200).send(channel.messages);
  });

  apiRouter.post("/message/:otherID", isLoggedIn, async (req, res) => {
    const token = getToken(req);

    const user = res.locals.user;

    const otherID = req.params.otherID;

    const idNum = parseInt(otherID);

    if (isNaN(idNum)) {
      res.status(400).send({ error: "Invalid user ID" });
      return;
    }

    const otherUser = await mongoClient.usersCollection.findOne({ id: idNum });

    if (otherUser == null) {
      res.status(404).send({ error: "User not found" });
      return;
    }




  });

  apiRouter.get("/user/:username", isLoggedIn, async (req, res) => {
    const token = getToken(req);

    const username = req.params.username;
    if (username == null) {
      res.status(400).send({ error: "Invalid username" });
      return;
    }

    const user = await mongoClient.usersCollection.findOne({ username });

    if (user == null) {
      res.status(404).send({ error: "User not found" });
      return;
    }

    res.status(200).send({id: user.id, username: user.username});

  })

  apiRouter.get("/logout", isLoggedIn, async (req, res) => {
    clearToken(res).status(200).send();
  });

  apiRouter.get("/@me", isLoggedIn, async (req, res) => {
    const user = res.locals.user;
    res.status(200).send(user);
  });

  return apiRouter;
}
