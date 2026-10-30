import { registry, refreshRegistry, getDockIds, setDockIds, getAllApps, installExtension, uninstallExtension, isBuiltin, availableExtensions } from "./app-registry.js";
import { launchApp, closeApp, subscribe, currentApp } from "./app-lifecycle.js";
import { getState, patchState, exportLayout, importLayout } from "./storage.js";
import { renderApp, applyWallpaper, applyTheme } from "./render.js";
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const toast = (s) => {
  const t = $("#toast");
  t.textContent = s;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
};
// ============ 桌面状态 ============
let editMode = false;
let drag = null;
let longTimer = null;
let edgeTimer = null;
let folderOverlay = null;
const HOME_PER_PAGE = 8; // 每页桌面图标数
// 获取桌面顺序（含文件夹对象）
function getHomeOrder() {
  const saved = getState().order?.home;
  if (Array.isArray(saved) && saved.length) return saved;
// 默认：所有非 Dock 内置应用
  const dock = getDockIds();
  return getAllApps().filter(a => !dock.includes(a.id)).map(a => a.id);
}
function saveHomeOrder(order) {
  patchState({ order: { ...getState().order, home: order } });
}
// 扁平化：展开文件夹，获取所有应用ID（含文件夹内的）
function flattenApps(order) {
  const ids = [];
  order.forEach(item => {
    if (typeof item === "string") ids.push(item);
    else if (item.type === "folder") ids.push(...item.apps);
  });
  return ids;
}
// 在 order 中查找某个应用ID所在的路径（顶层位置 或 文件夹内位置）
function findAppPosition(order, appId) {
  for (let i = 0; i < order.length; i++) {
    const item = order[i];
    if (typeof item === "string") {
      if (item === appId) return { level: "top", index: i, folderIndex: -1 };
    } else if (item.type === "folder") {
      const fi = item.apps.indexOf(appId);
      if (fi >= 0) return { level: "folder", index: i, folderIndex: fi, folder: item };
    }
  }
  return null;
}
// ============ 渲染 ============
function iconHTML(item, context) {
  // context: "home" | "dock" | "folder"
if (typeof item === "string") {
    const app = registry.get(item);
    if (!app) return "";
    return `<button class="app-icon" data-app="${app.id}" data-context="${context}" aria-label="${app.name}">
      <span class="glyph" style="background:${app.color}">${app.icon}</span>
      <span>${app.name}</span>
      ${editMode && !isBuiltin(app.id) ? '<span class="uninstall-x">×</span>' : ""}
    </button>`;
  }
  if (item.type === "folder") {
    const icons = item.apps.slice(0, 4).map(id => {
      const a = registry.get(id);
      return a ? `<span class="folder-thumb" style="background:${a.color}">${a.icon}</span>` : "";
    }).join("");
    return `<button class="app-icon folder-icon" data-folder="${item.name}" data-context="${context}" aria-label="${item.name}">
      <span class="glyph folder-glyph">${icons || "📁"}</span>
      <span>${item.name}</span>
    </button>`;
  }
  return "";
}
function renderDesktop() {
  const order = getHomeOrder();
  const dock = getDockIds();
  const page0 = order.slice(0, HOME_PER_PAGE);
const page1 = order.slice(HOME_PER_PAGE);
  $("#app-grid-0").innerHTML = page0.map(item => iconHTML(item, "home")).join("");
  $("#app-grid-1").innerHTML = page1.map(item => iconHTML(item, "home")).join("");
  $("#dock").innerHTML = dock.map(id => {
    const app = registry.get(id);
    return app ? `<button class="app-icon" data-app="${id}" data-context="dock" aria-label="${app.name}">
      <span class="glyph" style="background:${app.color}">${app.icon}</span>
    </button>` : "";
  }).join("");
  document.body.classList.toggle("edit-mode", editMode);
  bindIcons();
  bindDrag();
}
function bindIcons() {
  $$("[data-app]").forEach(b => {
    b.onclick = (e) => {
      if (editMode) {
        // 编辑模式下点击卸载按钮
        if (e.target.classList.contains("uninstall-x")) {
          const appId = b.dataset.app;
          if (!isBuiltin(appId)) {
            if (confirm(`卸载 ${registry.get(appId)?.name}？`)) {
              uninstallExtension(appId);
              // 从桌面和 Dock 移除
              const order = getHomeOrder();
const newOrder = order.filter(item => {
                if (typeof item === "string") return item !== appId;
                if (item.type === "folder") return item.apps = item.apps.filter(x => x !== appId), item.apps.length > 0;
                return true;
              });
              saveHomeOrder(newOrder);
              setDockIds(getDockIds().filter(id => id !== appId));
              refreshRegistry();
              renderDesktop();
              toast("已卸载");
            }
          }
          return;
        }
        return;
      }
      launchApp(b.dataset.app);
    };
  });
  $$("[data-folder]").forEach(b => {
    b.onclick = () => {
      if (editMode) return;
      openFolder(b.dataset.folder);
    };
  });
}
// ============ 文件夹视图 ============
function openFolder(folderName) {
  const order = getHomeOrder();
  const folder = order.find(item => item.type === "folder" && item.name === folderName);
  if (!folder) return;
  closeFolder();
  folderOverlay = document.createElement("div");
folderOverlay.className = "folder-overlay";
  folderOverlay.innerHTML = `
    <div class="folder-modal">
      <div class="folder-title">${folderName}</div>
      <div class="folder-grid">
        ${folder.apps.map(id => {
          const app = registry.get(id);
          if (!app) return "";
          return `<button class="app-icon" data-app="${id}" data-context="folder" aria-label="${app.name}">
            <span class="glyph" style="background:${app.color}">${app.icon}</span>
            <span>${app.name}</span>
          </button>`;
        }).join("")}
      </div>
      <div class="folder-hint">点击空白处关闭</div>
    </div>
  `;
  folderOverlay.addEventListener("click", (e) => {
    if (e.target === folderOverlay) closeFolder();
  });
  document.body.appendChild(folderOverlay);
  // 绑定文件夹内图标
  folderOverlay.querySelectorAll("[data-app]").forEach(b => {
    b.onclick = () => launchApp(b.dataset.app);
  });
}
function closeFolder() {
  if (folderOverlay) {
    folderOverlay.remove();
folderOverlay = null;
  }
}
// ============ 拖拽系统 ============
function bindDrag() {
  const draggables = $$("#app-grid-0 [data-app], #app-grid-0 [data-folder], #app-grid-1 [data-app], #app-grid-1 [data-folder], #dock [data-app]");
  draggables.forEach(el => {
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      longTimer = setTimeout(() => startDrag(el, e), 420);
    });
    el.addEventListener("pointermove", (e) => {
      if (drag && drag.source === el) {
        moveGhost(e.clientX, e.clientY);
        checkEdgeScroll(e.clientX);
      }
    });
    const finish = () => {
      clearTimeout(longTimer);
      if (drag && drag.source === el) endDrag();
    };
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
  });
}
function startDrag(el, e) {
  editMode = true;
  const isDock = el.dataset.context === "dock";
  const isFolder = el.hasAttribute("data-folder");
  drag = {
    source: el,
appId: el.dataset.app || null,
    folderName: el.dataset.folder || null,
    fromDock: isDock,
    isFolder: isFolder,
    ghost: null
  };
  // 创建幽灵图标
  const ghost = el.cloneNode(true);
  ghost.classList.add("drag-ghost");
  ghost.style.pointerEvents = "none";
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  el.classList.add("dragging-source");
  moveGhost(e.clientX, e.clientY);
  renderDesktop();
  toast("拖动图标到目标位置");
}
function moveGhost(x, y) {
  if (!drag?.ghost) return;
  drag.ghost.style.left = x + "px";
  drag.ghost.style.top = y + "px";
}
function checkEdgeScroll(x) {
  const w = window.innerWidth;
  clearTimeout(edgeTimer);
  if (x < 40 && page > 0) {
    edgeTimer = setTimeout(() => setPage(page - 1), 400);
  } else if (x > w - 40 && page < 1) {
    edgeTimer = setTimeout(() => setPage(page + 1), 400);
  }
}
function endDrag() {
  if (!drag) return;
  const { appId, folderName, fromDock, isFolder } = drag;
  // 查找松手位置的目标
  const elBelow = document.elementFromPoint(ghostX, ghostY);
const targetApp = elBelow?.closest("[data-app]");
  const targetFolder = elBelow?.closest("[data-folder]");
  const targetDock = elBelow?.closest("#dock");
  const order = getHomeOrder();
  const dock = getDockIds();
  if (targetDock && !fromDock && !isFolder) {
    // 拖入 Dock
    if (!dock.includes(appId)) {
      setDockIds([...dock, appId]);
      // 从桌面移除
      saveHomeOrder(order.filter(item => {
        if (typeof item === "string") return item !== appId;
        if (item.type === "folder") {
          item.apps = item.apps.filter(x => x !== appId);
          return item.apps.length > 0;
        }
        return true;
      }));
      toast("已加入 Dock");
    }
  } else if (fromDock && !targetDock) {
    // 从 Dock 拖出到桌面
    setDockIds(dock.filter(id => id !== appId));
    saveHomeOrder([...order, appId]);
    toast("已移出 Dock");
  } else if (targetApp && targetApp.dataset.app !== appId && !isFolder) {
    // 拖到另一个图标上 → 合并文件夹
    const targetId = targetApp.dataset.app;
    const targetContext = targetApp.dataset.context;
if (targetContext === "folder") {
      // 加入现有文件夹
      const newOrder = order.map(item => {
        if (item.type === "folder" && item.apps.includes(targetId)) {
          return { ...item, apps: [...item.apps, appId] };
        }
        return item;
      });
      // 从原位置移除
      saveHomeOrder(removeAppFromOrder(newOrder, appId));
      toast("已加入文件夹");
    } else {
      // 创建新文件夹
      const newFolder = { type: "folder", name: "新建文件夹", apps: [targetId, appId] };
      let newOrder = removeAppFromOrder(order, targetId);
      newOrder = removeAppFromOrder(newOrder, appId);
      // 找到 targetId 的位置，替换为文件夹
      const targetIdx = order.findIndex(item => typeof item === "string" && item === targetId);
      newOrder.splice(Math.max(0, targetIdx), 0, newFolder);
      saveHomeOrder(newOrder);
      toast("已创建文件夹");
    }
  } else if (targetFolder && !isFolder) {
    // 拖到文件夹上 → 加入文件夹
    const fn = targetFolder.dataset.folder;
    const newOrder = order.map(item => {
      if (item.type === "folder" && item.name === fn) {
return { ...item, apps: [...item.apps, appId] };
      }
      return item;
    });
    saveHomeOrder(removeAppFromOrder(newOrder, appId));
    toast("已加入文件夹");
  } else {
    // 普通位置交换或移动
    // 简化：如果拖到了另一个图标附近，交换位置
    if (targetApp && targetApp.dataset.app !== appId) {
      // 已在上面处理
    }
  }
  // 清理
  if (drag.ghost) drag.ghost.remove();
  drag = null;
  clearTimeout(edgeTimer);
  editMode = false;
  renderDesktop();
}
let ghostX = 0, ghostY = 0;
document.addEventListener("pointermove", (e) => {
  ghostX = e.clientX;
  ghostY = e.clientY;
}, { passive: true });
function removeAppFromOrder(order, appId) {
  const result = [];
  for (const item of order) {
    if (typeof item === "string") {
      if (item !== appId) result.push(item);
    } else if (item.type === "folder") {
      const apps = item.apps.filter(x => x !== appId);
      if (apps.length > 0) result.push({ ...item, apps });
    }
  }
  return result;
}
// ============ 页面切换 ============
renderDesktop();
subscribe(e => {
if (e.type === "launch") {
    const app = registry.get(e.id);
    $("#app-title").textContent = app?.name || "应用";
    $("#home").classList.add("hidden");
    $("#app-view").classList.remove("hidden");
    closeFolder();
    renderApp(e.id);
  } else {
    $("#app-view").classList.add("hidden");
    $("#home").classList.remove("hidden");
  }
});
$("#back-home").onclick = closeApp;
$("#home-indicator").onclick = () => { if (currentApp()) closeApp(); };
let page = getState().page || 0;
function setPage(n) {
  page = Math.max(0, Math.min(1, n));
  $("#pages").scrollTo({ left: page * $("#pages").clientWidth, behavior: "smooth" });
  $$("#page-indicator i").forEach((x, i) => x.classList.toggle("active", i === page));
  patchState({ page });
}
$("#pages").scrollLeft = page * $("#pages").clientWidth;
let startX = 0;
$("#pages").addEventListener("touchstart", e => startX = e.touches[0].clientX, { passive: true });
$("#pages").addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - startX;
if (Math.abs(dx) > 45 && !drag) setPage(page + (dx < 0 ? 1 : -1));
}, { passive: true });
$("#page-indicator").onclick = () => setPage(page ? 0 : 1);
// ============ 时钟 / 锁屏 ============
function clock() {
  const d = new Date();
  $("#status-time").textContent = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  $("#lock-clock").textContent = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  $("#lock-date").textContent = d.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
}
clock();
setInterval(clock, 15000);
function unlock() {
  $("#lockscreen").classList.add("hidden");
  $("#system").classList.remove("hidden");
}
$("#unlock-btn").onclick = unlock;
$("#lockscreen").addEventListener("touchstart", e => window.__lockY = e.touches[0].clientY, { passive: true });
$("#lockscreen").addEventListener("touchend", e => {
  if (window.__lockY - e.changedTouches[0].clientY > 35) unlock();
}, { passive: true });
// ============ 搜索 / 菜单 ============
$("#search-btn").onclick = () => {
  const q = prompt("搜索应用名称");
  if (!q) return;
  const a = getAllApps().find(x => x.name.includes(q) || x.id.includes(q));
  if (a) launchApp(a.id);
  else toast("没有找到应用");
};
$("#app-menu").onclick = () => {
  const action = prompt("LittlePhone 0.7.0\n输入 1 导出布局，2 导入布局");
  if (action === "1") {
    const data = exportLayout();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "littlephone-layout.json";
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (action === "2") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async e => {
      try {
        const obj = JSON.parse(await e.target.files[0].text());
        importLayout(obj);
        refreshRegistry();
        renderDesktop();
        applyWallpaper();
        toast("布局已导入");
      } catch (err) {
        alert("导入失败：" + err.message);
      }
    };
    input.click();
  }
};
applyWallpaper();
applyTheme();
// 应用安装/卸载后重新渲染桌面
window.addEventListener("apps-changed", () => {
  refreshRegistry();
  renderDesktop();
});
// 布局导入后重新渲染桌面
window.addEventListener("layout-imported", () => {
  refreshRegistry();
  renderDesktop();
});
