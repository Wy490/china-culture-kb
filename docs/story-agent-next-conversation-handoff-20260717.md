# Story Agent 下一对话交接（2026-07-18）

## 1. 快速启动与按需读取

新对话默认只完整读取：

1. 本文件。
2. `superpowers-lite`。
3. 当前切片实际涉及的 `china-culture-story-agent`、`gears-seedance-delivery` 或 `agent-dev-standards`；不涉及的 skill 不加载正文或 reference。

以下长期文档仍是规范来源，但不再要求启动时全文加载。先用标题/关键词定位，只读取当前切片相关段落：

| 当前任务 | 按需读取 |
| --- | --- |
| 改进度、真实计分、发布定义 | `story-agent-long-term-comprehensive-development-plan-20260713.md` 的当前基线、计分边界和 DoD |
| P4 归属、dirty worktree 冲突 | `story-agent-p4-change-review-plan.json` summary 与当前文件项；只有规则争议才读 P4 Markdown 对应最新小节 |
| GEARS、迁移、legacy、knowledge writeback | `story-agent-integrated-execution-plan-20260710.md` 对应 B3–B6 小节 |
| 知识内容扩充 | `knowledge-base-content-expansion-long-term-plan-20260713.md` 当前 milestone 与对应 batch plan |
| 历史决策冲突或证据缺失 | `story-agent-next-conversation-handoff-20260716.md` 的相关小节，不全文回放 |

启动上下文由原 6 份文档 3,077 行、约 334 KB，降为本交接约 190 行加必要 skill；默认减少约 85%。若状态与叙述冲突，以当前 Git 事实、P4 机器报告和新鲜测试为准；不得通过 reset、覆盖或删除来“恢复”交接状态。

## 2. 两个仓库固定边界

### Story Agent

- 路径：`/Users/wuyu/Desktop/china-culture-kb`
- 分支：`codex/story-agent-manifest-integrity-20260718`
- 分支基线：`ac7deb653327bfa90d5dffe2f0f2b162b17407ae`；最终 HEAD 以当前 `git rev-parse HEAD` 为准。
- 用户已在 2026-07-18 明确授权将 Story Agent 当前仓库全部改动提交并推送到新分支；该授权不扩展到相邻 GEARS v2 仓库。
- 本轮提交前 dirty worktree 属于连续开发成果，未通过 reset、删除或覆盖改变既有改动；提交后应以新鲜 `git status` 验证工作区干净。

### GEARS v2

- 路径：`/Users/wuyu/Desktop/gears v2`
- 分支：`codex/story-agent-workbench-bridge`
- 固定 HEAD：`1d772200a809ca282a73535126359949d054164b`
- `origin` 应为私有 fork `https://github.com/Wy490/gears-v2`；`upstream` 为原仓库。
- 目标 PR base 必须为 `v0.2-dev`。
- 最终 Git 状态：6 tracked / 5 untracked，staged 0；`git diff --check` 通过。
- 保留 dirty worktree；禁止自动暂存、commit、push。

## 3. 真实计分边界

- 本地项目/角色/场景、fixture、fake JWT/key、无模型测试、dry-run、readiness、SQLite 导入、候选稿和本地 E2E 均不计真实回片。
- 真实 GEARS/Seedance 仍为 `0/5`；三个真实端到端样板仍为 `0/3`。
- `external_ready=0/5`，真实公共 artifact URL 为 0。
- 专业文本包通过 0/15，真实模型项目 0/75，已核验真实修订轮次 0，真人盲评通过 0/45，professional pass 0。
- 不执行 20 个 `domain_safety` candidate，不执行 legacy 搬运/合并/删除/覆盖，不执行或切换 file→SQLite，不执行正式 knowledge writeback，除非获得独立明确授权。

## 4. 2026-07-18 最新完成切片

### 最终交付 manifest 完整性

- 对 `web/generated/ai-comic-series-projects` 的 927 个系列项目进行只读审计；用户指出的 10 个 `concat.txt` 无 `manifest.json` 项目全部复现，且全部为 2026-06-19 的历史 dry-run/测试夹具。
- 10 个项目均有 `seedance_final_delivery.output_path`/concat 计划、`dry_run=true`，但没有 `manifest_path`；它们不是“真实成片仅漏文件”，不得补造 manifest 或授予发布信用。
- Web generated health、MCP generated health 与监控脚本已从旧的 `output_path OR manifest_path` 改为 `output_path AND manifest_path`；新增 `final_delivery_manifest` 缺口、dry-run/manifest 证据与独立 summary。
- MCP production readiness 的 Delivery Contract 同步 fail closed：只有可用 ledger 同时声明输出与 manifest 才为 ready；concat/output 计划无 manifest 明确显示“尚不可发布”。
- 项目总览“生成项目体检”新增“缺最终 manifest”指标；GEARS worker 证据审计新增 manifest 缺口 delta，历史基线只作兼容说明，新增缺口才触发回归动作。
- 新机器证据：`data/reports/story-agent-monitor-remediation-queue-20260718.json`，精确列出 10 个项目 ID、dry-run 状态和安全修复动作；报告声明未修改 generated project、未 relink、未 archive、未正式写回。
- 监控扫描结果：22 个 story JSON、927 个系列项目、10 个 manifest 缺口；10/10 均为 dry-run。真实 GEARS/Seedance 回片与真实发布信用仍为 0。

