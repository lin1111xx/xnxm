import { getState, patchState, exportLayout, importLayout } from "../core/storage.js";
import { getAllApps, allBuiltinApps, availableExtensions, installExtension, uninstallExtension, refreshRegistry, isBuiltin } from "../core/app-registry.js";
import { sendMessage } from "../services/ai-service.js";

const $ = s => document.querySelector(s);
function panel(html) { return `<div class="panel">${html}</div>`; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

const themes = {
  default: { name: "默认", accent: "#6558d3" },
  dark: { name: "深色", accent: "#8b5cf6" },
  warm: { name: "暖色", accent: "#e11d48" },
  ocean: { name: "海洋", accent: "#059669" }
};

export function renderApp(id) {
  const state = getState();
  const content = $("#app-content");

  if (id === "settings") {
    const ai = state.ai || {};
    const wallpapers = [
      "linear-gradient(145deg,#a5b4fc,#fbcfe8 55%,#fed7aa)",
      "linear-gradient(145deg,#99f6e4,#bfdbfe 55%,#ddd6fe)",
      "linear-gradient(145deg,#1e293b,#475569 55%,#7c3aed)",
      "linear-gradient(145deg,#fecaca,#fda4af 55%,#fef3c7)"
    ];

    content.innerHTML =
      panel(`<h3>外观 · 壁纸</h3><div class="muted">选择渐变壁纸，或导入自定义图片</div>
        <div style="display:flex;gap:10px;margin-top:14px">
          ${wallpapers.map((w, i) => `<button data-wall="${i}" style="height:58px;flex:1;border-radius:13px;background:${w};border:2px solid ${state.wallpaper === i && !state.customWallpaper ? "#6558d3" : "transparent"}"></button>`).join("")}
        </div>
        <div class="row" style="margin-top:14px">
          <span>自定义壁纸</span>
          <span>
            <button class="primary" id="wallpaper-import">导入图片</button>
            ${state.customWallpaper ? '<button class="primary" id="wallpaper-clear" style="margin-left:6px">清除</button>' : ""}
          </span>
        </div>
        <input id="wallpaper-file" type="file" accept="image/*" hidden>`)

      + panel(`<h3>外观 · 主题</h3><div class="muted">切换系统强调色</div>
        <div style="display:flex;gap:10px;margin-top:14px">
          ${Object.entries(themes).map(([key, t]) => `
            <button data-theme="${key}" style="height:48px;flex:1;border-radius:12px;background:${t.accent};border:2px solid ${state.theme === key ? "#fff" : "transparent"};color:white;font-size:12px">${t.name}</button>
          `).join("")}
        </div>`)

      + panel(`<h3>桌面布局备份</h3><p class="muted">导出或导入桌面图标排列、文件夹、Dock、壁纸等布局设置（不含聊天记录和 API Key）。</p>
        <div class="row">
          <span>导出当前布局</span>
          <button class="primary" id="layout-export">导出 JSON</button>
        </div>
        <div class="row">
          <span>导入布局文件</span>
          <button class="primary" id="layout-import">选择文件</button>
        </div>
        <input id="layout-file" type="file" accept=".json,application/json" hidden>`)

      + panel(`<h3>AI 模型配置</h3><p class="muted">支持 OpenAI Chat Completions 兼容接口。部分服务商需要允许浏览器跨域访问。</p>
        <label class="muted">API Base URL</label><input id="ai-url" class="field" placeholder="https://api.openai.com/v1" value="${esc(ai.baseUrl || "")}">
        <label class="muted">API Key</label><input id="ai-key" class="field" type="password" autocomplete="off" placeholder="填写 API Key（留空则保持原密钥）">
        <label class="muted">模型名称</label><input id="ai-model" class="field" placeholder="例如 gpt-4o-mini" value="${esc(ai.model || "")}">
        <label class="muted">系统提示词</label><textarea id="ai-prompt" class="field" style="min-height:90px">${esc(ai.systemPrompt || "")}</textarea>
        <button class="primary" id="save-ai">保存 AI 配置</button><span class="muted" id="ai-saved" style="margin-left:9px"></span>
        <p class="muted" style="margin-top:12px">安全提示：这是纯前端应用，API Key 会保存在当前浏览器的本地存储中。不要在共享设备上保存密钥；正式商业产品建议增加自有后端代理。</p>`)

      + panel(`<h3>酒馆预设 / 提示词分层</h3><p class="muted">管理 system、角色定义、场景、作者注释等提示词层。预设可导入和导出 JSON。</p>
        <div class="row"><button class="primary" id="preset-import">导入预设 JSON</button><button class="primary" id="preset-export">导出当前预设</button><input id="preset-file" type="file" accept=".json,application/json" hidden></div>
        <label class="muted">选择预设</label><select id="preset-select" class="field"><option value="default" ${state.activePresetId === "default" ? "selected" : ""}>默认预设</option>${(state.presets || []).map(x => `<option value="${esc(x.id)}" ${x.id === state.activePresetId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
        <label class="muted">预设名称</label><input id="preset-name" class="field" value="${esc((state.presets || []).find(x => x.id === state.activePresetId)?.name || "默认预设")}">
        <div id="prompt-layers"></div>
        <button class="primary" id="add-layer">＋ 添加提示词层</button><button class="primary" id="save-preset" style="margin-left:8px">保存预设</button><span id="preset-msg" class="muted"></span>`)

      + panel(`<h3>系统</h3>
        <div class="row"><span>项目版本</span><b>0.7.0</b></div>
        <div class="row"><span>数据存储</span><b>本机浏览器</b></div>
        <div class="row"><span>锁屏</span><button class="primary" id="relock">立即锁定</button></div>
        <div class="row"><span>清除本机数据</span><button class="primary" id="reset-data">清除</button></div>`);

    // 壁纸选择
    content.querySelectorAll("[data-wall]").forEach(b => b.onclick = () => {
      patchState({ wallpaper: +b.dataset.wall, customWallpaper: "" });
      applyWallpaper();
    });

    // 自定义壁纸导入
    $("#wallpaper-import").onclick = () => $("#wallpaper-file").click();
    $("#wallpaper-file").onchange = async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        patchState({ customWallpaper: reader.result });
        applyWallpaper();
        renderApp("settings");
      };
      reader.readAsDataURL(file);
    };
    if ($("#wallpaper-clear")) {
      $("#wallpaper-clear").onclick = () => {
        patchState({ customWallpaper: "" });
        applyWallpaper();
        renderApp("settings");
      };
    }

    // 主题切换
    content.querySelectorAll("[data-theme]").forEach(b => b.onclick = () => {
      patchState({ theme: b.dataset.theme });
      applyTheme();
      renderApp("settings");
    });

    // 布局导出
    $("#layout-export").onclick = () => {
      const data = exportLayout();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "littlephone-layout.json";
      a.click();
      URL.revokeObjectURL(a.href);
    };

    // 布局导入
    $("#layout-import").onclick = () => $("#layout-file").click();
    $("#layout-file").onchange = async e => {
      try {
        const obj = JSON.parse(await e.target.files[0].text());
        importLayout(obj);
        refreshRegistry();
        applyWallpaper();
        applyTheme();
        renderApp("settings");
        // 触发桌面重渲染（通过关闭再打开设置）
        window.dispatchEvent(new CustomEvent("layout-imported"));
      } catch (err) {
        alert("布局导入失败：" + err.message);
      }
    };

    // AI 配置保存
    $("#save-ai").onclick = () => {
      const old = getState().ai || {};
      const key = $("#ai-key").value.trim() || old.apiKey || "";
      patchState({ ai: { baseUrl: $("#ai-url").value.trim(), apiKey: key, model: $("#ai-model").value.trim(), systemPrompt: $("#ai-prompt").value } });
      $("#ai-key").value = "";
      $("#ai-saved").textContent = "已保存";
    };

    // 预设逻辑（保持不变）
    let preset = (state.presets || []).find(x => x.id === state.activePresetId) || { id: "default", name: "默认预设", layers: [{ role: "system", name: "主系统提示词", content: ai.systemPrompt || "" }] };
    const layers = JSON.parse(JSON.stringify(preset.layers || []));
    const layerBox = $("#prompt-layers");
    const drawLayers = () => {
      layerBox.innerHTML = layers.map((l, i) => `<div class="panel" style="padding:12px"><div style="display:flex;gap:8px"><input class="field" data-layer-name="${i}" value="${esc(l.name || "提示词层")}" placeholder="层名称"><select class="field" data-layer-role="${i}" style="width:115px"><option value="system" ${l.role === "system" ? "selected" : ""}>system</option><option value="user" ${l.role === "user" ? "selected" : ""}>user</option></select><button data-layer-del="${i}">删除</button></div><textarea class="field" data-layer-content="${i}" style="min-height:80px">${esc(l.content || "")}</textarea></div>`).join("");
      layerBox.querySelectorAll("[data-layer-del]").forEach(b => b.onclick = () => { layers.splice(+b.dataset.layerDel, 1); drawLayers(); });
    };
    drawLayers();
    $("#preset-select").onchange = () => { patchState({ activePresetId: $("#preset-select").value }); renderApp("settings"); };
    $("#add-layer").onclick = () => { layers.push({ role: "system", name: "新提示词层", content: "" }); drawLayers(); };
    $("#save-preset").onclick = () => {
      layerBox.querySelectorAll("[data-layer-name]").forEach(e => layers[+e.dataset.layerName].name = e.value);
      layerBox.querySelectorAll("[data-layer-role]").forEach(e => layers[+e.dataset.layerRole].role = e.value);
      layerBox.querySelectorAll("[data-layer-content]").forEach(e => layers[+e.dataset.layerContent].content = e.value);
      const item = { id: preset.id || "preset-" + Date.now(), name: $("#preset-name").value || "未命名预设", layers };
      patchState({ presets: [...(getState().presets || []).filter(x => x.id !== item.id), item], activePresetId: item.id });
      $("#preset-msg").textContent = "已保存";
    };
    $("#preset-import").onclick = () => $("#preset-file").click();
    $("#preset-file").onchange = async e => {
      try {
        const obj = JSON.parse(await e.target.files[0].text());
        const src = obj.preset || obj;
        let imported;
        if (Array.isArray(src.prompts)) {
          imported = { id: "import-" + Date.now(), name: src.name || "导入预设", layers: src.prompts.map((x, i) => ({ role: x.role === "user" ? "user" : "system", name: x.name || `提示词 ${i + 1}`, content: x.content || x.prompt || x.system_prompt || "" })).filter((x, i) => src.prompts[i].enabled !== false) };
        } else if (Array.isArray(src.layers)) {
          imported = { id: "import-" + Date.now(), name: src.name || "导入预设", layers: src.layers.map(x => ({ role: x.role === "user" ? "user" : "system", name: x.name || "提示词层", content: x.content || "" })) };
        } else throw new Error("未识别到 prompts 或 layers 数组");
        patchState({ presets: [...(getState().presets || []), imported], activePresetId: imported.id });
        renderApp("settings");
      } catch (err) { alert("预设导入失败：" + err.message); }
    };
    $("#preset-export").onclick = () => {
      const item = { ...preset, name: $("#preset-name").value, layers };
      const blob = new Blob([JSON.stringify(item, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "littlephone-preset.json";
      a.click();
      URL.revokeObjectURL(a.href);
    };

    $("#relock").onclick = () => { document.querySelector("#system").classList.add("hidden"); document.querySelector("#lockscreen").classList.remove("hidden"); };
    $("#reset-data").onclick = () => { if (confirm("确定清除 LittlePhone 的本机数据？")) { localStorage.removeItem("littlephone.state.v1"); location.reload(); } };

  } else if (id === "notes") {
    content.innerHTML = panel(`<h3>备忘录</h3><textarea id="note" class="field note-area" placeholder="写下你的想法……"></textarea><button class="primary" id="save-note">保存</button><span class="muted" id="saved" style="margin-left:10px"></span>`);
    $("#note").value = state.notes || "";
    $("#save-note").onclick = () => { patchState({ notes: $("#note").value }); $("#saved").textContent = "已保存"; };

  } else if (id === "chat") {
    const chars = state.characters?.length ? state.characters : [{ id: "default", name: "默认助手", prompt: "你是一个友好、自然的中文 AI 助手。" }];
    const active = chars.find(c => c.id === state.activeCharacterId) || chars[0];
    content.innerHTML = `<div class="chat-box"><div class="panel"><div style="display:flex;align-items:center;gap:8px"><b style="flex:1">AI 角色聊天</b><select id="chat-character" class="field" style="width:auto;margin:0;max-width:55%">${chars.map(c => `<option value="${esc(c.id)}" ${c.id === active.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div><div class="muted" id="chat-status">当前角色：${esc(active.name)} · 对话独立保存</div></div><div class="messages" id="messages"></div><div class="chat-input"><input id="chat-text" placeholder="输入消息…" autocomplete="off"><button class="primary" id="chat-send">发送</button></div></div>`;
    const draw = () => { const box = $("#messages"); if (!box) return; box.innerHTML = (getState().chatsByCharacter?.[active.id] || []).map(m => `<div class="bubble ${m.role === "user" ? "user" : ""}">${esc(m.content)}</div>`).join(""); box.scrollTop = box.scrollHeight; };
    draw();
    $("#chat-character").onchange = () => { patchState({ activeCharacterId: $("#chat-character").value }); renderApp("chat"); };
    let busy = false, controller = null;
    const send = async () => {
      const input = $("#chat-text"), v = input.value.trim();
      if (!v || busy) return;
      const current = getState(), cfg = current.ai || {}, all = current.chatsByCharacter || {}, history = [...(all[active.id] || []), { role: "user", content: v }];
      patchState({ chatsByCharacter: { ...all, [active.id]: history } });
      input.value = ""; draw();
      busy = true; $("#chat-send").textContent = "停止"; $("#chat-status").textContent = "正在生成…";
      controller = new AbortController();
      $("#chat-send").onclick = () => controller?.abort();
      try {
        const prompt = [cfg.systemPrompt || "你是一个友好的助手。", active.prompt || ""].filter(Boolean).join("\\n\\n");
        const recent = history.slice(-30);
        const book = getState().worldbook || [];
        const haystack = recent.map(x => x.content).join("\\n").toLowerCase();
        const matched = book.filter(e => (e.keywords || "").split(/[,，、\\n]/).map(x => x.trim()).filter(Boolean).some(k => haystack.includes(k.toLowerCase())));
        const bookPrompt = matched.length ? "\\n\\n【相关世界书设定】\\n" + matched.map(e => `【${e.title}】\\n${e.content}`).join("\\n\\n") : "";
        const selectedPreset = (getState().presets || []).find(x => x.id === getState().activePresetId);
        const presetLayers = (selectedPreset?.layers || []).filter(x => x.content?.trim());
        const systemParts = [prompt, ...presetLayers.filter(x => x.role === "system").map(x => x.content), bookPrompt].filter(Boolean);
        const requestMessages = [{ role: "system", content: systemParts.join("\\n\\n") }, ...presetLayers.filter(x => x.role === "user").map(x => ({ role: "user", content: x.content })), ...recent.map(m => ({ role: m.role, content: m.content }))];
        let streamed = "";
        const answer = await sendMessage({ ...cfg, messages: requestMessages, signal: controller.signal, onDelta: chunk => { streamed += chunk; const box = $("#messages"); if (box) { let bubble = $("#streaming-bubble"); if (!bubble) { bubble = document.createElement("div"); bubble.id = "streaming-bubble"; bubble.className = "bubble"; box.appendChild(bubble); } bubble.textContent = streamed; box.scrollTop = box.scrollHeight; } } });
        const latest = getState().chatsByCharacter || {};
        patchState({ chatsByCharacter: { ...latest, [active.id]: [...(latest[active.id] || []), { role: "assistant", content: answer }] } });
        $("#chat-status").textContent = "回复完成";
      } catch (err) {
        if (err.name === "AbortError") $("#chat-status").textContent = "已停止";
        else {
          const latest = getState().chatsByCharacter || {};
          patchState({ chatsByCharacter: { ...latest, [active.id]: [...(latest[active.id] || []), { role: "assistant", content: "请求失败：" + err.message }] } });
          $("#chat-status").textContent = err.message;
        }
      } finally { busy = false; controller = null; $("#chat-send").textContent = "发送"; $("#chat-send").onclick = send; draw(); }
    };
    $("#chat-send").onclick = send;
    $("#chat-text").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  } else if (id === "characters") {
    const chars = state.characters || [];
    content.innerHTML = panel(`<h3>角色管理</h3><p class="muted">支持 JSON 角色卡，以及包含 chara 元数据的 PNG 角色卡（Tavern Card v2/v3 常见格式）。</p><div class="row"><button class="primary" id="add-char">＋ 新建角色</button><button class="primary" id="import-char">导入角色卡</button><input id="char-file" type="file" accept=".json,.png,application/json,image/png" hidden></div><div id="character-list">${chars.map(c => `<div class="row"><span>${esc(c.name)}</span><span><button class="primary" data-edit-char="${esc(c.id)}">编辑</button> <button data-delete-char="${esc(c.id)}">删除</button></span></div>`).join("")}</div><div id="char-editor" style="margin-top:14px"></div>`);
    const editor = $("#char-editor");
    const open = (c = { id: "char-" + Date.now(), name: "新角色", prompt: "" }) => {
      editor.innerHTML = `<label class="muted">角色名称</label><input id="char-name" class="field" value="${esc(c.name)}"><label class="muted">人设提示词</label><textarea id="char-prompt" class="field" style="min-height:120px">${esc(c.prompt)}</textarea><button class="primary" id="char-save">保存角色</button>`;
      $("#char-save").onclick = () => { const list = getState().characters || []; const item = { ...c, name: $("#char-name").value.trim() || "未命名角色", prompt: $("#char-prompt").value }; patchState({ characters: [...list.filter(x => x.id !== c.id), item] }); renderApp("characters"); };
    };
    $("#add-char").onclick = () => open();
    content.querySelectorAll("[data-edit-char]").forEach(b => b.onclick = () => open(chars.find(c => c.id === b.dataset.editChar)));
    content.querySelectorAll("[data-delete-char]").forEach(b => b.onclick = () => { if (confirm("删除这个角色？聊天记录会保留在本机数据中。")) { patchState({ characters: getState().characters.filter(c => c.id !== b.dataset.deleteChar) }); renderApp("characters"); } });
    $("#import-char").onclick = () => $("#char-file").click();
    $("#char-file").onchange = async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        let data;
        if (file.name.toLowerCase().endsWith(".json")) data = JSON.parse(await file.text());
        else data = await readPngCharacter(file);
        const d = data.data || data;
        const name = d.name || d.char_name || file.name.replace(/\.[^.]+$/, "");
        const desc = d.description || d.personality || "";
        const scenario = d.scenario || "";
        const mes = d.mes_example || "";
        const prompt = [desc, scenario, mes].filter(Boolean).join("\\n\\n");
        const item = { id: "import-" + Date.now(), name, prompt, source: "character-card" };
        patchState({ characters: [...(getState().characters || []), item] });
        renderApp("characters");
      } catch (err) { alert("导入失败：" + err.message); }
    };

  } else if (id === "worldbook") {
    const entries = state.worldbook || [];
    content.innerHTML = panel(`<h3>世界书</h3><p class="muted">保存世界观条目。关键词会自动注入聊天上下文。</p><div id="world-list">${entries.map((e, i) => `<div class="row"><span>${esc(e.title)}</span><button class="primary" data-world-edit="${i}">编辑</button></div>`).join("")}</div><button class="primary" id="world-add">＋ 添加条目</button><div id="world-editor" style="margin-top:14px"></div>`);
    const editor = $("#world-editor");
    const open = (e = { title: "新条目", keywords: "", content: "" }) => {
      editor.innerHTML = `<label class="muted">标题</label><input id="world-title" class="field" value="${esc(e.title)}"><label class="muted">关键词（逗号分隔）</label><input id="world-keys" class="field" value="${esc(e.keywords)}"><label class="muted">内容</label><textarea id="world-content" class="field" style="min-height:130px">${esc(e.content)}</textarea><button class="primary" id="world-save">保存条目</button>`;
      $("#world-save").onclick = () => { const list = getState().worldbook || []; const item = { title: $("#world-title").value, keywords: $("#world-keys").value, content: $("#world-content").value }; patchState({ worldbook: [...list.filter(x => x.title !== e.title), item] }); renderApp("worldbook"); };
    };
    $("#world-add").onclick = () => open();
    content.querySelectorAll("[data-world-edit]").forEach(b => b.onclick = () => open(entries[+b.dataset.worldEdit]));

  } else if (id === "store") {
    const installed = state.installedApps || [];
    content.innerHTML =
      panel(`<h3>已安装应用</h3><p class="muted">内置应用不可卸载，扩展应用可在此管理。</p>
        ${allBuiltinApps.map(a => `<div class="row"><span>${esc(a.icon)}　${esc(a.name)}</span><span class="muted">内置</span></div>`).join("")}
        ${installed.map(a => `<div class="row"><span>${esc(a.icon)}　${esc(a.name)}</span><span><button class="primary" data-uninstall="${esc(a.id)}">卸载</button></span></div>`).join("")}`)
      + panel(`<h3>扩展市场</h3><p class="muted">安装更多扩展应用到你的手机。</p>
        ${availableExtensions.map(ext => {
          const isInstalled = installed.find(a => a.id === ext.id);
          return `<div class="row">
            <span>${esc(ext.icon)}　${esc(ext.name)}<br><small class="muted">${esc(ext.description)}</small></span>
            <span>${isInstalled ? '<span class="muted">已安装</span>' : `<button class="primary" data-install="${esc(ext.id)}">安装</button>`}</span>
          </div>`;
        }).join("")}`);

    content.querySelectorAll("[data-install]").forEach(b => b.onclick = () => {
      try {
        installExtension(b.dataset.install);
        renderApp("store");
        window.dispatchEvent(new CustomEvent("apps-changed"));
      } catch (err) { alert(err.message); }
    });
    content.querySelectorAll("[data-uninstall]").forEach(b => b.onclick = () => {
      if (confirm("确定卸载这个扩展？")) {
        uninstallExtension(b.dataset.uninstall);
        renderApp("store");
        window.dispatchEvent(new CustomEvent("apps-changed"));
      }
    });

  } else if (id === "browser") {
    content.innerHTML = panel(`<h3>浏览器</h3><input id="web-url" class="field" placeholder="输入网址，例如 https://example.com"><button class="primary" id="web-go">打开网页</button><p class="muted">网页将在新标签页打开。</p>`);
    $("#web-go").onclick = () => { let u = $("#web-url").value.trim(); if (u) { if (!/^https?:\/\//i.test(u)) u = "https://" + u; window.open(u, "_blank", "noopener"); } };

  } else if (id === "clock") {
    content.innerHTML = panel(`<h3>时钟</h3><div id="big-clock" style="font-size:48px;font-weight:250;text-align:center;padding:25px 0"></div><p class="muted" style="text-align:center">设备本地时间</p>`);
    const tick = () => { const el = $("#big-clock"); if (el) el.textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
    tick();
    window.__clockInterval = setInterval(tick, 1000);

  } else {
    const app = getAllApps().find(a => a.id === id);
    content.innerHTML = panel(`<h3>${esc(app?.name || "应用")}</h3><p class="muted">${esc(app?.description || "这是一个扩展应用，功能将在后续版本完善。")}</p>`);
  }
}

async function readPngCharacter(file) {
  const buf = await file.arrayBuffer(), v = new DataView(buf);
  if (v.getUint32(0) !== 0x89504e47) throw new Error("不是有效 PNG 文件");
  const bytes = new Uint8Array(buf);
  let off = 8;
  while (off + 12 <= bytes.length) {
    const len = v.getUint32(off);
    const type = String.fromCharCode(...bytes.slice(off + 4, off + 8));
    const begin = off + 8, end = begin + len;
    if (end > bytes.length) break;
    if (type === "tEXt" || type === "iTXt") {
      const chunk = bytes.slice(begin, end);
      let text = new TextDecoder().decode(chunk);
      let idx = text.indexOf("\\0");
      if (idx >= 0) {
        let key = text.slice(0, idx), val = text.slice(idx + 1);
        if (type === "iTXt") { const parts = val.split("\\0"); val = parts.slice(4).join("\\0"); }
        if (key === "chara") {
          const raw = atob(val.replace(/-/g, "+").replace(/_/g, "/"));
          const decoded = decodeURIComponent(Array.from(raw, c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
          return JSON.parse(decoded);
        }
      }
    }
    off = end + 4;
    if (type === "IEND") break;
  }
  throw new Error("PNG 中没有找到 chara 角色卡元数据");
}

export function applyWallpaper() {
  const s = getState();
  if (s.customWallpaper) {
    document.documentElement.style.setProperty("--wallpaper", `url(${s.customWallpaper}) center/cover`);
  } else {
    const wallpapers = [
      "linear-gradient(145deg,#a5b4fc,#fbcfe8 55%,#fed7aa)",
      "linear-gradient(145deg,#99f6e4,#bfdbfe 55%,#ddd6fe)",
      "linear-gradient(145deg,#1e293b,#475569 55%,#7c3aed)",
      "linear-gradient(145deg,#fecaca,#fda4af 55%,#fef3c7)"
    ];
    document.documentElement.style.setProperty("--wallpaper", wallpapers[s.wallpaper || 0]);
  }
}

export function applyTheme() {
  const s = getState();
  const theme = themes[s.theme || "default"] || themes.default;
  document.documentElement.style.setProperty("--accent", theme.accent);
}
