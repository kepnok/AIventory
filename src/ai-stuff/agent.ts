import { Groq } from "groq-sdk";
import dotenv from "dotenv";
import {  PrismaClient } from "../../generated/prisma";
import { systemPrompt } from "./systemPrompt";

dotenv.config();
const prismaClient = new PrismaClient();

const client = new Groq({
	apiKey: process.env.GROQ_API_KEY,
});
const MODEL = "llama-3.3-70b-versatile";

async function getTotalStock({ sku }: { sku: string }) {
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
}

async function shouldRestock({ sku }: { sku: string }) {
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
}

async function getExpiringSoon({
	sku,
	withinDays = 30,
}: {
	sku: string;
	withinDays?: number;
}) {
	const now = new Date();
	const future = new Date();
	future.setDate(now.getDate() + withinDays);

	const product = await prismaClient.products.findUnique({
		where: { sku },
		include: { batches: true },
	});

	if (!product) {
		return JSON.stringify({ error: "product not found" });
	}

	const expiringSoon = product.batches.filter(
		(batch) => batch.expiryDate && batch.expiryDate <= future
	);

	return JSON.stringify({
		sku,
		productName: product.name,
		expiringCount: expiringSoon.length,
		expiringBatches: expiringSoon.map(({ id, expiryDate, quantity }) => ({
			id,
			expiryDate,
			quantity,
		})),
	});
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
				name: "getExpiringSoon",
				description:
					"Find if a product is going to expire soon within a given number of days by looking it up using the sku.",
				parameters: {
					type: "object",
					properties: {
						sku: {
							type: "string",
							description:
								"SKU that uniquely identifies a product in the warehouse.",
						},
						withinDays: {
							type: "number",
							description: 
								"Number of days which the expiry date is to be checked. Default value is within 30 days if no input from user"
						}
					},
					required: ["sku"],
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
			getExpiringSoon
		};

		messages.push(responseMessage);

		for (const toolCall of toolCalls) {
			const functionName = toolCall.function.name as keyof typeof availableFunctions;
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

		return secondResponse.choices[0].message.content;
	}

	return responseMessage.content;
}
