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
  position: string | null
  email: string | null
  outTelephone: string | null
  inTelephone: string | null
  cellularPhone: string | null
}
