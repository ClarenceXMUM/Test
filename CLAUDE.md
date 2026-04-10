# COROS 训练分析工具 · 项目状态

> 本地跑步训练分析工具，面向中长跑运动员（800m/1500m）。读取 FIT 文件，展示步幅、步频、心率等关键指标，支持间歇训练分段对比与疲劳节点检测。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 18 + Vite + TypeScript |
| 图表 | Recharts（ComposedChart、双/三 YAxis、ReferenceLine、ReferenceArea） |
| 存储 | IndexedDB（VERSION 4，idb-keyval 风格手写） |
| 样式 | 纯 CSS，Apple 设计语言（白底、#007AFF、16px 圆角、SF系字体） |
| FIT 解析 | fit-file-parser（半步频 ×2、speed m/s、vertical_oscillation mm） |

---

## 已完成阶段

### Phase 1 — 基础框架
- 三栏布局骨架（已在 Phase 4 重构为侧边栏）
- FIT 文件导入与解析
- 步幅/步频折线图（Recharts）

### Phase 2 — 图表增强
- 动态 Y 轴域（`computeYDomain`，±15% margin）
- 间歇检测（`detectIntervals`：步频 ≥ 150 spm，持续 ≥ 30 秒）
- 间歇视图（`buildIntervalViewData`：虚拟 X 轴对齐各组）
- 数据平滑（滑动中位数 + 移动平均两步法）
- 异常过滤（`filterAnomalies`：生理不可能值 → 线性插值）

### Phase 3 — 本地存储 + 训练日管理
- IndexedDB 多 store（sessions + training_days）
- 训练日聚合（`saveOrMergeDay`）
- 日历卡片视图 + 点击展开 `DayModal` 浮层
- 疲劳节点检测（`detectBreakpoints`：10s vs 30s 滑窗，stride 下降 > 5%，仅 > 3 分钟间歇）
- 活动类型判断（`activityType: 'interval' | 'continuous'`）

### Phase 4 — 数据丰富 + 布局重构
- **主训练判断规则**：`peakSpeedMs ≥ 1000/270 ≈ 3.704 m/s`（即配速 4:30/km 以内）
- **批量导入 + 去重**：多文件选择，`startTime` 唯一索引（DB VERSION 3），跳过重复，进度提示
- **心率线**：`heartRate` 字段，chart 右侧第三条线（珊瑚红 #FF6B6B），有数据才显示
- **垂直振幅比 (VO) 子图**：橙色 #FF9F0A，100px 子图，仅完整视图显示
- **圈次标记**：`LapData`，全视图 ReferenceLine + 浮动 `.lap-tooltip`
- **侧边栏导航重构**：`Sidebar` + `PanelDrawer` 替换三栏布局
- **深度分析年月日级联选择器**：替代文件上传，从 DB 读取可用日期

### Phase 5 — Bug 修复 + 训练日志 + 跑量修正 + 目标设定

#### Bug 修复
- **Invalid Date**：`DayModal` 改为直接使用 `date` prop（`YYYY-MM-DD`）渲染日期，`formatDateLong` 补充 `T12:00:00` 防止 UTC 时区偏移
- **深度分析圈次模块**：新增"圈次数据" Card，含全部/跑步/恢复 Tab 过滤、横向色块行、汇总行

#### 新功能
- **训练日志**：`DayModal` 顶部新增多行文本输入区，1.5s 防抖自动保存，内容存入 `training_days.notes`，重新打开自动加载
- **跑量手动修正**：`DayModal` 内"跑量修正"区块，点击距离/时间进入内联编辑，Enter 或 ✓ 保存，重置按钮清除覆盖值，修改后显示橙色 ✎ 标记
- **月/周分层展示**：`OverviewContent` 按月分组（粗体月标题 + 月跑量），月内按 ISO 周分组（第X周 + 周跑量），周跑量由手动修正值汇总
- **目标设定**：`ProfileContent` 完整实现，支持 800m/1000m/1500m/3000m/自定义多条目，各距离预设字段，自定义距离可动态添加/删除字段，数据存入 IndexedDB `goals` store

### Phase 5 补丁

#### Bug 修复
- **间歇段判定阈值**：`detectIntervals` `minDurationSec` 由 20 秒改为 **30 秒**，避免短暂高步频片段误判为间歇段

#### 清理
- 移除 `DayModal` 中的 `TrainingLog`（训练日志）与 `ManualOverride`（跑量修正）两个空显示模块

#### 新功能
- **手动删除训练记录**：`DayModal` 内训练条目支持长按 800ms 进入删除模式（背景变红、显示"删除"文字），点击确认删除；原位置出现撤销栏，5 秒内可撤销；点击其他区域退出删除模式不删除；倒计时结束后真正从 IndexedDB 删除（session + training_day 联动更新，当天无剩余 session 时自动删除 training_day）

---

## 目录结构

