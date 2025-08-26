export type NewUser = {
    firstname: string,
    lastname: string,
    username: string,
    email: string,
    password: string,
}

export type NewSession = {
    userId: number,
    expiresAt: Date,
    ip: string,
    userAgent: string
}
