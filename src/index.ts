import express, { RequestHandler } from "express";
import * as dotenv from "dotenv";
import { MongoDBClient } from "./mongodb/simplifiedClient";

import { bodyToJson, buildLoggedIn, buildZodSchemaVerif } from "./middlewares";
import { BaseUserSchema, EmailOTP, LoginSchema, OTPVerifying, OTPVerifyingSchema, PhoneOTP, RegisterSchema } from "./schemas";
import { generateToken, getOTP, getUnixTimestamp } from "./utils";
import { z } from "zod";

dotenv.config({ path: ".env.local" });

const port = process.env.PORT || 3000;
const mongourl = process.env.MONGODB_URI;

if (!mongourl) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const app = express();
const apiRouter = express.Router();

const mongoClient = new MongoDBClient(mongourl);

const isLoggedIn = buildLoggedIn(mongoClient);

const isLoginSchema = buildZodSchemaVerif(LoginSchema);
apiRouter.post("/login", bodyToJson, isLoginSchema, async (req, res) => {
  const user = await mongoClient.usersCollection.findOne({ username: req.body.username, password: req.body.password });

  if (user == null) {
    res.status(401).send({ error: "Invalid username or password" });
    return;
  }

  res.cookie("token", user.token).status(200).send({token: user.token});
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
    phone: body.phone || "",
    password: body.password,
    token,
    emailVerified: false,
    phoneVerified: false,
  });

  res.status(201).send({ token });
});

apiRouter.post("/emailVerifyStart", isLoggedIn, async (req, res) => {
  const token = req.cookies.token;
  const user = await mongoClient.usersCollection.findOne({ token });

  if (user == null) {
    res.status(401).send({ error: "Not logged in" });
    return;
  }

  if (user.emailVerified) {
    res.status(400).send({ error: "Email already verified" });
    return;
  }

  const emailOtp = getOTP();
  const unixTimestamp = getUnixTimestamp();

  // TODO: send out email OTP to user's email.

  await mongoClient.otpCollection.updateOne(
    { userToken: token },
    { userToken: token, email: user.email, emailOtp, timestamp: unixTimestamp, timeout: 60 * 5 },
    { upsert: true }
  );
  res.status(200).send({otp: emailOtp});
});

const isOTPVerifyingSchema = buildZodSchemaVerif(OTPVerifyingSchema);
apiRouter.post("/emailVerifyFinish", isLoggedIn, bodyToJson, isOTPVerifyingSchema, async (req, res) => {
  const token = req.cookies.token;

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

apiRouter.post("/phoneVerifyStart", isLoggedIn, bodyToJson, isOTPVerifyingSchema, async (req, res) => {
  const token = req.cookies.token;
  const user = await mongoClient.usersCollection.findOne({ token });

  if (user == null) {
    res.status(401).send({ error: "Not logged in" });
    return;
  }

  if (user.phone === "") {
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
    { userToken: token, phone: user.phone, phoneOtp: phoneOTP, timestamp: unixTimestamp, timeout: 60 * 5 },
    { upsert: true }
  );

  res.status(200).send({otp: phoneOTP});
});

apiRouter.post("/phoneVerifyFinish", isLoggedIn, bodyToJson, isOTPVerifyingSchema, async (req, res) => {
  const token = req.cookies.token;

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
  await mongoClient.usersCollection.updateOne({ token }, { $set: { phoneVerified: true } })

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

apiRouter.get("/logout", isLoggedIn, async (req, res) => {
  res.clearCookie("token").status(200).send();
});

apiRouter.get("/@me", isLoggedIn, async (req, res) => {
  const user = await mongoClient.usersCollection.findOne({ token: req.cookies.token });
  res.status(200).send(user);
});

app.use("/api/v1", apiRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
