# 实现原理与发布评估

> 适用于当前 0.1.x 开发线。0.1.0 的历史审核与缺陷记录见 `v0.1.0` 标签中的旧版本文档；本文件只描述修复后的状态。

## 1. 范围与版本绑定

- 仅适用于 Windows 上的 DSH Desktop `0.2.2-rc.5`；其他 profile、macOS 和独立 Web 部署不工作。
- `engines.dsh` 是精确版本。DSH 的兼容性预检会把不满足要求的行标为 `disabled`，所以 DSH 升级后插件会停用，直到发布匹配的新版本。不要在没有跑完验收的情况下放宽范围。
- 提醒对象是正在运行的主对话：DSH 在后台、该轮真正结束时请求任务栏高亮和静音通知。子代理、空轮、主动取消、单独的定时轮次和 Goal 自动续跑的中间轮次不触发。

## 2. 组成与数据流

1. **Host 入口**：[`index.js`](../index.js) 在 `win32` + `desktop` profile 下激活，注入 `profileContext`、`agents`、`goals`、`connection`。
2. **完成判定**：[`completion.js`](../completion.js) 只观察激活后的实时事件；按事件循环批次合并候选，再确认同一会话、Agent 空闲、无排队输入、Goal 不在 `active + armed`。暂停的 Goal 只抑制与它自己的输入有关的候选。
3. **标题**：[`titles.js`](../titles.js) 只读当前会话的 `title` 投影；[`config.js`](../config.js) 的 `showConversationTitle` 是 `volatile` 字段，保存时不重挂载插件，进行中的测试和诊断状态不会丢。
4. **本机交付**：[`index.js`](../index.js) 同时只运行一个助手，最多合并一个后续请求；卸载时解除监听、取消倒计时并中止助手。[`windows.js`](../windows.js) 只执行固定的 PowerShell 路径和随包脚本，不拼接会话内容，不传完整环境，12 秒超时、32 KiB 输出上限。
5. **窗口与通知**：[`flash.ps1`](../flash.ps1) 核对父进程、可执行文件、Windows 会话、窗口所有权和前台；用 `FlashWindowEx` 请求任务栏提醒（不抢焦点），用 DSH 安装器注册的 `com.deepseek.dsh` 身份提交静音 Toast；发送前复检前台。没有任务栏窗口时仍尝试通知。`submitted` 只表示已提交，不表示用户看到了横幅。
6. **详情页**：[`client.js`](../client.js) 是一个 Client 插件，通过 `plugins.bundle.config`（以包名为 key）在插件详情页渲染设置、测试和诊断；它通过 `api/dsh-task-notifications` 与 Host 的 owner-only 路由通信。

## 3. 关键实现决定

- **不再用 `-EncodedCommand`**：旧方案把整个脚本编码进命令行，实测 32,721 / 32,767 字符，只剩约 45 字符余量，任何文案增加都可能让助手启动失败且没有测试能发现。现在直接 `-File` 执行包内 `flash.ps1`，并新增“用不存在的父进程 PID 真实启动一次”的回归。
- **`flash.ps1` 必须保存为 UTF-8 with BOM**：Windows PowerShell 5.1 会把无 BOM 的脚本按 ANSI 代码页读取，中文文案会解析失败；文件顶部有说明，修改后要保留 BOM。
- **通知文案跟随 Windows 显示语言**：`CurrentUICulture` 为中文时用中文，其他语言回退英文；测试示例标题也由 `flash.ps1` 提供，Host 不再传中文示例。DSH 界面语言不覆盖系统通知语言。
- **Toast 唤起按系统版本降级**：Windows 10（build < 22000）的 Toast 不派发 `activationType="protocol"`，点击只关闭通知；`flash.ps1` 在 Win10 上把 `activation` 记为 `protocol-unavailable`，标题加“请手动切回”后缀。Windows 11 才附加 `dsh://open`，且仍受前台锁和 DSH 聚焦实现影响。
- **固定码表**：attention / toast / title / activation 只允许约定的代码；HTTP 路由只接受 `{"action":"test"}` 或 `{"action":"setTitle","enabled":boolean}`，512 B 上限、精确 JSON 形状、重复键检测、固定错误码，不把原始异常、路径或聊天文本送出边界。
- **隐私默认开启是产品决策**：标题可能包含首条提示词片段，并可能出现在锁屏或通知中心。README、插件描述和发布说明必须保留该披露；关闭只影响之后的提醒，不删除历史通知。
- **保存链路**：页面通过 `configEditor.edit` 写 profile 补丁，`volatile` 字段原地提交；[`check-preferences.mjs`](../check-preferences.mjs) 用模拟的 Loader 引用覆盖保存成功、拒绝和路由注销。真实桌面端已由用户实测：保存 → 完整重启 → 值仍在（2026-11-22）。
- **市场发布不依赖 npm**：`private: true` 保持不变。公开 Discover 的 format-1 索引当前只收 npm 版本，因此本包的市场入口是 **awesome-dsh-plugin / dshmarket** 目录的 GitHub Release tarball 条目（`docs/market-entry.yml`），不是公开 Discover 索引。包元数据已提供 `author`、`icon`、`homepage`、`repository`、`keywords`、`license`、`engines.dsh` 和 `assets/icon-180.png`；README 作为插件详情的长描述回退，双语覆盖 en/zh。若以后要进公开 Discover，需要发布 npm，或让用户配置一个支持 `git` source 的自建索引。
- **控制路由的 base**：[`client.js`](../client.js) 用 `document.baseURI` 显式解析控制地址，避免 `<base>` 或路径前缀把请求带到错误位置。

