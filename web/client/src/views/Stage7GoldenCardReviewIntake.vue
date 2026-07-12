<template>
  <section class="review-page">
    <header class="hero">
      <div><p class="eyebrow">STORY AGENT · STAGE 7 · HUMAN REVIEW INTAKE</p><h2>黄金素材卡真人审稿接入</h2><p>冻结卡片与源文件哈希，按风险级别检查三角色实名审稿材料；这里只做签署前预检。</p></div>
      <nav><RouterLink to="/story/stage6-exit-review-signature">Stage 6 退出签名</RouterLink><RouterLink to="/knowledge-writeback-queue">写回队列</RouterLink></nav>
    </header>
    <div class="truth-lock"><strong>预检 ready ≠ 人工通过</strong><span>pending、fixture、自报批准和本地导入都不能晋升黄金卡，也不能增加专业进度。</span></div>
    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>

    <section v-if="workspace" class="summary-grid">
      <article><span>候选卡</span><strong>{{ workspace.summary.indexed_candidate_card_count }} / 75</strong></article>
      <article><span>片型覆盖</span><strong>{{ workspace.summary.candidate_video_type_count }} / 15</strong></article>
      <article><span>缺口</span><strong>{{ workspace.summary.missing_target_card_count }} 张</strong></article>
      <article><span>待真人审稿</span><strong>{{ workspace.summary.pending_human_review_card_count }}</strong></article>
      <article class="zero"><span>人工通过</span><strong>0</strong></article>
    </section>

    <section v-if="workspace" class="type-strip">
      <article v-for="item in workspace.video_types" :key="item.video_type" :class="item.coverage_status">
        <span>{{ item.label }}</span><strong>{{ item.indexed_candidate_card_count }} / 5</strong><small>{{ item.coverage_status==='missing_candidates'?'缺候选':'候选待审' }}</small>
      </article>
    </section>

    <section v-if="workspace" class="control-bar">
      <label>候选卡<select v-model="selectedCardId"><option v-for="card in workspace.cards" :key="card.card_id" :value="card.card_id">{{ card.entry_name }} · {{ card.video_type }} · {{ card.risk_tier }}</option></select></label>
      <button :disabled="loading" @click="loadWorkspace">生成绑定模板</button>
      <button class="primary" :disabled="loading||!editorText" @click="runInspection">{{ loading?'检查中…':'检查审稿材料' }}</button>
    </section>

    <section class="workspace-grid">
      <article class="editor-card">
        <header><div><p class="eyebrow">REVIEW INTAKE JSON</p><h3>外部真人审稿记录</h3></div><span>仅内存</span></header>
        <div class="toolbar"><label>导入 JSON<input type="file" accept=".json,application/json" @change="importFile"></label><button @click="copyJson">复制 JSON</button><span>{{ copyMessage }}</span></div>
        <textarea v-model="editorText" aria-label="Stage 7 golden card review intake JSON" spellcheck="false" />
        <footer><span>{{ editorText.length.toLocaleString() }} 字符</span><b>不批准 · 不晋升 · 不写回</b></footer>
      </article>

      <article class="result-card">
        <header><div><p class="eyebrow">PREFLIGHT RESULT</p><h3>绑定、角色与证据检查</h3></div><b :class="inspection?.approval_preflight_ready?'ready':'blocked'">{{ inspection?.approval_preflight_ready?'READY FOR EXTERNAL SIGNATURE':'BLOCKED' }}</b></header>
        <div v-if="inspection" class="metrics"><div><span>Schema</span><strong>{{ inspection.checks.intake_schema_valid?'合法':'失败' }}</strong></div><div><span>角色</span><strong>{{ inspection.review_summary.matched_required_role_count }}/{{ inspection.review_summary.required_role_count }}</strong></div><div><span>证据引用</span><strong>{{ inspection.review_summary.evidence_reference_count }}</strong></div><div><span>人工通过</span><strong>0</strong></div></div>
        <div v-if="inspection" class="binding-panel"><span>Card <b>{{ inspection.expected_binding.card_id }}</b></span><span>片型 <b>{{ inspection.expected_binding.video_type }}</b></span><span>风险 <b>{{ inspection.expected_binding.risk_tier }}</b></span><span>源文件 <code>{{ shortPath(inspection.expected_binding.source_card_file) }}</code></span><span>Source SHA <code>{{ shortHash(inspection.source_file_sha256) }}</code></span><span>Card SHA <code>{{ shortHash(inspection.canonical_card_payload_sha256) }}</code></span></div>
        <section v-if="inspection" class="roles"><h4>必需审稿角色</h4><div><span v-for="role in inspection.expected_binding.required_roles" :key="role">{{ roleLabel(role) }}</span></div></section>
        <section v-if="inspection" class="checks"><h4>真人审稿接入门禁</h4><div><span v-for="(passed,key) in inspection.checks" :key="key" :class="passed?'ok':'fail'">{{ passed?'✓':'×' }} {{ checkLabel(key) }}</span></div></section>
        <section v-if="inspection?.issues.length" class="issues"><h4>问题 {{ inspection.issues.length }} 项</h4><article v-for="(item,index) in inspection.issues" :key="`${item.code}-${index}`"><header><b>{{ item.gate.toUpperCase() }}</b><code>{{ item.code }}</code></header><span>{{ item.path||'root' }}</span><p>{{ item.message }}</p></article></section>
        <div class="safety-grid"><span>Review persisted <b>否</b></span><span>Source card modified <b>否</b></span><span>Province Markdown modified <b>否</b></span><span>Human approval granted <b>否</b></span><span>Golden card promoted <b>否</b></span><span>Professional passed <b>否</b></span></div>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Stage7GoldenCardReviewerRole, Stage7GoldenCardReviewInspectionResult, Stage7GoldenCardReviewWorkspace } from '@shared/types'
