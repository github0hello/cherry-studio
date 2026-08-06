import type { SidebarFavorite, SidebarFavoriteItem } from '@shared/data/preference/preferenceTypes'
import { describe, expect, it } from 'vitest'

import {
  getOrderedLaunchpadApps,
  getOrderedVisibleSidebarFavorites,
  getSidebarFavoriteItems,
  getSidebarMenuPath,
  isMessageOnlyConversationUrl,
  reorderLaunchpadApps,
  reorderSidebarFavorites,
  resolveSidebarActiveItem,
  setSidebarAppPinned,
  SIDEBAR_FAVORITE_ORDER
} from '../sidebar'

const appFavorite = (id: string): SidebarFavoriteItem => ({ type: 'app', id: id as SidebarFavorite })

describe('sidebar config helpers', () => {
  it('keeps the fixed sidebar app order available', () => {
    expect(SIDEBAR_FAVORITE_ORDER.slice(0, 5)).toEqual(['assistants', 'agents', 'paintings', 'translate', 'knowledge'])
  })

  it('preserves the preference order when reading ordered visible sidebar favorites', () => {
    expect(
      getOrderedVisibleSidebarFavorites([appFavorite('translate'), appFavorite('assistants'), appFavorite('agents')])
    ).toEqual(['translate', 'assistants', 'agents'])
  })

  it('sanitizes ordered visible sidebar favorites and keeps required favorites visible', () => {
    expect(
      getOrderedVisibleSidebarFavorites([
        appFavorite('translate'),
        { type: 'app', id: 'unknown' } as never,
        appFavorite('translate'),
        appFavorite('agents')
      ])
    ).toEqual(['assistants', 'translate', 'agents'])
  })

  it('dedupes favorites and drops unknown app favorites', () => {
    expect(
      getSidebarFavoriteItems([
        appFavorite('translate'),
        appFavorite('files'),
        appFavorite('assistants'),
        appFavorite('files'),
        { type: 'app', id: 'unknown' } as never
      ])
    ).toEqual([appFavorite('translate'), appFavorite('files'), appFavorite('assistants')])
  })

  it('drops unknown favorite types from visible reads while keeping surrounding leaves', () => {
    const group = { type: 'group', id: 'g1', name: 'Group', items: [] } as unknown as SidebarFavoriteItem

    expect(getSidebarFavoriteItems([appFavorite('translate'), group, appFavorite('files')])).toEqual([
      appFavorite('translate'),
      appFavorite('files')
    ])
  })

  it('preserves extra per-item fields through normalization (non-lossy round-trip)', () => {
    // Future per-item params must survive the normalize round-trip instead of being
    // rebuilt away from just the id.
    const appWithExtra = { type: 'app', id: 'assistants', badge: 3 } as unknown as SidebarFavoriteItem

    expect(getSidebarFavoriteItems([appWithExtra])).toEqual([{ type: 'app', id: 'assistants', badge: 3 }])
  })

  it('resolves menu paths and active items with the paintings provider route', () => {
    expect(getSidebarMenuPath('paintings', 'zhipu')).toBe('/app/paintings/zhipu')
    expect(resolveSidebarActiveItem('/app/paintings/zhipu')).toBe('paintings')
  })

  it('resolves the active item for query-keyed conversation routes', () => {
    expect(resolveSidebarActiveItem('/app/chat?topicId=abc')).toBe('assistants')
    expect(resolveSidebarActiveItem('/app/agents?sessionId=xyz')).toBe('agents')
  })

  it('classifies a message-view URL as message-only only when it carries its conversation id', () => {
    expect(isMessageOnlyConversationUrl('/app/chat?topicId=topic&view=message')).toBe(true)
    expect(isMessageOnlyConversationUrl('/app/agents?sessionId=session&view=message')).toBe(true)
    // Malformed: `view=message` without an id is a bare entry, not a message-only popup.
    expect(isMessageOnlyConversationUrl('/app/chat?view=message')).toBe(false)
    expect(isMessageOnlyConversationUrl('/app/agents?view=message')).toBe(false)
    expect(isMessageOnlyConversationUrl('/app/chat?topicId=topic')).toBe(false)
  })
})