完成 `project-service` 修订/补素材边界的领域泛化、production auto-draft 领域默认抽离，以及 production readiness 和三类生产资料模板的跨域收口：

- Domain Pack 版本 1.4.5，capability 总数 12；新增 `story_supplement` 与 `production_material_draft`。
- `story-domain-supplement-guidance/v1` 由领域包声明候选稿类型、标题、复核规则和正式写回草案适用性。
- `china_culture` 生成待真人复核的领域知识候选；`original_fiction` 只生成项目内素材候选，正式知识候选导出 fail closed。
- 新平台合同 `story-domain-edit-persistence/v1`：修订只追加 Project version；补素材只更新当前 Project 状态和 generated story snapshot。
- 所有编辑固定 Domain source 禁写、knowledge writeback 未执行、external delivery 未触发、migration 未执行、real credit 为零。
- 质量修订和补素材均在持久化前校验；不再在通用 prompt 中硬编码 `data/provinces`。
- 新增 `story-domain-production-material-guidance/v1`：受众/学习者、项目与素材、来源/事实、单镜头/提示词、家长提示、知识层级、边界卡、社媒分享/字幕/评论及误区边界的默认文案和审查边界均由领域包返回。
- `original_fiction` 不再继承中国文化的“文化入门/史学工艺民俗”、非遗名录、文化讲述者、馆方/出版物、传承人/馆员、馆藏真伪、省份 Markdown、“文化边界真实/稳定”、“文化符号”、“冷知识/地方经验”、“传说/正式入库”或来源内部字段假设。
- production auto-draft 不再向用户输出 `material_pack verified_facts`、`source_entry=`、`credibility_note=` 等内部字段名；原创域改用项目素材、创作确认和权利复核语义，中国文化域保留事实与来源核验语义。
- production readiness 同步识别创作者、编剧、角色设计与权利顾问，原创域补齐讲述角色后不再继续误报缺失。
- production readiness 现按 `sourceDomain` 合并集中式字段覆盖：原创儿童故事识别“故事标志物/关键物件”，社媒短视频识别“人物选择/剧情讨论、项目素材、权利边界卡”，AI 漫剧识别“原创设定/架空/世界规则”；用户可见标签与补充问题同步改为原创语义。
- `world_and_truth_mode` 不再把通用“待核实”当成世界观/真实度证据，只有真实度、虚构、传说、史实等明确语义才计入。
- 儿童故事、社媒短视频、AI 漫剧的 canonical production pack 主动目标、gate 和问题已改为跨域表达；`china_culture` 仍通过领域证据保持事实/来源核验，`original_fiction` 不再被默认文化事实字段误判。
- P4 分类器现将 `data/production-packs/` 确定性归入 `production_docs`，避免 canonical production pack 变化落入人工 hold。
- `ProductionMaterialSampleEntry` 新增可选 `applicable_source_domains`；production pack service 按当前领域返回样例，历史无标签样例按旧中国文化来源处理，对新领域 fail closed。
- 儿童、社媒、AI 漫剧分别新增 3 个 `original_fiction` 中立样例；原 3/3/10 个中国文化样例均显式标注 `china_culture`，原创 prompt 和新生成项目不再收到周敦颐、柳毅、屈原、书院、年画等跨域样例。
- `original_fiction` 本地生成现挂载领域过滤后的 production pack 和 readiness；AI 漫剧集成测试证明项目只持久化原创样例。
- canonical `source_observations` 已显式标注适用领域；draft 工具和 Markdown 同时展示来源、样例的领域适用性。AI 漫剧 draft 已按真实内容变化重生成：目标改为“故事材料”，样例为 `china_culture=10`、`original_fiction=3`。
- P4 分类器同时将 `production-material-pack-service.ts` 确定性归入 `shared_core`，本轮无人工 hold。
- production pack health 新增 `sample_entry_count_by_source_domain`、`minimum_sample_entry_count_by_source_domain` 和 `legacy_sample_entry_count`；三类跨域片型均要求 `china_culture>=2`、`original_fiction>=2`。
- 新 issue `underfilled_domain_sample_entries` 会把领域样例缺口降为 warning，并携带 `source_domain`；legacy 无标签样例只计入 `china_culture`，不会满足原创域最低覆盖。
- Web 与 MCP health JSON/Markdown 均输出同一领域覆盖摘要；Web GEARS evidence Markdown 同步展示 `domain_samples` 与 `legacy_samples`，MVP production material lane 现在提供 `domain_sample_ready=3/3`。
- canonical 三类 pack 在 Web 与 MCP 两侧均为领域覆盖健康，当前无领域样例 issue；旧 MCP fixture 因原创覆盖为 0 曾正确转为 warning，补齐显式领域 fixture 后恢复 passed。
- canonical pack 文件新增 `health_policy.required_domain_sample_video_types` 与 `domain_sample_minimums`，Web/MCP 两侧原 `DOMAIN_SAMPLE_MINIMUMS` 常量已删除；策略缺失、非法阈值、声明/映射不一致或引用未加载 pack 均产生 error 并 fail closed，health schema 仍为 `production-material-pack-health/v1`。
- health 报告新增 `domain_sample_policy_valid` 与 `domain_sample_policy_video_types`，MVP/GEARS evidence 同步展示；三类跨域片型仍为 `china_culture>=2`、`original_fiction>=2`，真实计分不变。
- 重复 `sample_id` 不再抬高样例总门禁或领域覆盖：报告保留原始 `sample_entry_count`，新增 `unique_sample_entry_count`、`duplicate_sample_entry_ids`，重复 ID 产生 `duplicate_sample_entry` error；领域过滤后的 pack 也只返回唯一样例。
- production pack draft 新增可选 `sourceDomain` / `--source-domain`：来源观察和样例按域过滤，legacy 无标签内容只归 `china_culture`；报告输出目标域、排除来源/样例数、重复来源/样例数和非法来源数，域专属 CLI 文件名不会覆盖通用草案。
- draft 审稿就绪现按唯一 `source_id` 计数，重复或空白来源不能抬高状态；候选 `sample_entries` 也按唯一 `sample_id` 去重。canonical、附加 observations、pack/template/sample 均有字段级运行时校验，畸形 JSON 不再泄露 `.find/.map/join` 内部错误。AI 漫剧通用候选报告已重生成，4 个唯一来源、五类审计计数均为 0。
- 新增两端共同消费的 `production-material-pack-health-conformance/v1` JSON matrix：16 个策略/样例用例覆盖缺失/非对象、非空且唯一的声明数组、声明与最低值映射一致、非空领域、正整数、已加载 pack 引用、未知成片类型与重复 `sample_id`；测试值与 canonical 业务阈值分离，未把 `2/2` 重新硬编码进实现。
- 同一 matrix 锁定 15 个受支持 `VideoType`：Web 对照 `VIDEO_TYPE_CONFIG`，MCP 对照显式支持集合并逐型运行合法策略；Web/MCP 仍保持独立运行时，不形成 Web→MCP 依赖。
- 两端现同时拒绝 `required_domain_sample_video_types` 中的空白元素；MCP 同时补齐未知 `video_type` fail-closed，未知同名 pack 不再使非法策略通过。health schema 保持 `production-material-pack-health/v1`，canonical pack 健康与真实计分均未改变。
- 共享 matrix 进一步新增 31 个 pack 结构用例，覆盖 `video_type/label/goal/material_template/sample_entries`、所有 template string-array 字段，以及 sample `sample_id/entry_name/applicable_source_domains` 的缺失、类型、空白、空数组和重复领域标签边界。
- Web 注入式 `productionMaterialPacks` 现与 canonical loader 使用同一运行时过滤器；畸形注入不再进入 health summary、触发 `.trim()` 异常或抬高 `pack_count`。MCP 文件 loader 同步要求非空 `goal`、字段级 sample 结构与非空 template 内容。
- 显式 `applicable_source_domains` 只有非空、非空白且唯一时才被接受；畸形领域标签不会再静默退化为 legacy `china_culture`。历史无标签 sample 的 legacy 归属保持不变。
- 31 个 structure cases 现在逐项声明稳定、双边一致的拒绝预期：`pack_index`、原因码与精确字段路径；Web/MCP 运行时都复用同一顺序生成首个失败诊断，但保持各自独立实现。
- health v1 additive 新增 `rejected_pack_count` 与 `rejected_pack_diagnostics`；畸形 pack 产生 `invalid_pack_structure` error 并令 health fail closed，同时仍不进入 `pack_count`、policy 引用或样例健康统计。canonical 当前为 `0 / []`，既有 schema version 与真实计分均未改变。
- 诊断只回显索引、枚举原因码和结构路径，不复制 label、goal、模板、样例或任意输入值；MCP health Markdown、Web GEARS evidence Markdown 以及 Web/MCP MVP evidence 均已同步该摘要。
- 共享 matrix 再新增 7 个 pack 文件根合同用例：有效根、root 非对象、`schema_version` 缺失/非字符串/不支持，以及 `packs` 缺失/非数组；两端逐项锁定同一根级有效性、原因码和路径。
- health v1 additive 新增 `pack_file_valid` 与 `pack_file_diagnostics`；根合同失败产生 `invalid_pack_file_structure` error，并在解析 pack、health policy 或满足 required video type 前 fail closed。canonical 当前为 `true / []`。
- Web canonical loader 不再伪造正确 schema，MCP pack health 改为保留原始 JSON 根值；文件缺失或 JSON 无法解析统一给出无 payload 的 `source_unavailable`。MCP/Web GEARS Markdown 与 Web/MCP MVP evidence 已同步 `pack_file_valid`，敏感 schema 测试值不会进入报告。
- 共享 matrix 新增 collection case，证明两个结构合法、同 `video_type` 的 pack 不得同时进入健康统计。Web/MCP 现在都保留首个已接受 pack，以 `pack_index=1 / duplicate_video_type / packs[1].video_type` 拒绝后项。
- 重复类型产生独立 `duplicate_pack_video_type` error，不再由 `packsByType` 静默以后项覆盖首项；后项不能抬高 `pack_count`、policy 引用、sample coverage、readiness 或 summary。MVP evidence 新增 `duplicate_pack_video_type_count`，Markdown 不回显重复 pack 的 label/goal/sample。
- MCP draft 回归证明存在重复类型时仍只使用首项 label、goal、template 和 sample，敏感后项不进入草案；因此 Web runtime、Web/MCP health 与 draft 的同型 pack 选择规则现统一为 first accepted wins。canonical 当前重复拒绝数为 0，真实计分不变。
- MCP draft 测试现在直接读取共享 health conformance fixture 的 2 个 root 与 8 个 pack/sample 代表 case，不复制整套 matrix；unsupported schema、缺失 `packs`、空白 label/goal/template item、缺失 sample ID/name，以及空/空白/重复领域标签均 fail closed。
- draft 独立 parser 现要求精确 `video-type-material-supplement-packs/v1`、必填 `packs` 数组、非空字符串与数组项、必填 sample identity，以及显式领域标签非空/非空白/唯一。错误消息精确固定为字段路径与规则，不拼接输入 payload；draft v1 schema 与 Web/MCP 独立运行时均未改变。
- draft 源文件获取现只在 `fs.readFile` 与 `JSON.parse` 两个窄边界转换异常：缺失/不可读统一为 `production pack file is unavailable`，非法 JSON 统一为 `production pack file must contain valid JSON`；绝对路径、ENOENT、原生解析位置和文件内容均不回显。
- schema、根对象、pack/template/sample 等解析后字段校验仍保留原精确错误，未被获取异常边界吞掉；health v1、draft v1、canonical 文件内容、Web/MCP 独立运行时和真实计分均未改变。
- 新增 MCP 本地单一合同 `production-material-video-types.ts`，15 类合法 `VideoType` 只维护一份；health 保留 `PRODUCTION_HEALTH_SUPPORTED_VIDEO_TYPES` 原导出兼容，draft 不依赖 Web，也不再复制名单。
- draft 入口现以 `videoType must be a supported video type` 拒绝未知目标类型，pack parser 以精确字段路径拒绝未知 `packs[i].video_type`；两类错误均不回显未知值或 pack label/goal/sample。共享 conformance 的 15 类合法值逐型证明请求与现有 pack 上下文仍可生成草案。
- 新增 `production-material-source-observations.ts`，MCP `sourceObservations` 字符串和 CLI `--observations-json` 文件现在共用窄范围解析/读取边界；MCP 非法 JSON 固定为 `sourceObservations must contain valid JSON`，CLI 缺失/不可读和非法 JSON 分别固定为 `observations file is unavailable` 与 `observations file must contain valid JSON`。
- parser/loader 不回显输入、目标文件路径、ENOENT、SyntaxError 或解析位置；CLI 最外层只输出单行 message，不再附带内部栈绝对路径，未知非 Error payload 统一为 `production material pack draft failed`。解析成功后的非数组和 observation 字段错误仍由 draft 精确校验。
- canonical AI 漫剧原创域只读回归仍为 `ready_for_editor_review`、4 个来源、3 个样例和 label `AI漫剧`，未写文件、未授予真实信用。

