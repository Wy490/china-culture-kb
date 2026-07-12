# Story Agent Stage 6 / Iteration 1 多轮修订合同实现报告

状态：multi_round_revision_contract_ready_15_real_projects_pending

本轮把 15 个片型已有的 Coverage 与修订计划统一为可审计的多轮修订生命周期。服务覆盖结构、人物或信息、场景、对白或旁白、节奏、事实与文化六类 Coverage，支持导入编剧编辑、导演、事实文化评审和用户桌读意见，并逐条记录关闭结果。

每轮修订必须保存前后专业文本包 SHA-256、前后质量分、质量增量、解决/新增/剩余问题、修改区段、必须重建与实际重建的派生文本，以及模型或人工作者、提示/简报版本和成本记录状态。修改 `full_text` 或分场后未重建 `scene_breakdown`、`sequence_beats`、导演文本或交付文本时，合同 fail closed。

fixture 和 simulation 即使产生分数上涨，也不能获得真实修订信用；Stage 6 退出候选也不等于专业通过。

```text
当前 Stage：Stage 6 / Iteration 1
覆盖片型：15 / 15
专业纵向管线：15 / 15
专业文本包通过：0 / 15
Stage 6 固定多轮修订项目规格：15
完成两轮真实修订项目：0 / 15
已验证真实修订轮次：0
Stage 6 失败 fixture：3
固定真实模型项目：0 / 75
真人盲评通过项目：0 / 45
黄金素材卡人工通过：0 / 75
硬门槛失败数：15
professional_text_creation_progress：40% -> 40%
```

三个失败 fixture 分别覆盖：模拟分数上涨冒充真实修订、源文本变化后派生文本陈旧，以及桌读意见未关闭却尝试形成退出候选。

下一步 Stage 6 / Iteration 2 必须执行 15 个真实项目：每个片型至少一个项目完成两轮以上修订，并保存真实 provenance、桌读反馈、版本差异、质量增量和派生文本重建证据。在真实模型、人工创作与真人桌读证据到位前，完成项目数和专业进度保持不变。
