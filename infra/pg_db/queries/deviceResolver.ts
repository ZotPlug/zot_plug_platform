// infra/pg_db/queries/deviceResolver.ts

import { getDeviceIdByName } from './devices';

/**
 * Resolves a device identifier based on provided deviceId or deviceName.
 * If both are provided, an error is thrown.
 * If neither is provided, an error is thrown.
 * If deviceName is provided, it fetches the corresponding deviceId from the database.
 */ 
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