主要新增文件：

- `web/server/src/platform/story-domain-edit-boundary.ts`
- `web/server/src/platform/story-domain-production-material-guidance.ts`
- `web/server/src/__tests__/story-domain-edit-boundary.test.ts`

主要修改文件：

- `web/server/src/platform/domain-pack.ts`
- `web/server/src/platform/story-domain-revision-safety.ts`
- `web/server/src/domains/china-culture/domain-pack.ts`
- `web/server/src/domains/original-fiction/domain-pack.ts`
- `web/server/src/services/project-service.ts`
- `web/server/src/services/production-material-readiness-service.ts`
- `web/server/src/services/production-material-pack-service.ts`
- `web/server/src/services/gears-execution-service.ts`
- `web/server/src/services/story-agent-mvp-status-service.ts`
- `web/server/src/domains/china-culture/story-generation-preparation-service.ts`
- `web/server/src/domains/original-fiction/domain-pack.ts`
- `web/shared/types.ts`
- `mcp-server/src/tools/draft-production-material-pack.ts`
- `mcp-server/src/lib/production-material-video-types.ts`
- `mcp-server/src/lib/production-material-source-observations.ts`
- `mcp-server/src/tools/production-health-reports.ts`
- `mcp-server/src/tools/get-story-agent-mvp-status.ts`
- `data/production-packs/video-type-material-supplement-packs.json`
- `data/production-packs/production-material-pack-health-conformance.json`
- `data/reports/production-material-pack-draft-ai_comic_drama.json`
- `docs/production-material-pack-draft-ai_comic_drama.md`
- `scripts/story-agent-p4-change-review-plan.mjs`
- 相关 registry、Project service、API 和两个领域测试。

