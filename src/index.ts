import express, { Request, Response } from "express";
import { signinSchema, signupSchema } from "./schema/auth.schema";
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient } from "../generated/prisma";
import dotenv from "dotenv";
import cors from "cors";
import { authMiddleware, authRequest } from "./middlewares/auth.middleware";
import { productsSchema, productstype } from "./schema/products.schema";
import { productBatchSchema } from "./schema/batch.schema";
import { runConversation } from "./ai-stuff/agent";

const app = express();
dotenv.config();

app.use(express.json());
app.use(cors());

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
	const { username, password, email, warehouseId } = result.data;

	try {
		await client.users.create({
			data: {
				username,
				password,
				email,
				warehouseId,
			},
		});
		res.status(201).json({
			message: "user created sucessfully",
		});
	} catch (err) {
		console.log("error creating user", err);

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
					warehouseId: user.warehouseId,
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

app.post("/api/products", authMiddleware, async (req: Request, res: Response) => {
	req.body as productstype;
	const result = productsSchema.safeParse((req as authRequest).body);
	if (!result.success) {
		res.status(400).json({
			message: "validation error",
			error: result.error.format(),
		});
		return;
	}
	const { name, sku, restockLevel, warehouseId } = result.data;
	try {
		await client.products.create({
			data: {
				name,
				sku,
				restockLevel,
				warehouseId,
			},
		});
		res.status(200).json({
			message: "product added succesfully",
		});
	} catch (err) {
		console.log(err);
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code == "P2002"
		) {
			res.status(400).json({
				message: "product wtih this sku already exists",
			});
		} else {
			res.status(500).json({
				message: "Internal server error",
			});
		}
	}
});

app.get("/api/products", authMiddleware, async (req: Request, res: Response) => {
	
	try {
		const data = await client.products.findMany({
			where: {
				warehouseId: (req as authRequest).body.warehouseId
			}
		});
		
		res.status(200).json({
			data
		})

	} catch(err) {
		res.status(500).json({
			message: "internal server error"
		})
	}
});

app.post("/api/restock/:id", authMiddleware, async (req: Request, res: Response) => {
	const productId = parseInt(req.params.id);
	const result = productBatchSchema.safeParse((req as authRequest).body);

	if(!result.success){
		res.status(400).json({
			meassage: "validation error",
			error: result.error.format()
		});
		return;
	}

	const { quantity, expiryDate, editedBy } = result.data;

	try {
		await client.productBatch.create({
			data: {
				productId,
				quantity,
				expiryDate,
				editedBy
			}
		});

		res.status(200).json({
			message: "product batch updated"
		});

	} catch(err) {
		console.log("error while updateing product batch log", err);
		res.status(500).json({
			message: "internal server error"
		});
	}
});

app.get("api/products/:id", authMiddleware, async (req: Request, res: Response) => {
	
	const id = parseInt(req.params.id);
	try {

		const data = await client.productBatch.findMany({
			where: {
				id
			}
		});
		res.status(200).json({
			data
		})
	} catch (err) {
		res.status(500).json({
			message: "Internal server error"
		})
	}
});


app.post("/api/ai", authMiddleware, async (req: Request, res: Response) => {
	const prompt = (req as authRequest).body.prompt;
	try {
		const response = await runConversation(prompt);

	if(response){
		res.json(JSON.parse(response));
	}
	else res.json({
		message: "error occured in the agent-handler"
	})
	} catch(err) {
		console.log(err);
		res.status(500).json({
			message: "internal server error at ai endpoint"
		})
	}
});


app.listen(3000, () => console.log("server running on port 3000"));
