import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Download,
  Send,
  Plus,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Type,
  Smile,
  ShieldCheck,
  Check,
  Info,
  Layers,
  Crop,
  Sliders
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';
import { StickerItem } from '../../types/chat';

interface StickerCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStickerCreated?: (sticker: StickerItem) => void;
}

const POPULAR_EMOJIS = ['😂', '❤️', '🔥', '👍', '😎', '🎉', '🚀', '✨', '🤩', '🥺', '🐱', '🐶', '👏', '💯', '🤔', '💀'];

export const StickerCreatorModal: React.FC<StickerCreatorModalProps> = ({
  isOpen,
  onClose,
  onStickerCreated
}) => {
  const { theme } = useTheme();
  const { addCustomSticker, sendSticker, activeChat } = useChat();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [stickerName, setStickerName] = useState('My Sticker');
  const [selectedEmoji, setSelectedEmoji] = useState('✨');
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // Sticker Effects
  const [hasWhiteOutline, setHasWhiteOutline] = useState(true);
  const [outlineWidth, setOutlineWidth] = useState(8);
  const [hasShadow, setHasShadow] = useState(true);
  const [transparentBg, setTransparentBg] = useState(true);

  // Caption text on sticker
  const [stickerText, setStickerText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');

  // Preview & Export
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isGold = theme === 'black-gold';

  // Load default template if no image
  useEffect(() => {
    if (isOpen && !imageSrc) {
      // Create a nice default starter image (Alpha Telegram Cat/Dog vector)
      setImageSrc('https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=512&auto=format&fit=crop&q=80');
    }
  }, [isOpen, imageSrc]);

  // Render canvas according to exact Telegram 512x512 specification
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Telegram requires exact 512x512 square canvas
    canvas.width = 512;
    canvas.height = 512;

    // Clear canvas
    ctx.clearRect(0, 0, 512, 512);

    if (!transparentBg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 512, 512);
    }

    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      ctx.save();

      // Center transformations
      ctx.translate(256 + offsetX, 256 + offsetY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      // Fit dimensions
      const aspect = img.width / img.height;
      let drawW = 400;
      let drawH = 400;
      if (aspect > 1) {
        drawH = 400 / aspect;
      } else {
        drawW = 400 * aspect;
      }

      // 1. Draw Telegram White Outline if enabled
      if (hasWhiteOutline && outlineWidth > 0) {
        // Multi-directional offset to generate crisp white outline
        const dArr = [-1, 0, 1];
        const rad = outlineWidth;
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = hasShadow ? 16 : 0;
        ctx.shadowOffsetY = hasShadow ? 8 : 0;

        for (let i = -rad; i <= rad; i += 2) {
          for (let j = -rad; j <= rad; j += 2) {
            if (i * i + j * j <= rad * rad) {
              ctx.drawImage(img, -drawW / 2 + i, -drawH / 2 + j, drawW, drawH);
            }
          }
        }
        ctx.restore();
      }

      // 2. Draw Main Image
      if (hasShadow && !hasWhiteOutline) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 8;
      }
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // 3. Draw Text Caption if provided
      if (stickerText.trim()) {
        ctx.save();
        ctx.font = 'bold 36px "Impact", -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = textColor;
        ctx.strokeText(stickerText.toUpperCase(), 256, 480);
        ctx.fillText(stickerText.toUpperCase(), 256, 480);
        ctx.restore();
      }

      // 4. Draw Small Telegram Emoji Badge in top-right corner
      if (selectedEmoji) {
        ctx.save();
        ctx.font = '36px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(selectedEmoji, 490, 22);
        ctx.restore();
      }
    };
  }, [imageSrc, scale, rotation, offsetX, offsetY, hasWhiteOutline, outlineWidth, hasShadow, transparentBg, stickerText, textColor, selectedEmoji, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setStickerName(file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || 'Custom Sticker');
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => setImageSrc(reader.result as string);
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const generateStickerItem = (): StickerItem | null => {
    if (!canvasRef.current) return null;
    // Export as Telegram 512x512 standard WebP/PNG
    const dataUrl = canvasRef.current.toDataURL('image/webp', 0.95);
    const newSticker: StickerItem = {
      id: 'custom_stk_' + Date.now(),
      packId: 'my-stickers',
      name: stickerName.trim() || 'Custom Sticker',
      emoji: selectedEmoji,
      url: dataUrl,
      isCustom: true
    };
    return newSticker;
  };

  const handleSaveSticker = () => {
    const sticker = generateStickerItem();
    if (!sticker) return;
    addCustomSticker(sticker);
    if (onStickerCreated) {
      onStickerCreated(sticker);
    }
    onClose();
  };

  const handleSaveAndSend = async () => {
    const sticker = generateStickerItem();
    if (!sticker) return;
    addCustomSticker(sticker);
    if (onStickerCreated) {
      onStickerCreated(sticker);
    }
    await sendSticker(sticker);
    onClose();
  };

  const handleDownloadForTelegram = () => {
    if (!canvasRef.current) return;
    // Telegram @Stickers requires 512x512 WebP or PNG with transparent background
    const link = document.createElement('a');
    link.download = `${stickerName.replace(/\s+/g, '_')}_512x512.webp`;
    link.href = canvasRef.current.toDataURL('image/webp', 0.98);
    link.click();
  };

  return (
    <div
      onPaste={handlePaste}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div
        className={`w-full max-w-2xl rounded-3xl p-5 sm:p-6 border shadow-2xl relative flex flex-col max-h-[92vh] animate-pop-in ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
            : 'bg-[#121318] border-white/10 text-white shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight flex items-center gap-2">
                <span>Telegram Sticker Studio</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>512x512 SPEC</span>
                </span>
              </h3>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Create custom stickers fully recognized by Telegram and your bot.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition btn-press"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Workspace: Left is Canvas Preview, Right is Controls */}
        <div className="flex-1 overflow-y-auto py-3 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {/* Left: 512x512 Canvas Preview (with Telegram checkerboard background) */}
          <div className="flex flex-col items-center">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden border-2 border-[var(--color-border)] shadow-2xl flex items-center justify-center bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] bg-[#0c0d12]">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
              />
              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-mono text-zinc-400">
                512 × 512 px (Telegram WebP)
              </span>
            </div>

            {/* Quick Upload / Replace Button */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-2 transition btn-press w-64 sm:w-72 justify-center"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>Upload Photo / Paste Image</span>
            </button>
          </div>

          {/* Right: Customization Controls */}
          <div className="space-y-3.5 text-xs">
            {/* Sticker Name & Emoji Binding */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                Sticker Name & Associated Emoji
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={stickerName}
                  onChange={(e) => setStickerName(e.target.value)}
                  placeholder="Sticker name"
                  maxLength={24}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:border-[var(--color-accent)] outline-none"
                />
                <div className="relative">
                  <span className="text-xl px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 inline-block select-none cursor-default">
                    {selectedEmoji}
                  </span>
                </div>
              </div>

              {/* Emoji quick selector */}
              <div className="flex flex-wrap gap-1 pt-1">
                {POPULAR_EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setSelectedEmoji(em)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition ${
                      selectedEmoji === em
                        ? 'bg-[var(--color-accent)]/20 ring-1 ring-[var(--color-accent)] scale-110'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Transform Controls (Zoom & Rotation) */}
            <div className="p-3 rounded-2xl bg-black/30 border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <span>Scale / Zoom</span>
                </span>
                <span className="font-mono text-[var(--color-accent)]">{Math.round(scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.0"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full accent-[var(--color-accent)] cursor-pointer"
              />

              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300 pt-1">
                <span className="flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <span>Rotation</span>
                </span>
                <span className="font-mono text-[var(--color-accent)]">{rotation}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value))}
                className="w-full accent-[var(--color-accent)] cursor-pointer"
              />
            </div>

            {/* Telegram Sticker Effects (Iconic White Die-cut Outline & Shadow) */}
            <div className="p-3 rounded-2xl bg-black/30 border border-white/5 space-y-2">
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                Telegram Signature Effects
              </span>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-xs font-medium text-white flex items-center gap-1.5">
                  <span>White Die-Cut Contour</span>
                </span>
                <input
                  type="checkbox"
                  checked={hasWhiteOutline}
                  onChange={(e) => setHasWhiteOutline(e.target.checked)}
                  className="rounded accent-[var(--color-accent)] w-4 h-4 cursor-pointer"
                />
              </label>

              {hasWhiteOutline && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-zinc-400">Outline Width:</span>
                  <input
                    type="range"
                    min="2"
                    max="16"
                    value={outlineWidth}
                    onChange={(e) => setOutlineWidth(parseInt(e.target.value))}
                    className="flex-1 accent-[var(--color-accent)] cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-zinc-400">{outlineWidth}px</span>
                </div>
              )}

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-xs font-medium text-white">Soft Floating Shadow</span>
                <input
                  type="checkbox"
                  checked={hasShadow}
                  onChange={(e) => setHasShadow(e.target.checked)}
                  className="rounded accent-[var(--color-accent)] w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-xs font-medium text-white">Transparent Canvas (Telegram Standard)</span>
                <input
                  type="checkbox"
                  checked={transparentBg}
                  onChange={(e) => setTransparentBg(e.target.checked)}
                  className="rounded accent-[var(--color-accent)] w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            {/* Text Overlay */}
            <div>
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">
                Meme Text Caption (Optional)
              </label>
              <input
                type="text"
                value={stickerText}
                onChange={(e) => setStickerText(e.target.value)}
                placeholder="e.g. APPROVED, WOW, LOL"
                maxLength={20}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:border-[var(--color-accent)] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 select-none">
          {/* Download WebP for Telegram @Stickers bot */}
          <button
            onClick={handleDownloadForTelegram}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition btn-press"
            title="Download official 512x512 WebP sticker file"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Download 512px WebP</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleSaveSticker}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition btn-press"
            >
              Save to My Stickers
            </button>

            {activeChat && (
              <button
                onClick={handleSaveAndSend}
                className="px-4 py-2 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-text)] text-xs font-bold flex items-center gap-1.5 shadow-md btn-press"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save & Send in Chat</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