## 5. 本轮测试证据

- 测试先行红灯：缺少新平台文件/capability、硬编码候选稿和合同断言共 7 项失败；实现后转绿。
- 本次 auto-draft 红灯：未填写受众的 `original_fiction` 项目仍输出“零基础文化入门观众”；Domain Pack guidance 接线后转绿。
- 后续红灯依次复现原创项目继承非遗名录/文化讲述者、馆方/省份 Markdown、馆员/传承人/馆藏真伪；实现后全部转绿。
- readiness 联动红灯：原创讲述角色已生成但只识别馆员/专家/传承人的关键词；增加领域中立角色证据后转绿。
- 本次剩余 auto-draft 红灯：`original_fiction` 的 `shot_prompt_layers` 仍继承“文化边界真实”，`parent_teacher_note` 仍继承“文化符号”；新增领域对照断言并下沉到 Domain Pack 后转绿。
- 本次后续红灯分三批复现：原创单镜头仍写“文化边界稳定”；知识层级/事实卡/来源线索仍继承文化事实语境并泄露内部字段；儿童与社媒草拟仍写“故事改写与事实边界”“冷知识/地方经验”“重要事实旁标”“版本、地点或实物线索”“传说/正式入库”。全部下沉到 1.4.5 guidance 后转绿。
- readiness 新切片红灯依次复现：原创儿童“故事标志物”、原创社媒“人物选择/项目素材/权利边界卡”、原创 AI 漫剧“原创设定/世界规则”均无法满足对应字段；按 `sourceDomain` 合并集中式字段覆盖后转绿。
- 反向红灯证明通用“待核实”会误满足 `world_and_truth_mode`；收窄特殊匹配后转绿。跨域 production pack 对照测试随后复现儿童模板仍含中国文化默认，三类 canonical 主动模板泛化后转绿。
- 样例领域红灯复现：`getProductionMaterialPack(..., { sourceDomain: 'original_fiction' })` 仍返回全部中国文化样例，原创 AI 漫剧生成结果没有 production pack/readiness；领域元数据、过滤和原创生成接线后转绿。
- draft 红灯复现两层丢失：来源适用领域未进入 Markdown，已有样例也未显示适用领域；补齐 draft schema/render 后转绿，并重生成 AI 漫剧 Markdown/JSON。
- 领域 health 红灯复现：Web/MCP summary 均没有领域计数，2 条 legacy/原创混合 fixture 无法发现原创覆盖不足；新增领域摘要与最低覆盖 issue 后两侧转绿。
- MCP MVP fixture 随后从 passed 正确变为 warning，暴露三类片型 `original_fiction=0/2`；fixture 补齐显式领域样例后恢复 passed，并新增 canonical Web/MCP 阈值一致性断言。
- 本次定向：`project-service` + Domain Pack registry，2 files / 74 tests 通过；Story server TypeScript 与 `git diff --check` 通过。
- 扩展定向：Project service、Domain Pack registry 与 production readiness，3 files / 83 tests 通过。
- 本次最新定向：Domain Pack registry 14、Project service 60、production material readiness 9，合计 3 files / 83 tests 通过；`npm --prefix web/server run lint` 与 `git diff --check` 通过。P4 `--write` 后 `--check` 通过：128 files、0 hold、0 staged。
- 本轮最终定向：Domain Pack registry 14、Project service 60、production material readiness 9、original fiction domain 3，合计 4 files / 86 tests 通过；Story server TypeScript 通过。
- 定向回归：7 files / 293 tests。
- Story server TypeScript：通过。
- Story server 全量：129 files passed + 1 skipped；1089 tests passed + 2 skipped。
- 跨仓 HTTP E2E：隔离 SQLite + Alembic、fake JWT/keys、无模型 2/2；正式 Recipe/provider/media/credit 均为 0。
- GEARS `make check`：mypy 76 source files；backend 291；frontend 17；production build；Ruff 96 files，全通过。
- Unified CI local：21/21；Track A Playwright 6/6；MCP 79 files / 355 tests；KB lint 34 files / 262 entries；Stage 6–8、治理、diff、P4 stale、no-stage 全通过。
- `superpowers-lite`：官方 `quick_validate.py` 通过；`agents/openai.yaml` 解析、触发 prompt 和关键工作流断言通过；正文 80 行、无 TODO。
- 本次 readiness 定向：Project service、production readiness、China-culture preparation、story prompt、original fiction domain，5 files / 93 tests 通过；MCP production material draft 2 tests 通过；Story server TypeScript 通过。
- 本次样例领域定向：Story prompt、original fiction、production readiness、China-culture preparation、Domain Pack registry，5 files / 49 tests 通过；MCP draft 2 tests 通过；Web TypeScript 与 MCP build 通过。
- 本次领域 health 定向：Web production readiness 16 tests；Web API/health/GEARS 3 files / 246 tests；MCP health/MVP 2 files / 14 tests；Web TypeScript 与 MCP build 通过。
- 本轮最新 Unified CI：21/21；Web server 129 files passed + 1 skipped、1098 tests passed + 2 skipped；Track A 6/6；MCP 79 files / 359 tests；Web/MCP build、KB lint 262 entries、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过；明确未授予 real revision 或 professional pass。
- 本次 canonical policy 红灯覆盖缺失、非正整数、引用未加载 pack 及 Web/MCP 正常解析；production readiness 19 tests、MCP health/MVP 16 tests 与两侧 TypeScript 转绿。
- 本次 draft 红灯覆盖原创域跨域泄漏、重复/空白 source ID、重复 sample ID、非数组/畸形 observation、非数组 packs 与非法 sample 领域标签；draft 9 tests 与 MCP TypeScript 转绿。
- 本次重复样例红灯证明同一 `sample_id` 可把原创域从 1 抬成 2；Web/MCP 改为唯一 ID 计数后恢复 `original_fiction=1/2` 并产生明确 error。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1101 tests + 2 skipped、Track A 6/6、MCP 79 files / 377 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次共享契约第一组红灯证明 Web/MCP 均会把 `['children_story', '   ']` 清洗为合法声明；补齐空白元素 fail-closed 后 Web 20 tests 转绿，MCP 继续暴露第二组红灯：同名 `experimental_story` pack 可让未知类型策略通过。MCP 支持集合与未知类型校验接线后两侧 matrix 全绿。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1102 tests + 2 skipped、Track A 6/6、MCP 79 files / 379 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 当前 P4：145 files（106 tracked / 39 untracked），`shared_core=77`、`governance=37`、`production_docs=31`，0 hold、0 staged。
- 本次 pack 结构红灯分别复现：Web 注入路径把缺失 `video_type` 的 pack 计入 `pack_count=1`；MCP 文件 loader 接受空白 `label`，后续还会接受缺失 `goal` 与畸形 sample。统一过滤和非空规则后，Web 定向 21 tests、MCP 定向 14 tests 全绿。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1103 tests + 2 skipped、Track A 6/6、MCP 79 files / 381 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次拒绝诊断红灯证明 Web/MCP 对无效 structure case 只会静默过滤，报告没有拒绝数量、原因或路径；实现后 31 个用例逐项得到相同的紧凑诊断，canonical 保持 `rejected_pack_count=0`。Web readiness 21、MCP health 14、Web API 205、MCP MVP 4 均通过，Web/MCP TypeScript、构建与 Markdown 证据断言通过。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1103 tests + 2 skipped、Track A 6/6、MCP 79 files / 381 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次根合同红灯证明 Web/MCP 报告的 `pack_file_valid` 均不存在，旧 loader 会丢失根失败原因；7 个共同 cases 接线后，Web readiness 22、MCP health 15、MCP MVP 4、Web API health/MVP/GEARS evidence 定向均通过，两侧 TypeScript 与无 payload Markdown 断言通过。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1104 tests + 2 skipped、Track A 6/6、MCP 79 files / 383 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次 collection 红灯证明 Web/MCP 对两个合法同型 pack 都返回 `pack_count=2`，且 report map 以后项覆盖、runtime/draft `.find` 取首项；首项保留/后项拒绝接线后，Web health 23、MCP health + draft 26、MCP MVP 4、Web MVP API 定向与两侧 TypeScript 全通过。
- 上一切片 Unified CI：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 79 files / 387 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次 draft 代表集首先 9/9 红灯，证明 unsupported schema、缺失 packs、空白内容和非法 sample 领域均会继续生成并进入 Markdown；收紧后共享代表集 10 tests、完整 draft 20 tests、MCP build 与 canonical AI 漫剧只读草案全通过，错误完整消息精确相等且不含敏感测试值。
- 本次第一次 Unified 的未改动 Web callback 单测发生一次 5 秒瞬时超时，导致 secret 未及清理并级联 12 个 401；该单测随即 13ms 通过，完整 callback describe 16/16 通过，未修改无关代码。相同代码重跑 Unified 全绿。
- 上一切片最终 Unified CI：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 79 files / 407 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次源文件获取红灯精确复现：缺文件返回带绝对 KB_ROOT 的 ENOENT，非法 JSON 返回原生 `Unexpected end of JSON input`；窄边界转换后两条脱敏测试 2/2、完整 draft 22/22、MCP build 与 canonical AI 漫剧原创域只读草案均通过，且共享 schema/pack 代表校验继续返回原精确错误。
- 上一切片最终 Unified CI 一次通过：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 79 files / 411 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次支持类型合同红灯分别证明未知请求 `experimental_story_sensitive` 会生成草案、未知 pack `experimental_story` 会通过 parser；抽取单一 MCP 合同后，两类 fail-closed 测试与 15 类逐型合法回归共 25 tests、完整 draft 39 tests、draft + health 55 tests、MCP build 和 canonical AI 漫剧原创域只读草案均通过。
- 上一切片最终 Unified CI 一次通过：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 79 files / 445 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次额外来源输入红灯精确复现：MCP/CLI 非法 JSON 返回 `Unexpected end of JSON input`，CLI 缺文件同时泄露 ENOENT、绝对目标路径和 `path` 字段。转换后 helper + draft 44 tests、MCP build、canonical 草案、真实 MCP stdio 和两类真实 CLI 冒烟均通过；CLI 两个失败路径最终都只有单行固定消息，解析成功后的 `{}` 仍返回 `additionalObservations must be an array`。
- 当前最终 Unified CI：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 81 files / 455 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。
- 本次 manifest 完整性切片先用 Web/MCP/production-readiness 三组红灯复现 `output_path OR manifest_path` 误判，修复后定向回归转绿；实盘只读扫描精确得到 10 个 manifest 缺口、10/10 dry-run，未修改 `web/generated`。
- 本次最终 Unified CI：21/21；Web 129 files + 1 skipped / 1105 tests + 2 skipped、Track A 6/6、MCP 82 files / 456 tests、KB 262 entries；Web/MCP build、Stage 6–8、治理、diff、P4 current 与 no-stage 全通过，未授予 real revision 或 professional pass。首次沙箱内全量仍因 Supertest 绑定 `0.0.0.0` 得到 `EPERM`，允许本地临时端口后原样通过；另补齐新测试系列的标准 plan fixture 后，受影响 API 5/5 通过。

