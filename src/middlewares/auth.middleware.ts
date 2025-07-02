import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export interface authRequest extends Request {
	userID: number;
	warehouseId: number;
}

export function authMiddleware(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const token = req.headers.authorization?.split(" ")[1];
	if (!token) {
		res.status(401).json({
			message: "token not provided",
		});
	}

	try {
		const decoded = jwt.verify(
			token as string,
			process.env.JWT_SECRET as string
		) as jwt.JwtPayload;

		if (decoded) {
			(req as authRequest).userID = decoded.id;
			(req as authRequest).warehouseId = decoded.warehouseId;
			next();
		} else {
			res.json(401).json({
				message: "invalid token",
			});
		}
	} catch (err) {
		res.status(401).json({
			message: "something went wrong during authentication",
		});
	}
}
