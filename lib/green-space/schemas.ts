import { z } from "zod";

export const PlantFields = z.object({
  nickname: z.string().trim().max(60).nullish(),
  location: z.string().trim().max(80).nullish(),
  light_condition: z.enum(["low", "medium", "bright_indirect", "full_sun"]).nullish(),
  watering_preference: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(1000).nullish(),
  acquired_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});
