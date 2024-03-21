import { z } from "zod";
import { BaseUserSchema } from "./schemas";
import ws from "ws";

export interface PotentialCustomData {
    user: z.infer<typeof BaseUserSchema>
  }
  

export interface TempWSStorage {
  v1: Map<number, ws>;
}