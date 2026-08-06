import { MockUsePreferenceUtils } from '@test-mocks/renderer/usePreference'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSidebarFavorites } from '../useSidebarFavorites'

describe('useSidebarFavorites', () => {
  beforeEach(() => {
    MockUsePreferenceUtils.resetMocks()
  })

  it('pins an app that is not yet favorited', () => {
    const setFavorites = vi.fn().mockResolvedValue(undefined)
    MockUsePreferenceUtils.mockPreferenceReturn(
      'ui.sidebar.favorites',
      [{ type: 'app', id: 'assistants' }],
      setFavorites
    )

    const { result } = renderHook(() => useSidebarFavorites())

    act(() => {
      result.current.setAppPinned('knowledge', true)
    })

    expect(setFavorites).toHaveBeenCalledWith([
      { type: 'app', id: 'assistants' },
      { type: 'app', id: 'knowledge' }
    ])
  })

  it('does not unpin a required app', () => {
    const setFavorites = vi.fn().mockResolvedValue(undefined)
    MockUsePreferenceUtils.mockPreferenceReturn(
      'ui.sidebar.favorites',
      [{ type: 'app', id: 'assistants' }],
      setFavorites
    )

    const { result } = renderHook(() => useSidebarFavorites())

    act(() => {
      result.current.setAppPinned('assistants', false)
    })

    expect(setFavorites).toHaveBeenCalledWith([{ type: 'app', id: 'assistants' }])
  })
})
