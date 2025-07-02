import { z } from "zod";

export const productsSchema = z.object({
	name: z.string(),
	sku: z.string().toUpperCase(),
	restockLevel: z.number(),
	warehouseId: z.number()
})

export type productstype = z.infer<typeof productsSchema>
