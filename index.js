import { watchCompletions } from './completion.js'
import { requestAttention } from './windows.js'

export const inject = ['commands', 'profileContext', 'agents', 'goals']

const hints = {
  'flash-requested': '已请求 Windows 高亮 DSH 任务栏按钮。实际显示由 Windows 决定。',
  ready: '已确认 DSH 任务栏窗口（仅探测）。',
  foreground: 'DSH 在前台，本次没有提醒。',
  'no-window': '没有可高亮的任务栏窗口（例如 DSH 已隐藏到托盘）。',
  'ambiguous-window': '找到多个候选窗口，未提醒。',
  'wrong-desktop': '无法确认 Windows 桌面进程，未提醒。',
  'no-foreground': '无法确认前台窗口，未提醒。',
  'enumeration-failed': '无法枚举 Windows 窗口，未提醒。',
  'invalid-parent': 'Windows 桌面进程 ID 无效，未提醒。',
  'parent-exited': 'Windows 桌面进程已退出或不存在，未提醒。',
  'parent-inaccessible': '无法访问 Windows 桌面进程，未提醒。',
  'interop-unavailable': '无法加载 Windows 窗口接口，未提醒。',
  'window-check-failed': 'Windows 窗口检查失败，未提醒。',
  'helper-aborted': 'Windows 助手已取消。',
  'helper-timeout': 'Windows 助手检查超时。',
  'helper-output-limit': 'Windows 助手输出超出限制，无法确认结果。',
  'helper-invalid-result': 'Windows 助手返回的结果无效。',
  'helper-failed': 'Windows 助手未能完成检查。',
}

const toastHints = {
  submitted: '系统通知：已提交，是否弹横幅由 Windows 决定。',
  ready: '系统通知：发送者和通知内容可用（仅探测）。',
  skipped: '系统通知：本次未发送。',
  'app-not-registered': '系统通知：Windows 没有注册 DeepSeek Harness 发送者。',
  failed: '系统通知：检查或发送失败，任务栏提醒不受影响。',
  'disabled:DisabledForApplication': '系统通知：此应用的通知已关闭。',
  'disabled:DisabledForUser': '系统通知：当前用户的通知已关闭。',
  'disabled:DisabledByGroupPolicy': '系统通知：组策略禁止发送通知。',
  'disabled:DisabledByManifest': '系统通知：应用清单不允许发送通知。',
}

function formatResult({ attention, toast }) {
  const windowStatus = Object.hasOwn(hints, attention) ? hints[attention] : 'Windows 返回了未知任务栏状态。'
  // A transport failure cannot confirm whether PowerShell reached the OS APIs.
  if (attention.startsWith('helper-')) return windowStatus
  const notificationStatus = Object.hasOwn(toastHints, toast) ? toastHints[toast] : 'Windows 返回了未知通知状态。'
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
      }).finally(() => {
        attempt = undefined
        if (rerun !== undefined && !disposed) {
          const next = rerun
          rerun = undefined
          trigger(next)
        }
      }).catch(() => {
        // Handle unexpected formatting or cleanup failures too, without exposing
        // raw helper output or replacing a queued attempt's newer status.
        if (!disposed && attempt === undefined) last = `${label}：Windows 助手未能完成检查。`
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
