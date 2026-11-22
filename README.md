# DSH 对话提醒 / DSH Conversation Notifications

> Windows DSH Desktop: when a main conversation finishes in the background, request taskbar attention and send a silent Windows notification.

English | [中文](#中文)

`dsh-task-notifications` is a third-party plugin. It currently supports **DSH Desktop `0.2.2-rc.5` on Windows**. Standalone Web deployments, macOS, and other unverified DSH versions are not supported.

## Install and develop

- **Release**: download the archive from [GitHub Releases](https://github.com/Magicqy/dsh-task-notifications/releases), then choose it in **Plugins → Add plugin**. Uninstall the previous version first; also uninstall the old `@local/dsh-taskbar-test` prototype to avoid duplicate reminders.
- **Development**: run `npm ci` in this repository, then choose the repository directory in **Plugins → Add plugin**. Keep the local link and make changes here. Reload or restart DSH after Host or client changes, then reopen the plugin details.
- Disable or uninstall from the Plugins page. The plugin does not modify the registry, install a system service, or keep a resident helper running.

## Settings and diagnostics

Open **Plugins → Taskbar and system notifications** and use **Notification privacy**, **Test a notification**, and **Notification diagnostics** on the details page. There are no slash commands for this plugin.

- **Show conversation title** — on by default. Turn it off in **Notification privacy** and click **Save** to hide titles in future notifications. The plugin reads only DSH's current title, never message bodies; an automatic title can contain an excerpt from the first prompt. Windows may keep a title in Notification Center or on the lock screen; turning this off does not remove existing notifications. Merged reminders and conversations without a title use generic wording. A saved opt-out survives upgrades.
- **Test a notification** — click **Test in 10 seconds**, then switch to another app or minimize DSH. With titles on, the test uses a fixed sample instead of a real title. Return and click **Refresh** to inspect the taskbar result, Windows notification, title handling, and activation. The test does not call a model.
- **Open DSH from the notification** — a standard DSH Desktop package registers the `dsh` protocol at startup; the plugin never writes the registry. On Windows 11 only, the plugin attaches the fixed `dsh://open` action while the registered command matches the running Desktop executable. Windows 10 does not dispatch protocol activation from toasts, so the plugin marks it unavailable, the toast asks you to switch back manually, and clicking only dismisses it. On Windows 11, clicking asks DSH to bring its window forward, but Windows can still keep it behind other windows; it never opens a specific conversation. Check the association with `Win + R` → `dsh://open`. "Submitted" does not mean the banner was shown, and an attached action does not guarantee Windows actually raises the window.

## Scope and environment limits

- A finished background main conversation can trigger a reminder. Subagents, standalone scheduled rounds, intermediate Goal auto-rounds, and user cancellations do not trigger; DSH in the foreground does not notify.
- A taskbar window is asked to flash; when DSH is hidden in the tray the plugin still tries the notification but there is no taskbar button. Automatic reminders do not steal focus or change the tray icon.
- Requires Windows PowerShell 5.1, desktop Win32/WinRT APIs, and the DSH Windows notification sender registration. Group policy, Do Not Disturb, or notification permissions can limit the result; the plugin does not bypass them. Banner clicks and Notification Center retention/click behavior are decided by Windows.
- Notification wording follows the Windows display language: Chinese Windows gets Chinese, other display languages fall back to English. DSH's in-app language does not override it.
- Not included: wait-for-input or wait-for-approval reminders, and conversation deep links.

## DSH version binding

`package.json` pins `engines.dsh` to the verified `0.2.2-rc.5`. DSH disables a plugin row whose requirement is unmet, so after DSH updates this plugin stays disabled until a matching plugin release. Publish a new plugin version for each verified DSH version, and widen the range only after running the acceptance below on the new build.

## Regression and release

Run `npm ci` and `npm test`. Tests do not send a real notification, flash the taskbar, or start DSH; the Windows suite launches the packaged helper once with a nonexistent parent PID, which returns before any window or toast work. Run `node check.mjs <DSH main PID> "<DSH executable>"` for a read-only window/notifier probe. `npm pack --offline --ignore-scripts` builds the GitHub archive; the package is not published to npm. The public Discover index currently lists npm versions only, so the market route is the community catalog/dshmarket via the GitHub release tarball, not an npm version.

Release checklist:

1. Run the acceptance on Windows 10 22H2 and Windows 11: default title on, off, and on again, including restart; the settings page; banner, Notification Center, and tray-hidden click. On Windows 10, toast clicks only dismiss; verify the manual-switch hint instead.
2. Bump `version`, run `npm test`, and run the live probe.
3. `npm pack --ignore-scripts`, record the SHA-256, tag, and upload `dsh-task-notifications.tgz` with the SHA-256 in the release notes.
4. Install the archive in a clean profile and verify install, use, and uninstall.

Never claim an environment that has not passed.

## 中文

> Windows 版 DSH Desktop 在后台时，主对话结束后高亮任务栏按钮并发送静音通知。

`dsh-task-notifications` 是第三方插件。当前声明支持 **Windows 上的 DSH Desktop `0.2.2-rc.5`**；不支持 Web 独立部署、macOS 或其他未验证的 DSH 版本。

### 安装和开发

- 发布版：从 [GitHub Releases](https://github.com/Magicqy/dsh-task-notifications/releases) 下载对应版本，在「插件 → 添加插件」选择安装包。升级前先卸载旧版；旧原型 `@local/dsh-taskbar-test` 也应卸载，避免重复提醒。
- 开发版：在本仓库根目录运行 `npm ci`，然后在 DSH 的「插件 → 添加插件」选择本仓库目录。保留这个本地链接，后续修改在本仓库完成。Host 和客户端代码变更按安装提示重新加载或重启 DSH，再打开插件详情。
- 禁用或卸载在插件页完成。插件不修改注册表，不安装系统服务，不另开常驻助手。

### 设置与诊断

打开「插件 → 任务栏与系统通知」，在插件详情页直接使用「通知隐私」「测试通知」「通知诊断」。斜杠菜单没有本插件的测试或配置命令。

- **显示对话标题**：默认开启；在「通知隐私」关闭并点击「保存」即可隐藏之后的标题。只读取 DSH 的当前标题，不直接读取消息正文；自动标题可能包含首条消息的片段。Windows 可能在通知中心或锁屏保留标题，关闭不删除历史通知。多个对话合并或没有标题时用通用文案。升级保留已保存的关闭设置。
- **测试通知**：在页面点击「10 秒后测试」，切到其他应用或最小化 DSH。开启标题时，测试也只用固定示例。回来后点击「刷新」，分别查看任务栏、系统通知、标题处理与唤起动作。测试不调用模型。
- **点击唤起**：标准打包的 DSH Desktop 启动时会自动向 Windows 注册 `dsh` 协议，安装并打开桌面版即可，插件不会写注册表。只有 **Windows 11** 且注册项指向当前的 DSH 可执行文件时，插件才附加固定的 `dsh://open` 唤起动作；**Windows 10 的 Toast 不派发协议激活**，插件会标记为未附加，通知文案会提示手动切回，点击只关闭通知。Windows 11 点击会让 DSH 尝试把窗口带到前台，但系统仍可能因前台锁保持原状；不跳转到指定对话。可用 `Win + R` 输入 `dsh://open` 单独验证关联。「已提交」不代表横幅已显示，「附加唤起」也不保证 Windows 实际切到前台。

### 提醒范围及环境限制

- 已结束的后台主对话可以触发提醒。子代理、单独的定时任务轮次、Goal 自动续跑的中间轮次及主动取消不触发。DSH 在前台时不提醒。
- 有任务栏窗口时请求高亮；DSH 藏入托盘后仍尝试发通知，但没有任务栏按钮。自动提醒不抢焦点，不改托盘图标。
- 需要 Windows PowerShell 5.1、可用的桌面 Win32/WinRT 接口和 DSH 的 Windows 通知发送者注册。组策略、勿扰或通知权限可能限制效果；插件不绕过限制。横幅点击与通知中心保留、点击分别由系统决定。
- 通知文案跟随 Windows 显示语言：中文系统用中文，其他显示语言回退英文；DSH 界面语言不单独覆盖。
- 不支持等待答复、等待审批或对话深链。

### 与 DSH 版本的绑定

`package.json` 的 `engines.dsh` 精确锁定已验证的 `0.2.2-rc.5`。DSH 会停用不满足版本要求的插件行，因此 DSH 升级后，本插件会保持停用，直到发布匹配的新版本。每个已验证的 DSH 版本都应发布对应插件版本；只有在新版本上跑完验收，才放宽范围。

### 回归与发布

在仓库运行 `npm ci`、`npm test`。测试不发送真实通知、不高亮任务栏、不启动 DSH；Windows 套件会用不存在的父进程 PID 启动一次随包助手，助手在窗口和通知工作之前就返回。可运行 `node check.mjs <DSH主进程PID> "<DSH可执行文件完整路径>"` 执行只读探测。`npm pack --offline --ignore-scripts` 用于生成 GitHub 安装包，不发布到 npm 注册表。公开 Discover 索引当前只收 npm 版本；因此市场路径走社区目录/dshmarket 的 GitHub Release tarball，而不是 npm 版本。

发布清单：

1. 在标准安装的 Windows 10 22H2 和 Windows 11 上测试标题默认开启、关闭及重新开启（含重启），测试插件设置页，并分别确认横幅、通知中心、托盘隐藏时的点击效果；Windows 10 点击只关闭通知，验证手动切回提示即可。
2. 更新 `version`，运行 `npm test` 和只读探测。
3. `npm pack --ignore-scripts`，记录 SHA-256，打 tag，上传 `dsh-task-notifications.tgz`，并在发布说明里写入 SHA-256。
4. 在干净 profile 里安装该安装包，验证安装、使用和卸载。

没有通过的环境不应写成已支持。
