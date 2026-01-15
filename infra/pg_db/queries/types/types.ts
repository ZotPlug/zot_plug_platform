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

export type ByDeviceName = {
    deviceName: string
}

// One of deviceId or deviceName must be provided
export type DeviceIdentifier = {
    deviceId?: number,
    deviceName?: string
}

export interface NewReading {
    deviceId? : number
    deviceName? : string
    voltage? : number
    current? : number
    power? : number
    cumulativeEnergy? : number
    recordedAt?: string
}

export interface UpdateDevice {
    deviceId?: number
    deviceName?: string
    status?: "online" | "offline" | "error"
    lastSeen?: string
    newDeviceName?: string
}

export interface EnergyStatsInput {
    deviceId?: number
    deviceName?: string
    periodType: 'daily'|'weekly'|'monthly'
    periodStart: string
    totalEnergy: number                           // in watt-hours
    avgPower?: number                             // in watts
    maxPower?: number                             // in watts
}

export interface UpdateDeviceMetadata {
    deviceId?: number
    deviceName?: string
    imageBase64?: string                          // base64-encoded image data
}

export interface UpdateDevicePolicy {
    deviceId?: number
    deviceName?: string
    dailyEnergyLimit?: number                           // in watt-hours
    allowedStart?: string                               // HH:MM:SS
    allowedEnd?: string                                 // HH:MM:SS
    isEnforced?: boolean
}