export type DetectedRegion = {
  id: string
  kind: 'map' | 'speed' | 'mirror' | 'unknown'
  polygon: Array<{ x: number; y: number }>
  bbox: { x: number; y: number; w: number; h: number }
  area: number
}

function polygonArea(poly: Array<{ x: number; y: number }>) {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    area += poly[i].x * poly[j].y
    area -= poly[j].x * poly[i].y
  }
  return Math.abs(area) / 2
}

function bboxFromPoly(poly: Array<{ x: number; y: number }>) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of poly) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function convexHull(points: Array<{ x: number; y: number }>) {
  if (points.length <= 1) return points.slice()
  const pts = points.slice().sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))
  const lower: Array<{ x: number; y: number }> = []
  for (let i = 0; i < pts.length; i++) {
    while (lower.length >= 2) {
      const len = lower.length
      const a = lower[len - 2],
        b = lower[len - 1],
        c = pts[i]
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
      if (cross <= 0) lower.pop()
      else break
    }
    lower.push(pts[i])
  }
  const upper: Array<{ x: number; y: number }> = []
  for (let i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2) {
      const len = upper.length
      const a = upper[len - 2],
        b = upper[len - 1],
        c = pts[i]
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
      if (cross <= 0) upper.pop()
      else break
    }
    upper.push(pts[i])
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}

export async function detectFromVideo(video: HTMLVideoElement, _sampleCount = 6): Promise<DetectedRegion[]> {
  const w = 320,
    h = 180
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  
  const prevTime = video.currentTime
  if (video.duration && video.duration > 0) {
    video.currentTime = Math.min(video.duration * 0.5, video.duration - 0.1)
    await new Promise((r) => setTimeout(r, 80))
  }
  
  ctx.drawImage(video, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  
  const mask = new Uint8Array(w * h)
  const darkThreshold = 14
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2]
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const idx = i / 4
    if (lum > darkThreshold) {
      mask[idx] = 1
    }
  }
  
  const visited = new Uint8Array(w * h)
  const blobs: Array<Array<number>> = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (mask[idx] && !visited[idx]) {
        const stack = [idx]
        visited[idx] = 1
        const blob: Array<number> = []
        while (stack.length) {
          const cur = stack.pop()!
          blob.push(cur)
          const cx = cur % w,
            cy = Math.floor(cur / w)
          const neighbors = [
            (cy - 1) * w + cx,
            (cy + 1) * w + cx,
            cy * w + (cx - 1),
            cy * w + (cx + 1)
          ]
          for (let n = 0; n < neighbors.length; n++) {
            const nidx = neighbors[n]
            if (nidx < 0 || nidx >= w * h) continue
            const nx = nidx % w,
              ny = Math.floor(nidx / w)
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
            if (mask[nidx] && !visited[nidx]) {
              visited[nidx] = 1
              stack.push(nidx)
            }
          }
        }
        if (blob.length > 400) {
          blobs.push(blob)
        }
      }
    }
  }
  
  video.currentTime = prevTime
  
  blobs.sort((a, b) => b.length - a.length)
  
  const regions: DetectedRegion[] = []
  for (let b = 0; b < Math.min(3, blobs.length); b++) {
    const blob = blobs[b]
    const points: Array<{ x: number; y: number }> = []
    for (let i = 0; i < blob.length; i++) {
      const idx = blob[i]
      const x = idx % w,
        y = Math.floor(idx / w)
      points.push({ x, y })
    }
    const hull = convexHull(points)
    const poly = hull.length >= 3 ? hull : points.slice(0, 3)
    const bbox = bboxFromPoly(poly)
    if (bbox.w < 8 || bbox.h < 8) continue
    const area = polygonArea(poly)
    
    let kind: DetectedRegion['kind'] = 'unknown'
    const cx = bbox.x + bbox.w / 2
    const cy = bbox.y + bbox.h / 2
    if (cy > h * 0.52 && cx < w * 0.38) kind = 'map'
    else if (cy > h * 0.5 && cx > w * 0.6) kind = 'speed'
    else if (cy < h * 0.45 && cx > w * 0.25 && cx < w * 0.75) kind = 'mirror'
    
    regions.push({
      id: `${kind}-${b}`,
      kind,
      polygon: poly,
      bbox,
      area
    })
  }
  
  regions.sort((a, b) => {
    const order = { map: 0, speed: 1, mirror: 2, unknown: 3 }
    return order[a.kind] - order[b.kind]
  })
  
  return regions
}
