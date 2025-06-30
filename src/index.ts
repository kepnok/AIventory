import express, { Request, Response } from "express";
import { signinSchema, signupSchema } from "./schema/auth.schema";
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "../generated/prisma";
import dotenv from "dotenv";
import { authMiddleware, authRequest } from "./middlewares/auth.middleware";

const app = express();
dotenv.config();

app.use(express.json());
const client = new PrismaClient();

app.post("/api/signup", async (req: Request, res: Response) => {
	const result = signupSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({
			message: "validation error",
			error: result.error.format(),
		});
		return;
	}
	const { username, password, email } = result.data;

	try {
		await client.users.create({
			data: {
				username,
				password,
				email,
			},
		});
		res.status(201).json({
			message: "user created sucessfully",
		});
	} catch (err) {
		console.log("error created user", err);

		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code == "P2002"
		) {
			const fields = err.meta?.target as string[];
			res.status(400).json({
				message: `A user with this ${fields.join(",")} already exists`,
			});
		} else {
			res.status(500).json({
				message: "Internal server error",
			});
		}
	}
});

app.post("/api/signin", async (req: Request, res: Response) => {
	const result = signinSchema.safeParse(req.body);
	if (!result.success) {
		res.status(400).json({
			message: "validataion error",
			error: result.error.format(),
		});
		return;
	}

	const { username, password } = result.data;

	try {
		const user = await client.users.findFirst({
			where: {
				username,
				password,
			},
		});

		if (user) {
			const token = jwt.sign(
				{
					id: user.id,
				},
				process.env.JWT_SECRET as string
			);

			res.status(201).json({
				token,
			});
		} else {
			res.status(400).json({
				message: "User does not exist, invlaid username or password",
			});
		}
	} catch (err) {
		res.status(500).json({
			message: "Internal server error",
		});
	}
});

app.post("/api/products", authMiddleware, async (req:Request, res: Response) => {
	
	

})

app.listen(3000, () => console.log("server running on port 3000"));
