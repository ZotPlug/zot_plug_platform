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


// ----------- DEVICES -----------
export interface NewDevice {
    name: string,
    userId: number
}

export interface UpdateDevice {
    id: number,
    name?: string,
    status?: boolean,
    powerUsage?: number
}