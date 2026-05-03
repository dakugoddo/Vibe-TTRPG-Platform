import { useState, useRef, useEffect } from 'react';
import { yjsStore } from '../../../store/yjsStore';
import type { Entity } from '../../../types';
import { glass } from '../../../utils/theme';
import { Image as ImageIcon, Upload, X, AlertTriangle, User, Box, Sword, Wand2, Map, FileText, Bookmark } from 'lucide-react';
import { getIsHost } from '../../../services/fileApi';

interface EntityImageBlockProps {
    entity: Entity;
    isWide?: boolean;
}

const TYPE_ICONS: Record<string, React.FC<any>> = {
    character: User,
    object: Box,
    attack: Sword,
    spell: Wand2,
    canvas: Map,
    note: FileText,
    tag: Bookmark,
    folder: Bookmark,
};

export function EntityImageBlock({ entity, isWide = false }: EntityImageBlockProps) {
    const isHost = getIsHost();
    const [imageError, setImageError] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [tempUrl, setTempUrl] = useState(entity.icon_url || '');
    const [availableImages, setAvailableImages] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const Icon = TYPE_ICONS[entity.type] || ImageIcon;

    useEffect(() => {
        setTempUrl(entity.icon_url || '');
        setImageError(false);
    }, [entity.icon_url]);

    useEffect(() => {
        if (isEditing && isHost) {
            fetch('http://localhost:3001/api/assets')
                .then(res => res.json())
                .then(data => setAvailableImages(Array.isArray(data) ? data : []))
                .catch(err => console.error("Failed to load assets list", err));
        }
    }, [isEditing, isHost]);

    const handleSave = () => {
        yjsStore.updateEntity(entity.id, { icon_url: tempUrl });
        setIsEditing(false);
    };

    const handleRemove = () => {
        yjsStore.updateEntity(entity.id, { icon_url: '' });
        setIsEditing(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !isHost) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = (reader.result as string).split(',')[1];
            try {
                const res = await fetch('http://localhost:3001/api/assets/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        base64: base64String
                    })
                });
                const data = await res.json();
                if (data.success) {
                    const newUrl = data.filename; // Only save the filename for portability
                    yjsStore.updateEntity(entity.id, { icon_url: newUrl });
                    setIsEditing(false);
                }
            } catch (err) {
                console.error("Upload error", err);
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    // Calculate full URL for img src
    let fullUrl = entity.icon_url;
    if (fullUrl && !fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
        fullUrl = `http://localhost:3001/api/assets/${fullUrl}`;
    }

    return (
        <div className={`relative mb-4 flex-shrink-0 group overflow-hidden ${glass.blockBg} border border-white/5 shadow-md flex flex-col justify-center items-center ${isWide ? 'h-40 w-full rounded-xl mx-auto' : 'h-48 w-48 rounded-2xl mx-auto'}`}>
            
            {entity.icon_url ? (
                imageError ? (
                    <div className="flex flex-col items-center justify-center text-red-400 opacity-60">
                        <AlertTriangle size={32} className="mb-2" />
                        <span className="text-xs font-bold text-center px-4">Ссылка недействительна или изображение удалено</span>
                    </div>
                ) : (
                    <img 
                        src={fullUrl} 
                        onError={() => setImageError(true)} 
                        alt={entity.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                )
            ) : (
                <div className="flex flex-col items-center justify-center text-white/20">
                    <Icon size={isWide ? 64 : 48} strokeWidth={1.5} />
                    <span className="text-[10px] mt-2 font-bold tracking-widest uppercase opacity-50">НЕТ ФОТО</span>
                </div>
            )}

            {/* Hover overlay for editing */}
            <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center transition-all duration-300 ${isEditing ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'}`}>
                
                {!isEditing ? (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                        className="px-4 py-2 bg-black/50 hover:bg-white/20 text-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.5)] font-bold text-xs backdrop-blur-md transition-all border border-white/20 hover:border-white/50"
                    >
                        Изменить фото
                    </button>
                ) : (
                    <div className="w-full h-full p-4 flex flex-col gap-2 relative bg-black/40" onClick={e => e.stopPropagation()}>
                        {/* Close button */}
                        <button onClick={() => setIsEditing(false)} className="absolute top-2 right-2 text-white/50 hover:text-white bg-black/50 rounded-full p-1" title="Отмена">
                            <X size={14} />
                        </button>

                        <div className="text-xs font-bold text-white/70 mb-1 uppercase tracking-wider text-center pt-2">Настройки изображения</div>

                        <div className="flex flex-col gap-2 w-full max-w-sm mx-auto overflow-y-auto custom-scrollbar">
                            {/* URL/Filename input */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={tempUrl}
                                    onChange={(e) => setTempUrl(e.target.value)}
                                    placeholder="Имя файла или URL..."
                                    className={`${glass.input} w-full text-xs py-1.5 px-2`}
                                />
                            </div>

                            {/* Dropdown for existing files */}
                            {isHost && availableImages.length > 0 && (
                                <select 
                                    className={`${glass.input} w-full text-xs py-1.5 px-2 text-white/70 bg-black/50 cursor-pointer`}
                                    onChange={(e) => setTempUrl(e.target.value)}
                                    value=""
                                >
                                    <option value="" disabled>...или выберите существующее</option>
                                    {availableImages.map(img => (
                                        <option key={img} value={img}>{img}</option>
                                    ))}
                                </select>
                            )}
                            
                            <div className="flex gap-2 mt-1">
                                <button 
                                    onClick={handleSave}
                                    className="flex-1 py-1.5 bg-white/20 text-white rounded-md text-xs font-bold border border-white/20 hover:bg-white/30 transition-colors shadow-sm"
                                >
                                    Сохранить ссылку
                                </button>
                                {entity.icon_url && (
                                    <button 
                                        onClick={handleRemove}
                                        className="py-1.5 px-3 bg-red-500/20 text-red-500 hover:text-red-400 hover:bg-red-500/30 rounded-md text-xs font-bold border border-red-500/20 transition-colors"
                                        title="Удалить привязку к фото (файл останется)"
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>

                            {isHost && (
                                <div className="mt-2 border-t border-white/10 pt-3 relative">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileUpload} 
                                        accept="image/*" 
                                        className="hidden" 
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className={`w-full py-1.5 text-white rounded-md text-xs font-bold border border-white/20 transition-colors flex items-center justify-center gap-2 ${isUploading ? 'bg-white/10 opacity-50' : 'bg-black/50 hover:bg-white/20'}`}
                                    >
                                        <Upload size={14} />
                                        {isUploading ? 'Загрузка...' : 'Загрузить новое фото'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
        </div>
    );
}
