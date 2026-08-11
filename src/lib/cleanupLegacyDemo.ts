export function clearLegacyDemoData() {
  if (typeof window==='undefined') return
  for (let index=localStorage.length-1;index>=0;index--) {
    const key=localStorage.key(index)
    if (key&&(key.startsWith('rede-maternar:')||key.startsWith('rm:v08:'))) localStorage.removeItem(key)
  }
}