## 4. 验证状态

已通过：

- `npm test`：会话生命周期、队列、Goal、取消、错误归因、标题、Windows 结果校验、双语 Toast 载荷、随包助手真实启动、控制路由输入校验、保存链路。
- 本机只读探测：`node check.mjs <DSH主进程PID> "<DSH可执行文件>"`，确认窗口定位和通知载荷就绪，探测模式不调用 `Show`。
- 详情页保存 → 完全重启 DSH → 值仍在（2026-11-22 用户实测）。
- Windows 10 22H2：通知可显示；点击只关闭通知（系统不派发协议激活），与实现预期一致。
- 0.1.2 的 tarball 在一次性 profile 中安装成功，`@deepseek-ai/schemastery` 由 profile 根解析，`Config` 默认标题为 `true`；该 profile 已清理。
- 0.1.1 的 GitHub 资产与当时的 `v0.1.1` HEAD 经 `npm pack` 的产物逐字节一致。

未验证（发布前手工做）：

- 真实横幅/通知中心/锁屏的显示、托盘隐藏时的点击；
- Windows 11、其他机器、英文 Windows 下的实际通知文案与点击/聚焦；
- 真实自动完成路径的端到端通知（自动测试使用模拟事件）。

## 5. 已知限制

- DSH 升级后插件会被停用，需要跟随发版；这是精确版本锁定的预期结果。
- 每次提醒新起 PowerShell、编译 C#、读取 Start 菜单，本机完整探测约 0.5–1.2 秒；这是提交延迟，不是横幅出现时间。
- 组策略可能阻止 `Add-Type` 或 `-File`；非标准安装可能没有正确的开始菜单发送者注册；多窗口或候选不明确时跳过。
- 不抢焦点、不改托盘图标、不支持等待答复/审批或对话深链；Windows 10 点击通知只关闭通知，Windows 11 点击请求回到 DSH，但可能被前台锁或虚拟桌面挡住。
- 通知只含固定提示或当前标题，不含消息正文；但标题和完成时间仍可能在锁屏或通知中心可见。

## 6. 发布检查表

1. `npm ci && npm test`。
2. 只读探测：`node check.mjs <DSH主进程PID> "<DSH可执行文件完整路径>"`。
3. 手工验收：Windows 10 22H2 与 Windows 11；标题开/关/再开（含重启）；设置页保存；横幅、通知中心、锁屏、托盘隐藏；中英文 Windows 文案。Win10 验证点击只关闭并出现手动切回提示；Win11 验证点击/聚焦。
4. 更新 `version`，`npm pack --ignore-scripts`，记录 SHA-256。
5. 打 tag、上传 `dsh-task-notifications.tgz`，发布说明写支持版本、默认标题披露和 SHA-256；市场条目用 `docs/market-entry.yml`，指向该 Release tarball，不发布 npm。
6. 干净 profile 安装、使用、卸载各一次（0.1.2 已做安装与 `Config` 加载，界面使用和卸载待做）。
7. 仓库创建满 1 天后，把 `docs/market-entry.yml` 复制为 awesome-dsh-plugin 的 `data/plugins/Magicqy__dsh-task-notifications.yml` 并提 PR；dshmarket 次日刷新，公开 Discover 索引仍只收 npm 版本。

没有通过的项不要写成已支持。