注：本轮第一次 Unified CI 在默认沙箱因 Supertest 绑定 `0.0.0.0` 得到 `EPERM`，24 files / 256 tests 因同一端口限制失败；解除本地测试端口限制后原样 21/21 通过，不是代码回归。此前 GEARS 隔离门禁的 SQLite 迁移和 fake key 变量名问题也均已按旧交接修正；所有测试未发模型请求。

## 6. 五套进度

- 综合研发：78%，受三个真实样板 0/3 上限约束，本轮不增长。
- 专业文本创作：47.5%，真实通过指标均为 0。
- 知识内容供给：正式条目 262 / 长期条目规模目标 800，当前来源 960；M1 机器 23/23、真人 0/23；M2 机器 70/97、真人 0。
- 真实 GEARS/Seedance：0/5；本地 acceptance-ready 5 个排除于真实计分。
- 发布运营成熟度：60%；durable signed release 0，active release authority 0，真实 UAT 未完成。

商业成熟度估计仍为 35%。

## 7. 下一最小切片

继续只做一个边界清晰的内部切片：为最终交付 manifest 缺口建立受控重导出白名单和逐项目人工确认流程。当前 10 个目标已被正确识别为不可发布历史夹具，但没有自动修复授权，也没有真实媒体输入可支持真实装配。保持 generated 项目只读、真实计分为零，禁止按模板补造 manifest。

