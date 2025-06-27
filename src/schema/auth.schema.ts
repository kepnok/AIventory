import { z } from "zod";

export const signupSchema = z.object({
	username: z.string().max(10).min(3, "Username must be between 3 and 10 characthers"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	email: z.string().email()
});

export const signinSchema = z.object({
	username: z.string().max(10).min(3, "Username must be between 3 and 10 characthers"),
	password: z.string().min(6, "Password must be at least 6 characters")
});

export type signupType = z.infer<typeof signupSchema>
export type signinType = z.infer<typeof signinSchema>