import { getStage7GoldenCardReviewWorkspace, inspectStage7GoldenCardReview } from '../api/stage7-golden-cards'

const workspace=ref<Stage7GoldenCardReviewWorkspace|null>(null),inspection=ref<Stage7GoldenCardReviewInspectionResult|null>(null),selectedCardId=ref(''),editorText=ref(''),loading=ref(false),errorMessage=ref(''),copyMessage=ref('')
const checkLabels:Record<string,string>={request_valid:'检查请求',json_valid:'JSON 可解析',intake_schema_valid:'Intake schema',card_found_in_index:'统一索引存在',card_pending_human_review:'候选仍待人审',card_id_binding_valid:'Card ID 绑定',video_type_binding_valid:'片型绑定',source_file_binding_valid:'源文件绑定',source_file_digest_valid:'源文件 SHA-256',card_payload_digest_valid:'卡片 Payload SHA-256',review_decision_recorded:'审稿决定已记录',reviewer_roles_complete:'风险角色齐全',reviewer_identities_verified:'实名身份已核验',review_timestamps_valid:'审稿时间有效',evidence_refs_present:'证据引用齐全',review_notes_present:'审稿意见齐全',unanimous_role_approval:'三角色一致批准',source_claimed_credit_rejected:'自报信用已拒绝'}
const roleLabels:Record<Stage7GoldenCardReviewerRole,string>={source_reviewer:'来源审稿',authorization_reviewer:'授权审稿',type_director:'片型导演',fact_reviewer:'事实审稿',ethics_reviewer:'伦理审稿',local_culture_reviewer:'地方文化审稿'}
onMounted(loadWorkspace)
async function loadWorkspace(){loading.value=true;errorMessage.value='';const response=await getStage7GoldenCardReviewWorkspace(selectedCardId.value);loading.value=false;if(!response.ok||!response.data){errorMessage.value=response.error?.message??'黄金卡审稿接入加载失败';return}workspace.value=response.data;selectedCardId.value=response.data.selected_card_id;editorText.value=response.data.template_raw_json;inspection.value=response.data.template_inspection}
async function runInspection(){loading.value=true;errorMessage.value='';const response=await inspectStage7GoldenCardReview({raw_json:editorText.value,expected_card_id:selectedCardId.value});loading.value=false;if(!response.ok||!response.data){errorMessage.value=response.error?.message??'黄金卡审稿材料检查失败';return}inspection.value=response.data}
async function importFile(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;try{editorText.value=await file.text();errorMessage.value=''}catch(error){errorMessage.value=`导入失败：${(error as Error).message}`}finally{input.value=''}}
async function copyJson(){try{await navigator.clipboard.writeText(editorText.value);copyMessage.value='已复制'}catch{copyMessage.value='复制未授权'}window.setTimeout(()=>copyMessage.value='',1600)}
function checkLabel(key:string){return checkLabels[key]??key} function roleLabel(role:Stage7GoldenCardReviewerRole){return roleLabels[role]} function shortHash(value:string){return value?`${value.slice(0,10)}…${value.slice(-6)}`:'—'} function shortPath(value:string){return value.split('/').slice(-2).join('/')}
</script>