建议顺序：

1. 先复核新分支、远端、干净状态与最新门禁证据。
2. 从 `final_delivery_manifest_gaps` 生成只读 operator queue；每个项目必须明确选择“保留测试夹具并排除发布”或“提供真实/授权素材后重跑 final delivery export”。
3. 若选择重导出，先验证 cut、subtitle、audio、title-card 依赖与实际文件存在，再调用现有 final delivery dry-run 生成新的 manifest；不得直接复制其他项目 manifest。
4. 用 generated health 前后快照证明 manifest 缺口只减不增，并保持 `web/generated` 之外的知识库、正式 writeback、迁移与真实计分边界不变。
5. 只有具备真实 endpoint、公共 artifact URL、授权素材与人工 sign-off 时，才进入真实 GEARS/Seedance 发布验收。

## 8. 外部阻塞

- 真实模型凭据、授权预算、模型选择与成本上限未提供。
- 三个样板的真实业务目标、授权素材、人物/场地和版权条件未齐。
- 编剧/剧本编辑、类型导演/制片、事实/文化真人评审未到位。
- 真实 GEARS/Seedance endpoint、callback 和五个稳定公共 artifact URL 未提供。
- 26 个 legacy 目录需逐项人工 ownership、版本/内容及处置签署。
- 20 个 legacy domain-safety candidate 等待人工授权；99 个断链项目等待准确备份或用途证据。
- 生产身份、外部审计归档、release authority、对象存储、队列、备份恢复和真实 UAT 未完成。

