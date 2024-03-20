import { z } from "zod";
import { BaseUserSchema } from "./schemas";

export interface PotentialCustomData {
    user: z.infer<typeof BaseUserSchema>
  }
  