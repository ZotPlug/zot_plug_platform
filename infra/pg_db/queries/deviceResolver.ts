// infra/pg_db/queries/deviceResolver.ts

import { getDeviceIdByName } from './devices';

export async function resolveDeviceId(
    deviceId?: number,
    deviceName?: string
): Promise<number | null> {

    if (deviceId && deviceName)
        throw new Error("Provide either deviceId or deviceName, not both")

    if (deviceId)
        return deviceId

    if (deviceName)
        return await getDeviceIdByName(deviceName)
    
    throw new Error("Missing device identifier")
}