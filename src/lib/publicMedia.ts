const MAX_PUBLIC_IMAGE_WIDTH = 1600
const MAX_PUBLIC_IMAGE_HEIGHT = 1600
const PUBLIC_IMAGE_QUALITY = 0.82

export async function optimizePublicImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_PUBLIC_IMAGE_WIDTH / bitmap.width, MAX_PUBLIC_IMAGE_HEIGHT / bitmap.height)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', PUBLIC_IMAGE_QUALITY))
    if (!blob || blob.size >= file.size) return file
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagem'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}
