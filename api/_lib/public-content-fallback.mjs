import { readFileSync } from 'node:fs'

const csvPath=new URL('../_data/public-content-fallback.csv',import.meta.url)
let snapshot

function parseSingleCellCsv(raw){
  const newline=raw.indexOf('\n')
  if(newline<0)return '{}'
  let value=raw.slice(newline+1).trim()
  if(value.startsWith('"')&&value.endsWith('"'))value=value.slice(1,-1).replace(/""/g,'"')
  return value
}

export function publicContentFallback(){
  if(snapshot)return snapshot
  try{snapshot=JSON.parse(parseSingleCellCsv(readFileSync(csvPath,'utf8')))}catch{snapshot={articles:[],videos:[]}}
  return snapshot
}

export const fallbackArticles=()=>publicContentFallback().articles||[]
export const fallbackVideos=()=>publicContentFallback().videos||[]
