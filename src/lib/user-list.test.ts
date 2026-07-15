import { describe, it, expect } from 'vitest'
import { getIconColor, filterUsers } from './user-list.utils'
import type { UserListUser } from './user-list.types'

const MOCK_USERS: UserListUser[] = [
  { userId: 1, fullName: '田中 美咲', fullNameKana: 'タナカ ミサキ', department: 'サービス推進部' },
  { userId: 2, fullName: '田所 健一', fullNameKana: 'タドコロ ケンイチ', department: '営業グループ' },
  { userId: 3, fullName: '田崎 結衣', fullNameKana: 'タサキ ユイ', department: null },
  { userId: 4, fullName: '山田 太郎', fullNameKana: 'ヤマダ タロウ', department: '開発部' },
]

describe('getIconColor', () => {
  it('userId の剰余でパレット内の色を返す', () => {
    // 同じ userId は常に同じ色になる（参照一貫性）
    expect(getIconColor(0)).toBe(getIconColor(0))
    expect(getIconColor(1)).toBe(getIconColor(1))
  })

  it('8色パレットの範囲内に収まる', () => {
    const validColors = [
      'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-green-500',
      'bg-teal-500', 'bg-blue-500', 'bg-indigo-400', 'bg-purple-400',
    ]
    for (let i = 0; i < 20; i++) {
      expect(validColors).toContain(getIconColor(i))
    }
  })

  it('userId が 8 の倍数のとき userId=0 と同じ色になる（周期性）', () => {
    expect(getIconColor(0)).toBe(getIconColor(8))
    expect(getIconColor(0)).toBe(getIconColor(16))
  })
})

describe('filterUsers', () => {
  it('キーワードなしのとき全件返す', () => {
    expect(filterUsers(MOCK_USERS, '')).toHaveLength(4)
    expect(filterUsers(MOCK_USERS, '   ')).toHaveLength(4)
  })

  it('氏名の一部一致でフィルタできる', () => {
    // 「田」は田中・田所・田崎・山田 の全4名にヒットする
    const result = filterUsers(MOCK_USERS, '田')
    expect(result).toHaveLength(4)

    // 苗字で絞ればヒット数が減ることも確認
    const tanaka = filterUsers(MOCK_USERS, '田中')
    expect(tanaka).toHaveLength(1)
    expect(tanaka[0].fullName).toBe('田中 美咲')
  })

  it('苗字＋名前の連続でもスペースを無視してマッチする', () => {
    // "田中美咲"（スペースなし）でも "田中 美咲" にヒットする
    const result = filterUsers(MOCK_USERS, '田中美咲')
    expect(result).toHaveLength(1)
    expect(result[0].fullName).toBe('田中 美咲')
  })

  it('カナで検索できる', () => {
    // カナ（タナカ）でも氏名カナ（タナカ ミサキ）にヒットする
    const result = filterUsers(MOCK_USERS, 'タナカ')
    expect(result).toHaveLength(1)
    expect(result[0].fullName).toBe('田中 美咲')
  })

  it('ひらがなでカナ検索できる（ひらがな→カタカナ変換）', () => {
    // 「たなか」と入力しても「タナカ ミサキ」にヒットする（AIPO準拠）
    const result = filterUsers(MOCK_USERS, 'たなか')
    expect(result).toHaveLength(1)
    expect(result[0].fullName).toBe('田中 美咲')
  })

  it('一致しないキーワードは0件を返す', () => {
    expect(filterUsers(MOCK_USERS, '佐藤')).toHaveLength(0)
  })
})
