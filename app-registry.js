import { getState, patchState } from "./storage.js";

// 内置应用（不可卸载）
const builtinApps = [
  {id:"chat",name:"AI 聊天",icon:"✦",color:"linear-gradient(145deg,#8b5cf6,#4f46e5)",description:"连接模型，与你的角色聊天",builtin:true},
  {id:"characters",name:"角色",icon:"👤",color:"linear-gradient(145deg,#fb7185,#e11d48)",description:"管理 AI 角色资料",builtin:true},
  {id:"worldbook",name:"世界书",icon:"📚",color:"linear-gradient(145deg,#f59e0b,#d97706)",description:"管理世界观与设定",builtin:true},
  {id:"notes",name:"备忘录",icon:"📝",color:"linear-gradient(145deg,#facc15,#eab308)",description:"记录灵感和内容",builtin:true},
  {id:"gallery",name:"照片",icon:"🌄",color:"linear-gradient(145deg,#38bdf8,#2563eb)",description:"图片空间（后续完善）",builtin:true},
  {id:"browser",name:"浏览器",icon:"🌐",color:"linear-gradient(145deg,#34d399,#059669)",description:"打开网页",builtin:true},
  {id:"store",name:"应用中心",icon:"▦",color:"linear-gradient(145deg,#64748b,#334155)",description:"管理手机应用",builtin:true},
  {id:"settings",name:"设置",icon:"⚙",color:"linear-gradient(145deg,#94a3b8,#475569)",description:"系统与外观设置",builtin:true},
  {id:"phone",name:"电话",icon:"☎",color:"linear-gradient(145deg,#4ade80,#16a34a)",description:"电话应用示意",builtin:true},
  {id:"clock",name:"时钟",icon:"◷",color:"linear-gradient(145deg,#60a5fa,#4f46e5)",description:"时间与计时工具",builtin:true}
];

// 内置应用列表（应用中心展示用）
export const allBuiltinApps = builtinApps;

// 可安装的扩展应用市场清单
export const availableExtensions = [
  {id:"ext-calc",name:"计算器",icon:"🧮",color:"linear-gradient(145deg,#475569,#1e293b)",description:"基础四则运算计算器"},
  {id:"ext-todo",name:"待办清单",icon:"☑",color:"linear-gradient(145deg,#34d399,#059669)",description:"管理日常待办事项"},
  {id:"ext-music",name:"音乐",icon:"🎵",color:"linear-gradient(145deg,#f472b6,#db2777)",description:"本地音乐播放器示意"},
  {id:"ext-camera",name:"相机",icon:"📷",color:"linear-gradient(145deg,#a78bfa,#7c3aed)",description:"拍照与录像示意"},
  {id:"ext-calendar",name:"日历",icon:"📅",color:"linear-gradient(145deg,#f87171,#dc2626)",description:"查看日期与日程"},
  {id:"ext-file",name:"文件管理",icon:"📁",color:"linear-gradient(145deg,#fbbf24,#d97706)",description:"管理本机文件"}
];

// 注册表：内置 + 已安装扩展
export const registry = new Map();

export function refreshRegistry(){
  registry.clear();
  builtinApps.forEach(a => registry.set(a.id, a));
  const installed = getState().installedApps || [];
  installed.forEach(a => registry.set(a.id, {...a, extension:true}));
}

// 初始化
refreshRegistry();

// 所有已注册应用（内置 + 扩展）
export function getAllApps(){
  return [...registry.values()];
}

// 默认 Dock
export const defaultDockIds = ["phone","chat","browser","settings"];

// 获取当前 Dock（可配置）
export function getDockIds(){
  const saved = getState().order?.dock;
  if(Array.isArray(saved) && saved.length) return saved.filter(id => registry.has(id));
  return defaultDockIds.filter(id => registry.has(id));
}

// 设置 Dock
export function setDockIds(ids){
  const order = getState().order || {};
  patchState({order: {...order, dock: ids}});
}

// 安装扩展
export function installExtension(extId){
  const ext = availableExtensions.find(e => e.id === extId);
  if(!ext) throw new Error("未找到该扩展");
  const installed = getState().installedApps || [];
  if(installed.find(a => a.id === extId)) throw new Error("已安装");
  patchState({installedApps: [...installed, {...ext, installedAt: Date.now()}]});
  refreshRegistry();
  return ext;
}

// 卸载扩展
export function uninstallExtension(extId){
  patchState({installedApps: (getState().installedApps||[]).filter(a => a.id !== extId)});
  refreshRegistry();
}

// 是否是内置应用
export function isBuiltin(appId){
  return builtinApps.some(a => a.id === appId);
}