```
src/
├── App.tsx / App.css              # 侧边栏 + PanelDrawer 布局
├── types/
│   └── training.ts                # 所有 TypeScript 类型（含 GoalEntry / GoalField）
├── lib/
│   ├── fitParser.ts               # FIT 解析（HR / VO / Laps / Breakpoints）
│   ├── db.ts                      # IndexedDB VERSION 4
│   └── chartUtils.ts              # 图表算法（过滤/平滑/检测/降采样）
└── components/
    ├── ui/
    │   └── Card.tsx               # 可折叠卡片
    ├── charts/
    │   └── StrideCadenceChart.tsx # 主图表组件（+ CSS）
    └── layout/
        ├── Sidebar.tsx / .css     # 左侧 200px 导航栏
        ├── PanelDrawer.tsx / .css # 滑入内容面板
        ├── OverviewContent.tsx / OverviewContent.css  # 训练总览（月/周分层 + 批量导入）
        ├── AnalysisContent.tsx / AnalysisContent.css  # 深度分析（级联选择器 + 图表 + 圈次）
        ├── ProfileContent.tsx / ProfileContent.css    # 个人中心（目标设定）
        ├── Content.css            # 共用内容区样式
        └── DayModal.tsx / .css    # 训练日浮层（长按删除 + 撤销）
```

---

## 关键类型（training.ts）

```typescript
export const MAIN_TRAINING_MIN_SPEED_MS = 1000 / 270  // 4:30/km ≈ 3.704 m/s

export interface RecordPoint {
  time: number          // seconds from session start
  cadence: number       // spm (already ×2 from half-cadence)
  stride: number        // cm
  distanceM?: number
  heartRate?: number    // bpm
  verticalOscillation?: number  // mm
}

export interface LapData {
  lapNumber: number
  startTime: number     // seconds from session start
  endTime: number
  distanceM: number
  avgSpeedMs: number
  avgHeartRate?: number
  avgCadence?: number
}

export interface Breakpoint {
  time: number; relativeTime: number; distanceM: number
  intervalIndex: number; strideBefore: number; strideAfter: number
}

export interface TrainingSession {
  id: string; startTime: string; date: string
  distanceKm: number; durationSec: number; avgPaceSecPerKm: number
  peakSpeedMs: number; activityType: ActivityType
  records: RecordPoint[]; breakpoints: Breakpoint[]; laps: LapData[]
}

export interface TrainingDay {
  date: string              // YYYY-MM-DD — keyPath
  sessionIds: string[]
  totalDistanceKm: number
  totalDurationSec: number
  notes?: string            // 训练日志
  manualDistanceKm?: number // 手动修正跑量
  manualDurationSec?: number
}

export type GoalDistance = '800m' | '1000m' | '1500m' | '3000m' | 'custom'

export interface GoalField { name: string; value: string }

export interface GoalEntry {
  id: string
  distance: GoalDistance
  customName?: string        // 仅 custom 使用
  fields: GoalField[]
}
```

---

## IndexedDB 版本迁移

```
VERSION 1 → sessions store（基础字段）
VERSION 2 → training_days store
VERSION 3 → sessions 上添加 startTime 唯一索引（去重用）
VERSION 4 → goals store（keyPath: 'id'）
```

主要 DB 函数：
- `saveSessionIfNew(session)` — 检查 `startTime` 唯一索引，重复返回 `null`
- `saveOrMergeDay(session)` — 聚合 session 到对应 training_day
- `updateDay(date, updates)` — 非破坏性合并更新 training_day（用于 notes / manual 字段）
- `deleteSessionFromDay(sessionId, date)` — 删除 session 记录并从 training_day 中移除，当天无剩余 session 时自动删除 training_day
- `getAllGoals() / saveGoal(goal) / deleteGoal(id)` — 目标 CRUD

---

## 图表组件 Props

```typescript
// StrideCadenceChart
interface Props {
  records: RecordPoint[]
  breakpoints?: Breakpoint[]
  activityType?: ActivityType
  laps?: LapData[]
}
```

图表功能：
- 步幅（蓝 #007AFF）/ 步频（绿 #34C759）/ 心率（红 #FF6B6B）开关
- 原始 / 平滑切换
- 完整视图 / 间歇视图切换（仅 interval 类型）
- 全视图：圈次虚线 + 运行段蓝色底色 + 圈次悬停浮层
- 间歇视图：各组对齐 + 疲劳节点红线
- VO 子图（仅全视图，有数据时显示）

---

## 待办 / 可扩展

- [ ] 个人中心：运动员档案、PR 记录
- [ ] 训练周报/月报聚合视图
- [ ] 跑步经济性（步频 × 步幅 效率比）分析
- [ ] 导出 CSV / 图表截图

---

## 发布流程（每次功能更新后执行）

每次完成一个阶段或功能后，按顺序执行以下命令，确保改动同步到 `Running Analytics.app`：

```bash
# 1. 重新构建（让 app 拿到最新代码）
npm run build

# 2. 提交并推送
git add .
git commit -m "第X阶段：XXX功能"
git push
```

> `Running Analytics.app` 启动时运行 `vite preview`，服务的是 `dist/` 目录，所以必须先 build 才能生效。

---

## 更新记录

| 日期 | 内容 |
|---|---|
| 2026-04-09 | Phase 5 补丁：间歇阈值 30s / 移除空模块 / 长按删除训练记录 + 撤销 |
| 2026-04-09 | Phase 5：Invalid Date 修复 / 圈次模块 / 训练日志 / 跑量手动修正 / 月周分层 / 目标设定 |
| 2026-04-09 | Phase 4 完成：主训练规则 / 批量导入去重 / HR / VO / Laps / 侧边栏重构 / 深度分析级联选择器 |
| 2026-03-xx | Phase 3：IndexedDB / 日历 / DayModal / 疲劳节点 |
| 2026-03-xx | Phase 2：Y 轴优化 / 间歇检测与视图 / 平滑 |
| 2026-03-xx | Phase 1：FIT 导入 / 步幅步频图 |
