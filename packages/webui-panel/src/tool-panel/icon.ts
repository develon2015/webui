/**
 * 面板图标解析
 * 根据传入的图标字符串推断渲染方式：内联 SVG / 图片地址 / 纯文本(如 emoji)
 * ToolPanel 标题栏与 ToolPanelManager 任务栏共用此逻辑，保证两处显示一致
 */
export type PanelIconType = 'svg' | 'img' | 'text'

/** 判断图标字符串的渲染类型 */
export function resolvePanelIconType(icon: string): PanelIconType {
    const value = icon.trim()
    if (!value) return 'text'
    // 内联 SVG 字符串
    if (/<svg[\s>]/i.test(value)) return 'svg'
    // 图片地址：网络 / data / blob
    if (/^(https?:\/\/|data:image|blob:)/i.test(value)) return 'img'
    // 绝对或相对路径
    if (/^(\/|\.{1,2}\/)/.test(value)) return 'img'
    // 常见图片扩展名
    if (/\.(svg|png|jpe?g|gif|webp|ico|avif|bmp)(\?.*)?$/i.test(value)) return 'img'
    return 'text'
}