## 9. Superpowers Lite 流程优化

Mac/Codex 当前没有已安装、可编辑的 Superpowers 插件副本；仓库文档记录的 Superpowers 5.1.0 属于 Windows/Claude Code。为让下一次 Codex 对话实际生效，本轮新增项目级 `.codex/skills/superpowers-lite`，不修改 marketplace 缓存，也不伪装成 Windows 插件升级。

核心规则：

- 默认 Lite：一次审计、一个可逆切片、定向验证、简短汇报。
- 跨模块/跨仓共享合同升级 Standard：短计划、双边合同测试、一次代表性 E2E、里程碑结束时一次全量门禁。
- 破坏性、安全、付费外部调用、真实数据迁移或生产授权升级 Strict；Strict 不扩大用户授权。
- 行为、bug、安全边界和共享合同保持红绿测试；纯文档、机器报告和机械改动只运行对应 parser/audit/diff/P4，不重复不受影响的全量套件。
- 不再强制每个明确任务先 brainstorming、大计划、worktree、subagent 或多轮 full CI。
- 保留真实计分边界、根因诊断、完成前新鲜证据、dirty worktree 保护和 60 秒内进度沟通。
- 同一连续对话只做一次完整启动审计；用户说“继续”时从当前切片恢复，不重读全部计划、不重跑未受影响的全量门禁。
- 普通 `继续` 默认只做一个约 10–15 分钟的可验证切片；完成后先回报。只有用户明确要求持续自动推进或不要停，才连续执行多个切片。
- 仅当前切片涉及的仓库做完整 branch/remote/diff 基线；另一仓在最终交接只刷新 status/staged。
- 全工作区归属读取 P4 JSON summary；只审查本切片触达文件的 diff，不默认展开 16k+ 行历史差异。

