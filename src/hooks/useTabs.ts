import { useId, type KeyboardEvent } from 'react'

/**
 * The attributes and the keyboard handling that make buttons and the area they switch a tab list with its tab panel.
 * The arrow keys, Home and End move the focus between the tabs. That does not select a tab yet, since switching
 * can ask to discard changes or start a search: a tab is selected like any button.
 * Only the selected tab is in the Tab order, so the Tab key leads from the tabs on into the panel.
 */
export function useTabs(selectedTab: string, orientation: 'horizontal' | 'vertical' = 'horizontal') {
  const id = useId()
  const panelId = `${id}-panel`
  const [previousKey, nextKey] = orientation === 'vertical' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'))
    const index = tabs.indexOf(e.target as HTMLElement)
    const last = tabs.length - 1
    let next: number

    switch (e.key) {
      case nextKey:
        next = index === last ? 0 : index + 1
        break
      case previousKey:
        next = index === 0 ? last : index - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }

    e.preventDefault()
    tabs[next].focus()
  }

  return {
    tabListProps: { role: 'tablist', 'aria-orientation': orientation, onKeyDown: handleKeyDown },
    getTabProps: (tabId: string) => ({
      role: 'tab',
      id: `${id}-${tabId}`,
      'aria-selected': tabId === selectedTab,
      'aria-controls': panelId,
      tabIndex: tabId === selectedTab ? 0 : -1
    }),
    tabPanelProps: { role: 'tabpanel', id: panelId, 'aria-labelledby': `${id}-${selectedTab}` }
  }
}
