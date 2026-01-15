// infra/pg_db/queries/deviceResolver.ts

import { getDeviceIdByName } from './devices';

/**
 * Resolves a device identifier to a device ID.
 */ 
export async function resolveDeviceId(
    deviceId?: number,
    deviceName?: string
): Promise<number | null> {

    if (deviceId && deviceName)
        throw new Error("Provide either deviceId or deviceName, not both")

    if (deviceId)
        return deviceId

    if (deviceName) {
        const id = await getDeviceIdByName(deviceName)
        if (id === null) throw new Error("Device not found")
        return id
    }
        
    throw new Error("Missing device identifier")
}