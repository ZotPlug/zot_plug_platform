import { Router, Request, Response, NextFunction, RequestHandler } from "express"

export type PublishBody = {
	topic: string;
	payload?: unknown;
	qos?: 0 | 1;
	retain?: boolean;
}

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
	(req, res, next) => { fn(req, res, next).catch(next); }



