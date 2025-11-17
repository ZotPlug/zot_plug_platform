import { publishAsync, topicAllowed } from '../mqtt_conf/mqtt_client_conf'
import { PublishBody, asyncHandler } from '../mqtt_conf/util'
import { Router, Request, Response } from "express"

const router = Router()

router.post("/publish", asyncHandler(async (
    req: Request<{}, any, PublishBody>,
    res: Response
): Promise<void> => {
    const { topic, payload, qos = 0, retain = false } = req.body ?? {};
    if (!topic) { res.status(400).json({ error: "topic required" }); return; }
    if (!topicAllowed(topic)) { res.status(403).json({ error: "topic not allowed" }); return; }

    const body = typeof payload === "object" ? JSON.stringify(payload) : String(payload ?? "");
    await publishAsync(topic, body, qos === 1 ? 1 : 0, !!retain);

    // IMPORTANT: don’t `return res.json(...)` — just send and end the function (Promise<void>)
    res.json({ ok: true });
}))

export default router
