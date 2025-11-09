// Defines all the reusable TypeScript interfaces for query functions
// Schema Contract between API routes and DB
// infra/pg_db/queries/types/types.ts

// ----------- USERS -----------

export type BasicCreds = {
    email: string,
    password: string
}

export type NewUser = BasicCreds & {
    firstname: string,
    lastname: string,
    username: string,
}

export type NewSession = {
    userId: number,
    ip: string,
    userAgent: string
}

export type GetSession = {
    sessionId: string
}

export type UpdateUserFields = Partial<{
    firstname: string,
    lastname: string,
    username: string,
    email: string,
    phone: string,
    email_verified: boolean
}>

// ----------- DEVICES -----------
export interface NewDevice {
    deviceName: string,
    userId: number
}

export interface UpdateDevice {
    id: number,
    deviceName?: string,
    status?: "online" | "offline" | "error",
    lastSeen?: string
}

export type ByDeviceName = {
    deviceName: string
}

export interface NewPowerReading {
    deviceName: string,
    voltage? : number,
    current? : number,
    power? : number,
    cumulativeEnergy? : number,
    recordedAt?: string
}

export interface UpdateDeviceMetadata {
    deviceName: string,
    imageUrl: string,
}

export interface UpdateDevicePolicy {
    deviceName: string,
    dailyEnergyLimit?: number,                          // in watt-hours
    allowedStart?: string,                               // HH:MM:SS
    allowedEnd?: string                                  // HH:MM:SS
    isEnforced?: boolean
}