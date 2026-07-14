# ADAS/NOA 功能定义 — Learning Session

> **Date:** 2026-07-12
> **Topic:** 智驾系统开发(小鹏智驾系统开发工程师岗)
> **Path:** 自动驾驶功能与算法链路 → ADAS/NOA 功能定义
> **Subtopic:** ODD 边界与降级策略设计
> **Level:** beginner→intermediate

---

## Positioning

上次概览解决了 ADAS/NOA 功能"是什么"，这次进入量产工程里更关键的问题：边界怎么被系统识别，退出和降级路径怎么被设计得可解释、可验证、可复盘喵。

## Analogy

可以把 ODD 与降级策略想成登山领队的撤退预案喵。

登山队不会只写一句"天气不好就撤退"，而是会提前定义可执行条件，比如风速超过多少、能见度低于多少、队员血氧低于多少、路线结冰到什么程度、通信是否可用喵。这些条件还必须能在现场测出来，否则它们只是口号，不是预案喵。

真正专业的领队还会区分"是否允许出发""是否允许继续前进""什么时候必须撤退"，并且不会因为一阵短风就让队伍反复前进和撤退喵。

智驾系统也是一样，ODD 不是文档里的一句话，而是一组系统能感知、能判断、能测试的运行边界喵。当车辆接近边界时，系统不能突然"消失"，而要按事先设计好的路径提醒驾驶员、降低自动化能力，必要时执行最小风险策略喵。

## Core Mechanism

**1. ODD 的工程化描述喵。**

ODD 是功能被允许工作的边界条件集合，这一句概览已经讲过，这里直接进入怎么把它写成工程语言喵。

工程里不能只写"高速 NOA 支持高速道路和良好天气"，因为这句话无法直接变成感知逻辑、测试用例和退出策略喵。更可落地的 ODD 描述会拆成条件集合，覆盖这些维度喵：

- **道路条件**：道路类型、车道线质量、匝道类型、施工区域、收费站、隧道、急弯、坡度、限速范围等喵。
- **环境条件**：雨雪雾、光照、眩光、夜间、积水、低能见度、路面附着风险等喵。
- **动态交通要素**：周车密度、切入切出频率、静止障碍物、行人非机动车混行、异常车辆、施工人员或锥桶等喵。
- **自车状态**：车速、转向制动执行器状态、动力系统状态、轮速一致性、传感器在线状态、摄像头遮挡、雷达故障、定位质量等喵。
- **驾驶员状态**：是否在座、是否握持方向盘、是否注意前方、是否具备接管能力等喵。

ISO 34503 和 BSI PAS 1883 都提供过 ODD 分类描述的思路，可以把它们理解为帮助团队系统化枚举 ODD 维度的参考框架，而不是需要背诵的条款清单喵。

量产工程对 ODD 描述最重要的要求是**可测量、可感知、可测试**喵。可测量意味着条件最好能落到阈值、枚举、置信度或组合规则上喵。可感知意味着车辆运行时真的有信号能判断该条件，而不是人类事后看视频才知道喵。可测试意味着测试团队能构造边界内、边界外、边界附近和快速穿越边界的场景喵。

**2. ODD 边界的运行时监测喵。**

写出 ODD 只是第一步，系统必须在运行时实时判断自己是否仍在 ODD 内喵。这个判断依赖的不是单一信号，而是一组**边界感知信号**喵。例如高速 NOA 会同时看地图道路属性、定位置信度、车道线质量、目标检测置信度、传感器健康状态、天气和能见度估计、驾驶员监控状态等喵。

这里要特别区分**进入条件、保持条件和退出条件**喵。进入条件通常更严格，因为系统从人工进入自动化时要确认环境足够稳定喵。保持条件可以略有容忍，因为功能运行中遇到短时轻微波动时不应立即退出喵。退出条件要覆盖明确越界、能力不足、关键传感器失效、驾驶员不可接管、系统风险升高等情况喵。

