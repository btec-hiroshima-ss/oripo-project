import { describe, it, expect, vi, beforeEach } from 'vitest'

// Kysely の流暢 API（メソッドチェーン）を模倣するモック。
// チェーンメソッドは self を返し、execute / executeTakeFirst だけをテストごとに制御する。
const mockDb = vi.hoisted(() => {
  const m: Record<string, ReturnType<typeof vi.fn>> = {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
    leftJoin: vi.fn(),
    innerJoin: vi.fn(),
    select: vi.fn(),
    distinct: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    set: vi.fn(),
    execute: vi.fn(),
    executeTakeFirst: vi.fn(),
  }
  return m
})

vi.mock('./db', () => ({ db: mockDb }))

const CHAIN_METHODS = [
  'selectFrom', 'updateTable', 'leftJoin', 'innerJoin',
  'select', 'distinct', 'where', 'orderBy', 'limit', 'set',
]

beforeEach(() => {
  vi.resetAllMocks()
  for (const method of CHAIN_METHODS) {
    mockDb[method].mockReturnValue(mockDb)
  }
  mockDb.execute.mockResolvedValue([])
})

import { hashPassword, getUserProfile, updateUserProfile } from './user'
import type { UserProfileInput } from './user.types'

// AIPO との互換性テスト
// hashPassword の実装を変えると既存ユーザーがログインできなくなるため、期待値は絶対に変えないこと
describe('hashPassword', () => {
  it('SHA-1+Base64でハッシュ化する', () => {
    // echo -n "password" | openssl sha1 -binary | base64 → W6ph5Mm5Pz8GgiULbPgzG37mj9g=
    expect(hashPassword('password')).toBe('W6ph5Mm5Pz8GgiULbPgzG37mj9g=')
  })

  it('大文字小文字を区別する', () => {
    expect(hashPassword('Password')).not.toBe(hashPassword('password'))
  })

  it('空文字列もハッシュ化できる', () => {
    expect(hashPassword('')).toBe('2jmj7l5rSw0yVb/vlWAYkK/YBwk=')
  })
})

// getUserProfile が SELECT する列。null 許容カラムは明示的に型を付ける
// （型注釈がないと非 null のリテラル型に推論され、null を渡すテストが型エラーになる）
type UserRow = {
  user_id: number
  login_name: string
  last_name: string
  first_name: string
  last_name_kana: string | null
  first_name_kana: string | null
  cellular_phone: string | null
  position_name: string | null
}

const userRow: UserRow = {
  user_id: 42,
  login_name: 'm.tanaka',
  last_name: '田中',
  first_name: '美咲',
  last_name_kana: 'タナカ',
  first_name_kana: 'ミサキ',
  cellular_phone: '09012345678',
  position_name: null,
}

// getUserProfile はユーザー行 → [部署一覧, 管理者判定] の順にクエリを発行する。
// executeTakeFirst は「ユーザー行」「管理者判定」の2回呼ばれるため順番に値を返す。
function setupProfileQueries(options: {
  user?: UserRow | undefined
  departments?: { post_name: string; post_id: number }[]
  isAdmin?: boolean
} = {}) {
  const { user = userRow, departments = [], isAdmin = false } = options
  mockDb.executeTakeFirst
    .mockResolvedValueOnce(user)
    .mockResolvedValueOnce(isAdmin ? { role_id: 2 } : undefined)
  mockDb.execute.mockResolvedValue(departments)
}

