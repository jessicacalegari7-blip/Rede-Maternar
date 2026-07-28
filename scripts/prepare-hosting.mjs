import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

const dist = resolve('dist')
const server = resolve(dist, 'server')
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

async function filesAt(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (path === server) continue
    if (entry.isDirectory()) result.push(...await filesAt(path))
    else result.push(path)
  }
  return result
}

const assets = {}
for (const path of await filesAt(dist)) {
  const route = `/${relative(dist, path).replaceAll('\\', '/')}`
  assets[route] = {
    body: (await readFile(path)).toString('base64'),
    type: mime[extname(path)] ?? 'application/octet-stream',
  }
}
assets['/'] = assets['/index.html']

const worker = `
const files=${JSON.stringify(assets)};
function decode(value){
  const raw=atob(value);const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}
export default {async fetch(request){
  if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Method not allowed",{status:405});
  const path=new URL(request.url).pathname;
  const asset=files[path]??(path.includes(".")?null:files["/"]);
  if(!asset)return new Response("Not found",{status:404});
  return new Response(request.method==="HEAD"?null:decode(asset.body),{headers:{"content-type":asset.type,"cache-control":path.startsWith("/assets/")?"public, max-age=31536000, immutable":"no-cache"}});
}};
`
await mkdir(server, { recursive: true })
await writeFile(resolve(server, 'index.js'), worker)
