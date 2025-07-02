import { z } from "zod";

export const productsSchema = z.object({
	name: z.string(),
	sku: z.string().toUpperCase(),
	restockLevel: z.number(),
	warehouseId: z.number()
})

export type productstype = z.infer<typeof productsSchema>



// id            Int          @id @default(autoincrement())
//   sku           String       @unique 
//   name          String
//   quantity      Int
//   reorderLevel  Int
//   expiryDate    DateTime?
//   lastRestocked DateTime
//   warehouseId   Int
//   warehouse     Warehouse    @relation(fields: [warehouseId], references: [id])
//   restocks      RestockLog[]