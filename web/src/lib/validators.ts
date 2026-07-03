import { z } from "zod";

export const phoneSchema = z
  .string()
  .regex(/^1[3-9]\d{9}$/, "请输入有效的手机号");

export const codeSchema = z.string().regex(/^\d{6}$/, "验证码为 6 位数字");

export const sexEnum = z.enum(["MALE", "FEMALE", "UNKNOWN"]);

export const petCreateSchema = z.object({
  name: z.string().trim().min(1, "请填写昵称").max(20),
  species: z.string().trim().min(1, "请填写品种").max(20),
  ageMonths: z.number().int().min(0).max(600).nullable().optional(),
  sex: sexEnum.optional(),
});

export const petUpdateSchema = petCreateSchema.partial();