例如车道线质量连续 2 秒较好才允许进入 LCC，但车道线质量短暂下降 0.3 秒不一定马上退出喵。这就是**滞回（hysteresis）和去抖（debounce）**的作用喵。滞回是指进入和退出使用不同阈值，避免信号在阈值附近反复触发喵。去抖是指条件必须持续满足或持续不满足一段时间，系统才改变状态喵。没有滞回和去抖，用户会看到功能在边界附近反复可用、激活、退出、再可用，这会严重损害体验和安全感喵。

更深一层的问题是**"感知不到的边界"**喵。如果系统的 ODD 写了"不支持施工区"，但感知模型无法稳定识别施工锥桶和临时车道线，那么系统就无法可靠知道自己已经到了边界喵。这种"功能意图和感知能力之间的缺口"正是 SOTIF 关注的重要来源喵。

**3. 降级策略设计喵。**

降级不是简单地把功能关掉，而是把系统从高能力状态带到更低风险状态的**路径设计**喵。

常见降级阶梯可以是城市 NOA 降到 LCC，再降到 ACC，最后交还人工喵。另一类情况是风险变化太快或关键能力直接丢失，此时可能不能逐级降级，而要直接发起接管请求或进入最小风险策略喵。降级策略的核心问题不是"降到哪个功能名"，而是**"当前还能可靠控制什么"**喵。如果横向控制不可靠但纵向目标稳定，可能保留 ACC 喵。如果定位和地图失效但车道线稳定，可能保留基础 LCC 或要求接管喵。如果驾驶员不可接管且车辆仍需维持安全，系统就要考虑 MRM 喵。

**TOR** 是 Takeover Request，也就是系统请求驾驶员接管喵。TOR 不应只有一个蜂鸣声，而通常会有**升级链**，例如视觉提示、声音提示、方向盘震动或座椅震动、自动减速、双闪或更强的风险提示喵。TOR 设计必须有**时间预算**，不能等系统已经失控才提醒驾驶员喵。这个预算要考虑驾驶员注意力恢复时间、理解提示时间、手脚重新介入时间、车辆当前速度、周围交通密度和道路剩余可用距离喵。

**MRM** 是 Minimum Risk Maneuver，最小风险策略喵。MRM 的目标不是完成原任务，而是在驾驶员未接管或系统能力不足时主动降低风险喵。MRM 可以是缓减速、保持车道内停车、靠边停车、驶入应急车道或其他受设计约束的动作喵。**MRC** 是 Minimal Risk Condition，也就是 MRM 结束后希望达到的最小风险状态喵。例如车辆打双闪停在车道内可能是某些系统的 MRC，但对高速场景来说它仍然有残余风险喵。靠边停车可能是更好的 MRC，但它要求系统仍具备足够的环境感知、横向控制和可通行空间判断能力喵。

三个失效应对等级也要分清喵：**fail-safe** 是检测到故障后尽快进入安全状态，典型目标是停止危险输出喵。**fail-degraded** 是系统带着受限能力继续工作，例如从 NOA 降到 ACC 喵。**fail-operational** 是系统在部分故障后仍能完成关键安全功能，这通常要求更高的冗余设计喵。L2 系统的责任仍在驾驶员，工程上可以更依赖及时 TOR 和驾驶员接管喵。L3 系统在其 ODD 内由系统承担动态驾驶任务，因此对故障监测、冗余、MRM 和接管时间设计的要求显著更高喵。

**4. 功能状态机设计要点喵。**

量产功能通常会用状态机来组织 ODD 判断、激活、降级、接管和退出喵。典型状态包括：

- **off**：功能关闭或不允许工作喵。
- **standby**：系统待命，但当前条件还不足以激活喵。
- **available**：进入条件满足，用户可以激活功能喵。
- **active**：功能正在控制车辆喵。
- **degraded**：系统仍在控制车辆，但能力已经降低或功能集合已经收缩喵。
- **takeover_request**：系统正在请求驾驶员接管喵。
- **MRM**：系统正在执行最小风险策略喵。

