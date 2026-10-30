const KEY = "littlephone.state.v1";
const defaults = {
  wallpaper: 0,
  customWallpaper: "",
  theme: "default",
  iconPack: "default",
  locked: true,
  notes: "",
  chats: [],
  page: 0,
  order: {},
  installedApps: [],
  characters: [{id:"default",name:"默认助手",prompt:"你是一个友好、自然的中文 AI 助手。"}],
  activeCharacterId:"default",
  chatsByCharacter:{},
  worldbook: [],
  presets: [],
  activePresetId:"default",
  contextLimit: 30,
  ai: {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    systemPrompt: "你是 LittlePhone 中友好、自然的 AI 助手。请用中文回答。"
  }
};

export function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    const merged = {...defaults, ...saved, ai: {...defaults.ai, ...(saved.ai||{})}};
    return merged;
  }catch{ return {...defaults}; }
}

let state = loadState();

export function getState(){ return state; }

export function patchState(patch){
  state = {...state, ...patch};
  try{ localStorage.setItem(KEY, JSON.stringify(state)); }
  catch(e){ console.warn("Storage unavailable", e); }
  return state;
}

// 桌面布局导出（不含 AI Key 和聊天记录）
export function exportLayout(){
  const s = getState();
  return {
    version: "0.7.0",
    type: "littlephone-layout",
    order: s.order,
    wallpaper: s.wallpaper,
    customWallpaper: s.customWallpaper,
    theme: s.theme,
    iconPack: s.iconPack,
    installedApps: s.installedApps || [],
    exportedAt: new Date().toISOString()
  };
}

// 桌面布局导入
export function importLayout(obj){
  if(!obj || obj.type !== "littlephone-layout") throw new Error("不是有效的 LittlePhone 布局文件");
  const patch = {};
  if(obj.order) patch.order = obj.order;
  if(typeof obj.wallpaper === "number") patch.wallpaper = obj.wallpaper;
  if(obj.customWallpaper !== undefined) patch.customWallpaper = obj.customWallpaper;
  if(obj.theme) patch.theme = obj.theme;
  if(obj.iconPack) patch.iconPack = obj.iconPack;
  if(Array.isArray(obj.installedApps)) patch.installedApps = obj.installedApps;
  patchState(patch);
  return patch;
}
