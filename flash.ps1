$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class DshTaskbarFlashTest {
    private delegate bool EnumProc(IntPtr hwnd, IntPtr ignored);

    [StructLayout(LayoutKind.Sequential)]
    private struct FlashInfo {
        public uint size;
        public IntPtr hwnd;
        public uint flags;
        public uint count;
        public uint timeout;
    }

    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr ignored);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr hwnd, uint command);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] private static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder name, int maxCount);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
    [DllImport("user32.dll")] private static extern bool FlashWindowEx(ref FlashInfo info);

    private const uint Owner = 4;
    private const uint RootOwner = 3;
    private const int ExtendedStyle = -20;
    private const int ToolWindow = 0x80;
    private const uint FlashTaskbar = 0x02;
    private const uint FlashUntilForeground = 0x0C;

    private static bool IsDesktopWindow(IntPtr hwnd, uint expectedPid) {
        uint pid;
        if (GetWindowThreadProcessId(hwnd, out pid) == 0 || pid != expectedPid) return false;
        if (!IsWindowVisible(hwnd) || GetWindow(hwnd, Owner) != IntPtr.Zero) return false;
        if ((GetWindowLong(hwnd, ExtendedStyle) & ToolWindow) != 0) return false;
        var name = new StringBuilder(100);
        return GetClassName(hwnd, name, name.Capacity) > 0
            && name.ToString().StartsWith("Chrome_WidgetWin_", StringComparison.Ordinal);
    }

    public static string Run(int parentId, string desktopPath, bool probeOnly) {
        if (parentId <= 0 || String.IsNullOrEmpty(desktopPath) || !Environment.UserInteractive) return "wrong-desktop";
        using (var self = Process.GetCurrentProcess())
        using (var parent = Process.GetProcessById(parentId)) {
            if (parent.SessionId != self.SessionId || parent.SessionId == 0
                || !String.Equals(parent.MainModule.FileName, desktopPath, StringComparison.OrdinalIgnoreCase)) return "wrong-desktop";

            var foreground = GetForegroundWindow();
            if (foreground == IntPtr.Zero) return "no-foreground";
            uint foregroundPid;
            GetWindowThreadProcessId(foreground, out foregroundPid);
            if (foregroundPid == (uint)parentId) return "foreground";

            var matches = new List<IntPtr>();
            if (!EnumWindows(delegate (IntPtr hwnd, IntPtr ignored) {
                if (IsDesktopWindow(hwnd, (uint)parentId)) matches.Add(hwnd);
                return true;
            }, IntPtr.Zero)) return "enumeration-failed";
            if (matches.Count == 0) return "no-window";
            if (matches.Count != 1) return "ambiguous-window";

            var window = matches[0];
            foreground = GetForegroundWindow();
            if (foreground == IntPtr.Zero) return "no-foreground";
            GetWindowThreadProcessId(foreground, out foregroundPid);
            if (foregroundPid == (uint)parentId || GetAncestor(foreground, RootOwner) == window) return "foreground";

            if (parent.HasExited || !IsDesktopWindow(window, (uint)parentId)) return "no-window";
            if (probeOnly) return "ready";

            var info = new FlashInfo {
                size = (uint)Marshal.SizeOf(typeof(FlashInfo)), hwnd = window,
                flags = FlashTaskbar | FlashUntilForeground, count = 0, timeout = 0
            };
            // Win32 reports the previous active state (not success). Do not send
            // FLASHW_STOP: the shell may have a separate update reminder.
            FlashWindowEx(ref info);
            return "flash-requested";
        }
    }
}
'@

$probe = $env:DSH_FLASH_PROBE -eq '1'
$rootPid = [int]$env:DSH_FLASH_PID
$attention = [DshTaskbarFlashTest]::Run($rootPid, $env:DSH_FLASH_EXE, $probe)
$toastResult = 'skipped'

# Probe the notifier even in the foreground, but never show a probe notification.
if ($probe -or $attention -in @('flash-requested', 'no-window')) {
    try {
        # Use the app identity already registered by the Desktop installer.
        $appId = 'com.deepseek.dsh'
        if ((Get-StartApps).AppID -notcontains $appId) {
            $toastResult = 'app-not-registered'
        } else {
            $null = [Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]
            $null = [Windows.UI.Notifications.ToastNotification,Windows.UI.Notifications,ContentType=WindowsRuntime]
            $null = [Windows.UI.Notifications.ToastNotifier,Windows.UI.Notifications,ContentType=WindowsRuntime]
            $null = [Windows.UI.Notifications.NotificationSetting,Windows.UI.Notifications,ContentType=WindowsRuntime]
            $null = [Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime]
            $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)
            $setting = [string]$notifier.Setting
            if ($setting -and $setting -ne 'Enabled') {
                $toastResult = 'disabled:' + $setting
            } else {
                $xml = [Windows.Data.Xml.Dom.XmlDocument]::new()
                $xml.LoadXml('<toast><visual><binding template="ToastGeneric"><text/><text/></binding></visual><audio silent="true"/></toast>')
                $text = $xml.GetElementsByTagName('text')
                if ($env:DSH_TOAST_TEST -eq '1') {
                    $text.Item(0).InnerText = 'DSH 提醒测试'
                    $text.Item(1).InnerText = '这是手动触发的 Windows 通知。'
                } else {
                    $text.Item(0).InnerText = 'DSH 对话已结束'
                    $text.Item(1).InnerText = '可以切回 DeepSeek Harness 查看结果。'
                }
                $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
                if ($probe) {
                    $toastResult = 'ready'
                } else {
                    # Recheck without flashing in case the user switched back
                    # while the notifier and sender registration were prepared.
                    $now = [DshTaskbarFlashTest]::Run($rootPid, $env:DSH_FLASH_EXE, $true)
                    if ($now -in @('ready', 'no-window')) {
                        $notifier.Show($toast)
                        $toastResult = 'submitted'
                    } else {
                        $toastResult = 'skipped'
                    }
                }
            }
        }
    } catch {
        $toastResult = 'failed'
        if ($probe) { [Console]::Error.WriteLine($_.Exception.Message + "`n" + $_.ScriptStackTrace) }
    }
}

@{ attention = $attention; toast = $toastResult } | ConvertTo-Json -Compress