状态迁移要具备**原子性**，也就是一次迁移必须有明确触发条件、明确目标状态和明确副作用喵。例如从 active 到 degraded 的触发原因可以是地图置信度下降，目标状态是只保留 LCC，副作用是 UI 显示"导航辅助已降级为车道居中"并记录日志喵。

状态迁移还要**可解释**，每次降级都能回答三个问题：为什么降级喵？用户当时看到了什么喵？事后如何通过日志复盘喵？所以工程日志不能只写"state changed"，而要记录触发信号、阈值、持续时间、状态前后变化、提示通道、驾驶员响应和控制输出喵。

状态机还要**抑制震荡与重复报警**喵。如果车道线质量在 0.49 和 0.51 之间波动，系统不能每秒提示一次"功能退出"再"功能可用"喵。如果 TOR 已经进入声音提示阶段，系统也不应每个控制周期都重新播放第一阶段提示喵。

**5. 与安全体系的挂钩喵。**

ODD 退出逻辑常和 **ISO 26262** 的安全机制关联，因为它处理的是故障检测、故障响应和安全状态转换喵。例如摄像头失效、转向执行器异常、制动系统故障、定位模块异常，都可能通过安全机制触发功能退出或降级喵。

而感知性能局限、场景理解不足、模型在边界场景下表现不稳定，则更接近 **SOTIF** 关注的问题喵。例如大雨下车道线仍然存在但模型置信度虚高，这未必是硬件坏了，却可能造成系统误以为仍在 ODD 内喵。

测试验证必须专门覆盖 **ODD 边界场景**，而不是只测典型正常场景喵：边界内场景验证系统不会过早退出喵；边界外场景验证系统不会错误激活或继续保持喵；刚好在边界附近的场景验证滞回和去抖是否合理喵；快速穿越边界的场景验证 TOR、降级和 MRM 的时序是否来得及喵。

**6. 一个高速 NOA 遇上施工区加大雨的降级时间线喵。**

假设车辆正在高速 NOA active 状态，车速 100 km/h，地图显示前方 800 米有施工风险区域喵。系统首先发现高精地图施工标记与前视感知中的锥桶候选目标一致，但锥桶检测置信度还不稳定喵。此时系统可以保持 active，同时提前降低策略激进度，例如增加跟车距离、抑制主动变道、降低目标速度喵。

当车辆继续接近，雨量增大，车道线质量下降，摄像头可用性和目标检测置信度同时降低喵。系统判断高速 NOA 的保持条件不再满足，但基础纵向跟车仍可靠，于是从 NOA 降级到受限能力状态（如 LCC+ACC 或仅 ACC）喵。UI 显示导航辅助能力受限，声音提示驾驶员准备接管，日志记录触发原因是施工区风险、车道线质量下降和雨天感知置信度下降的组合喵。

如果驾驶员握持方向盘并确认接管，系统退出自动控制并回到 standby 或 off 喵。如果驾驶员没有响应，TOR 从视觉升级到声音和触觉，并且车辆开始缓慢减速喵。如果接管超时且系统仍能保持当前车道安全，车辆进入 MRM，打开双闪并在车道内平稳减速到停止或寻找可行的靠边停车机会喵。

整个过程的目标不是让系统显得"永远能开"，而是在能力下降时仍然把风险变化管理得连续、可理解、可验证喵。

## Code Example

