export type BannerPosition = 'top' | 'bottom';
export type BannerColor = 'green' | 'blue' | 'red' | 'yellow';

const colorMap: Record<BannerColor, string> = {
  green: '#4caf50',
  blue: '#2196f3',
  red: '#f44336',
  yellow: '#ff9800'
};

export function showBanner(
  message: string,
  options: {
    id?: string;
    position?: BannerPosition;
    color?: BannerColor;
    duration?: number;
  } = {}
) {
  const {
    id = 'banner',
    position = 'top',
    color = 'green',
    duration = 2000
  } = options;

  // Remove existing banner with same id if any
  const existingBanner = document.getElementById(id);
  if (existingBanner) {
    existingBanner.remove();
  }

  // Create banner
  const banner = document.createElement('div');
  banner.id = id;
  banner.textContent = message;
  
  const positionStyle = position === 'top' ? 'top: 20px;' : 'bottom: 20px;';
  
  banner.style.cssText = `
    position: fixed;
    ${positionStyle}
    left: 50%;
    transform: translateX(-50%);
    background: ${colorMap[color]};
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    font-weight: bold;
    z-index: 2000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  
  document.body.appendChild(banner);

  // Remove after duration
  setTimeout(() => {
    banner.remove();
  }, duration);
}
