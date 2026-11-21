import { watchCompletions } from './completion.js'
import { requestAttention } from './windows.js'

export const inject = ['commands', 'profileContext', 'agents', 'goals']

const hints = {
  'flash-requested': '已请求 Windows 高亮 DSH 任务栏按钮。实际显示由 Windows 决定。',
  foreground: 'DSH 在前台，本次没有提醒。',
  'no-window': '没有可高亮的任务栏窗口（例如 DSH 已隐藏到托盘）。',
  'ambiguous-window': '找到多个候选窗口，未提醒。',
  'wrong-desktop': '无法确认 Windows 桌面进程，未提醒。',
  'no-foreground': '无法确认前台窗口，未提醒。',
  'enumeration-failed': '无法枚举 Windows 窗口，未提醒。',
}

const toastHints = {
  submitted: '系统通知：已提交，是否弹横幅由 Windows 决定。',
  skipped: '系统通知：本次未发送。',
  'app-not-registered': '系统通知：Windows 没有注册 DeepSeek Harness 发送者。',
  failed: '系统通知：发送失败，任务栏提醒不受影响。',
}

function formatResult({ attention, toast }) {
  const windowStatus = Object.hasOwn(hints, attention) ? hints[attention] : 'Windows 返回了未知任务栏状态。'
  const notificationStatus = toast?.startsWith('disabled:')
    ? '系统通知：Windows 未允许发送（' + toast.slice(9) + '）。'
    : Object.hasOwn(toastHints, toast) ? toastHints[toast] : 'Windows 返回了未知通知状态。'
  return `${windowStatus}\n${notificationStatus}`
}

export function apply(ctx) {
  if (process.platform !== 'win32' || ctx.profileContext.name !== 'desktop') return
  ctx.effect(() => {
    let timer
    let attempt
    let rerun
    let disposed = false
    let last = '还没有运行提醒。'

    function trigger(kind = 'auto') {
      if (disposed) return
      if (attempt !== undefined) {
        if (rerun !== 'test') rerun = kind
        return
      }
      const run = new AbortController()
      attempt = run
      const label = kind === 'test' ? '手动测试' : '对话结束'
      last = `${label}：正在检查 DSH 窗口。`
      void requestAttention({ signal: run.signal, test: kind === 'test' }).then(result => {
        if (!disposed) last = `${label}：${formatResult(result)}`
      }, () => {
        if (!disposed) last = `${label}：Windows 助手未能运行或超时。`
      }).finally(() => {
        attempt = undefined
        if (rerun !== undefined && !disposed) {
          const next = rerun
          rerun = undefined
          trigger(next)
        }
      })
    }

    const removeStart = ctx.commands.register({
      name: 'taskbar-test',
      description: '10 秒后手动验证 DSH 任务栏高亮和 Windows 通知',
      handler() {
        if (timer !== undefined) return { kind: 'error', text: '已有一次手动测试在倒计时。' }
        last = '已开始倒计时：10 秒内切去其他应用，或最小化 DSH，观察高亮和静音通知。'
        timer = setTimeout(() => {
          timer = undefined
          trigger('test')
        }, 10_000)
        return { kind: 'success', text: last }
      },
    })
    const removeStatus = ctx.commands.register({
      name: 'taskbar-test-status',
      description: '查看最近一次任务栏和系统通知状态',
      handler: () => ({ kind: 'success', text: last }),
    })
    const stopWatching = watchCompletions(ctx, trigger)
    return () => {
      disposed = true
      stopWatching()
      clearTimeout(timer)
      attempt?.abort()
      removeStatus()
      removeStart()
    }
  }, 'taskbar reminder: completion events and manual test commands')
}
