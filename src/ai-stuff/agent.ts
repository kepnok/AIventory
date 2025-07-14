import { Groq } from "groq-sdk";
import dotenv from "dotenv";
import { PrismaClient } from "../../generated/prisma";
import { systemPrompt } from "./systemPrompt";

dotenv.config();
const prismaClient = new PrismaClient();

const client = new Groq({
	apiKey: process.env.GROQ_API_KEY,
});
const MODEL = "llama-3.3-70b-versatile";

async function getTotalStock({ sku }: { sku: string }) {
	try {
		const product = await prismaClient.products.findUnique({
			where: {
				sku,
			},
			include: {
				batches: true,
			},
		});

		const total =
			product?.batches.reduce((sum, batch) => sum + batch.quantity, 0) || 0;
		return JSON.stringify({ total });
	} catch (err) {
		console.log("error in getTotalStock" + err);

		return JSON.stringify({
			error: "some error occured in the database",
		});
	}
}

async function shouldRestock({ sku }: { sku: string }) {
	try {
		const product = await prismaClient.products.findUnique({
			where: {
				sku,
			},
			include: {
				batches: true,
			},
		});

		const total =
			product?.batches.reduce((sum, batch) => sum + batch.quantity, 0) || 0;

		if (
			product &&
			typeof product.restockLevel === "number" &&
			total < product.restockLevel
		) {
			return JSON.stringify({ verdict: true });
		} else {
			return JSON.stringify({ verdict: false });
		}
	} catch (err) {
		console.log("error in shouldRestock" + err);

		return JSON.stringify({
			error: "error occoured in the database",
		});
	}
}

async function getExpiryDate({ sku }: { sku: string }) {
	try {
		const product = await prismaClient.products.findUnique({
			where: { sku },
			include: { batches: true },
		});

		if (!product) {
			return JSON.stringify({ error: "product not found" });
		}

		return JSON.stringify({
			sku,
			productName: product.name,
			batches: product.batches.map(({ id, expiryDate, quantity }) => ({
				id,
				expiryDate,
				quantity,
			})),
		});
	} catch (err) {
		console.log("error in getExpiryDate" + err);

		return JSON.stringify({
			error: "error occured in the database",
		});
	}
}

async function createProduct({
	name,
	sku,
	restockLevel,
	warehouseId,
}: {
	name: string;
	sku: string;
	restockLevel: string;
	warehouseId: string;
}) {
	const restock = parseInt(restockLevel);
	const id = parseInt(warehouseId);
	try {
		await prismaClient.products.create({
			data: {
				name,
				sku,
				restockLevel: restock,
				warehouseId: id,
			},
		});
	} catch (err) {
		console.error("error in createProduct:", err);
		return JSON.stringify({ error: "failed to create product" });
	}

	return JSON.stringify({ sucess: true });
}

async function createProductBatch({
	sku,
	quantity,
	expiryDate,
}: {
	sku: string;
	quantity: string;
	expiryDate: string;
}) {
	try {
		const product = await prismaClient.products.findUnique({
			where: { sku },
		});

		if (!product) {
			return JSON.stringify({ error: `No product found with SKU ${sku}` });
		}

		await prismaClient.productBatch.create({
			data: {
				productId: product.id,
				quantity: parseInt(quantity),
				expiryDate: expiryDate ? new Date(expiryDate) : null,
				editedBy: "ai",
			},
		});

		return JSON.stringify({ success: true });
	} catch (err) {
		console.error("Error in createProductBatch:", err);
		return JSON.stringify({ error: "Failed to create product batch" });
	}
}

function stripFunctionTags(text: string): string {
	return text.replace(/<function=.*?>/g, "").replace(/<\/function>/g, "");
}

export async function runConversation(userPrompt: string) {
	const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
		{
			role: "system",
			content: systemPrompt,
		},
		{
			role: "user",
			content: userPrompt,
		},
	];

	const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
		{
			type: "function",
			function: {
				name: "getTotalStock",
				description:
					"Find the total stock of a product when given the SKU of that product.",
				parameters: {
					type: "object",
					properties: {
						sku: {
							type: "string",
							description:
								"SKU that uniquely identifies a product in the warehouse.",
						},
					},
					required: ["sku"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "shouldRestock",
				description:
					"Find out if a product needs to be restocked by looking it up in the database using the SKU and comparing it to predefined restock level that is already present in the database",
				parameters: {
					type: "object",
					properties: {
						sku: {
							type: "string",
							description:
								"SKU that uniquely identifies a product in the warehouse.",
						},
					},
					required: ["sku"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "getExpiryDate",
				description:
					"Get all batches of a product along with their expiry dates and quantities using the SKU. This helps the AI determine if the product is expiring soon.",
				parameters: {
					type: "object",
					properties: {
						sku: {
							type: "string",
							description:
								"SKU that uniquely identifies a product in the warehouse.",
						},
					},
					required: ["sku"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "createProduct",
				description:
					"Add a new product to the database. This will make a new listing for a product in the database with 0 inital quanitity.",
				parameters: {
					type: "object",
					properties: {
						sku: {
							type: "string",
							description:
								"SKU that uniquely identifies a product in the warehouse.",
						},
						name: {
							type: "string",
							description: "Name of the product.",
						},
						restockLevel: {
							type: "string",
							description:
								"Restock level. If the quantity goes below this, the product will need to be restocked.",
						},
						warehouseId: {
							type: "string",
							description:
								"WarehouseId to identify the warehouse this product is listed under",
						},
					},
					required: ["sku", "name", "restockLevel", "warehouseId"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "createProductBatch",
				description:
					"Add a new batch for a product using its SKU. You must provide quantity and editor.",
				parameters: {
					type: "object",
					properties: {
						sku: {
							type: "string",
							description: "SKU of the product",
						},
						quantity: {
							type: "string",
							description: "Quantity in this batch",
						},
						expiryDate: {
							type: "string",
							description: "Expiry date (optional, ISO 8601 format)",
						},
					},
					required: ["sku", "quantity", "expiryDate"],
				},
			},
		},
	];

	const response = await client.chat.completions.create({
		model: MODEL,
		messages: messages,
		stream: false,
		tools: tools,
		tool_choice: "auto",
		max_completion_tokens: 4096,
	});

	const responseMessage = response.choices[0].message;
	const toolCalls = responseMessage.tool_calls;

	if (toolCalls) {
		const availableFunctions = {
			getTotalStock,
			shouldRestock,
			getExpiryDate,
			createProduct,
		};

		messages.push(responseMessage);

		for (const toolCall of toolCalls) {
			const functionName = toolCall.function
				.name as keyof typeof availableFunctions;
			const functionToCall = availableFunctions[functionName];
			const functionArgs = JSON.parse(toolCall.function.arguments);
			const functionResponse = await functionToCall(functionArgs);

			messages.push({
				tool_call_id: toolCall.id,
				role: "tool",
				content: functionResponse,
			});
		}

		const secondResponse = await client.chat.completions.create({
			model: MODEL,
			messages: messages,
		});

		return stripFunctionTags(secondResponse.choices[0].message.content ?? "");
	}

	return stripFunctionTags(responseMessage.content ?? "");
}