```python
from dataclasses import dataclass
from enum import Enum, auto


class Mode(Enum):
    OFF = auto()
    STANDBY = auto()
    AVAILABLE = auto()
    ACTIVE = auto()
    DEGRADED = auto()
    TAKEOVER_REQUEST = auto()
    MRM = auto()


@dataclass
class Signals:
    speed_kph: float
    lane_conf: float
    map_conf: float
    perception_conf: float
    sensor_healthy: bool
    driver_attentive: bool
    construction_zone: bool
    heavy_rain: bool


class DebounceCounter:
    def __init__(self, enter_ticks: int, exit_ticks: int):
        self.enter_ticks = enter_ticks
        self.exit_ticks = exit_ticks
        self.good_count = 0
        self.bad_count = 0
        self.stable_inside = False

    def update(self, raw_inside: bool) -> bool:
        # 连续满足进入条件才判定进入 ODD，这就是去抖喵。
        if raw_inside:
            self.good_count += 1
            self.bad_count = 0
        else:
            self.bad_count += 1
            self.good_count = 0

        # 进入需要更严格，避免刚擦边就激活功能喵。
        if not self.stable_inside and self.good_count >= self.enter_ticks:
            self.stable_inside = True

        # 退出也要持续确认，避免短时抖动导致反复退出喵。
        if self.stable_inside and self.bad_count >= self.exit_ticks:
            self.stable_inside = False

        return self.stable_inside


class NoaStateMachine:
    def __init__(self):
        self.mode = Mode.STANDBY
        self.odd_filter = DebounceCounter(enter_ticks=3, exit_ticks=2)
        self.tor_seconds = 0
        self.mrm_seconds = 0
        self.last_reason = "init"

    def raw_odd_inside(self, s: Signals) -> bool:
        # 这里用极简规则模拟工程里的 ODD 条件集合喵。
        road_ok = 0 < s.speed_kph <= 130 and not s.construction_zone
        sensing_ok = s.lane_conf >= 0.65 and s.perception_conf >= 0.70
        localization_ok = s.map_conf >= 0.70
        environment_ok = not s.heavy_rain
        vehicle_ok = s.sensor_healthy
        return road_ok and sensing_ok and localization_ok and environment_ok and vehicle_ok

    def degraded_allowed(self, s: Signals) -> bool:
        # NOA 不可用时，仍可能保留更低能力的 LCC 或 ACC 喵。
        return s.sensor_healthy and s.perception_conf >= 0.55 and s.speed_kph <= 130

    def tick(self, s: Signals, dt: float = 1.0) -> tuple[Mode, str, str]:
        raw_inside = self.raw_odd_inside(s)
        stable_inside = self.odd_filter.update(raw_inside)
        ui_message = "功能待命"

        if self.mode == Mode.STANDBY:
            if stable_inside:
                self.mode = Mode.AVAILABLE
                self.last_reason = "进入条件稳定满足"
                ui_message = "NOA 可用"

        elif self.mode == Mode.AVAILABLE:
            if stable_inside:
                # 真实系统需要用户拨杆或按键确认激活，示例简化为自动激活喵。
                self.mode = Mode.ACTIVE
                self.last_reason = "ODD 稳定满足，示例自动激活"
                ui_message = "NOA 已激活"
            else:
                self.mode = Mode.STANDBY
                self.last_reason = "进入条件不再稳定"
                ui_message = "NOA 暂不可用"

        elif self.mode == Mode.ACTIVE:
            if stable_inside:
                ui_message = "NOA 正常工作"
            elif self.degraded_allowed(s):
                self.mode = Mode.DEGRADED
                self.last_reason = "NOA ODD 退出，但基础控制仍可用"
                ui_message = "NOA 已降级"
            else:
                self.mode = Mode.TAKEOVER_REQUEST
                self.tor_seconds = 0
                self.last_reason = "ODD 退出且无法可靠降级"
                ui_message = "请立即接管"

        elif self.mode == Mode.DEGRADED:
            if stable_inside:
                self.mode = Mode.ACTIVE
                self.last_reason = "ODD 条件恢复并稳定"
                ui_message = "NOA 已恢复"
            elif not self.degraded_allowed(s):
                self.mode = Mode.TAKEOVER_REQUEST
                self.tor_seconds = 0
                self.last_reason = "降级能力也不再满足"
                ui_message = "请立即接管"
            else:
                ui_message = "辅助能力受限"

        elif self.mode == Mode.TAKEOVER_REQUEST:
            self.tor_seconds += dt

            # TOR 升级链按时间推进，避免每一帧重复报警喵。
            if s.driver_attentive:
                self.mode = Mode.STANDBY
                self.last_reason = "驾驶员完成接管"
                ui_message = "驾驶员已接管"
            elif self.tor_seconds < 3:
                ui_message = "视觉接管提示"
            elif self.tor_seconds < 6:
                ui_message = "声音接管提示"
            elif self.tor_seconds < 9:
                ui_message = "触觉接管提示并缓减速"
            else:
                self.mode = Mode.MRM
                self.mrm_seconds = 0
                self.last_reason = "接管超时，进入 MRM"
                ui_message = "执行最小风险策略"

        elif self.mode == Mode.MRM:
            self.mrm_seconds += dt
            ui_message = "缓减速并保持风险最小"

            # 示例里用低速代表接近 MRC，真实系统会有更完整的停车和驻车条件喵。
            if s.speed_kph <= 3:
                self.mode = Mode.OFF
                self.last_reason = "达到最小风险状态 MRC"
                ui_message = "已达到最小风险状态"

        return self.mode, ui_message, self.last_reason


if __name__ == "__main__":
    sm = NoaStateMachine()

    # 场景：正常巡航 → 施工区+大雨 → 降级 → 接管超时 → MRM → 停车喵。
    scenario = [
        Signals(100, 0.80, 0.90, 0.88, True, False, False, False),
        Signals(100, 0.82, 0.90, 0.90, True, False, False, False),
        Signals(100, 0.81, 0.90, 0.89, True, False, False, False),
        Signals(95, 0.58, 0.75, 0.62, True, False, True, True),
        Signals(90, 0.52, 0.65, 0.56, True, False, True, True),
        Signals(80, 0.40, 0.50, 0.45, True, False, True, True),
        Signals(70, 0.38, 0.45, 0.42, True, False, True, True),
        Signals(60, 0.36, 0.42, 0.40, True, False, True, True),
        Signals(50, 0.35, 0.40, 0.38, True, False, True, True),
        Signals(45, 0.35, 0.40, 0.38, True, False, True, True),
        Signals(40, 0.35, 0.40, 0.38, True, False, True, True),
        Signals(30, 0.35, 0.40, 0.38, True, False, True, True),
        Signals(20, 0.35, 0.40, 0.38, True, False, True, True),
        Signals(10, 0.35, 0.40, 0.38, True, False, True, True),
        Signals(5, 0.35, 0.40, 0.38, True, False, True, True),
        Signals(2, 0.35, 0.40, 0.38, True, False, True, True),
    ]

    for i, sig in enumerate(scenario, start=1):
        mode, ui, reason = sm.tick(sig)
        print(f"t={i:02d}s mode={mode.name:<16} ui={ui} reason={reason}")
```

