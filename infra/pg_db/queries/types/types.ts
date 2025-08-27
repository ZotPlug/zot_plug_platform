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


