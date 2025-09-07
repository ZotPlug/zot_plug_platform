// Defines all the reusable TypeScript interfaces for query functions
// Schema Contract between API routes and DB

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
    name: string,
    userId: number
}

export interface UpdateDevice {
    id: number,
    name?: string,
    status?: "online" | "offline" | "error",
    lastSeen?: string
}