这段代码把 ODD 检查、去抖、降级、TOR 升级链和 MRM 放进一个极简状态机里喵。

`Signals` 模拟运行时边界感知信号，包括车速、车道线置信度、地图置信度、感知置信度、传感器健康、驾驶员注意力、施工区和大雨喵。

`raw_odd_inside()` 表示"当前瞬间看起来是否在 ODD 内"，但它的结果**不会直接驱动状态跳转**喵。`DebounceCounter` 要求条件连续满足 3 个 tick 才允许进入，连续不满足 2 个 tick 才确认退出，这就是去抖喵。真实工程里还会把进入阈值和退出阈值分开，例如进入要求车道线置信度大于 0.75，保持只要求大于 0.60，这就是滞回喵。

`degraded_allowed()` 表示高阶 NOA 退出后，系统仍可能保留更低能力，例如只做基础横纵向控制喵。注意 AVAILABLE 到 ACTIVE 在真实系统里需要用户拨杆或按键确认，示例为了演示简化成自动激活喵。

运行这个场景会看到完整链路：t1–t2 条件好但去抖未满，t3 变为 AVAILABLE，t4 激活；t4 起进入施工区加大雨，t5 去抖确认越界、感知置信度还够，于是 DEGRADED；t6 感知置信度跌破 0.55、降级能力也不满足，进入 TAKEOVER_REQUEST；驾驶员一直未响应，t7–t8 视觉提示、t9–t11 声音提示、t12–t14 触觉提示并缓减速，t15 接管超时进入 MRM，t16 车速降到 3 km/h 以下、达到 MRC 后转 OFF 喵。

