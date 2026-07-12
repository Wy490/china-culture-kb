# Phase 2 Domain Pack 候选规则包

更新时间：2026-07-09

本文件说明 `data/domain-packs/phase2-candidate-rule-packs.json` 的用途和后续晋升规则。

## 本轮结果

从 30 条黄金生产素材卡和 9 条回归样本中，抽取并结构化了 9 个 Phase 2 候选规则包：

| 候选包 | 主要用途 | 状态 |
|---|---|---|
| 重大历史伤痛证据表达候选包 | 南京大屠杀等创伤历史表达边界 | candidate_pending_domain_review |
| 民族医药文化记录与隐私边界候选包 | 苗医苗药等民族医药文化记录和医疗伦理 | candidate_pending_domain_review |
| 革命历史事件再现边界候选包 | 平江起义、武昌起义等事件再现 | candidate_pending_domain_review |
| 非遗流程与授权候选包 | 非遗宣传片材料、工序、授权 | candidate_pending_domain_review |
| 民族仪式与社区边界候选包 | 民族仪式、社区知识、公开展演边界 | candidate_pending_domain_review |
| 戏曲曲艺版权与舞台资产候选包 | 曲目、唱词、曲谱、肖像和舞台资产授权 | candidate_pending_domain_review |
| 微纪录现场与来源边界候选包 | 现实现场、来源线索、B-roll、再现边界 | candidate_pending_domain_review |
| AI 漫剧连续性分镜候选包 | 角色稳定、道具锚点、单镜头/多镜头测试 | candidate_pending_domain_review |
| 工艺材料工具流程候选包 | 工艺材料、工具、流程、文物/复原件边界 | candidate_pending_domain_review |

## 设计原则

这些包不是正式 Domain Pack，而是候选层。

原因：

- 它们来自黄金卡和回归样本，已经有生产价值。
- 但它们还没有完成人工领域审稿。
- 还没有达到“每个包至少被 3 个真实条目或项目调用验证”的正式门槛。
- 直接写入 `data/domain-packs/china-culture.json` 会让未审稿规则影响全局生成。

因此本轮新增独立候选文件：

`data/domain-packs/phase2-candidate-rule-packs.json`

正式 Domain Pack 仍保持：

`data/domain-packs/china-culture.json`

## 晋升门槛

候选包进入正式 Domain Pack 前，需要完成：

- 人工领域审稿。
- 至少 3 个真实条目或项目调用验证。
- 至少 1 条回归样本或项目生成验证。
- 人工 Patch 到正式 `china-culture.json`。
- 跑 Domain Pack 候选测试和全量测试。

## 与 Phase 1 的关系

Phase 1 的重点是条目级黄金卡。

Phase 2 的重点不是继续复制单条卡，而是把多张卡中反复出现的规则提升为可复用资产。

这次结构化候选包，等于把 Phase 1 的成果接到了 Phase 2 的入口：

```text
30 条黄金卡
  -> 9 条回归样本
  -> 9 个候选规则包
  -> 人工审稿
  -> 正式 Domain Pack
  -> 多片型复用
```

## 仍不能计为完成

以下内容还没有完成：

- 候选包尚未人工审稿。
- 候选包尚未写入正式 Domain Pack。
- 每个候选包尚未被 3 个真实项目调用验证。
- 还没有形成正式的项目调用统计。

所以 Phase 2 当前是“候选结构化完成”，不是“正式包完成”。
