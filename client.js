window.__ModuleLoader__.load({
  id: 'dsh-task-notifications',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const namespace = 'dsh-task-notifications'
    // Resolve against the page base explicitly, so a <base> element or a path
    // prefix cannot silently redirect the control call away from the Host route.
    function controlEndpoint() {
      const base = globalThis.document?.baseURI ?? 'http://dsh.internal/'
      return new URL('api/dsh-task-notifications', base)
    }
    const dictionary = {
      en: {
        settings: 'Notification privacy',
        titleSwitch: 'Show conversation title in Windows notifications',
        privacyWarning: 'On by default. A title can contain an excerpt from your first prompt and may appear on the lock screen or in Notification Center. Turn this off and save to hide titles in future notifications; existing notifications stay unchanged.',
        on: 'On', off: 'Off', unknown: 'Unknown', save: 'Save', saving: 'Saving…', saved: 'Setting saved.', unsaved: 'Unsaved change.',
        testHeading: 'Test a notification', test: 'Test in 10 seconds', starting: 'Starting…',
        testHelp: 'Start the test, then switch to another app or minimize DSH within 10 seconds. If titles are enabled in the saved setting, the test uses a fixed sample instead of a real title.',
        activationHelp: 'If notification activation is unavailable, the notification is informational only. The taskbar highlight does not bring DSH to the foreground.',
        diagnostics: 'Notification diagnostics', refresh: 'Refresh', refreshing: 'Refreshing…',
        loading: 'Reading settings and diagnostics…',
        testStarted: 'Test requested. Switch away now, then return and refresh diagnostics to check the result.',
        testPending: 'A test is counting down or a notification attempt is in progress. Refresh diagnostics to check again.',
        noResult: 'No notification attempt has finished yet.',
        lastResult: 'Latest completed attempt', attention: 'Taskbar', toast: 'Windows notification',
        titleStatus: 'Title handling', activationStatus: 'Open DSH from notification', unknownStatus: 'Unknown status.',
        unavailable: 'These settings are available only to the owner of a running DSH Desktop plugin.',
        readFailed: 'Could not refresh settings and diagnostics. Refresh to try again.',
        stale: 'Showing the last confirmed information.',
        saveFailed: 'Could not confirm that the setting was saved. Refresh to check before trying again.',
        saveRejected: 'DSH could not save the setting. Check whether the current profile allows editing it.',
        testFailed: 'Could not confirm that the test was started. Refresh diagnostics before trying again.',
        testBusy: 'A notification test or attempt is already in progress. Refresh diagnostics to check again.',
        'kind.auto': 'Conversation completed', 'kind.test': 'Manual test',
        'attention.flash-requested': 'Taskbar highlight requested. Windows decides whether to show it.',
        'attention.ready': 'Taskbar window found (diagnostic only).',
        'attention.foreground': 'DSH was already in the foreground; nothing was sent.',
        'attention.no-window': 'No taskbar window to highlight. DSH may be hidden in the system tray.',
        'attention.ambiguous-window': 'More than one candidate window was found; nothing was sent.',
        'attention.wrong-desktop': 'Could not confirm the Windows desktop process.',
        'attention.no-foreground': 'Could not identify the foreground window.',
        'attention.enumeration-failed': 'Could not list Windows windows.',
        'attention.invalid-parent': 'The desktop process ID was invalid.',
        'attention.parent-exited': 'The desktop process had exited or could not be found.',
        'attention.parent-inaccessible': 'The desktop process could not be accessed.',
        'attention.interop-unavailable': 'The Windows window-management interface was unavailable.',
        'attention.window-check-failed': 'The Windows window check failed.',
        'attention.helper-aborted': 'The Windows helper was canceled.',
        'attention.helper-timeout': 'The Windows helper timed out.',
        'attention.helper-output-limit': 'The Windows helper returned too much data to confirm the result.',
        'attention.helper-invalid-result': 'The Windows helper returned an invalid result.',
        'attention.helper-failed': 'The Windows helper could not complete the attempt.',
        'toast.submitted': 'Submitted. Windows decides whether to show a banner.',
        'toast.ready': 'Notification sender and content available (diagnostic only).',
        'toast.skipped': 'No notification was sent.',
        'toast.app-not-registered': 'Windows has not registered DSH as a notification sender.',
        'toast.failed': 'The notification could not be checked or sent.',
        'toast.disabled:DisabledForApplication': 'Windows notifications are disabled for this app.',
        'toast.disabled:DisabledForUser': 'Windows notifications are disabled for this user.',
        'toast.disabled:DisabledByGroupPolicy': 'Windows notifications are disabled by group policy.',
        'toast.disabled:DisabledByManifest': 'The app manifest does not allow Windows notifications.',
        'title.hidden': 'Title excluded by preference.',
        'title.unavailable': 'No conversation title was available.',
        'title.attached': 'A conversation title was included.',
        'title.sample': 'A fixed sample title was included.',
        'title.not-submitted': 'No notification was submitted.',
        'activation.attached': 'Open DSH action attached. Windows determines whether clicking brings DSH to the foreground.',
        'activation.protocol-unavailable': 'Informational only. Clicking the notification cannot open DSH.',
        'activation.not-submitted': 'No notification was submitted.',
      },
      zh: {
        settings: '通知隐私',
        titleSwitch: '在 Windows 通知中显示对话标题',
        privacyWarning: '默认开启。对话标题可能包含首条提示词的片段，并出现在锁屏或通知中心。关闭后点击「保存」，之后的通知不再包含标题；已发送的通知不受影响。',
        on: '开启', off: '关闭', unknown: '未知', save: '保存', saving: '正在保存…', saved: '设置已保存。', unsaved: '更改尚未保存。',
        testHeading: '测试通知', test: '10 秒后测试', starting: '正在启动…',
        testHelp: '开始测试后，请在 10 秒内切换到其他应用或最小化 DSH。若已保存的设置启用了标题，测试只使用固定示例，不会显示真实标题。',
        activationHelp: '若通知不支持打开 DSH，则仅用于提示。任务栏高亮不会将 DSH 切到前台。',
        diagnostics: '通知诊断', refresh: '刷新', refreshing: '正在刷新…', loading: '正在读取设置和诊断状态…',
        testStarted: '测试已请求。请先切换到其他应用，随后返回并刷新诊断以查看结果。',
        testPending: '测试正在倒计时，或正在尝试发送通知。请刷新诊断以查看结果。',
        noResult: '尚无已完成的通知尝试。',
        lastResult: '最近一次已完成的尝试', attention: '任务栏', toast: 'Windows 通知',
        titleStatus: '标题处理', activationStatus: '从通知打开 DSH', unknownStatus: '未知状态。',
        unavailable: '只有正在运行此插件的 DSH 桌面端所有者可以访问这些设置。',
        readFailed: '无法刷新设置和诊断。请刷新后重试。',
        stale: '当前显示上次确认的信息。',
        saveFailed: '无法确认设置是否已保存。请先刷新确认，再重试。',
        saveRejected: 'DSH 未能保存设置。请检查当前配置是否允许修改此项。',
        testFailed: '无法确认测试是否已启动。请先刷新诊断，再重试。',
        testBusy: '已有测试或通知尝试正在进行。请刷新诊断以查看结果。',
        'kind.auto': '对话结束', 'kind.test': '手动测试',
        'attention.flash-requested': '已请求高亮任务栏按钮。实际是否显示由 Windows 决定。',
        'attention.ready': '已确认任务栏窗口（仅探测）。',
        'attention.foreground': 'DSH 已在前台，本次未提醒。',
        'attention.no-window': '没有可高亮的任务栏窗口。DSH 可能已隐藏到系统托盘。',
        'attention.ambiguous-window': '找到多个候选窗口，本次未提醒。',
        'attention.wrong-desktop': '无法确认 Windows 桌面进程。',
        'attention.no-foreground': '无法确认前台窗口。',
        'attention.enumeration-failed': '无法枚举 Windows 窗口。',
        'attention.invalid-parent': 'Windows 桌面进程 ID 无效。',
        'attention.parent-exited': 'Windows 桌面进程已退出或不存在。',
        'attention.parent-inaccessible': '无法访问 Windows 桌面进程。',
        'attention.interop-unavailable': 'Windows 窗口管理接口不可用。',
        'attention.window-check-failed': 'Windows 窗口检查失败。',
        'attention.helper-aborted': 'Windows 助手已取消。',
        'attention.helper-timeout': 'Windows 助手检查超时。',
        'attention.helper-output-limit': 'Windows 助手输出超出限制，无法确认结果。',
        'attention.helper-invalid-result': 'Windows 助手返回的结果无效。',
        'attention.helper-failed': 'Windows 助手未能完成本次尝试。',
        'toast.submitted': '已提交通知。是否显示横幅由 Windows 决定。',
        'toast.ready': '发送者和通知内容可用（仅探测）。',
        'toast.skipped': '本次未发送通知。',
        'toast.app-not-registered': 'Windows 尚未将 DSH 注册为通知发送者。',
        'toast.failed': '无法检查或发送通知。',
        'toast.disabled:DisabledForApplication': '此应用的 Windows 通知已关闭。',
        'toast.disabled:DisabledForUser': '当前用户的 Windows 通知已关闭。',
        'toast.disabled:DisabledByGroupPolicy': '组策略已禁用 Windows 通知。',
        'toast.disabled:DisabledByManifest': '应用清单不允许发送 Windows 通知。',
        'title.hidden': '按隐私设置隐藏标题。',
        'title.unavailable': '没有可用的对话标题。',
        'title.attached': '通知包含对话标题。',
        'title.sample': '通知包含固定示例标题。',
        'title.not-submitted': '未提交 Windows 通知。',
        'activation.attached': '已附加打开 DSH 的动作。点击后是否切到前台由 Windows 决定。',
        'activation.protocol-unavailable': '仅用于提示。点击通知无法打开 DSH。',
        'activation.not-submitted': '未提交 Windows 通知。',
      },
    }

    const styles = `
      .dsh-task-notifications { display: grid; gap: 16px; min-width: 0; color: var(--dsw-alias-label-primary); }
      .dsh-task-notifications section {
        display: grid; gap: 12px; min-width: 0; padding: 16px;
        background: var(--dsw-alias-settings-card-fill);
        border: 1px solid var(--dsw-alias-settings-card-stroke); border-radius: 12px;
      }
      .dsh-task-notifications h2, .dsh-task-notifications h3, .dsh-task-notifications p,
      .dsh-task-notifications dl, .dsh-task-notifications dd { margin: 0; }
      .dsh-task-notifications h2 { font-size: 15px; line-height: 22px; font-weight: 600; }
      .dsh-task-notifications h3 { font-size: 13px; line-height: 20px; font-weight: 600; }
      .dsh-task-notifications .dsh-tn-row {
        display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 16px;
        font-size: 14px; line-height: 20px;
      }
      .dsh-task-notifications p, .dsh-task-notifications dl { font-size: 13px; line-height: 20px; }
      .dsh-task-notifications p, .dsh-task-notifications dt { color: var(--dsw-alias-label-secondary); }
      .dsh-task-notifications .dsh-tn-warning { color: var(--dsw-alias-label-primary); }
      .dsh-task-notifications .dsh-tn-error { color: var(--dsw-alias-state-error-primary); }
      .dsh-task-notifications .dsh-tn-control {
        box-sizing: border-box; min-block-size: 32px; padding: 5px 12px; border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 20px; cursor: pointer;
      }
      .dsh-task-notifications .dsh-tn-primary {
        border-color: var(--dsw-alias-button-primary-fill); background: var(--dsw-alias-button-primary-fill);
        color: var(--dsw-alias-label-primary-foreground);
      }
      @media (hover: hover) {
        .dsh-task-notifications .dsh-tn-control:not(:disabled):hover { background: var(--dsw-alias-interactive-bg-hover); }
        .dsh-task-notifications .dsh-tn-primary:not(:disabled):hover { background: var(--dsw-alias-button-primary-hover); }
      }
      .dsh-task-notifications button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
      .dsh-task-notifications button:disabled { opacity: .55; cursor: default; }
      .dsh-task-notifications .dsh-tn-switch-row { display: flex; align-items: center; gap: 8px; }
      .dsh-task-notifications .dsh-tn-switch {
        position: relative; box-sizing: border-box; width: 34px; height: 20px; flex: none;
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
        background: var(--dsw-alias-bg-layer-3); padding: 0; cursor: pointer;
      }
      .dsh-task-notifications .dsh-tn-switch::after {
        content: ''; position: absolute; inset-block-start: 2px; inset-inline-start: 2px;
        width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-label-secondary);
      }
      .dsh-task-notifications .dsh-tn-switch[aria-checked='true'] {
        background: var(--dsw-alias-button-primary-fill); border-color: var(--dsw-alias-button-primary-fill);
      }
      .dsh-task-notifications .dsh-tn-switch[aria-checked='true']::after {
        inset-inline-start: 16px; background: var(--dsw-alias-label-primary-foreground);
      }
      .dsh-task-notifications .dsh-tn-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .dsh-task-notifications .dsh-tn-test-copy p + p:not(:empty) { margin-block-start: 8px; }
      .dsh-task-notifications .dsh-tn-data {
        display: flex; flex-wrap: wrap; gap: 2px 16px; padding-block: 6px;
        border-block-start: 1px solid var(--dsw-alias-border-l2);
      }
      .dsh-task-notifications .dsh-tn-data dt { flex: 1 1 140px; }
      .dsh-task-notifications .dsh-tn-data dd { flex: 2 1 220px; min-width: 0; }
    `

    function readSnapshot(json) {
      if (typeof json?.showConversationTitle !== 'boolean' || typeof json.pending !== 'boolean') throw new Error()
      const { showConversationTitle, pending, status, testStatus } = json
      return { showConversationTitle, pending, result: readStatus(status), testResult: readStatus(testStatus ?? null) }
    }

    function readStatus(status) {
      if (status === null) return null
      if (!status || typeof status !== 'object' || Array.isArray(status)) throw new Error()
      const result = {}
      for (const field of ['kind', 'attention', 'toast', 'title', 'activation']) {
        const code = typeof status[field] === 'string' ? `${field}.${status[field]}` : ''
        // Retain translation keys only, never arbitrary data from the diagnostic response.
        result[field] = Object.hasOwn(dictionary.en, code) ? code : 'unknownStatus'
      }
      return result
    }

    function NotificationSettings({ t }) {
      const warningId = React.useId()
      const switchId = React.useId()
      const [snapshot, setSnapshot] = React.useState(null)
      const [draft, setDraft] = React.useState(null)
      const [busy, setBusy] = React.useState('refresh')
      const [notice, setNotice] = React.useState(null)
      const [error, setError] = React.useState(null)
      const currentRequest = React.useRef(null)

      const request = React.useCallback(async (action, enabled) => {
        if (currentRequest.current) return
        const controller = new AbortController()
        currentRequest.current = controller
        const timeout = setTimeout(() => controller.abort(), 12_000)
        setBusy(action)
        setError(null)
        setNotice(null)
        const failed = action === 'setTitle' ? 'saveFailed' : action === 'test' ? 'testFailed' : 'readFailed'
        try {
          const common = { signal: controller.signal, cache: 'no-store', mode: 'same-origin', credentials: 'same-origin', redirect: 'error' }
          const response = await fetch(controlEndpoint(), action === 'refresh' ? common : {
            ...common, method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action === 'setTitle' ? { action, enabled } : { action }),
          })
          if (currentRequest.current !== controller) return
          if (!response.ok) {
            if ([401, 403, 404].includes(response.status)) {
              setSnapshot(null)
              setDraft(null)
              setError('unavailable')
            } else {
              // Recognize fixed error codes only; never display the body or a raw diagnostic.
              const code = response.status === 409 ? (await response.json().catch(() => null))?.error : null
              if (currentRequest.current !== controller) return
              if (action === 'test' && code === 'test-pending') {
                setSnapshot(value => value === null ? value : { ...value, pending: true })
                setError('testBusy')
              } else {
                setError(action === 'setTitle' && code === 'title-not-saved' ? 'saveRejected' : failed)
              }
            }
            return
          }
          const next = readSnapshot(await response.json())
          if (currentRequest.current !== controller) return
          setSnapshot(next)
          if (action === 'refresh') setDraft(null)
          if (action === 'setTitle') {
            if (next.showConversationTitle === enabled) {
              setDraft(null)
              setNotice('saved')
            } else {
              setError(failed)
            }
          } else if (action === 'test') {
            setNotice('testStarted')
          }
        } catch {
          if (currentRequest.current === controller) setError(failed)
        } finally {
          clearTimeout(timeout)
          if (currentRequest.current === controller) {
            currentRequest.current = null
            setBusy(null)
          }
        }
      }, [])

      React.useEffect(() => {
        void request('refresh')
        return () => {
          const controller = currentRequest.current
          currentRequest.current = null
          controller?.abort()
        }
      }, [request])

      const checked = draft ?? snapshot?.showConversationTitle ?? false
      const dirty = snapshot !== null && checked !== snapshot.showConversationTitle
      const disabled = busy !== null || snapshot === null || ['saveFailed', 'testFailed', 'readFailed'].includes(error)
      const results = [snapshot?.testResult, snapshot?.result].filter(Boolean)
      function resultTable(result) {
        const rows = [
          ['lastResult', result.kind], ['attention', result.attention], ['toast', result.toast],
          ['titleStatus', result.title], ['activationStatus', result.activation],
        ]
        return h('dl', { key: result.kind }, rows.map(([label, value]) => h('div', { className: 'dsh-tn-data', key: label },
          h('dt', null, t(label)), h('dd', null, t(value)),
        )))
      }

      return h('div', { className: 'dsh-task-notifications' },
        h('style', null, styles),
        h('section', { 'aria-label': t('settings') },
          h('h2', null, t('settings')),
          h('div', { className: 'dsh-tn-row' },
            h('label', { htmlFor: switchId }, t('titleSwitch')),
            h('div', { className: 'dsh-tn-switch-row' },
              h('span', { 'aria-hidden': true }, t(snapshot === null ? 'unknown' : checked ? 'on' : 'off')),
              h('button', {
                id: switchId, type: 'button', role: 'switch', className: 'dsh-tn-switch', disabled,
                'aria-checked': checked, 'aria-describedby': warningId,
                onClick: () => {
                  const enabled = !checked
                  setDraft(enabled === snapshot.showConversationTitle ? null : enabled)
                  setNotice(null)
                },
              }),
            ),
          ),
          h('p', { id: warningId, className: 'dsh-tn-warning' }, t('privacyWarning')),
          h('div', { className: 'dsh-tn-controls' },
            h('button', {
              type: 'button', className: 'dsh-tn-control dsh-tn-primary', disabled: disabled || !dirty,
              onClick: () => void request('setTitle', checked),
            }, t(busy === 'setTitle' ? 'saving' : 'save')),
            h('p', { role: 'status' }, notice === 'saved' ? t(notice) : dirty ? t('unsaved') : null),
            (error === 'saveFailed' || error === 'saveRejected') && h('p', { role: 'alert', className: 'dsh-tn-error' }, t(error)),
          ),
        ),
        h('section', { 'aria-label': t('testHeading') },
          h('div', { className: 'dsh-tn-row' },
            h('h2', null, t('testHeading')),
            h('button', {
              type: 'button', className: 'dsh-tn-control', disabled: disabled || snapshot.pending,
              onClick: () => void request('test'),
            }, t(busy === 'test' ? 'starting' : 'test')),
          ),
          h('div', { className: 'dsh-tn-test-copy' },
            h('p', null, t('testHelp')),
            h('p', null, t('activationHelp')),
            h('p', { role: 'status' }, notice === 'testStarted' ? t(notice) : null),
          ),
          (error === 'testFailed' || error === 'testBusy') && h('p', { role: 'alert', className: 'dsh-tn-error' }, t(error)),
        ),
        h('section', { 'aria-label': t('diagnostics') },
          h('div', { className: 'dsh-tn-row' },
            h('h2', null, t('diagnostics')),
            h('button', {
              type: 'button', className: 'dsh-tn-control', disabled: busy !== null,
              onClick: () => void request('refresh'),
            }, t(busy === 'refresh' ? 'refreshing' : 'refresh')),
          ),
          (error === 'unavailable' || error === 'readFailed') && h('div', { role: 'alert' },
            h('p', { className: 'dsh-tn-error' }, t(error)),
            snapshot !== null && h('p', null, t('stale')),
          ),
          h('div', { role: 'status' },
            snapshot === null && busy === 'refresh' && h('p', null, t('loading')),
            snapshot?.pending && notice !== 'testStarted' && h('p', null, t('testPending')),
            snapshot !== null && !snapshot.pending && results.length === 0 && h('p', null, t('noResult')),
            results.map(resultTable),
          ),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(namespace, dictionary), 'task notifications: settings copy')
        ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config', key: 'dsh-task-notifications', locale: namespace,
        }, ({ t, view }) => view === 'page' ? h(NotificationSettings, { t }) : null)), 'task notifications: settings slot')
      },
    }
  },
})