describe('sidebar favorites mutations', () => {
  it('pins an app to the very end of the mixed list', () => {
    expect(setSidebarAppPinned([appFavorite('assistants'), appFavorite('files')], 'knowledge', true)).toEqual([
      appFavorite('assistants'),
      appFavorite('files'),
      appFavorite('knowledge')
    ])
  })

  it('unpins an app while preserving other apps', () => {
    expect(
      setSidebarAppPinned(
        [appFavorite('assistants'), appFavorite('knowledge'), appFavorite('files')],
        'knowledge',
        false
      )
    ).toEqual([appFavorite('assistants'), appFavorite('files')])
  })

  it('never unpins a required app', () => {
    expect(setSidebarAppPinned([appFavorite('assistants'), appFavorite('knowledge')], 'assistants', false)).toEqual([
      appFavorite('assistants'),
      appFavorite('knowledge')
    ])
  })

  it('preserves forward-compatible unknown items when mutating favorites', () => {
    const group = {
      type: 'group',
      id: 'g1',
      name: 'Group',
      items: [appFavorite('files')]
    } as unknown as SidebarFavoriteItem

    expect(setSidebarAppPinned([appFavorite('assistants'), group], 'knowledge', true)).toEqual([
      appFavorite('assistants'),
      appFavorite('knowledge'),
      group
    ])
  })
})

describe('reorderSidebarFavorites (mixed cross-type reorder)', () => {
  it('reorders apps together into any interleaved order', () => {
    expect(
      reorderSidebarFavorites(
        [appFavorite('assistants'), appFavorite('knowledge'), appFavorite('files')],
        [appFavorite('files'), appFavorite('assistants'), appFavorite('knowledge')]
      )
    ).toEqual([appFavorite('files'), appFavorite('assistants'), appFavorite('knowledge')])
  })

  it('keeps stored favorites missing from a partial order at the end', () => {
    expect(
      reorderSidebarFavorites(
        [appFavorite('assistants'), appFavorite('files'), appFavorite('stale')],
        [appFavorite('files'), appFavorite('assistants')]
      )
    ).toEqual([appFavorite('files'), appFavorite('assistants')])
  })

  it('drops requested items that are not stored favorites', () => {
    expect(
      reorderSidebarFavorites(
        [appFavorite('assistants'), appFavorite('files')],
        [appFavorite('ghost'), appFavorite('files'), appFavorite('assistants')]
      )
    ).toEqual([appFavorite('files'), appFavorite('assistants')])
  })

  it('keeps a required app once when the requested reorder omits it', () => {
    const reordered = reorderSidebarFavorites([appFavorite('knowledge')], [appFavorite('knowledge')])

    expect(reordered).toEqual([appFavorite('knowledge'), appFavorite('assistants')])
    expect(reordered.filter((item) => item.type === 'app' && item.id === 'assistants')).toHaveLength(1)
  })
})

describe('launchpad app order (independent from sidebar favorites)', () => {
  it('falls back to the canonical order when the store is empty', () => {
    expect(getOrderedLaunchpadApps(undefined)).toEqual(SIDEBAR_FAVORITE_ORDER)
    expect(getOrderedLaunchpadApps([])).toEqual(SIDEBAR_FAVORITE_ORDER)
  })

  it('keeps the stored order first and appends missing apps in canonical order', () => {
    const ordered = getOrderedLaunchpadApps(['files', 'assistants'])
    expect(ordered.slice(0, 2)).toEqual(['files', 'assistants'])
    expect([...ordered].sort()).toEqual([...SIDEBAR_FAVORITE_ORDER].sort())
    expect(new Set(ordered).size).toBe(ordered.length)
  })

  it('drops unknown and duplicate stored ids', () => {
    const ordered = getOrderedLaunchpadApps(['files', 'ghost', 'files', 'assistants'])
    expect(ordered.slice(0, 2)).toEqual(['files', 'assistants'])
    expect(ordered).not.toContain('ghost')
    expect(new Set(ordered).size).toBe(ordered.length)
  })

  it('reorders to the requested order and keeps missing apps at the end', () => {
    const next = reorderLaunchpadApps(['assistants', 'agents', 'files'], ['files', 'assistants', 'agents'])
    expect(next.slice(0, 3)).toEqual(['files', 'assistants', 'agents'])
    expect([...next].sort()).toEqual([...SIDEBAR_FAVORITE_ORDER].sort())
  })

  it('drops unknown ids from a requested reorder', () => {
    const next = reorderLaunchpadApps(['assistants', 'agents'], ['ghost', 'agents', 'assistants'])
    expect(next.slice(0, 2)).toEqual(['agents', 'assistants'])
    expect(next).not.toContain('ghost')
  })
})
