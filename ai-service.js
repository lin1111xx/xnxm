// OpenAI-compatible streaming Chat Completions adapter.
export async function sendMessage({baseUrl,apiKey,model,messages,signal,onDelta}){
 if(!baseUrl||!apiKey||!model) throw new Error("请先在「设置 → AI 模型」中填写 API 地址、密钥和模型名称。");
 let response;
 try{
  response=await fetch(baseUrl.replace(/\/+$/,"")+"/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},body:JSON.stringify({model,messages,stream:true}),signal});
 }catch(error){if(error.name==="AbortError")throw error;throw new Error("网络连接失败，请检查网络、API 地址及服务商跨域（CORS）设置。")}
 if(!response.ok){let detail="";try{const data=await response.json();detail=data.error?.message||data.message||""}catch{}throw new Error(`接口请求失败（HTTP ${response.status}）${detail?": "+detail:""}`)}
 if(!response.body?.getReader){const data=await response.json();const text=data.choices?.[0]?.message?.content||"";onDelta?.(text);return text}
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",result="";
 while(true){
  const {value,done}=await reader.read();if(done)break;
  buffer+=decoder.decode(value,{stream:true});
  const lines=buffer.split(/\r?\n/);buffer=lines.pop()||"";
  for(const line of lines){const t=line.trim();if(!t.startsWith("data:"))continue;const raw=t.slice(5).trim();if(raw==="[DONE]")continue;
   try{const data=JSON.parse(raw);const delta=data.choices?.[0]?.delta?.content;const chunk=typeof delta==="string"?delta:Array.isArray(delta)?delta.map(x=>x.text||"").join(""):"";if(chunk){result+=chunk;onDelta?.(chunk)}}catch{}
  }
 }
 if(buffer.startsWith("data:")){const raw=buffer.slice(5).trim();if(raw&&raw!=="[DONE]"){try{const d=JSON.parse(raw).choices?.[0]?.delta?.content;if(typeof d==="string"){result+=d;onDelta?.(d)}}catch{}}}
 if(!result)throw new Error("模型没有返回文本内容。");
 return result;
}