该流程优化不增加任何业务进度或真实交付信用。

### 已确认的耗时来源

- 上下文加载：旧规则启动即读 3,077 行长期文档，远高于 80 行 `superpowers-lite`。
- 工作区规模：Story 为大型 dirty worktree，tracked diff 约 16,417 行新增；全量展开会显著增加分析量。
- 测试执行：Story server 全量约 67 秒，Unified CI 约 88 秒，GEARS 完整门禁还会追加等待；这些不是模型“思考”。
- 权限往返：GEARS 位于工作区写权限外，重复 escalated 审计会产生额外审批/调度延迟。
- 文档维护：过去每个小切片同时追加长期计划、综合执行、P4 prose、机器报告和交接，造成重复读取与验证。

优化后只在业务基线/计分/里程碑变化时更新长期计划；普通切片默认只更新代码、必要测试、P4 JSON 和当前交接。P4 prose、综合执行和长期计划不再逐切片重复追加。

## 10. 新对话启动指令

建议将以下内容作为新对话首条消息：

> 完整读取 `docs/story-agent-next-conversation-handoff-20260717.md`，使用 `$superpowers-lite` 默认 Lite 模式推进；长期计划、P4 prose、综合执行和知识扩充文档按交接第 1 节路由，只读当前任务相关段落。先做一次 Story/P4 快速审计，再收口 draft `source_observations` 与 `additionalObservations` 的数组语义：对 canonical/追加输入对称证明显式空、空白、重复领域标签会静默退化，以及空/空白/重复/未知成片标签和空白 takeaway/limitation 仍被接受；复用 MCP 单一受支持类型合同，领域标签 present 时要求非空唯一非空白，成片标签还必须受支持，文本列表拒绝空白项。错误固定字段路径且不回显 payload；blank `source_id` 继续按 invalid observation 计数，不改 draft v1、canonical 内容或真实计分。完成定向测试、MCP build 和 canonical 草案只读回归，稳定后只跑一次完整门禁。本切片不改 GEARS 时只在最终刷新其 status/staged。保持 knowledge writeback、20 个 domain-safety candidate、legacy disposition、file→SQLite、真实模型和真实 GEARS/Seedance 零动作。保留 dirty worktree，不暂存、不提交、不推送。完成后用紧凑格式报告五套进度、测试证据、两仓状态、下一步和外部阻塞。

## 11. 新对话每轮强制报告

每轮必须报告：五套进度、真实指标、测试证据、Story/GEARS 两个工作区状态、下一步和外部阻塞。任何 fixture、fake key、readiness、dry-run、本地导入或候选稿不得改变真实计分。
