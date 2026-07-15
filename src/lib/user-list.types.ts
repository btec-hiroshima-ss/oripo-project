export type UserListUser = {
  userId: number
  fullName: string
  fullNameKana: string
  department: string | null
  cellularPhone: string | null
}

export type UserListDetail = {
  userId: number
  fullName: string
  fullNameKana: string
  departments: string[]
  cellularPhone: string | null
}