<style scoped>
.review-page{min-height:100%;padding:28px;color:#f2eadc;background:radial-gradient(circle at 90% 0%,#60472f,#251d19 38%,#0e0c0b 100%)}.hero{max-width:1480px;margin:0 auto 16px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.hero h2{margin:4px 0 8px;font-size:clamp(30px,4vw,48px);letter-spacing:-.04em}.hero p{margin:0;max-width:920px;color:#bcae9d}.hero nav{display:flex;gap:8px}.hero a,.control-bar button,.toolbar button,.toolbar label{padding:9px 13px;border:1px solid #775e42;border-radius:9px;color:#f1dfc7;background:#352a21;text-decoration:none;cursor:pointer;font:inherit}.eyebrow{color:#d5a969!important;font-size:11px;font-weight:800;letter-spacing:.17em}.truth-lock{max-width:1480px;margin:0 auto 14px;padding:14px 16px;display:flex;gap:14px;border:1px solid #9a6d38;border-radius:12px;color:#ffd293;background:#3a2918}.truth-lock span{color:#d0b187}.error-banner{max-width:1480px;margin:0 auto 13px;padding:11px;border-radius:9px;color:#ffb2b2;background:#4a2020}.summary-grid{max-width:1480px;margin:0 auto 12px;display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.summary-grid article{padding:11px;border:1px solid #5e4934;border-radius:9px;background:#211a16}.summary-grid span{display:block;color:#a6937d;font-size:9px}.summary-grid strong{font-size:21px}.summary-grid .zero strong{color:#ff9f9f}.type-strip{max-width:1480px;margin:0 auto 12px;display:grid;grid-template-columns:repeat(8,1fr);gap:5px}.type-strip article{padding:7px;border-radius:7px;background:#282019}.type-strip article.missing_candidates{background:#351e1e}.type-strip span,.type-strip small{display:block;color:#a9927a;font-size:8px}.type-strip strong{font-size:14px}.type-strip .missing_candidates strong{color:#e89a9a}.control-bar{max-width:1480px;margin:0 auto 14px;padding:10px;display:flex;align-items:flex-end;gap:8px;border:1px solid #5d4935;border-radius:11px;background:#1d1714}.control-bar label{flex:1;color:#aa957d;font-size:9px}.control-bar select{width:100%;margin-top:4px;padding:8px;border:1px solid #735b43;border-radius:7px;color:#f2e6d5;background:#100d0b}.control-bar .primary{background:#6b4d2e;border-color:#bb8851}.control-bar button:disabled{opacity:.5}.workspace-grid{max-width:1480px;margin:auto;display:grid;grid-template-columns:minmax(420px,.85fr) minmax(590px,1.15fr);gap:15px;align-items:start}.editor-card,.result-card{overflow:hidden;border:1px solid #594634;border-radius:13px;background:rgba(29,23,19,.97)}.editor-card{position:sticky;top:15px}.editor-card>header,.result-card>header{padding:15px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #4c3a2b}.editor-card h3,.result-card h3{margin:3px 0 0}.editor-card header span{color:#9e8974;font:10px ui-monospace,monospace}.result-card header>b{font-size:10px;letter-spacing:.07em}.ready{color:#83d9ad}.blocked{color:#ff9f9f}.toolbar{padding:10px 13px;display:flex;align-items:center;gap:7px}.toolbar input{display:none}.toolbar span{color:#9e8a75;font-size:10px}textarea{width:100%;min-height:630px;padding:16px;box-sizing:border-box;resize:vertical;border:0;border-block:1px solid #443326;outline:0;color:#e7d9c8;background:#0d0b09;font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.editor-card footer{padding:10px 13px;display:flex;justify-content:space-between;color:#9e8a75;font-size:10px}.editor-card footer b{color:#e0b779}.metrics{margin:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.metrics div{padding:9px;border-radius:7px;background:#30261e}.metrics span{display:block;color:#a48e77;font-size:9px}.metrics strong{font-size:15px}.metrics div:last-child strong{color:#ff9e9e}.binding-panel,.safety-grid{margin:0 14px 12px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.binding-panel span,.safety-grid span{padding:8px;border-radius:7px;color:#a28d78;background:#2b211a;font-size:9px}.binding-panel b,.binding-panel code,.safety-grid b{float:right;max-width:65%;color:#eadbc9;overflow-wrap:anywhere}.safety-grid b{color:#ff9f9f}.roles,.checks,.issues{margin:0 14px 13px}.roles h4,.checks h4,.issues h4{margin:0 0 7px}.roles>div{display:flex;gap:6px}.roles span{padding:7px 9px;border-radius:7px;color:#e2bc84;background:#3a2c1e;font-size:9px}.checks>div{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.checks span{padding:7px;border-radius:6px;font-size:9px}.ok{color:#7fd4a8;background:#19352a}.fail{color:#eea0a0;background:#3b2020}.issues>article{margin:5px 0;padding:8px;border:1px solid #5b3c38;border-radius:7px;background:#2d1b1b}.issues article header{display:flex;gap:7px}.issues article b{color:#ec9d91;font-size:8px}.issues code{color:#cfb4aa;font-size:9px}.issues article>span{display:block;margin-top:3px;color:#9e827a;font-size:9px}.issues p{margin:2px 0 0;color:#c8b6ae;font-size:10px}
@media(max-width:1150px){.type-strip{grid-template-columns:repeat(4,1fr)}.workspace-grid{grid-template-columns:1fr}.editor-card{position:static}textarea{min-height:440px}}@media(max-width:760px){.review-page{padding:18px 12px}.hero,.truth-lock,.control-bar{align-items:flex-start;flex-direction:column}.control-bar label{width:100%}.summary-grid{grid-template-columns:repeat(2,1fr)}.type-strip{grid-template-columns:repeat(2,1fr)}.metrics,.binding-panel,.safety-grid,.checks>div{grid-template-columns:1fr}}
</style>
