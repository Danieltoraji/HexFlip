// ============================================================
// HexFlip — 截图工具
// 使用 html2canvas 截取 Canvas 棋盘区域
// ============================================================

import html2canvas from 'html2canvas';

/**
 * 截取指定 DOM 元素并下载为 PNG 图片
 * @param element - 要截图的 DOM 元素
 * @param filename - 下载文件名（不含扩展名）
 */
export async function captureScreenshot(
  element: HTMLElement,
  filename: string = 'hexflip_screenshot',
): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#f0f4f8',
      scale: 2, // 2x 高清
      useCORS: true,
      logging: false,
    });

    // 转为 PNG 并下载
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('截图失败:', error);
    alert('截图失败，请重试');
  }
}