`TAKEOVER_REQUEST` 状态用 `tor_seconds` 推进提示升级链，避免每一帧重复播放第一阶段报警喵。如果驾驶员在 TOR 时间预算内恢复注意并接管（`driver_attentive=True`），状态机会回到 `STANDBY` 喵。

真实量产代码不会这么简单，但这个模型抓住了工程设计的骨架：先判断边界，再过滤抖动，再选择降级路径，再管理接管时间，最后进入最小风险状态喵。

## Common Misconceptions

1. **以为 ODD 写在文档里，系统自然就知道自己在不在 ODD 内喵。** ODD 必须被转化成运行时可观测信号和状态机条件，否则它只是一段需求文字喵。

2. **以为降级等于直接退出喵。** 降级更准确地说是能力收缩，系统可能从 NOA 收缩到 LCC、ACC 或人工接管，而不是每次都立刻断开控制喵。

3. **以为 TOR 一响，驾驶员一定会接管喵。** 工程上必须假设驾驶员可能分心、误解、反应慢或完全没有响应，所以才需要 TOR 时间预算和 MRM 喵。

4. **以为 MRM 就是急刹喵。** MRM 的目标是最小化风险，不是制造新的风险，通常更强调可控减速、保持稳定和选择合适的最小风险状态喵。

5. **算法同学容易只看模型平均精度，而忽略 ODD 边界附近的置信度可靠性喵。** 量产系统最怕的不是模型在简单场景里错一点，而是在边界外仍然高置信地输出"我能行"喵。

## Socratic Check

1. 如果一个高速 NOA 功能声明"不支持施工区"，但系统只能在 30% 的场景里稳定识别锥桶，这个 ODD 边界设计还成立吗喵？

   提示：不要只从需求文字判断，要从运行时是否可感知、可触发、可验证来判断喵；感知不到的边界会让系统在边界外仍以为自己在 ODD 内，这正是 SOTIF 要处理的风险喵。

2. 如果车道线置信度在阈值附近每秒上下波动，状态机应该立刻反复 active 和 off 吗喵？

   提示：考虑进入条件、保持条件、退出条件的分离，加上滞回、去抖和用户提示抑制，让功能状态在边界附近保持稳定喵。

---

## Quick Summary

- ODD 工程化描述不是一句功能边界，而是道路、环境、动态要素、自车、驾驶员、地图定位和传感器健康等条件集合喵。
- 好的 ODD 条件必须可测量、可感知、可测试，否则无法支撑运行时判断和测试验证喵。
- 降级策略要设计能力收缩路径、TOR 升级链、接管时间预算、MRM 和 MRC，而不是简单关闭功能喵。
- 状态机要让每次进入、退出、降级和接管都有明确触发原因、用户提示和日志证据，并用滞回去抖抑制边界震荡喵。
- ISO 26262 更关注故障与安全机制，SOTIF 更关注性能局限和边界场景下的非预期风险喵。

## Next Steps

- 2026-07-12：用户选择深入子主题「高速 NOA 与城市 NOA 场景难点深挖」，见 `ADAS-NOA 功能定义--2026-07-12--高速-noa-与城市-noa-场景难点深挖.md` 喵。