describe('getUserProfile', () => {
  it('ユーザーが存在しない場合は null を返す', async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(undefined)

    expect(await getUserProfile(999)).toBeNull()
  })

  it('プロフィールを姓・名を分離した形で返す', async () => {
    setupProfileQueries({ departments: [{ post_name: '広島SS課（広島）', post_id: 2 }] })

    const profile = await getUserProfile(42)

    expect(profile).toEqual({
      userId: 42,
      loginName: 'm.tanaka',
      lastName: '田中',
      firstName: '美咲',
      lastNameKana: 'タナカ',
      firstNameKana: 'ミサキ',
      cellularPhone: '09012345678',
      departments: ['広島SS課（広島）'],
      position: null,
      isAdmin: false,
    })
  })

  it('複数部署に所属している場合は順番どおり配列で返す', async () => {
    setupProfileQueries({
      departments: [
        { post_name: '全社員', post_id: 1 },
        { post_name: '広島SS課（広島）', post_id: 2 },
      ],
    })

    const profile = await getUserProfile(42)

    expect(profile?.departments).toEqual(['全社員', '広島SS課（広島）'])
  })

  it('admin ロールを持つ場合は isAdmin が true になる', async () => {
    setupProfileQueries({ isAdmin: true })

    expect((await getUserProfile(42))?.isAdmin).toBe(true)
  })

  it('admin ロールを持たない場合は isAdmin が false になる', async () => {
    setupProfileQueries({ isAdmin: false })

    expect((await getUserProfile(42))?.isAdmin).toBe(false)
  })

  it('フリガナ未登録は空文字、携帯電話未登録は null になる', async () => {
    setupProfileQueries({
      user: { ...userRow, last_name_kana: null, first_name_kana: null, cellular_phone: null },
    })

    const profile = await getUserProfile(42)

    expect(profile?.lastNameKana).toBe('')
    expect(profile?.firstNameKana).toBe('')
    expect(profile?.cellularPhone).toBeNull()
  })

  // 現行 DB は position_id=0 でマスタに該当せず、役職は常に null になる
  it('役職が紐付いている場合はその名称を返す', async () => {
    setupProfileQueries({ user: { ...userRow, position_name: '主任' } })

    expect((await getUserProfile(42))?.position).toBe('主任')
  })
})

describe('updateUserProfile', () => {
  const input: UserProfileInput = {
    lastName: '田中',
    firstName: '美咲',
    lastNameKana: 'タナカ',
    firstNameKana: 'ミサキ',
    cellularPhone: '09012345678',
    password: 'pass1234',
    passwordConfirm: 'pass1234',
  }

  it('パスワードをハッシュ化して保存する', async () => {
    await updateUserProfile(42, input)

    const values = mockDb.set.mock.calls[0][0]
    expect(values.password_value).toBe(hashPassword('pass1234'))
    // 平文が保存されていないこと
    expect(values.password_value).not.toBe('pass1234')
  })

  it('前後の空白を除去して保存する', async () => {
    await updateUserProfile(42, { ...input, lastName: '  田中  ' })

    expect(mockDb.set.mock.calls[0][0].last_name).toBe('田中')
  })

  it('携帯電話番号が未入力なら null を保存する', async () => {
    await updateUserProfile(42, { ...input, cellularPhone: '   ' })

    expect(mockDb.set.mock.calls[0][0].cellular_phone).toBeNull()
  })

  // AIPO 互換のため更新日時・更新者も記録する
  it('パスワード変更日時・更新日時・更新者を記録する', async () => {
    await updateUserProfile(42, input)

    const values = mockDb.set.mock.calls[0][0]
    expect(values.password_changed).toBeInstanceOf(Date)
    expect(values.modified).toBeInstanceOf(Date)
    expect(values.updated_user_id).toBe(42)
  })

  it('更新対象を user_id で絞り込む', async () => {
    await updateUserProfile(42, input)

    expect(mockDb.where).toHaveBeenCalledWith('user_id', '=', 42)
  })

  // 部署・権限は管理者のユーザー管理画面でのみ変更できる（specs/user-info.md 仕様確認事項1）
  it('部署・権限に関わるカラムは更新しない', async () => {
    await updateUserProfile(42, input)

    const values = mockDb.set.mock.calls[0][0]
    expect(values).not.toHaveProperty('position_id')
    expect(Object.keys(values)).toEqual([
      'last_name',
      'first_name',
      'last_name_kana',
      'first_name_kana',
      'cellular_phone',
      'password_value',
      'password_changed',
      'modified',
      'updated_user_id',
    ])
  })
})
