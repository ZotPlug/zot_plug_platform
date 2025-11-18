import { Router, Request, Response, NextFunction, RequestHandler } from "express"

export type PublishBody = {
	topic: string;
	payload?: unknown;
	qos?: 0 | 1;
	retain?: boolean;
}

export type AcceptingBody = {
	energyIncrement: number,
	voltage: number,
	current: number,
	power: number,
	deviceName: string
}

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
	(req, res, next) => {
		fn(req, res, next).catch(next);
	}

export async function updateAllReadings(params: AcceptingBody) {
	try {
		const res = await fetch(`http://localhost:4000/api/devices/updateReadings/${params.deviceName}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(params)
		})

		if (!res.ok) {
			console.error("HTTP error:", res.status);
			const errBody = await res.text(); // body may not be JSON if it's an error
			throw new Error(`Response body: ${errBody}`)
		}
	} catch (err) {
		console.error('Error updating READINGS from device to db: ', err)
	}
}


