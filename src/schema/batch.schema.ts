import { z } from "zod";

export const productBatchSchema = z.object({
	quantity: z.number().int(),
	expiryDate: z.preprocess(
		(val) => (val ? new Date(val as string) : undefined),
		z.date().optional()
	),
	editedBy: z.enum(["manual", "ai"]),
});

export type productBatchType = z.infer<typeof productBatchSchema>;
